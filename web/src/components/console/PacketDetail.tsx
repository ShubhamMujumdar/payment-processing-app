import { useEffect } from "react";
import type { Person, Stage, WorkPacket } from "../../api/types";
import { duration, FLAG_COPY, formatDateTime, stageColor } from "../../lib/format";
import { Ident, Lozenge } from "./primitives";

/**
 * Custody chain for one packet.
 *
 * The chain is the answer to "who had this, in what order, and for how long" -
 * the question that otherwise requires opening Jira, GitHub and Confluence side
 * by side. Each row is one CustodySpan; the connector between rows is a handoff.
 */

export default function PacketDetail({
  packet,
  stages,
  people,
  onClose,
}: {
  packet: WorkPacket;
  stages: Stage[];
  people: Person[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stageOf = (id: string) => stages.find((s) => s.id === id);
  const personOf = (id: string) => people.find((p) => p.personId === id);
  const totalHeld = packet.spans.reduce((sum, s) => sum + s.calendarAdjustedSeconds, 0);
  const totalElapsed = packet.spans.reduce((sum, s) => sum + s.custodySeconds, 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-975/60" onClick={onClose} aria-hidden="true" />

      <aside
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[560px] flex-col border-l hairline bg-ink-900 shadow-2xl"
        role="dialog"
        aria-label={`Custody chain for ${packet.issueKey ?? packet.packetId}`}
      >
        <header className="flex items-start gap-3 border-b hairline px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Ident>{packet.issueKey ?? packet.packetId}</Ident>
              {packet.requirementIds.map((r) => (
                <span key={r} className="rounded-[3px] border hairline px-1.5 py-px font-mono text-[10px] text-gray-500">
                  {r}
                </span>
              ))}
            </div>
            <h2 className="text-[14px] font-medium leading-snug text-gray-100">{packet.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-[3px] p-1 text-gray-500 hover:bg-black/[0.06] hover:text-gray-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-cgz-cyan"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid grid-cols-3 border-b hairline">
          {[
            ["Working time held", duration(totalHeld)],
            ["Wall-clock elapsed", duration(totalElapsed)],
            ["Hands", String(new Set(packet.spans.map((s) => s.personId)).size)],
          ].map(([label, value]) => (
            <div key={label} className="border-r hairline px-4 py-2.5 last:border-r-0">
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-600">{label}</p>
              <p className="tnum mt-0.5 font-mono text-[15px] text-gray-100">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-wider text-gray-600">
            Chain of custody
          </p>

          <ol className="relative">
            {packet.spans.map((span, i) => {
              const stage = stageOf(span.stageId);
              const who = personOf(span.personId);
              const last = i === packet.spans.length - 1;

              return (
                <li key={span.spanId} className="relative pb-4 pl-6 last:pb-0">
                  {/* Handoff connector */}
                  {!last && (
                    <span
                      className="absolute left-[5px] top-3 h-full w-px"
                      style={{ background: "rgba(255,255,255,0.09)" }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className="absolute left-0 top-[3px] size-[11px] rounded-[2px]"
                    style={{
                      background: stageColor(span.stageId),
                      opacity: span.isOpen ? 1 : 0.7,
                      boxShadow: span.isOpen ? `0 0 0 3px ${stageColor(span.stageId)}22` : undefined,
                    }}
                    aria-hidden="true"
                  />

                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[12.5px] font-medium text-gray-200">{stage?.label}</span>
                    {stage?.isGate && <Lozenge tone="warn">gate</Lozenge>}
                    {span.isOpen && <Lozenge tone="brand">holding now</Lozenge>}
                    {span.isOverdue && <Lozenge tone="fail">overdue</Lozenge>}

                    <span className="tnum ml-auto font-mono text-[11px] text-gray-300">
                      {duration(span.calendarAdjustedSeconds)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[12px] text-gray-400">
                    {who?.name}
                    <span className="text-gray-600"> · {who?.role}</span>
                  </p>

                  <p className="mt-1 font-mono text-[10px] text-gray-600">
                    {formatDateTime(span.enteredAt)}
                    {span.exitedAt ? ` → ${formatDateTime(span.exitedAt)}` : " → open"}
                    {span.custodySeconds !== span.calendarAdjustedSeconds &&
                      ` · ${duration(span.custodySeconds)} wall-clock`}
                  </p>

                  <p className="mt-1 text-[11px] text-gray-500">
                    {span.activeMinutesEstimate === null
                      ? "No activity signal in this window"
                      : `~${span.activeMinutesEstimate}m engaged, inferred from ${span.activitySignalCount} signals`}
                  </p>

                  {span.flags
                    .filter((f) => f !== "no_activity_signal")
                    .map((f) => (
                      <p key={f} className="mt-1 text-[10px] text-state-warn" title={FLAG_COPY[f]}>
                        {FLAG_COPY[f]}
                      </p>
                    ))}
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </>
  );
}
