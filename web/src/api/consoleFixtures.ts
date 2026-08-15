/**
 * Entity rows behind the console tabs.
 *
 * All derived from the same packets as the portfolio view, so every tab agrees
 * with every other one: a requirement's linked issues really are the packets
 * carrying it, and a pull request's review time really is its CODE_REVIEW
 * custody span. Tabs that disagree with each other is the fastest way to lose
 * a room.
 */

import { buildPortfolio, mulberry32, NOW, PEOPLE } from "./fixtures";
import type {
  ConsoleData,
  DefectRow,
  DefectStatus,
  DeploymentRow,
  PersonStats,
  PullRequestRow,
  Requirement,
  Severity,
  TestCaseRow,
  TestStatus,
} from "./types";

const REQ_TITLES: Record<string, string> = {
  "FR-PAY-012": "Payment initiation shall be idempotent on client reference",
  "FR-PAY-030": "Payment status transitions shall follow the defined state machine",
  "FR-PAY-045": "Refund total shall never exceed the captured amount",
  "FR-PAY-049": "Partial refunds shall round half-even to minor units",
  "FR-PAY-058": "Strong customer authentication shall be applied per PSD2",
  "FR-PAY-061": "Low-value transactions may claim an SCA exemption",
  "FR-PAY-072": "Settlement batches shall reconcile against acquirer files",
  "FR-PAY-088": "The audit trail shall be append-only and immutable",
  "FR-PAY-095": "The acquirer interface shall version its contract",
  "FR-PAY-115": "Merchant onboarding shall complete KYB before activation",
  "FR-PAY-134": "Every payee shall be screened against sanctions lists",
  "FR-PAY-141": "Disputes shall follow the scheme chargeback lifecycle",
  "FR-PAY-152": "Payouts shall be scheduled per merchant agreement",
  "NFR-PAY-004": "Duplicate submission shall not create a second payment",
  "NFR-PAY-007": "Payment lookup shall return within 200ms at p95",
  "NFR-PAY-009": "Gateway calls shall time out at 5s and retry twice",
  "NFR-PAY-012": "The delivery pipeline shall block on failed security scans",
  "NFR-PAY-014": "Error responses shall not disclose internal detail",
  "NFR-PAY-015": "No endpoint shall be exposed without authentication",
  "NFR-PAY-018": "Line coverage shall not fall below the agreed floor",
  "NFR-PAY-022": "The service shall expose a readiness endpoint",
  "NFR-PAY-025": "Every request shall carry a correlation identifier",
  "BR-PAY-003": "The platform shall release on a predictable cadence",
  "BR-PAY-007": "Customers shall never be refunded more than they paid",
  "BR-PAY-009": "The platform shall comply with PSD2",
  "BR-PAY-014": "Settlement shall be reconcilable to the penny",
  "BR-PAY-018": "The platform shall not process sanctioned payments",
  "BR-PAY-021": "All money movement shall be auditable for seven years",
};

const OWNER_BY_PREFIX: Record<string, string> = { BR: "p1", FR: "p2", NFR: "p3" };

type DefectSeed = [string, string, Severity, DefectStatus, string, string | null];

const DEFECT_SEEDS: DefectSeed[] = [
  ["DEF-PAY-201", "CI and Security workflows fail to resolve trivy-action", "major", "verified", "local", "NFR-PAY-012"],
  ["DEF-PAY-202", "trivy-action v0.28.0 references a deleted setup-trivy tag", "major", "verified", "local", "NFR-PAY-012"],
  ["DEF-PAY-203", "Dependency scan reports 4 critical and 26 high CVEs", "critical", "triaged", "local", "NFR-PAY-012"],
  ["DEF-PAY-204", "Exception handler returns stack traces to the caller", "major", "in-progress", "staging", "NFR-PAY-014"],
  ["DEF-PAY-205", "Swagger UI reachable without authentication", "critical", "open", "dev", "NFR-PAY-015"],
  ["DEF-PAY-206", "Refund ceiling check races under concurrent requests", "critical", "in-progress", "staging", "FR-PAY-045"],
  ["DEF-PAY-207", "Partial refund rounds half-up on JPY", "minor", "triaged", "uat", "FR-PAY-049"],
  ["DEF-PAY-208", "Audit row written before gateway confirmation", "major", "resolved", "dev", "FR-PAY-088"],
  ["DEF-PAY-209", "CD promotes to UAT while CI is failing", "major", "open", "dev", "NFR-PAY-012"],
  ["DEF-PAY-210", "No readiness probe, deploy reports success prematurely", "minor", "open", "dev", "NFR-PAY-022"],
];

export function buildConsole(seed = 20260815): ConsoleData {
  const base = buildPortfolio(seed);
  const rand = mulberry32(seed ^ 0x5eed);
  const { packets } = base;

  // --- requirements ---------------------------------------------------------
  const requirements: Requirement[] = Object.keys(REQ_TITLES).map((reqId, i) => {
    const prefix = reqId.split("-")[0];
    const ordinal = Number(reqId.split("-")[2]);
    const carrying = packets.filter((p) => p.requirementIds.includes(reqId));
    const testCount = 1 + Math.floor(rand() * 3);
    const passing = Math.max(0, testCount - (rand() < 0.22 ? 1 : 0));

    return {
      reqId,
      title: REQ_TITLES[reqId],
      document: prefix === "BR" ? "PRD-10" : ordinal > 110 ? "FSD-21" : "FSD-20",
      obligation: rand() < 0.82 ? "shall" : "should",
      moscow: prefix === "BR" || rand() < 0.6 ? "MUST" : "SHOULD",
      // FSD-21 is deliberately held at DRAFT, so its requirements are not
      // baselined and are not under change control yet.
      baselined: prefix !== "FR" || ordinal <= 110,
      ownerId: OWNER_BY_PREFIX[prefix] ?? "p2",
      release: rand() < 0.7 ? "R2" : "R3",
      linkedIssueKeys: carrying.map((p) => p.issueKey).filter((k): k is string => Boolean(k)),
      linkedTestIds: Array.from({ length: testCount }, (_, t) => `TC-PAY-${400 + i * 3 + t}`),
      openDefectIds: DEFECT_SEEDS.filter(
        (d) => d[5] === reqId && d[3] !== "verified" && d[3] !== "resolved",
      ).map((d) => d[0]),
      verification: passing / testCount,
      lastChangedAt: new Date(NOW.getTime() - rand() * 30 * 86400000).toISOString(),
    };
  });

  // --- pull requests --------------------------------------------------------
  const pullRequests: PullRequestRow[] = packets
    .filter((p) => p.prNumbers.length)
    .map((p) => {
      const number = p.prNumbers[0];
      const isLive = number <= 2; // PR #1 and #2 are real merges on the repo
      const reviewSpan = p.spans.find((s) => s.stageId === "CODE_REVIEW");
      const merged = !["CODE_REVIEW", "DEVELOPMENT", "CI_VERIFY"].includes(p.currentStageId);

      return {
        number,
        title: p.title,
        authorId: "p5",
        // The repo has no second collaborator, so the live PRs genuinely have
        // no reviewer. Shown empty rather than invented.
        reviewerIds: isLive ? [] : ["p4"],
        state: merged ? "merged" : "open",
        checks: rand() < 0.15 && !isLive ? "failing" : "passing",
        additions: 12 + Math.floor(rand() * 320),
        deletions: Math.floor(rand() * 90),
        filesChanged: 1 + Math.floor(rand() * 12),
        requirementIds: p.requirementIds,
        openedAt: p.openedAt,
        mergedAt: merged ? p.spans[p.spans.length - 1].enteredAt : null,
        reviewSeconds: isLive ? null : (reviewSpan?.calendarAdjustedSeconds ?? null),
        isLive,
      } satisfies PullRequestRow;
    });

  // --- test cases -----------------------------------------------------------
  const tests: TestCaseRow[] = requirements.flatMap((r) =>
    r.linkedTestIds.map((tcId, i) => {
      const failed = r.verification < 1 && i === 0;
      const status: TestStatus = failed ? "failed" : rand() < 0.08 ? "not-run" : "passed";
      return {
        tcId,
        title: `Verify ${r.title.replace(/^(The |Every |All |No )/, "").slice(0, 60)}`,
        requirementId: r.reqId,
        ownerId: "p6",
        automated: rand() < 0.55,
        status,
        lastRunAt: status === "not-run" ? null : new Date(NOW.getTime() - rand() * 6 * 86400000).toISOString(),
        durationMs: status === "not-run" ? null : Math.floor(40 + rand() * 3200),
      } satisfies TestCaseRow;
    }),
  );

  // --- defects --------------------------------------------------------------
  const defects: DefectRow[] = DEFECT_SEEDS.map(
    ([defectId, title, severity, status, environment, requirementId], i) => {
      const raisedAt = new Date(NOW.getTime() - (1 + rand() * 26) * 86400000);
      return {
        defectId,
        title,
        severity,
        status,
        environment,
        raisedById: "p6",
        assigneeId: status === "open" ? null : i % 2 ? "p5" : "p4",
        requirementId,
        raisedAt: raisedAt.toISOString(),
        ageSeconds: Math.round((NOW.getTime() - raisedAt.getTime()) / 1000),
      } satisfies DefectRow;
    },
  );

  // --- deployments ----------------------------------------------------------
  // The first three are real: the CD run on 15 Aug 2026 that followed the
  // DEF-PAY-202 merge. None carries an approval because the environments have
  // no reviewers configured yet.
  const deployments: DeploymentRow[] = [
    { deploymentId: "d-1003", environment: "uat",        imageDigest: "sha256:9f2c…a41d", actorId: "p5", createdAt: "2026-08-15T21:12:59Z", status: "succeeded", gateApproved: false, isLive: true },
    { deploymentId: "d-1002", environment: "staging",    imageDigest: "sha256:9f2c…a41d", actorId: "p5", createdAt: "2026-08-15T21:12:50Z", status: "succeeded", gateApproved: false, isLive: true },
    { deploymentId: "d-1001", environment: "dev",        imageDigest: "sha256:9f2c…a41d", actorId: "p5", createdAt: "2026-08-15T21:12:43Z", status: "succeeded", gateApproved: false, isLive: true },
    { deploymentId: "d-0994", environment: "production", imageDigest: "sha256:41ab…77c0", actorId: "p8", createdAt: "2026-08-12T06:40:00Z", status: "succeeded", gateApproved: false, isLive: false },
    { deploymentId: "d-0991", environment: "uat",        imageDigest: "sha256:41ab…77c0", actorId: "p1", createdAt: "2026-08-11T11:05:00Z", status: "succeeded", gateApproved: false, isLive: false },
    { deploymentId: "d-0987", environment: "staging",    imageDigest: "sha256:41ab…77c0", actorId: "p6", createdAt: "2026-08-10T09:20:00Z", status: "failed",    gateApproved: false, isLive: false },
  ];

  // --- per-person rollups ---------------------------------------------------
  const allSpans = packets.flatMap((p) => p.spans);
  const personStats: PersonStats[] = PEOPLE.map((person) => {
    const mine = allSpans.filter((s) => s.personId === person.personId);
    const reviews = mine
      .filter((s) => s.stageId === "CODE_REVIEW" && !s.isOpen)
      .map((s) => s.calendarAdjustedSeconds)
      .sort((a, b) => a - b);

    return {
      personId: person.personId,
      activePackets: packets.filter(
        (p) =>
          p.spans[p.spans.length - 1].personId === person.personId &&
          p.currentStageId !== "PRODUCTION",
      ).length,
      totalCustodySeconds: mine.reduce((sum, s) => sum + s.calendarAdjustedSeconds, 0),
      medianReviewSeconds: reviews.length ? reviews[Math.floor(reviews.length / 2)] : null,
      reviewsSubmitted: reviews.length,
      commits: mine.reduce((sum, s) => sum + s.activitySignalCount, 0),
      testsAuthored: tests.filter((t) => t.ownerId === person.personId).length,
    } satisfies PersonStats;
  });

  return { ...base, requirements, pullRequests, tests, defects, deployments, personStats };
}
