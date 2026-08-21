import type { ReactNode } from "react";
import { Ident } from "../console/primitives";
import type { Run } from "../../api/code2doc";

/**
 * What actually happened, step by step, with each step's real output.
 *
 * The stage track above this shows *where* the pipeline is. It cannot show
 * *what it did*, and a dot labelled "Rank sections" tells a reader nothing.
 * So each step here prints its own evidence: the lines that changed, the
 * questions asked, the sections considered and how they scored, the decision
 * and its reason.
 *
 * Scores are shown as bars normalised to the best result in this search, not as
 * absolute confidence. That is deliberate and it is the honest encoding —
 * measured on two corpora, the same well-formed query scored +4.06 on one and
 * +2.97 on another, so an absolute number implies a precision the model does
 * not have. What is reliable is the ordering and the gap.
 */

function Step({
  index,
  title,
  what,
  seconds,
  badge,
  children,
}: {
  index: number;
  title: string;
  what: string;
  seconds?: number | null;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative pl-11">
      {/* the spine connecting steps */}
      <span className="absolute left-[13px] top-7 bottom-0 w-px bg-black/[0.09]" />
      <span className="absolute left-0 top-0 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-brand-700 bg-brand-950 text-[12px] font-medium text-brand-300">
        {index}
      </span>

      <div className="pb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[13.5px] font-medium text-gray-100">{title}</h3>
          {badge && <span className="text-[11.5px] text-brand-400">{badge}</span>}
          {seconds != null && (
            <span className="tnum ml-auto font-mono text-[11px] text-gray-600">{seconds}s</span>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] text-gray-500">{what}</p>
        <div className="mt-2.5">{children}</div>
      </div>
    </div>
  );
}

/** The +/- lines only. A reader wants the change, not the context lines. */
function changedLines(diff: string | null): { sign: string; text: string }[] {
  if (!diff) return [];
  return diff
    .split("\n")
    .filter(
      (l) =>
        (l.startsWith("+") && !l.startsWith("+++")) ||
        (l.startsWith("-") && !l.startsWith("---")),
    )
    .slice(0, 8)
    .map((l) => ({ sign: l[0], text: l.slice(1) }));
}

export default function Explain({ run }: { run: Run }) {
  const timing = (kind: string) => run.timeline?.find((t) => t.kind === kind)?.seconds ?? null;
  const proposals = run.proposals ?? [];
  const edits = proposals.filter((p) => p.needs_change);
  const lines = changedLines(run.diff);
  const files = (run.files ?? []).filter((f) => !f.skipped);
  const skipped = (run.files ?? []).filter((f) => f.skipped);

  // Bars are relative to the strongest result in this search.
  const scores = proposals.map((p) => p.rerank_score);
  const best = scores.length ? Math.max(...scores) : 0;
  const worst = scores.length ? Math.min(...scores) : 0;
  const width = (score: number) =>
    best === worst ? 100 : Math.max(6, ((score - worst) / (best - worst)) * 100);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-gray-500">
          What happened
        </h2>
        {run.total_seconds != null && (
          <span className="text-[11.5px] text-gray-600">
            start to finish, {run.total_seconds} seconds
          </span>
        )}
      </div>

      <Step
        index={1}
        title="Read the change"
        what="Pulled the commit from GitHub and threw away anything that cannot affect prose."
        seconds={timing("detected")}
        badge={`${files.length} file${files.length === 1 ? "" : "s"}${skipped.length ? ` · ${skipped.length} ignored` : ""}`}
      >
        {files.map((f) => (
          <p key={f.path} className="font-mono text-[11px] text-gray-500">
            {f.path}{" "}
            <span className="text-state-pass">+{f.additions}</span>{" "}
            <span className="text-state-fail">−{f.deletions}</span>
          </p>
        ))}
        {lines.length > 0 && (
          <div className="mt-2 overflow-x-auto rounded border border-black/[0.07] bg-ink-950 px-3 py-2 font-mono text-[11px] leading-[1.6]">
            {lines.map((l, i) => (
              <div key={i} className={l.sign === "+" ? "text-state-pass" : "text-state-fail"}>
                {l.sign} {l.text.trim()}
              </div>
            ))}
          </div>
        )}
        {skipped.length > 0 && (
          <p className="mt-2 text-[11px] text-gray-600">
            Ignored: {skipped.map((f) => `${f.path} (${f.reason})`).join(", ")}
          </p>
        )}
      </Step>

      <Step
        index={2}
        title="Worked out what it means"
        what="An LLM reads the diff and states the change in business terms, then decides whether prose could be affected at all."
        seconds={timing("analysing")}
        badge={run.analysis?.change_kind}
      >
        {run.analysis ? (
          <p className="rounded border border-black/[0.07] bg-black/[0.025] px-3 py-2 text-[12.5px] text-gray-300">
            “{run.analysis.summary}”
          </p>
        ) : (
          <p className="text-[12px] text-gray-600">…</p>
        )}
      </Step>

      <Step
        index={3}
        title="Asked the documentation"
        what="Queries describe the SUBJECT the change touches, never the change itself — documentation states what a system is, it never narrates edits."
        seconds={timing("retrieving")}
        badge={`${run.analysis?.queries.length ?? 0} questions`}
      >
        <ul className="space-y-1">
          {(run.analysis?.queries ?? []).map((q) => (
            <li key={q.topic} className="rounded border border-black/[0.07] bg-black/[0.025] px-3 py-1.5">
              <p className="text-[12px] text-gray-300">“{q.topic}”</p>
              <p className="mt-0.5 text-[11px] text-gray-600">{q.rationale}</p>
            </li>
          ))}
        </ul>
      </Step>

      <Step
        index={4}
        title="Ranked what came back"
        what="Every section in Confluence is scored against each question, then re-scored by a model that reads question and section together. Bars are relative to the best match here."
        seconds={timing("retrieved")}
        badge={`${proposals.length} candidates`}
      >
        <ul className="space-y-1.5">
          {proposals.map((p, i) => (
            <li key={`${p.page_id}-${p.line_start}`} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-right font-mono text-[11px] text-gray-600">
                {i + 1}
              </span>
              <span className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-black/[0.07]">
                <span
                  className={`block h-full rounded-full ${p.needs_change ? "bg-brand-500" : "bg-ink-500"}`}
                  style={{ width: `${width(p.rerank_score)}%` }}
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-gray-300">
                {p.heading_path}
              </span>
              <span className="shrink-0 truncate text-[11px] text-gray-600">{p.page_title}</span>
            </li>
          ))}
        </ul>
      </Step>

      <Step
        index={5}
        title="Decided, section by section"
        what="Each candidate is shown to the model with the diff. Leaving a section alone is a valid answer, and it has to give a reason either way."
        seconds={timing("proposed")}
        badge={`${edits.length} to change · ${proposals.length - edits.length} left alone`}
      >
        <ul className="space-y-1.5">
          {proposals.map((p) => (
            <li
              key={`${p.page_id}-${p.line_start}`}
              className={`rounded border px-3 py-2 ${
                p.needs_change ? "border-brand-800/60 bg-brand-950/25" : "border-black/[0.07] bg-black/[0.025]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={p.needs_change ? "text-brand-400" : "text-gray-600"}>
                  {p.needs_change ? "✎" : "✓"}
                </span>
                <span className="text-[12px] text-gray-300">{p.heading_path}</span>
                <span className="ml-auto text-[11px] text-gray-600">
                  {p.needs_change ? "needs changing" : "already correct"}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-gray-500">{p.rationale}</p>
            </li>
          ))}
        </ul>
        {run.status === "no-impact" && (
          <p className="mt-2 rounded border border-black/[0.07] bg-black/[0.025] px-3 py-2 text-[12px] text-gray-400">
            Nothing in the documentation is made untrue by this change.
          </p>
        )}
      </Step>

      <div className="pl-11 text-[11px] text-gray-600">
        Every number above came from this run. Nothing here is pre-recorded — see{" "}
        <Ident dim>demo/data/runs.sqlite</Ident>.
      </div>
    </div>
  );
}
