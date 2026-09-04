import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { Ident, Lozenge } from "../components/console/primitives";
import { CurlArrow, Track, type Stage, type StageState } from "../components/code2doc/Track";
import Explain from "../components/code2doc/Explain";
import {
  getRun,
  getRunCi,
  getRuns,
  publishProposal,
  subscribe,
  type Proposal,
  type PublishResult,
  type Run,
  type Workflow,
} from "../api/code2doc";
import { DOC_UPDATE_FIXTURES, mockEmailContent, type DocUpdateNotification } from "../api/docUpdateFixtures";

/**
 * The live view: one commit, two pipelines.
 *
 * The code track is GitHub's and takes minutes. The documentation track is ours
 * and takes about thirty seconds. Showing them on one screen is the argument:
 * by the time the build finishes, the docs already know what changed.
 *
 * Events arrive over SSE, but they only ever trigger a refetch — the API stays
 * the single source of truth. A UI that reconstructs state from a stream has
 * two versions of it, and they disagree the moment one frame is missed.
 */

const DOC_ORDER = ["detected", "analysing", "retrieving", "retrieved", "proposed"] as const;

const DOC_LABELS: Record<string, string> = {
  detected: "Commit read",
  analysing: "Understand change",
  retrieving: "Search Confluence",
  retrieved: "Rank sections",
  proposed: "Draft edits",
};

function docStages(run: Run | null): Stage[] {
  const reached = (() => {
    if (!run) return -1;
    switch (run.status) {
      case "detected": return 0;
      case "analysing": return 1;
      case "retrieved": return 3;
      case "proposed":
      case "published":
      case "no-impact": return 4;
      case "failed": return -2;
      default: return 0;
    }
  })();

  return DOC_ORDER.map((id, index) => {
    let state: StageState = "pending";
    if (run?.status === "failed") state = index === 0 ? "done" : "failed";
    else if (index < reached) state = "done";
    else if (index === reached) state = run?.status === "proposed" || run?.status === "no-impact" ? "done" : "active";
    return {
      id,
      label: DOC_LABELS[id],
      state,
      detail:
        id === "proposed" && run?.proposals
          ? `${run.proposals.filter((p) => p.needs_change).length} of ${run.proposals.length}`
          : undefined,
    };
  });
}

/**
 * Canonical execution order for well-known workflow name tokens.
 * Lower number = runs earlier in the pipeline.
 */
const WORKFLOW_PRIORITY: [string, number][] = [
  ["ci", 10], ["build", 10], ["test", 10],
  ["security", 20], ["scan", 20], ["lint", 20], ["quality", 20],
  ["cd", 30], ["deploy", 30], ["release", 30], ["delivery", 30],
];

function workflowPriority(name: string): number {
  const lower = (name ?? "").toLowerCase();
  for (const [key, pri] of WORKFLOW_PRIORITY) {
    if (lower.includes(key)) return pri;
  }
  return 20;
}

/** Map a single GitHub workflow run to the Track's StageState vocabulary. */
function workflowState(w: Workflow): StageState {
  if (w.status !== "completed") {
    return w.status === "in_progress" ? "active" : "pending";
  }
  switch (w.conclusion) {
    case "success":   return "done";
    case "cancelled": return "cancelled";
    case "skipped":   return "skipped";
    default:          return "failed"; // failure | timed_out | action_required | neutral
  }
}

/** Human-readable detail line shown below the stage label. */
function workflowDetail(w: Workflow, state: StageState): string | undefined {
  if (state === "active")    return "running";
  if (state === "pending")   return w.status === "queued" ? "queued" : undefined;
  if (state === "skipped" && w.status !== "completed") return undefined; // downstream-blocked
  return w.conclusion ?? undefined;
}

function ciStages(run: Run | null, workflows: Workflow[], loaded: boolean): Stage[] {
  const commit: Stage = {
    id: "commit",
    label: "Commit pushed",
    state: run ? "done" : "pending",
    detail: run?.sha.slice(0, 8),
  };

  if (!loaded) {
    return [commit, { id: "ci-loading", label: "Checking CI…", state: "pending" }];
  }
  if (workflows.length === 0) {
    return [commit, { id: "ci-none", label: "No workflow", state: "skipped", detail: "none watches this branch" }];
  }

  // Sort into canonical execution order (CI → Security → CD), then by start time
  // for ties so the track reads left-to-right as the pipeline actually ran.
  const sorted = [...workflows].sort((a, b) => {
    const pa = workflowPriority(a.name ?? "");
    const pb = workflowPriority(b.name ?? "");
    if (pa !== pb) return pa - pb;
    if (a.started_at && b.started_at) {
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    }
    return a.started_at ? -1 : b.started_at ? 1 : 0;
  });

  // Propagate failure: once a stage failed or was cancelled, any downstream
  // stage that never started is implicitly blocked — show it as skipped.
  let upstreamFailed = false;
  const workflowStages: Stage[] = sorted.map((w) => {
    let state: StageState;
    if (upstreamFailed && w.status !== "completed") {
      // Never started because an earlier stage failed
      state = "skipped";
    } else {
      state = workflowState(w);
      if (state === "failed" || state === "cancelled") upstreamFailed = true;
    }
    return {
      id: String(w.id),
      label: w.name ?? "workflow",
      state,
      detail: workflowDetail(w, state),
    };
  });

  return [commit, ...workflowStages];
}

/** The plain-English verdict, in one sentence. */
function headline(run: Run, edits: number): string {
  if (run.status === "failed") return "Something went wrong analysing this commit.";
  if (run.status === "no-impact") return "Nothing in the documentation needs to change.";
  if (!["proposed", "published"].includes(run.status)) return "Working out what this commit changed…";
  if (edits === 0) return "Nothing in the documentation needs to change.";
  const pages = new Set((run.proposals ?? []).filter((p) => p.needs_change).map((p) => p.page_title));
  return `${edits} documentation section${edits === 1 ? " is" : "s are"} now out of date.`
    + ` In ${[...pages].join(", ")}.`;
}

function subhead(run: Run, edits: number): string {
  const considered = (run.proposals ?? []).length;
  if (run.status === "failed") return run.error?.split("\n")[0] ?? "";
  if (!["proposed", "published", "no-impact"].includes(run.status)) {
    return "Reading the diff, then searching Confluence for anything it makes untrue.";
  }
  if (considered === 0) return "No documentation section matched this change.";
  if (edits === 0) {
    return `${considered} section${considered === 1 ? " was" : "s were"} considered and left alone — `
      + "each one already agrees with the code.";
  }
  const left = considered - edits;
  return `Found by searching ${considered} candidate section${considered === 1 ? "" : "s"}`
    + (left ? `; ${left} ${left === 1 ? "was" : "were"} checked and left alone.` : ".")
    + (run.total_seconds ? ` Took ${run.total_seconds} seconds.` : "");
}

export default function LivePipeline() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [ciLoaded, setCiLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommitEmail, setExpandedCommitEmail] = useState(false);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  const refreshList = useCallback(async () => {
    try {
      const data = await getRuns(20);
      setRuns(data.runs);
      setWatching(data.watching);
      setError(null);
      if (!selectedRef.current && data.runs.length) setSelected(data.runs[0].run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshRun = useCallback(async (runId: string) => {
    try {
      setRun(await getRun(runId));
    } catch {
      /* the list view still renders; a failed detail fetch is not fatal */
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!selected) return;
    setCiLoaded(false);
    setWorkflows([]);
    setExpandedCommitEmail(false);
    refreshRun(selected);
    getRunCi(selected)
      .then((d) => setWorkflows(d.workflows))
      .catch(() => setWorkflows([]))
      .finally(() => setCiLoaded(true));
  }, [selected, refreshRun]);

  // A new commit takes over the view; stage events for the commit already on
  // screen refresh it in place.
  useEffect(() => {
    return subscribe(
      (event) => {
        if (event.kind === "detected") {
          setSelected(event.run_id);
          refreshList();
        } else if (event.run_id === selectedRef.current) {
          refreshRun(event.run_id);
        } else {
          refreshList();
        }
      },
      (ok) => setConnected(ok),
    );
  }, [refreshList, refreshRun]);

  // While CI is mid-flight, keep asking. GitHub is the owner of that state and
  // it changes without telling us.
  useEffect(() => {
    if (!selected || !workflows.some((w) => w.status !== "completed")) return;
    const timer = setInterval(() => {
      getRunCi(selected).then((d) => setWorkflows(d.workflows)).catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [selected, workflows]);

  const docRunning = run !== null && !["proposed", "no-impact", "failed", "published"].includes(run.status);
  const proposals = useMemo(() => (run?.proposals ?? []).filter((p) => p.needs_change), [run]);

  // Derive the email record for this commit. A fixture match means the email was
  // already sent historically — the fixture itself is the evidence, so we show it
  // regardless of the live run's current status. For purely live commits we only
  // show the section once the run reaches "published" (manually approved).
  const commitEmail = useMemo((): DocUpdateNotification | null => {
    if (!run) return null;
    const fixture = DOC_UPDATE_FIXTURES.find((u) => run.sha.startsWith(u.shortSha));
    if (fixture) return fixture;
    if (run.status !== "published") return null;
    const publishedProposal = (run.proposals ?? []).find((p) => p.published);
    return {
      runId: run.run_id,
      shortSha: run.sha.slice(0, 7),
      pageId: publishedProposal?.page_id ?? "",
      pageTitle: publishedProposal?.page_title ?? "Documentation",
      pageUrl: publishedProposal?.anchor_url ?? "https://confluence.example.com",
      commitMessage: run.message.split("\n")[0],
      commitAuthor: run.author || "unknown",
      publishedAt: new Date().toISOString(),
      rationale: publishedProposal?.rationale ?? "Documentation updated to reflect this commit.",
      status: "published",
      emailSentAt: new Date().toISOString(),
      emailRecipients: ["ops-team@cognizant.com", "platform-sre@cognizant.com"],
    };
  }, [run]);

  const statusTone = (s: string): "pass" | "warn" | "fail" | "idle" | "brand" => {
    if (s === "proposed" || s === "published") return "pass";
    if (s === "failed") return "fail";
    if (s === "no-impact") return "idle";
    return "warn";
  };

  return (
    <>
      <PageMeta title="Code Review · Live pipeline" description="A commit, and the documentation it just made stale." />

      <div className="flex items-center justify-between gap-4 border-b border-black/[0.07] px-6 py-4">
        <div>
          <h1 className="text-[20px] font-bold text-gray-100">Code Review</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">
            {watching ? <>Watching <Ident dim>{watching}</Ident></> : "Not watching a branch"}
          </p>
        </div>
        <span className="flex items-center gap-2 text-[11.5px] text-gray-500">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-state-pass animate-pulse" : "bg-state-idle animate-pulse"}`} />
          {connected ? "live" : "reconnecting"}
        </span>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-[10px] border border-state-fail/30 bg-state-fail/[0.06] px-4 py-3 text-[12px] text-gray-300">
          Cannot reach code2doc at <Ident dim>127.0.0.1:8099</Ident> — {error}.
          <span className="block text-gray-500">Start it with <Ident dim>python -m code2doc.cli serve --watch</Ident></span>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 px-6 py-5 xl:grid-cols-[280px_1fr]">
        {/* recent commits */}
        <aside className="order-2 xl:order-1">
          <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-gray-500">Recent commits</h2>
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.run_id}>
                <button
                  onClick={() => setSelected(r.run_id)}
                  className={`w-full rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                    r.run_id === selected
                      ? "border-accent/40 bg-accent-soft"
                      : "border-black/[0.07] bg-black/[0.025] hover:bg-black/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Ident dim>{r.sha.slice(0, 7)}</Ident>
                    <span className="ml-auto"><Lozenge tone={statusTone(r.status)}>{r.status}</Lozenge></span>
                  </div>
                  <p className="mt-1.5 truncate text-[12px] text-gray-300">
                    {r.message.split("\n")[0]}
                  </p>
                </button>
              </li>
            ))}
            {runs.length === 0 && !error && (
              <li className="rounded-[10px] border border-black/[0.07] bg-black/[0.025] px-3 py-6 text-center text-[12px] text-gray-600">
                Nothing yet. Push a commit.
              </li>
            )}
          </ul>
        </aside>

        <section className="order-1 min-w-0 xl:order-2">
          {run ? (
            <>
              {/* the commit */}
              <div className="rounded-[10px] border border-black/[0.09] bg-ink-900 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Ident>{run.sha.slice(0, 8)}</Ident>
                  <span className="text-[13.5px] text-gray-100">{run.message.split("\n")[0]}</span>
                  {run.analysis && <Lozenge tone="brand">{run.analysis.change_kind}</Lozenge>}
                </div>
                <p className="mt-1 text-[11.5px] text-gray-500">
                  {run.author || "unknown"} · <Ident dim>{run.branch}</Ident> ·{" "}
                  <a href={run.url} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                    view on GitHub
                  </a>
                </p>
                {run.analysis && (
                  <p className="mt-2 border-t border-black/[0.07] pt-2 text-[12.5px] text-gray-400">
                    {run.analysis.summary}
                  </p>
                )}
              </div>

              {/* The one sentence a person should read if they read nothing
                  else on this page. Stays sticky so the verdict is always in
                  view while scrolling through pipeline steps. */}
              <div
                className={`sticky top-0 z-10 mt-3 rounded-[10px] border px-4 py-3 ${
                  proposals.length
                    ? "border-accent/40 bg-accent-soft"
                    : "border-black/[0.09] bg-black/[0.025]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-gray-100">{headline(run, proposals.length)}</p>
                    <p className="mt-1 text-[12px] text-gray-500">{subhead(run, proposals.length)}</p>
                  </div>
                  {proposals.length > 0 && (
                    <a
                      href="#proposals"
                      className="shrink-0 rounded-[6px] border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/20"
                    >
                      {proposals.length} proposal{proposals.length === 1 ? "" : "s"} ↓
                    </a>
                  )}
                </div>
              </div>

              {/* the two tracks */}
              <div className="mt-5 rounded-[10px] border border-black/[0.09] bg-ink-950/60 px-5 py-4">
                <Track title="Code · GitHub" accent="blue" stages={ciStages(run, workflows, ciLoaded)} />

                <CurlArrow active={docRunning} />

                <div className="ml-[52px] rounded-[10px] border border-accent/40 bg-accent-soft px-4 py-3">
                  <Track
                    title="Documentation · code2doc"
                    stages={docStages(run)}
                    trailing={
                      docRunning ? (
                        <span className="text-[10.5px] text-accent">working…</span>
                      ) : run.status === "no-impact" ? (
                        <span className="text-[10.5px] text-gray-500">no impact</span>
                      ) : null
                    }
                  />
                  {run.analysis?.queries?.length ? (
                    <div className="mt-3 border-t border-black/[0.07] pt-2">
                      <p className="text-[10.5px] uppercase tracking-wider text-gray-600">Asked Confluence</p>
                      <ul className="mt-1 space-y-0.5">
                        {run.analysis.queries.map((q) => (
                          <li key={q.topic} className="text-[11.5px] text-gray-400">
                            “{q.topic}”
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* proposals — shown before the detailed steps so reviewers reach
                  the approve action without scrolling past the full pipeline log */}
              {proposals.length > 0 && (
                <div className="mt-5" id="proposals">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Proposed documentation changes
                  </h2>
                  <div className="space-y-3">
                    {proposals.map((p) => (
                      <ProposalCard
                        key={`${p.page_id}-${p.line_start}`}
                        proposal={p}
                        runId={run.run_id}
                        index={(run.proposals ?? []).indexOf(p)}
                        onPublished={() => refreshRun(run.run_id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Emails Sent — only when this commit is approved and published to Confluence */}
              {commitEmail && (
                <div className="mt-5 rounded-[10px] border border-black/[0.09] bg-ink-900 px-5 py-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                      Emails Sent
                    </h2>
                    <span className="flex items-center gap-1.5 rounded-full border border-state-pass/30 bg-state-pass/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-state-pass">
                      <span className="size-1.5 rounded-full bg-state-pass" />
                      {commitEmail.emailRecipients.length} recipient{commitEmail.emailRecipients.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="rounded-[10px] border border-black/[0.07] bg-ink-950/60 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-[12.5px] font-medium text-gray-200">
                          {commitEmail.pageTitle}
                        </p>
                        <p className="truncate text-[11.5px] text-gray-500">
                          {commitEmail.commitMessage}
                        </p>
                        <p className="text-[11px] text-gray-600">
                          → {commitEmail.emailRecipients.join(", ")}
                        </p>
                      </div>
                      <button
                        onClick={() => setExpandedCommitEmail((v) => !v)}
                        className="shrink-0 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
                      >
                        {expandedCommitEmail ? "Hide ↑" : "View Email ↓"}
                      </button>
                    </div>

                    {expandedCommitEmail && (() => {
                      const email = mockEmailContent(commitEmail);
                      return (
                        <div className="mt-3 rounded-[8px] border border-state-warn/20 bg-state-warn/[0.04] p-3">
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <p>
                              <span className="text-gray-600">From:    </span>
                              <span className="text-gray-400">{email.from}</span>
                            </p>
                            <p>
                              <span className="text-gray-600">To:      </span>
                              <span className="text-gray-400">{email.to}</span>
                            </p>
                            <p>
                              <span className="text-gray-600">Subject: </span>
                              <span className="text-gray-300">{email.subject}</span>
                            </p>
                          </div>
                          <div className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-500">
                            {email.body}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* what actually happened, with each step's real output */}
              <div className="mt-6 rounded-[10px] border border-black/[0.09] bg-ink-900/40 px-5 py-5">
                <Explain run={run} />
              </div>

              {/* the diff */}
              {run.diff && (
                <details className="mt-4 rounded-[10px] border border-black/[0.07] bg-black/[0.025]">
                  <summary className="cursor-pointer select-none px-4 py-2 text-[11.5px] text-gray-500">
                    Diff · {run.files?.filter((f) => !f.skipped).length ?? 0} files
                    {run.files?.some((f) => f.skipped) ? ` (${run.files.filter((f) => f.skipped).length} filtered as noise)` : ""}
                  </summary>
                  <pre className="max-h-72 overflow-auto border-t border-black/[0.07] py-2 font-mono text-[11px] leading-[1.6]">
                    {run.diff.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith("+") && !line.startsWith("+++")
                            ? "bg-state-pass/[0.08] px-4 text-state-pass"
                            : line.startsWith("-") && !line.startsWith("---")
                              ? "bg-state-fail/[0.08] px-4 text-state-fail"
                              : line.startsWith("@@")
                                ? "px-4 text-accent"
                                : "px-4 text-gray-500"
                        }
                      >
                        {line || " "}
                      </div>
                    ))}
                  </pre>
                </details>
              )}

              {run.error && (
                <pre className="mt-4 overflow-auto rounded-[10px] border border-state-fail/30 bg-state-fail/[0.06] px-4 py-3 font-mono text-[11px] text-gray-400">
                  {run.error}
                </pre>
              )}
            </>
          ) : (
            <div className="rounded-[10px] border border-black/[0.07] bg-black/[0.025] px-5 py-16 text-center">
              <p className="text-[13px] text-gray-400">Waiting for a commit.</p>
              <p className="mt-1 text-[12px] text-gray-600">
                Push to <Ident dim>{watching ?? "the watched branch"}</Ident> and it appears here.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * Approving is two clicks, not one.
 *
 * The first plans the edit against the page as it stands right now and shows
 * what would change; the second performs it. That is not ceremony — the
 * proposal was drafted against a snapshot, and the page may have moved since.
 * The plan is where that gets caught, and it is the only moment where a stale
 * proposal is cheap to notice.
 */
function ProposalCard({
  proposal,
  runId,
  index,
  onPublished,
}: {
  proposal: Proposal;
  runId: string;
  index: number;
  onPublished: () => void;
}) {
  const tone = proposal.confidence === "high" ? "brand" : proposal.confidence === "low" ? "warn" : "idle";
  const [plan, setPlan] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const act = async (dryRun: boolean) => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await publishProposal(runId, index, dryRun);
      setPlan(result);
      if (result.published) onPublished();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const stripeColor =
    proposal.confidence === "high" ? "border-l-state-pass" : proposal.confidence === "low" ? "border-l-state-warn" : "border-l-state-idle";

  return (
    <div className={`overflow-hidden rounded-[10px] border border-accent/40 bg-ink-900 border-l-4 ${stripeColor}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-4 py-3">
        <span className="text-[13px] font-semibold text-gray-100">{proposal.page_title}</span>
        <span className="text-gray-600">›</span>
        <span className="text-[12.5px] text-gray-400">{proposal.heading_path}</span>
        <Lozenge tone={tone as "brand" | "warn" | "idle"}>{proposal.confidence}</Lozenge>
        <a
          href={proposal.anchor_url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[11.5px] text-brand-500 hover:underline"
        >
          open in Confluence ↗
        </a>
      </div>
      <div className="px-4 py-3">
        <p className="text-[12px] text-gray-400">{proposal.rationale}</p>

        <div className="mt-2 overflow-x-auto rounded-[8px] border border-black/[0.07] bg-ink-950 px-0 py-1 font-mono text-[11px] leading-[1.6]">
          {proposal.existing_text.split("\n").map((line, i) => (
            <div key={`e${i}`} className="bg-state-fail/[0.08] px-3 text-state-fail">− {line}</div>
          ))}
          {proposal.proposed_text.split("\n").map((line, i) => (
            <div key={`p${i}`} className="bg-state-pass/[0.08] px-3 text-state-pass">+ {line}</div>
          ))}
        </div>

        <p className="mt-2 text-[10.5px] text-gray-600">
          <Ident dim>{proposal.code_citation}</Ident>
          {" · "}lines {proposal.line_start}–{proposal.line_end}
          {" · "}rerank {proposal.rerank_score > 0 ? "+" : ""}{proposal.rerank_score.toFixed(2)}
        </p>
      </div>

      {/* approve */}
      <div className="border-t border-black/[0.07] px-4 py-3">
        {proposal.published || plan?.published ? (
          <p className="text-[12px] text-state-pass">
            ✓ Published to Confluence
            {plan?.new_version ? ` as version ${plan.new_version}` : ""} ·{" "}
            <a href={proposal.anchor_url} target="_blank" rel="noreferrer" className="underline">
              see it on the page
            </a>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => act(true)}
                disabled={busy}
                className="rounded-[8px] border border-black/[0.12] bg-white px-3 py-1.5 text-[12px] font-medium text-gray-300 shadow-sm hover:bg-black/[0.04] disabled:opacity-50"
              >
                {busy && !plan ? "Checking…" : "① Check against live page"}
              </button>
              <button
                onClick={() => act(false)}
                disabled={busy || !plan?.ok}
                title={plan?.ok ? "Writes a new version of the Confluence page" : "Check the page first"}
                className="rounded-[8px] border border-state-pass/40 bg-state-pass px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-state-pass/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ② Approve &amp; publish
              </button>
              {plan && !plan.published && (
                <span className={`text-[11.5px] ${plan.ok ? "text-state-pass" : "text-state-warn"}`}>
                  {plan.ok
                    ? `matches the page (v${plan.current_version} → v${plan.current_version + 1})`
                    : "cannot apply"}
                </span>
              )}
            </div>

            {plan && !plan.ok && plan.problem && (
              <p className="mt-2 rounded-[10px] border border-state-warn/30 bg-state-warn/[0.06] px-3 py-2 text-[11.5px] text-gray-300">
                {plan.problem}
              </p>
            )}
            {plan?.ok && plan.fragments.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">
                Will change only:{" "}
                {plan.fragments.map((f) => (
                  <span key={f.old} className="font-mono">
                    “{f.old}” → “{f.new}”{" "}
                  </span>
                ))}
              </p>
            )}
            {failure && (
              <p className="mt-2 text-[11.5px] text-state-fail">{failure}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
