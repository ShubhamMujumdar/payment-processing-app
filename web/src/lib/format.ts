import type { Phase, SpanFlag } from "../api/types";

/** Durations are read at a glance and compared down a column, so they get one
 *  significant unit and a fixed shape - never "2 days, 3 hours, 14 minutes". */
export function duration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)}m`;
  if (h < 24) return `${h < 10 ? h.toFixed(1) : Math.round(h)}h`;
  const d = h / 24;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)}d`;
}

/** Working-day equivalent, using the programme's 9-hour IST day. */
export function workingDays(seconds: number): string {
  return `${(seconds / 3600 / 9).toFixed(1)} working days`;
}

export const PHASE_COLOR: Record<Phase, string> = {
  define: "var(--color-phase-define)",
  build: "var(--color-phase-build)",
  verify: "var(--color-phase-verify)",
  gate: "var(--color-phase-gate)",
  live: "var(--color-phase-live)",
};

export const FLAG_COPY: Record<SpanFlag, string> = {
  simulated_gate: "Gate had no configured approver — transition is real, the approval is not",
  assumed_calendar: "Working calendar assumed from the programme default",
  clock_skew: "Source timestamps disagree; duration clamped to zero",
  no_activity_signal: "No attributable activity in this window",
  unresolved_identity: "Source account not mapped to a person",
};

export function relativeTime(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const h = diff / 3600000;
  if (h < 1) return `${Math.round(diff / 60000)}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
