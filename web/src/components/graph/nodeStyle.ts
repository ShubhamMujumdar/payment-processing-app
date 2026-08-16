/**
 * Node styling for the graph canvas.
 *
 * Colours come from the same sixteen-step Cognizant ramp the rest of the
 * console uses, assigned so that entities near each other in the delivery
 * lifecycle sit near each other in hue: documents and requirements at the
 * indigo end, code and tests through the blues and cyans, deployment and
 * release at the teal end.
 *
 * Defect is the single deliberate exception. It is a problem state rather than
 * a stage, and it has to be findable in a dense graph at a glance, so it takes
 * the semantic red from outside the brand band.
 */

export const NODE_COLOR: Record<string, string> = {
  Document: "var(--color-stage-1)",
  Stage: "var(--color-stage-2)",
  SourceAccount: "var(--color-stage-3)",
  Requirement: "var(--color-stage-4)",
  Person: "var(--color-stage-5)",
  WorkItem: "var(--color-stage-6)",
  WorkPacket: "var(--color-stage-7)",
  Commit: "var(--color-stage-8)",
  PullRequest: "var(--color-stage-9)",
  CustodySpan: "var(--color-stage-10)",
  PipelineRun: "var(--color-stage-11)",
  CodeUnit: "var(--color-stage-12)",
  TestCase: "var(--color-stage-14)",
  TestRun: "var(--color-stage-14)",
  Deployment: "var(--color-stage-15)",
  Release: "var(--color-stage-16)",
  Defect: "var(--color-state-fail)",
};

/** Size carries importance, not degree: a requirement is a bigger idea than a
 *  field, and a graph where everything is the same size reads as noise. */
export const NODE_RADIUS: Record<string, number> = {
  Requirement: 22,
  WorkPacket: 20,
  Person: 20,
  Defect: 19,
  CodeUnit: 16,
  TestCase: 16,
  PullRequest: 18,
  Commit: 15,
  CustodySpan: 14,
  Deployment: 17,
  PipelineRun: 15,
  WorkItem: 17,
  Stage: 14,
  SourceAccount: 14,
  Document: 18,
  Release: 18,
  TestRun: 14,
};

export const TYPE_ORDER = Object.keys(NODE_COLOR);
