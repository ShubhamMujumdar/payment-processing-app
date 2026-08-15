import { useState } from "react";
import type { CustodySpan, Person, Stage, WorkPacket } from "../../api/types";
import { duration, FLAG_COPY, PHASE_COLOR } from "../../lib/format";

/**
 * The custody ribbon.
 *
 * One horizontal bar per work packet. Each segment is one person's custody at
 * one stage, and its WIDTH IS THE TIME THEY HELD IT (calendar-adjusted, so
 * weekends do not inflate anyone's segment). Colour encodes lifecycle phase.
 * The notch between segments is a handoff - the moment accountability changed.
 *
 * Read left to right and you get the whole answer at once: how long the packet
 * has taken, who had it at each step, and where it is stuck. That is the
 * product's thesis expressed as one object, which is why it is the signature
 * element rather than a stat tile.
 *
 * The open segment is hatched rather than solid: custody that has not ended
 * cannot be measured, only observed so far.
 */

interface Props {
  packet: WorkPacket;
  stages: Stage[];
  people: Person[];
  onSelect?: (packetId: string) => void;
}

export default function CustodyRibbon({ packet, stages, people, onSelect }: Props) {
  const [hovered, setHovered] = useState<CustodySpan | null>(null);

  const stageById = (id: string) => stages.find((s) => s.id === id)!;
  const personById = (id: string) => people.find((p) => p.personId === id);

  // Segment widths come from adjusted time, with a floor so a two-minute
  // automated step stays clickable instead of collapsing to a hairline.
  const total = packet.spans.reduce((sum, s) => sum + Math.max(s.calendarAdjustedSeconds, 600), 0);
  const openSpan = packet.spans[packet.spans.length - 1];
  const holder = personById(openSpan.personId);
  const elapsed = packet.spans.reduce((sum, s) => sum + s.calendarAdjustedSeconds, 0);

  return (
    <div
      className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
      onMouseLeave={() => setHovered(null)}
    >
      <div className="mb-2 flex items-baseline gap-3">
        <button
          onClick={() => onSelect?.(packet.packetId)}
          className="truncate text-left text-[13px] font-medium text-gray-200 hover:text-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-850 rounded"
        >
          {packet.title}
        </button>

        <span className="tnum shrink-0 font-mono text-[10px] text-gray-500">
          {packet.issueKey ?? "unlinked"}
        </span>

        {packet.requirementIds.slice(0, 2).map((r) => (
          <span
            key={r}
            className="shrink-0 rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-px font-mono text-[10px] text-gray-400"
          >
            {r}
          </span>
        ))}

        {packet.isOrphan && (
          <span className="shrink-0 rounded bg-state-stale/15 px-1.5 py-px font-mono text-[10px] text-state-stale">
            no requirement
          </span>
        )}

        <span className="tnum ml-auto shrink-0 font-mono text-[11px] text-gray-400">
          {duration(elapsed)}
        </span>
      </div>

      {/* The ribbon itself */}
      <div className="flex h-7 w-full items-stretch gap-px overflow-hidden rounded-[3px]">
        {packet.spans.map((span) => {
          const stage = stageById(span.stageId);
          const person = personById(span.personId);
          const pct = (Math.max(span.calendarAdjustedSeconds, 600) / total) * 100;
          const color = PHASE_COLOR[stage.phase];
          const isHovered = hovered?.spanId === span.spanId;

          return (
            <button
              key={span.spanId}
              style={{
                width: `${pct}%`,
                background: span.isOpen
                  ? `repeating-linear-gradient(115deg, ${color}55 0 6px, ${color}22 6px 12px)`
                  : `${color}${isHovered ? "ee" : "aa"}`,
                borderTop: `2px solid ${color}`,
                boxShadow: span.isOverdue ? "inset 0 0 0 1px var(--color-state-fail)" : undefined,
              }}
              onMouseEnter={() => setHovered(span)}
              onFocus={() => setHovered(span)}
              className="relative min-w-[3px] transition-[filter] hover:brightness-125 focus:outline-none focus-visible:brightness-150"
              aria-label={`${stage.label}, held by ${person?.name ?? "unknown"}, ${duration(
                span.calendarAdjustedSeconds,
              )}`}
            >
              {pct > 9 && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[9px] font-semibold text-ink-950">
                  {person?.initials}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail rail. Reserves its own height so hovering does not reflow the list. */}
      <div className="mt-1.5 flex h-4 items-center gap-2 text-[10px]">
        {hovered ? (
          <>
            <span className="font-medium text-gray-300">{stageById(hovered.stageId).label}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">{personById(hovered.personId)?.name}</span>
            <span className="text-gray-500">·</span>
            <span className="tnum font-mono text-gray-300">
              {duration(hovered.calendarAdjustedSeconds)} held
            </span>
            {hovered.custodySeconds !== hovered.calendarAdjustedSeconds && (
              <span className="tnum font-mono text-gray-600">
                ({duration(hovered.custodySeconds)} elapsed)
              </span>
            )}
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">
              {hovered.activeMinutesEstimate === null
                ? "no activity signal"
                : `~${hovered.activeMinutesEstimate}m engaged, ${hovered.activitySignalCount} signals`}
            </span>
            {hovered.flags
              .filter((f) => f !== "no_activity_signal")
              .map((f) => (
                <span key={f} className="text-state-warn" title={FLAG_COPY[f]}>
                  ⚑ {f.replace(/_/g, " ")}
                </span>
              ))}
          </>
        ) : (
          <span className="text-gray-600">
            Now with {holder?.name ?? "unassigned"} at {stageById(openSpan.stageId).label}
            {openSpan.isOverdue && <span className="ml-2 text-state-fail">· overdue</span>}
          </span>
        )}
      </div>
    </div>
  );
}
