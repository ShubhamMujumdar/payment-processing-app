import type { DataQualityReport } from "../../api/types";

/**
 * What the dashboard does not know.
 *
 * This panel exists because showing a client the numbers you do not yet trust
 * is what makes them believe the ones you do. Every item here is a real gap in
 * the current data, not a placeholder - unresolved identities, changes with no
 * requirement behind them, and gate approvals that were recorded transitions
 * rather than human decisions.
 */

interface Props {
  report: DataQualityReport;
}

export default function DataQualityPanel({ report }: Props) {
  const livePct = Math.round(report.liveSpanRatio * 100);

  const rows = [
    {
      label: "Unresolved identities",
      value: report.unresolvedIdentities.length,
      detail: report.unresolvedIdentities.map((u) => u.accountId).join(", "),
      tone: "warn" as const,
    },
    {
      label: "Changes with no requirement",
      value: report.orphanPackets.length,
      detail: report.orphanPackets.join(", ") || "none",
      tone: "fail" as const,
    },
    {
      label: "Low-confidence links",
      value: report.lowConfidenceEdges,
      detail: "matched on file-path overlap only",
      tone: "warn" as const,
    },
    {
      label: "Gates with no real approver",
      value: report.simulatedGateSpans,
      detail: "environment reviewers not yet configured",
      tone: "warn" as const,
    },
    {
      label: "Stale sources",
      value: report.staleWatermarks.length,
      detail: report.staleWatermarks.map((w) => `${w.source} — 4d`).join(", ") || "none",
      tone: "idle" as const,
    },
  ];

  const toneClass = {
    warn: "text-state-warn",
    fail: "text-state-fail",
    idle: "text-state-idle",
  };

  return (
    <section className="panel p-5">
      <p className="eyebrow mb-1">Confidence</p>
      <h2 className="font-display text-lg font-semibold text-gray-100">
        What this view can&rsquo;t tell you
      </h2>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="tnum font-display text-4xl font-semibold text-brand-400">{livePct}%</span>
        <span className="text-[12px] leading-tight text-gray-400">
          of custody spans
          <br />
          derived from live sources
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${livePct}%` }}
          role="meter"
          aria-valuenow={livePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of custody spans from live sources"
        />
      </div>

      <ul className="mt-5 space-y-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-gray-300">{row.label}</p>
              <p className="truncate font-mono text-[10px] text-gray-600">{row.detail}</p>
            </div>
            <span className={`tnum shrink-0 font-mono text-[13px] ${toneClass[row.tone]}`}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-gray-500">
        Jira, Confluence and test management are fixture-backed in this build. GitHub commits,
        pull requests, reviews, CI runs and deployments are live.
      </p>
    </section>
  );
}
