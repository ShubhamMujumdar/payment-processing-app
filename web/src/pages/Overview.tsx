import { useEffect, useMemo, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import StagePipeline from "../components/spine/StagePipeline";
import CustodyRibbon from "../components/spine/CustodyRibbon";
import DataQualityPanel from "../components/spine/DataQualityPanel";
import { getPortfolio } from "../api/client";
import type { PortfolioSummary } from "../api/types";
import { duration } from "../lib/format";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export default function Overview() {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPortfolio()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not reach the spine"));
  }, []);

  // Attention order: what has been held longest without moving, since that is
  // the question this page exists to answer.
  const attention = useMemo(() => {
    if (!data) return [];
    return [...data.packets]
      .filter((p) => p.currentStageId !== "PRODUCTION")
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);
  }, [data]);

  const headline = useMemo(() => {
    if (!data) return null;
    const active = data.packets.filter((p) => p.currentStageId !== "PRODUCTION");
    const overdue = active.filter((p) => p.spans[p.spans.length - 1].isOverdue);
    const gateWaits = active.filter(
      (p) => data.stages.find((s) => s.id === p.currentStageId)?.isGate,
    );
    const longest = active.length
      ? Math.max(...active.map((p) => p.spans[p.spans.length - 1].calendarAdjustedSeconds))
      : 0;
    return { active: active.length, overdue: overdue.length, gateWaits: gateWaits.length, longest };
  }, [data]);

  if (error) {
    return (
      <div className="panel p-8">
        <p className="eyebrow mb-2">Not connected</p>
        <h2 className="font-display text-lg text-gray-100">The spine did not respond</h2>
        <p className="mt-2 max-w-prose text-[13px] text-gray-400">
          {error}. Start the API, or set <code className="font-mono text-brand-400">VITE_SPINE_MODE=fixtures</code>{" "}
          to work against seeded data.
        </p>
      </div>
    );
  }

  if (!data || !headline) {
    return (
      <div className="space-y-4">
        <div className="h-[220px] animate-pulse rounded-xl bg-white/[0.03]" />
        <div className="h-[420px] animate-pulse rounded-xl bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Portfolio overview — SDLC Spine"
        description="Accountability, custody and traceability across the Payments Platform delivery pipeline"
      />

      <header className="mb-6">
        <p className="eyebrow mb-2">
          Payments Platform · R2 · Sprint R2-S4 · {DATE_FMT.format(new Date(data.windowStart))} –{" "}
          {DATE_FMT.format(new Date(data.windowEnd))}
        </p>

        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          {headline.active} items in flight,{" "}
          <span className="text-state-warn">{headline.gateWaits} waiting on a person</span>
        </h1>

        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-gray-400">
          Every figure below is custody time — how long a work item sat with a named individual at
          a named stage, counted only during working hours. The longest single hold right now is{" "}
          <span className="tnum font-mono text-gray-200">{duration(headline.longest)}</span>.
        </p>
      </header>

      <div className="space-y-4">
        <StagePipeline stages={data.stages} loads={data.stageLoads} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="panel p-5 xl:col-span-2">
            <header className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Longest held</p>
                <h2 className="font-display text-lg font-semibold text-gray-100">
                  Who has what, and for how long
                </h2>
              </div>
              <span className="text-[11px] text-gray-500">
                Segment width is time held · hover a segment
              </span>
            </header>

            <div className="-mx-3 divide-y divide-white/[0.04]">
              {attention.map((packet) => (
                <CustodyRibbon
                  key={packet.packetId}
                  packet={packet}
                  stages={data.stages}
                  people={data.people}
                />
              ))}
            </div>
          </section>

          <DataQualityPanel report={data.dataQuality} />
        </div>
      </div>
    </>
  );
}
