/**
 * Wire types for the SDLC spine read API.
 *
 * These mirror section 11 of docs/superpowers/specs/2026-08-15-sdlc-spine-design.md
 * exactly. They are the contract, not UI conveniences - when the FastAPI service
 * lands, the mock client is swapped for a fetch client and nothing else changes.
 *
 * All timestamps are ISO-8601 UTC. Presentation timezone is the client's problem.
 */

export type Phase = "define" | "build" | "verify" | "gate" | "live";

export type StageId =
  | "REQ_DRAFT"
  | "REQ_REVIEW"
  | "BASELINED"
  | "REFINEMENT"
  | "DEVELOPMENT"
  | "CODE_REVIEW"
  | "CI_VERIFY"
  | "MERGED_DEV"
  | "DEPLOY_DEV"
  | "GATE2_STAGING"
  | "STAGING_TEST"
  | "GATE3_UAT"
  | "GATE4_CAB"
  | "RELEASE_TAG"
  | "GATE5_PROD"
  | "PRODUCTION";

export interface Stage {
  id: StageId;
  label: string;
  phase: Phase;
  /** Role accountable while work sits here. Sourced from CODEOWNERS, the cd.yml
   *  environment gates, and the roster - not invented. */
  accountableRole: string;
  /** True where a named human must actively approve to release custody. */
  isGate: boolean;
}

export interface Person {
  personId: string;
  handle: string;
  name: string;
  role: string;
  initials: string;
  /** False when no SourceAccount could be resolved to this human. Surfaced,
   *  never guessed at. */
  resolved: boolean;
  timezone: string;
}

/** Why a span is not entirely trustworthy. Rendered, never hidden. */
export type SpanFlag =
  | "simulated_gate"
  | "assumed_calendar"
  | "clock_skew"
  | "no_activity_signal"
  | "unresolved_identity";

export interface CustodySpan {
  spanId: string;
  packetId: string;
  stageId: StageId;
  personId: string;
  enteredAt: string;
  /** Null while custody is still held. An open span is not a zero-length one. */
  exitedAt: string | null;
  custodySeconds: number;
  /** Working-hours intersection. What the dashboard shows by default. */
  calendarAdjustedSeconds: number;
  activitySignalCount: number;
  /** Null when activitySignalCount is 0. "No signal" and "zero minutes" are
   *  different claims and must not be collapsed. */
  activeMinutesEstimate: number | null;
  isOpen: boolean;
  isOverdue: boolean;
  flags: SpanFlag[];
}

export type WorkType =
  | "test-authoring"
  | "architectural-seam"
  | "compliance-surface"
  | "pipeline"
  | "application"
  | "documentation";

export interface WorkPacket {
  packetId: string;
  title: string;
  requirementIds: string[];
  issueKey: string | null;
  prNumbers: number[];
  currentStageId: StageId;
  release: string;
  sprint: string;
  workType: WorkType;
  openedAt: string;
  spans: CustodySpan[];
  /** 0-100. Derived from age in stage against that stage's own distribution. */
  riskScore: number;
  /** No stitching rule matched - an unlinked change. A governance finding,
   *  not an ingestion error. */
  isOrphan: boolean;
}

export interface StageLoad {
  stageId: StageId;
  packetCount: number;
  /** Median calendar-adjusted seconds currently held at this stage. */
  medianAgeSeconds: number;
  p90AgeSeconds: number;
  overdueCount: number;
}

export interface DataQualityReport {
  unresolvedIdentities: { source: string; accountId: string; seenCount: number }[];
  orphanPackets: string[];
  lowConfidenceEdges: number;
  simulatedGateSpans: number;
  staleWatermarks: { source: string; lastEventAt: string }[];
  /** Share of spans derived wholly from live sources. The honest headline. */
  liveSpanRatio: number;
}

export interface PortfolioSummary {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  stages: Stage[];
  people: Person[];
  stageLoads: StageLoad[];
  packets: WorkPacket[];
  dataQuality: DataQualityReport;
}

/* ---------------------------------------------------------------------------
 * Entity views behind the console tabs. Each maps to a graph vertex type in
 * the spine spec (section 5.1) and to a read endpoint in section 11.
 * ------------------------------------------------------------------------- */

export type Obligation = "shall" | "should" | "may" | "shall not";
export type Moscow = "MUST" | "SHOULD" | "COULD" | "WON'T";

export interface Requirement {
  reqId: string;
  title: string;
  document: string;
  obligation: Obligation;
  moscow: Moscow;
  baselined: boolean;
  ownerId: string;
  release: string;
  linkedIssueKeys: string[];
  linkedTestIds: string[];
  openDefectIds: string[];
  /** 0-1. Share of linked test cases passing at last execution. */
  verification: number;
  lastChangedAt: string;
}

export type PrState = "open" | "merged" | "closed" | "draft";
export type CheckState = "passing" | "failing" | "running" | "none";

export interface PullRequestRow {
  number: number;
  title: string;
  authorId: string;
  reviewerIds: string[];
  state: PrState;
  checks: CheckState;
  additions: number;
  deletions: number;
  filesChanged: number;
  requirementIds: string[];
  openedAt: string;
  mergedAt: string | null;
  /** Review custody: null where the PR was merged without one. */
  reviewSeconds: number | null;
  isLive: boolean;
}

export type TestStatus = "passed" | "failed" | "blocked" | "not-run";

export interface TestCaseRow {
  tcId: string;
  title: string;
  requirementId: string | null;
  ownerId: string;
  automated: boolean;
  status: TestStatus;
  lastRunAt: string | null;
  durationMs: number | null;
}

export type Severity = "critical" | "major" | "minor";
export type DefectStatus = "open" | "triaged" | "in-progress" | "resolved" | "verified";

export interface DefectRow {
  defectId: string;
  title: string;
  severity: Severity;
  status: DefectStatus;
  environment: string;
  raisedById: string;
  assigneeId: string | null;
  requirementId: string | null;
  raisedAt: string;
  ageSeconds: number;
}

export interface DeploymentRow {
  deploymentId: string;
  environment: "dev" | "staging" | "uat" | "production";
  imageDigest: string;
  actorId: string;
  createdAt: string;
  status: "succeeded" | "failed" | "pending";
  /** True where a named human actually approved, false where the environment
   *  had no configured reviewer and the transition was recorded anyway. */
  gateApproved: boolean;
  isLive: boolean;
}

export interface PersonStats {
  personId: string;
  activePackets: number;
  totalCustodySeconds: number;
  medianReviewSeconds: number | null;
  reviewsSubmitted: number;
  commits: number;
  testsAuthored: number;
}

export interface ConsoleData extends PortfolioSummary {
  requirements: Requirement[];
  pullRequests: PullRequestRow[];
  tests: TestCaseRow[];
  defects: DefectRow[];
  deployments: DeploymentRow[];
  personStats: PersonStats[];
}
