import type { ReactNode } from "react";

/**
 * A horizontal run of pipeline stages.
 *
 * Nodes sit on a fixed-width grid rather than flexing, because the curling
 * arrow between the two tracks is drawn against these coordinates — a node that
 * moves when a label gets longer would drag the arrow off its anchor.
 */

export type StageState = "pending" | "active" | "done" | "failed" | "skipped";

export interface Stage {
  id: string;
  label: string;
  state: StageState;
  detail?: string;
}

/** Five doc stages must fit inside the inset sub-box without scrolling. */
export const NODE_WIDTH = 114;

const DOT: Record<StageState, string> = {
  pending: "border-ink-500 bg-ink-900",
  active: "border-brand-400 bg-brand-500",
  done: "border-accent/40 bg-accent/70",
  failed: "border-state-fail bg-state-fail/30",
  skipped: "border-ink-600 bg-ink-850",
};

const LABEL: Record<StageState, string> = {
  pending: "text-gray-600",
  active: "text-accent",
  done: "text-gray-300",
  failed: "text-state-fail",
  skipped: "text-gray-600",
};

export function Track({
  stages,
  accent = "cyan",
  title,
  trailing,
}: {
  stages: Stage[];
  accent?: "cyan" | "blue";
  title?: string;
  trailing?: ReactNode;
}) {
  const line = accent === "cyan" ? "bg-accent/70" : "bg-cgz-blue/40";
  return (
    <div>
      {title && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-gray-400">
            {title}
          </span>
          {trailing}
        </div>
      )}
      <div className="relative flex items-start overflow-x-auto pb-1">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="relative shrink-0"
            style={{ width: NODE_WIDTH }}
          >
            {index > 0 && (
              <span
                className={`absolute top-[8px] h-[1.5px] ${line}`}
                style={{ right: NODE_WIDTH / 2 + 8, width: NODE_WIDTH - 16, left: "auto" }}
              />
            )}
            <div className="flex flex-col items-center">
              <span
                className={`relative z-10 h-[18px] w-[18px] rounded-full border-2 ${DOT[stage.state]} ${
                  stage.state === "active" ? "animate-pulse" : ""
                }`}
              >
                {stage.state === "active" && (
                  <span className="absolute -inset-1.5 rounded-full border border-brand-400/40 animate-ping" />
                )}
              </span>
              <span className={`mt-2 text-center text-[11.5px] leading-tight ${LABEL[stage.state]}`}>
                {stage.label}
              </span>
              {stage.detail && (
                <span className="mt-0.5 max-w-[124px] truncate text-center text-[10.5px] text-gray-600">
                  {stage.detail}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The branch from the code track down into the documentation track.
 *
 * Drawn rather than described: the whole point of the second track is that it
 * runs *off* the commit, in parallel, and a reader should see that without
 * being told. It animates only while the doc pipeline is working, so motion on
 * screen always means work is happening.
 */
export function CurlArrow({ active, height = 34 }: { active: boolean; height?: number }) {
  const x = NODE_WIDTH / 2;
  return (
    <svg
      width={x + 60}
      height={height}
      className="block overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <marker id="c2d-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--color-brand-500)" />
        </marker>
      </defs>
      <path
        d={`M ${x} 0 C ${x} ${height * 0.55}, ${x + 14} ${height - 6}, ${x + 44} ${height - 6}`}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        markerEnd="url(#c2d-arrow)"
        strokeDasharray={active ? "4 4" : undefined}
      >
        {active && (
          <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.7s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}
