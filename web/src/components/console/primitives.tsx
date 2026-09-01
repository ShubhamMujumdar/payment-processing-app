import type { ReactNode } from "react";
import type { Person, Stage, StageId, WorkPacket } from "../../api/types";
import { duration, stageColor, stageIndex } from "../../lib/format";

/* Console primitives. Deliberately small and square: this is an operations
   surface, so density and alignment matter more than affordance. */

type Tone = "neutral" | "pass" | "warn" | "fail" | "idle" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "bg-black/[0.06] text-gray-400",
  pass: "bg-state-pass/12 text-state-pass",
  warn: "bg-state-warn/12 text-state-warn",
  fail: "bg-state-fail/12 text-state-fail",
  idle: "bg-black/[0.05] text-state-idle",
  brand: "bg-cgz-cyan/12 text-cgz-cyan",
};

export function Lozenge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`lozenge ${TONE[tone]}`}>{children}</span>;
}

/** Monospaced identifier. Every PAY-123, FR-PAY-045 and TC-PAY-401 uses this so
 *  identifiers are visually separable from prose at a glance. */
export function Ident({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <span className={`font-mono text-[11px] ${dim ? "text-gray-600" : "text-gray-400"}`}>
      {children}
    </span>
  );
}

export function StageChip({ stageId, stages }: { stageId: StageId; stages: Stage[] }) {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="size-2 shrink-0 rounded-sm"
        style={{ background: stageColor(stageId) }}
        aria-hidden="true"
      />
      <span className="text-[12px] text-gray-300">{stage.label}</span>
      {stage.isGate && (
        <span className="font-mono text-[9px] text-state-warn" title={`Gate — ${stage.accountableRole}`}>
          GATE
        </span>
      )}
    </span>
  );
}

export function PersonChip({
  person,
  showName = true,
}: {
  person?: Person;
  showName?: boolean;
}) {
  if (!person) return <span className="text-[12px] text-gray-600">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap" title={person.role}>
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] ${
          person.resolved
            ? "bg-cgz-blue/25 text-accent"
            : "border border-dashed border-state-warn/50 text-state-warn"
        }`}
      >
        {person.initials}
      </span>
      {showName && <span className="text-[12px] text-gray-300">{person.name}</span>}
    </span>
  );
}

/**
 * Compact custody flow for a table cell.
 *
 * Segment width is time held, colour is stage position. It reads as a single
 * glyph at row height but still answers "how many hands has this been through
 * and where did it sit longest".
 */
export function FlowBar({ packet, stages }: { packet: WorkPacket; stages: Stage[] }) {
  const total = packet.spans.reduce((sum, s) => sum + Math.max(s.calendarAdjustedSeconds, 600), 0);

  return (
    <span className="flex h-3.5 w-full min-w-[110px] items-stretch gap-px" aria-hidden="true">
      {packet.spans.map((span) => {
        const pct = (Math.max(span.calendarAdjustedSeconds, 600) / total) * 100;
        const stage = stages.find((s) => s.id === span.stageId);
        return (
          <span
            key={span.spanId}
            style={{
              width: `${pct}%`,
              background: stageColor(span.stageId),
              opacity: span.isOpen ? 1 : 0.62,
              outline: span.isOverdue ? "1px solid var(--color-state-fail)" : undefined,
              outlineOffset: "-1px",
            }}
            className="first:rounded-l-sm last:rounded-r-sm"
            title={`${stage?.label}: ${duration(span.calendarAdjustedSeconds)}`}
          />
        );
      })}
    </span>
  );
}

/** Horizontal position of a stage in the ladder, as a 16-tick rail. Gives an
 *  instant sense of how far along something is without reading the label. */
export function ProgressRail({ stageId }: { stageId: StageId }) {
  const idx = stageIndex(stageId);
  return (
    <span className="flex items-center gap-px" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="h-2.5 w-[3px] rounded-sm"
          style={{
            background: i <= idx ? stageColor(stageId) : "rgba(255,255,255,0.07)",
            opacity: i <= idx ? 0.35 + (i / 16) * 0.65 : 1,
          }}
        />
      ))}
    </span>
  );
}

/* --- table ---------------------------------------------------------------- */

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  sort?: (a: T, b: T) => number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty = "Nothing matches these filters.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  empty?: string;
}) {
  if (!rows.length) {
    return (
      <div className="flex h-40 items-center justify-center text-[12px] text-gray-600">{empty}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <thead className="sticky top-0 z-10 bg-ink-850">
          <tr className="border-b hairline">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`col-label ${c.align === "right" ? "text-right" : ""}`}
                style={{ width: c.width }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-black/[0.05] transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                } ${selected ? "bg-cgz-blue/[0.12]" : "hover:bg-black/[0.04]"}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-[7px] align-middle ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
