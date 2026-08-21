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

function ciStages(run: Run | null, workflows: Workflow[], loaded: boolean): Stage[] {
  const commit: Stage = { id: "commit", label: "Commit pushed", state: run ? "done" : "pending", detail: run?.sha.slice(0, 8) };
  if (!loaded) return [commit, { id: "ci", label: "Checking CI…", state: "pending" }];
  if (workflows.length === 0) {
    return [
      commit,
      {
        id: "none",
        label: "No workflow",
        state: "skipped",
        detail: "none watches this branch",
      },
    ];
  }
  return [
    commit,
    ...workflows.map((w) => ({
      id: String(w.id),
      label: w.name || "workflow",
      state: (w.status !== "completed"
        ? "active"
        : w.conclusion === "success"
          ? "done"
          : "failed") as StageState,
      detail: w.status === "completed" ? (w.conclusion ?? undefined) : w.status.replace("_", " "),
    })),
  ];
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

  return (
    <>
      <PageMeta title="Code Review · Live pipeline" description="A commit, and the documentation it just made stale." />

      <div className="flex items-center justify-between gap-4 border-b border-black/[0.07] px-6 py-4">
        <div>
          <h1 className="text-[19px] font-semibold text-gray-100">Code Review</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">
            {watching ? <>Watching <Ident dim>{watching}</Ident></> : "Not watching a branch"}
          </p>
        </div>
        <span className="flex items-center gap-2 text-[11.5px] text-gray-500">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-state-pass" : "bg-state-idle"}`} />
          {connected ? "live" : "reconnecting"}
        </span>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-[10px] border border-state-fail/30 bg-state-fail/[0.06] px-4 py-3 text-[12px] text-gray-300">
          Cannot reach code2doc at <Ident dim>127.0.0.1:8099</Ident> — {error}.
          <span className="block text-gray-500">Start it with <Ident dim>python -m code2doc.cli serve --watch</Ident></span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 px-6 py-5 xl:grid-cols-[240px_1fr]">
        {/* recent commits */}
        <aside className="order-2 xl:order-1">
          <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-gray-500">Recent commits</h2>
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.run_id}>
                <button
                  onClick={() => setSelected(r.run_id)}
                  className={`w-full rounded-[10px] border px-3 py-2 text-left transition-colors ${
                    r.run_id === selected
                      ? "border-accent/40 bg-accent-soft"
                      : "border-black/[0.07] bg-black/[0.025] hover:bg-black/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Ident dim>{r.sha.slice(0, 7)}</Ident>
                    <span className="ml-auto text-[10.5px] text-gray-600">{r.status}</span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-gray-300">
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
                  else on this page. */}
              <div
                className={`mt-3 rounded-[10px] border px-4 py-3 ${
                  proposals.length
                    ? "border-accent/40 bg-accent-soft"
                    : "border-black/[0.09] bg-black/[0.025]"
                }`}
              >
                <p className="text-[14px] text-gray-100">{headline(run, proposals.length)}</p>
                <p className="mt-1 text-[12px] text-gray-500">{subhead(run, proposals.length)}</p>
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

              {/* what actually happened, with each step's real output */}
              <div className="mt-6 rounded-[10px] border border-black/[0.09] bg-ink-900/40 px-5 py-5">
                <Explain run={run} />
              </div>

              {/* proposals */}
              {proposals.length > 0 && (
                <div className="mt-5">
                  <h2 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.14em] text-gray-500">
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

              {/* the diff */}
              {run.diff && (
                <details className="mt-4 rounded-[10px] border border-black/[0.07] bg-black/[0.025]" open>
                  <summary className="cursor-pointer px-4 py-2 text-[11.5px] text-gray-500">
                    Diff · {run.files?.filter((f) => !f.skipped).length ?? 0} files
                    {run.files?.some((f) => f.skipped) ? ` (${run.files.filter((f) => f.skipped).length} filtered as noise)` : ""}
                  </summary>
                  <pre className="max-h-72 overflow-auto border-t border-black/[0.07] px-4 py-3 font-mono text-[11px] leading-[1.5]">
                    {run.diff.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith("+") && !line.startsWith("+++")
                            ? "text-state-pass"
                            : line.startsWith("-") && !line.startsWith("---")
                              ? "text-state-fail"
                              : line.startsWith("@@")
                                ? "text-accent"
                                : "text-gray-500"
                        }
                      >
                        {line || " "}
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

  return (
    <div className="rounded-[10px] border border-accent/40 bg-ink-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-gray-200">{proposal.page_title}</span>
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

      <p className="mt-2 text-[12px] text-gray-400">{proposal.rationale}</p>

      <div className="mt-2 overflow-x-auto rounded-[10px] border border-black/[0.07] bg-ink-950 px-3 py-2 font-mono text-[11px] leading-[1.6]">
        {proposal.existing_text.split("\n").map((line, i) => (
          <div key={`e${i}`} className="text-state-fail">− {line}</div>
        ))}
        {proposal.proposed_text.split("\n").map((line, i) => (
          <div key={`p${i}`} className="text-state-pass">+ {line}</div>
        ))}
      </div>

      <p className="mt-2 text-[10.5px] text-gray-600">
        <Ident dim>{proposal.code_citation}</Ident>
        {" · "}lines {proposal.line_start}–{proposal.line_end}
        {" · "}rerank {proposal.rerank_score > 0 ? "+" : ""}{proposal.rerank_score.toFixed(2)}
      </p>

      {/* approve */}
      <div className="mt-3 border-t border-black/[0.07] pt-3">
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
                className="rounded-[10px] border border-black/[0.10] bg-black/[0.05] px-3 py-1.5 text-[12px] text-gray-300 hover:bg-black/[0.09] disabled:opacity-50"
              >
                {busy && !plan ? "Checking…" : "Check against the live page"}
              </button>
              <button
                onClick={() => act(false)}
                disabled={busy || !plan?.ok}
                title={plan?.ok ? "Writes a new version of the Confluence page" : "Check the page first"}
                className="rounded-[10px] border border-accent/40 bg-accent/70 px-3 py-1.5 text-[12px] text-accent hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Approve &amp; publish
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
