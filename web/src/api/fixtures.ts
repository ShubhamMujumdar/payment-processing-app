/**
 * Seeded fixtures for the portfolio overview.
 *
 * Deterministic: the same seed produces byte-identical output, so a demo never
 * surprises anyone. This mirrors the spine's own fixture generator
 * (spec section 10) and uses the real programme's content throughout - the
 * roster, stage ladder, identifier conventions and release calendar all come
 * from visa_platform/docs/requirements/index.md rather than being invented.
 *
 * PR #1 and PR #2 are real: they exist on
 * github.com/ShubhamMujumdar/payment-processing-app and were merged 15 Aug 2026.
 */

import type {
  CustodySpan,
  DataQualityReport,
  Person,
  PortfolioSummary,
  Stage,
  StageId,
  StageLoad,
  WorkPacket,
  WorkType,
  SpanFlag,
} from "./types";

// --- deterministic PRNG ----------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- the stage ladder, read from the programme -----------------------------
export const STAGES: Stage[] = [
  { id: "REQ_DRAFT",     label: "Requirement draft", phase: "define", accountableRole: "Business Analyst",        isGate: false },
  { id: "REQ_REVIEW",    label: "Requirement review", phase: "define", accountableRole: "Solution Architect",     isGate: false },
  { id: "BASELINED",     label: "Baselined",          phase: "define", accountableRole: "Programme Manager",      isGate: true  },
  { id: "REFINEMENT",    label: "Refinement",         phase: "define", accountableRole: "Product Owner",          isGate: false },
  { id: "DEVELOPMENT",   label: "Development",        phase: "build",  accountableRole: "Assignee",               isGate: false },
  { id: "CODE_REVIEW",   label: "Code review",        phase: "build",  accountableRole: "CODEOWNERS reviewer",    isGate: true  },
  { id: "CI_VERIFY",     label: "CI verify",          phase: "build",  accountableRole: "Author",                 isGate: false },
  { id: "MERGED_DEV",    label: "Merged to dev",      phase: "build",  accountableRole: "Engineering Lead",       isGate: false },
  { id: "DEPLOY_DEV",    label: "Deploy dev",         phase: "verify", accountableRole: "Automated",              isGate: false },
  { id: "GATE2_STAGING", label: "Staging approval",   phase: "verify", accountableRole: "QA Lead",                isGate: true  },
  { id: "STAGING_TEST",  label: "Staging test",       phase: "verify", accountableRole: "QA Lead",                isGate: false },
  { id: "GATE3_UAT",     label: "UAT sign-off",       phase: "gate",   accountableRole: "Product Owner",          isGate: true  },
  { id: "GATE4_CAB",     label: "CAB review",         phase: "gate",   accountableRole: "Delivery + Architect",   isGate: true  },
  { id: "RELEASE_TAG",   label: "Release tag",        phase: "gate",   accountableRole: "Delivery Manager",       isGate: false },
  { id: "GATE5_PROD",    label: "Production approval",phase: "gate",   accountableRole: "Delivery + Compliance + SRE", isGate: true },
  { id: "PRODUCTION",    label: "Production",         phase: "live",   accountableRole: "SRE",                    isGate: false },
];

export const PHASE_LABELS: Record<string, string> = {
  define: "Define",
  build: "Build",
  verify: "Verify",
  gate: "Release gates",
  live: "Live",
};

// --- the roster, verbatim from the PAY Confluence space ---------------------
export const PEOPLE: Person[] = [
  { personId: "p1",  handle: "@shubham.mujumdar1",  name: "Shubham Mujumdar 1",  role: "Product Owner / Lead BA",      initials: "S1",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p2",  handle: "@shubham.mujumdar2",  name: "Shubham Mujumdar 2",  role: "Business Analyst",             initials: "S2",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p3",  handle: "@shubham.mujumdar3",  name: "Shubham Mujumdar 3",  role: "Solution Architect",           initials: "S3",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p4",  handle: "@shubham.mujumdar4",  name: "Shubham Mujumdar 4",  role: "Engineering Lead",             initials: "S4",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p5",  handle: "@shubham.mujumdar5",  name: "Shubham Mujumdar 5",  role: "Senior Engineer",              initials: "S5",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p6",  handle: "@shubham.mujumdar6",  name: "Shubham Mujumdar 6",  role: "QA Lead",                      initials: "S6",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p7",  handle: "@shubham.mujumdar7",  name: "Shubham Mujumdar 7",  role: "Compliance & FC Risk",         initials: "S7",  resolved: false, timezone: "Asia/Kolkata" },
  { personId: "p8",  handle: "@shubham.mujumdar8",  name: "Shubham Mujumdar 8",  role: "Delivery / Programme Manager", initials: "S8",  resolved: true,  timezone: "Asia/Kolkata" },
  { personId: "p9",  handle: "@shubham.mujumdar9",  name: "Shubham Mujumdar 9",  role: "SRE / Platform",               initials: "S9",  resolved: false, timezone: "Asia/Kolkata" },
  { personId: "p10", handle: "@shubham.mujumdar10", name: "Shubham Mujumdar 10", role: "UX Lead",                      initials: "S10", resolved: true,  timezone: "Asia/Kolkata" },
];

const ROLE_TO_PERSON: Record<string, string> = {
  "Business Analyst": "p2",
  "Solution Architect": "p3",
  "Programme Manager": "p8",
  "Product Owner": "p1",
  Assignee: "p5",
  "CODEOWNERS reviewer": "p4",
  Author: "p5",
  "Engineering Lead": "p4",
  Automated: "p9",
  "QA Lead": "p6",
  "Delivery + Architect": "p8",
  "Delivery Manager": "p8",
  "Delivery + Compliance + SRE": "p7",
  SRE: "p9",
};

// --- working-calendar arithmetic (IST, Mon-Fri 09:30-18:30) -----------------
const WORK_START_MIN = 9 * 60 + 30;
const WORK_END_MIN = 18 * 60 + 30;
const IST_OFFSET_MIN = 330;

const DAY_MS = 86400000;

/**
 * Intersection of [from, to] with working windows, in seconds. This is what
 * removes the Friday-18:00-to-Monday-10:00 distortion: 64 raw hours becomes
 * roughly 8 working ones.
 *
 * Steps a day at a time and intersects each day's window, rather than walking
 * minute by minute - the naive version is ~8M iterations across the fixture set
 * and stalls first paint.
 */
function calendarAdjustedSeconds(from: Date, to: Date): number {
  if (to <= from) return 0;
  // Shift into IST so day boundaries and weekends are evaluated in local terms.
  const fromIst = from.getTime() + IST_OFFSET_MIN * 60000;
  const toIst = to.getTime() + IST_OFFSET_MIN * 60000;

  let total = 0;
  let dayStart = Math.floor(fromIst / DAY_MS) * DAY_MS;

  while (dayStart < toIst) {
    const weekday = new Date(dayStart).getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      const open = dayStart + WORK_START_MIN * 60000;
      const close = dayStart + WORK_END_MIN * 60000;
      const overlap = Math.min(toIst, close) - Math.max(fromIst, open);
      if (overlap > 0) total += overlap;
    }
    dayStart += DAY_MS;
  }
  return Math.round(total / 1000);
}

// --- packet seeds -----------------------------------------------------------
const WINDOW_START = new Date("2026-07-06T03:30:00Z");
const NOW = new Date("2026-08-15T15:44:00Z");

interface Seed {
  title: string;
  reqs: string[];
  issue: string | null;
  workType: WorkType;
  stage: StageId;
  prs?: number[];
  orphan?: boolean;
  stalled?: boolean;
}

const SEEDS: Seed[] = [
  { title: "Pessimistic lock on refund ceiling",           reqs: ["FR-PAY-045", "BR-PAY-007"], issue: "PAY-123", workType: "architectural-seam", stage: "CODE_REVIEW", prs: [14], stalled: true },
  { title: "Idempotency key on payment initiation",        reqs: ["FR-PAY-012", "NFR-PAY-004"], issue: "PAY-131", workType: "architectural-seam", stage: "GATE2_STAGING", prs: [15] },
  { title: "Audit trail immutability guarantees",          reqs: ["FR-PAY-088", "BR-PAY-021"], issue: "PAY-140", workType: "compliance-surface", stage: "GATE3_UAT", prs: [16] },
  { title: "SCA exemption handling for low-value",         reqs: ["FR-PAY-061"],               issue: "PAY-118", workType: "application",        stage: "DEVELOPMENT" },
  { title: "Refund service characterisation tests",        reqs: ["NFR-PAY-018"],              issue: "PAY-152", workType: "test-authoring",     stage: "CI_VERIFY", prs: [17] },
  { title: "Payment status transition test matrix",        reqs: ["FR-PAY-030", "NFR-PAY-018"], issue: "PAY-153", workType: "test-authoring",    stage: "STAGING_TEST", prs: [18] },
  { title: "Gateway timeout and retry semantics",          reqs: ["NFR-PAY-009"],              issue: "PAY-127", workType: "architectural-seam", stage: "GATE4_CAB", prs: [19] },
  { title: "Settlement batch reconciliation",              reqs: ["FR-PAY-072", "BR-PAY-014"], issue: "PAY-160", workType: "application",        stage: "REFINEMENT" },
  { title: "PSD2 strong customer authentication",          reqs: ["BR-PAY-009", "FR-PAY-058"], issue: "PAY-101", workType: "compliance-surface", stage: "PRODUCTION", prs: [11] },
  { title: "Merchant onboarding KYB checks",               reqs: ["FR-PAY-115"],               issue: "PAY-171", workType: "application",        stage: "REQ_REVIEW" },
  { title: "Sanctions screening hook",                     reqs: ["FR-PAY-134", "BR-PAY-018"], issue: "PAY-168", workType: "compliance-surface", stage: "REQ_DRAFT" },
  { title: "Currency rounding on partial refunds",         reqs: ["FR-PAY-049"],               issue: "PAY-144", workType: "application",        stage: "MERGED_DEV", prs: [20] },
  { title: "Actuator health endpoint for readiness",       reqs: ["NFR-PAY-022"],              issue: "PAY-155", workType: "pipeline",           stage: "DEVELOPMENT" },
  { title: "Structured logging with correlation ids",      reqs: ["NFR-PAY-025"],              issue: "PAY-158", workType: "application",        stage: "CODE_REVIEW", prs: [21] },
  { title: "Payment entity index tuning",                  reqs: ["NFR-PAY-007"],              issue: "PAY-149", workType: "architectural-seam", stage: "DEPLOY_DEV", prs: [22] },
  { title: "Dispute lifecycle state machine",              reqs: ["FR-PAY-141"],               issue: "PAY-175", workType: "documentation",      stage: "REQ_DRAFT" },
  { title: "Acquirer interface contract v2",               reqs: ["FR-PAY-095"],               issue: "PAY-137", workType: "architectural-seam", stage: "BASELINED" },
  { title: "Fix CI and Security pipeline action resolution", reqs: ["NFR-PAY-012"],            issue: "PAY-201", workType: "pipeline",           stage: "PRODUCTION", prs: [1] },
  { title: "Bump trivy-action to v0.36.0",                 reqs: ["NFR-PAY-012"],              issue: "PAY-202", workType: "pipeline",           stage: "PRODUCTION", prs: [2] },
  { title: "Exception handler leaks stack traces",         reqs: ["NFR-PAY-014"],              issue: "PAY-163", workType: "compliance-surface", stage: "GATE5_PROD", prs: [23] },
  { title: "Swagger UI exposed without auth",              reqs: ["NFR-PAY-015"],              issue: "PAY-164", workType: "compliance-surface", stage: "DEVELOPMENT", stalled: true },
  { title: "Refactor mapper to reduce duplication",        reqs: [],                           issue: null,      workType: "application",        stage: "CODE_REVIEW", prs: [24], orphan: true },
  { title: "Payout scheduling rules",                      reqs: ["FR-PAY-152"],               issue: "PAY-179", workType: "documentation",      stage: "REQ_DRAFT" },
  { title: "Release R2-S4 candidate",                      reqs: ["BR-PAY-003"],               issue: "PAY-190", workType: "pipeline",           stage: "RELEASE_TAG", prs: [25] },
];

function buildPacket(seed: Seed, idx: number, rand: () => number): WorkPacket {
  const stageIdx = STAGES.findIndex((s) => s.id === seed.stage);
  const spans: CustodySpan[] = [];

  // Work backwards from now so the current stage's age is what drives risk.
  const openedOffsetDays = 4 + rand() * 30;
  let cursor = new Date(NOW.getTime() - openedOffsetDays * 86400000);
  if (cursor < WINDOW_START) cursor = new Date(WINDOW_START.getTime());
  const openedAt = new Date(cursor.getTime());

  for (let i = 0; i <= stageIdx; i++) {
    const stage = STAGES[i];
    const isCurrent = i === stageIdx;
    const personId = ROLE_TO_PERSON[stage.accountableRole] ?? "p5";

    // Gates held by a human take longer than automated steps.
    const baseHours = stage.isGate ? 6 + rand() * 30 : 2 + rand() * 20;
    const stalledFactor = seed.stalled && isCurrent ? 9 : 1;
    const holdMs = baseHours * stalledFactor * 3600000;

    const enteredAt = new Date(cursor.getTime());
    const exitedAt = isCurrent ? null : new Date(cursor.getTime() + holdMs);
    const endForMath = exitedAt ?? NOW;

    const custodySeconds = Math.max(0, Math.round((endForMath.getTime() - enteredAt.getTime()) / 1000));
    const adjusted = calendarAdjustedSeconds(enteredAt, endForMath);

    const flags: SpanFlag[] = [];
    // Gates 2, 3 and 5 have no configured reviewers yet, so their approvals are
    // recorded transitions rather than real human decisions.
    if (["GATE2_STAGING", "GATE3_UAT", "GATE5_PROD"].includes(stage.id)) flags.push("simulated_gate");
    const person = PEOPLE.find((p) => p.personId === personId);
    if (person && !person.resolved) flags.push("unresolved_identity");

    const signalCount = stage.isGate ? Math.floor(rand() * 3) : Math.floor(rand() * 9);
    if (signalCount === 0) flags.push("no_activity_signal");

    spans.push({
      spanId: `sp-${idx}-${i}`,
      packetId: `WP-${100 + idx}`,
      stageId: stage.id,
      personId,
      enteredAt: enteredAt.toISOString(),
      exitedAt: exitedAt ? exitedAt.toISOString() : null,
      custodySeconds,
      calendarAdjustedSeconds: adjusted,
      activitySignalCount: signalCount,
      activeMinutesEstimate: signalCount === 0 ? null : 15 * signalCount + Math.floor(rand() * 25),
      isOpen: isCurrent,
      isOverdue: isCurrent && adjusted > 3600 * 16,
      flags,
    });

    if (exitedAt) cursor = exitedAt;
  }

  const openSpan = spans[spans.length - 1];
  const riskScore = Math.min(
    100,
    Math.round((openSpan.calendarAdjustedSeconds / (3600 * 24)) * 42 + (seed.orphan ? 18 : 0)),
  );

  return {
    packetId: `WP-${100 + idx}`,
    title: seed.title,
    requirementIds: seed.reqs,
    issueKey: seed.issue,
    prNumbers: seed.prs ?? [],
    currentStageId: seed.stage,
    release: "R2",
    sprint: "R2-S4",
    workType: seed.workType,
    openedAt: openedAt.toISOString(),
    spans,
    riskScore,
    isOrphan: Boolean(seed.orphan),
  };
}

export function buildPortfolio(seed = 20260815): PortfolioSummary {
  const rand = mulberry32(seed);
  const packets = SEEDS.map((s, i) => buildPacket(s, i, rand));

  const stageLoads: StageLoad[] = STAGES.map((stage) => {
    const here = packets.filter((p) => p.currentStageId === stage.id);
    const ages = here
      .map((p) => p.spans[p.spans.length - 1].calendarAdjustedSeconds)
      .sort((a, b) => a - b);
    const at = (q: number) => (ages.length ? ages[Math.min(ages.length - 1, Math.floor(ages.length * q))] : 0);
    return {
      stageId: stage.id,
      packetCount: here.length,
      medianAgeSeconds: at(0.5),
      p90AgeSeconds: at(0.9),
      overdueCount: here.filter((p) => p.spans[p.spans.length - 1].isOverdue).length,
    };
  });

  const allSpans = packets.flatMap((p) => p.spans);
  const simulated = allSpans.filter((s) => s.flags.includes("simulated_gate")).length;

  const dataQuality: DataQualityReport = {
    unresolvedIdentities: [
      { source: "github", accountId: "shubham.mujumdar7", seenCount: 14 },
      { source: "github", accountId: "shubham.mujumdar9", seenCount: 22 },
    ],
    orphanPackets: packets.filter((p) => p.isOrphan).map((p) => p.packetId),
    lowConfidenceEdges: 7,
    simulatedGateSpans: simulated,
    staleWatermarks: [{ source: "zephyr", lastEventAt: "2026-08-11T09:30:00Z" }],
    liveSpanRatio: 1 - simulated / allSpans.length,
  };

  return {
    generatedAt: NOW.toISOString(),
    windowStart: WINDOW_START.toISOString(),
    windowEnd: "2026-08-21T18:30:00Z",
    stages: STAGES,
    people: PEOPLE,
    stageLoads,
    packets,
    dataQuality,
  };
}
