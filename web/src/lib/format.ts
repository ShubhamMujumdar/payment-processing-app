import type { SpanFlag, StageId } from "../api/types";

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

export const STAGE_ORDER: StageId[] = [
  "REQ_DRAFT",
  "REQ_REVIEW",
  "BASELINED",
  "REFINEMENT",
  "DEVELOPMENT",
  "CODE_REVIEW",
  "CI_VERIFY",
  "MERGED_DEV",
  "DEPLOY_DEV",
  "GATE2_STAGING",
  "STAGING_TEST",
  "GATE3_UAT",
  "GATE4_CAB",
  "RELEASE_TAG",
  "GATE5_PROD",
  "PRODUCTION",
];

/**
 * Stage colour comes from position in the ladder, not from an arbitrary
 * category assignment. The ramp runs deep indigo through blue and cyan to teal,
 * so hue itself encodes how far along delivery a thing is - two stages that
 * look similar genuinely are adjacent.
 */
export function stageColor(stageId: StageId): string {
  const i = STAGE_ORDER.indexOf(stageId);
  return `var(--color-stage-${i < 0 ? 1 : i + 1})`;
}

export function stageIndex(stageId: StageId): number {
  return STAGE_ORDER.indexOf(stageId);
}

export const FLAG_COPY: Record<SpanFlag, string> = {
  simulated_gate: "No approver was configured — the transition is real, the approval is not",
  assumed_calendar: "Working calendar assumed from the programme default",
  clock_skew: "Source timestamps disagree; duration clamped to zero",
  no_activity_signal: "No attributable activity in this window",
  unresolved_identity: "Source account not mapped to a person",
};

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso));
export const formatDate = (iso: string) => DATE_ONLY.format(new Date(iso));

export function ago(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const h = diff / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}
