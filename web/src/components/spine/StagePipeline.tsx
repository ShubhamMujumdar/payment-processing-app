import type { Stage, StageLoad } from "../../api/types";
import { PHASE_LABELS } from "../../api/fixtures";
import { duration, PHASE_COLOR } from "../../lib/format";

/**
 * The pipeline, as the page's opening statement.
 *
 * Sixteen stages, grouped into the five phases the programme actually runs.
 * Bar height is work-in-progress; the figure beneath is median calendar-adjusted
 * time currently held at that stage. Gates carry a marker because a gate is a
 * person deciding, not a step executing - and gates are where work waits.
 *
 * The bottleneck is called out rather than left to be inferred. A dashboard that
 * makes you find the problem yourself has not done its job.
 */

interface Props {
  stages: Stage[];
  loads: StageLoad[];
}

export default function StagePipeline({ stages, loads }: Props) {
  const loadById = (id: string) => loads.find((l) => l.stageId === id)!;
  const maxCount = Math.max(1, ...loads.map((l) => l.packetCount));

  const occupied = loads.filter((l) => l.packetCount > 0);
  const bottleneck = occupied.length
    ? occupied.reduce((worst, l) => (l.medianAgeSeconds > worst.medianAgeSeconds ? l : worst))
    : null;
  const bottleneckStage = bottleneck ? stages.find((s) => s.id === bottleneck.stageId)! : null;

  const phases = ["define", "build", "verify", "gate", "live"] as const;

  return (
    <section className="panel p-5">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Work in progress</p>
          <h2 className="font-display text-lg font-semibold text-gray-100">
            Where everything is right now
          </h2>
        </div>

        {bottleneckStage && bottleneck && (
          <div className="flex items-center gap-2 rounded-lg border border-state-warn/25 bg-state-warn/[0.07] px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-state-warn" />
            <span className="text-[12px] text-gray-300">
              Slowest stage is{" "}
              <span className="font-medium text-state-warn">{bottleneckStage.label}</span> —
              median{" "}
              <span className="tnum font-mono">{duration(bottleneck.medianAgeSeconds)}</span> held,{" "}
              {bottleneck.packetCount} item{bottleneck.packetCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </header>

      <div className="flex items-end gap-5 overflow-x-auto pb-1">
        {phases.map((phase) => {
          const inPhase = stages.filter((s) => s.phase === phase);
          return (
            <div key={phase} className="flex min-w-fit flex-col gap-2">
              <div className="flex items-end gap-1">
                {inPhase.map((stage) => {
                  const load = loadById(stage.id);
                  const height = load.packetCount === 0 ? 3 : 12 + (load.packetCount / maxCount) * 68;
                  const isBottleneck = bottleneck?.stageId === stage.id;

                  return (
                    <div key={stage.id} className="group/stage relative flex w-[62px] flex-col items-center">
                      {/* Count sits above the bar so the eye reads quantity first. */}
                      <span
                        className={`tnum mb-1 font-mono text-[11px] ${
                          load.packetCount ? "text-gray-200" : "text-gray-700"
                        }`}
                      >
                        {load.packetCount || "—"}
                      </span>

                      <div className="flex h-[80px] w-full items-end">
                        <div
                          style={{
                            height: `${height}px`,
                            background:
                              load.packetCount === 0
                                ? "rgba(255,255,255,0.06)"
                                : `linear-gradient(180deg, ${PHASE_COLOR[phase]}dd, ${PHASE_COLOR[phase]}55)`,
                            boxShadow: isBottleneck
                              ? "0 0 0 1px var(--color-state-warn), 0 0 18px -4px var(--color-state-warn)"
                              : undefined,
                          }}
                          className="w-full rounded-t-[3px] transition-all"
                        />
                      </div>

                      <div className="mt-1.5 h-3">
                        {load.overdueCount > 0 && (
                          <span className="tnum font-mono text-[9px] text-state-fail">
                            {load.overdueCount} overdue
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 line-clamp-2 h-7 text-center text-[10px] leading-[1.3] text-gray-500 group-hover/stage:text-gray-300">
                        {stage.label}
                      </p>

                      {/* A gate is a human decision, not a step. Marked as such. */}
                      <span
                        className={`mt-0.5 text-[9px] ${
                          stage.isGate ? "text-state-warn" : "text-transparent"
                        }`}
                        title={stage.isGate ? `Gate — ${stage.accountableRole}` : undefined}
                      >
                        ◆
                      </span>

                      <span className="tnum font-mono text-[9px] text-gray-600">
                        {load.packetCount ? duration(load.medianAgeSeconds) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p
                className="border-t pt-1.5 text-center text-[10px] font-medium uppercase tracking-wider"
                style={{ borderColor: `${PHASE_COLOR[phase]}44`, color: `${PHASE_COLOR[phase]}` }}
              >
                {PHASE_LABELS[phase]}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
