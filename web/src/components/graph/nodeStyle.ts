/**
 * Node styling for the graph canvas.
 *
 * Colours come from the same sixteen-step Cognizant ramp the rest of the
 * console uses, assigned so that entities near each other in the delivery
 * lifecycle sit near each other in hue: documents and requirements at the
 * indigo end, code and tests through the blues and cyans, deployment and
 * release at the teal end.
 *
 * The Code hierarchy shares the cyan band and separates by lightness, because
 * a method and the class containing it are the same kind of thing at different
 * granularity — that relationship should be visible, not disguised as two
 * unrelated categories.
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

  // The code hierarchy: coarse to fine, dark to light within the cyan band.
  Code: "var(--color-stage-12)",
  CodeFile: "var(--color-stage-11)",
  CodeClass: "var(--color-stage-12)",
  CodeInterface: "var(--color-stage-12)",
  CodeRecord: "var(--color-stage-13)",
  CodeEnum: "var(--color-stage-13)",
  CodeMethod: "var(--color-stage-13)",
  CodeField: "var(--color-stage-15)",

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
  PullRequest: 18,
  Document: 18,
  Release: 18,
  WorkItem: 17,
  Deployment: 17,
  TestCase: 16,
  Commit: 15,
  PipelineRun: 15,
  CustodySpan: 14,
  Stage: 14,
  SourceAccount: 14,
  TestRun: 14,

  Code: 16,
  CodeFile: 18,
  CodeClass: 17,
  CodeInterface: 17,
  CodeRecord: 16,
  CodeEnum: 15,
  CodeMethod: 14,
  CodeField: 11,
};

/** What to call a class on screen. The store needs unambiguous type names;
 *  a reader does not need the "Code" prefix repeated eight times. */
export const TYPE_LABEL: Record<string, string> = {
  Code: "Code (all)",
  CodeFile: "File",
  CodeClass: "Class",
  CodeInterface: "Interface",
  CodeEnum: "Enum",
  CodeRecord: "Record",
  CodeMethod: "Method",
  CodeField: "Field",
  CustodySpan: "Custody span",
  SourceAccount: "Source account",
  WorkPacket: "Work packet",
  WorkItem: "Work item",
  PullRequest: "Pull request",
  PipelineRun: "Pipeline run",
  TestCase: "Test case",
  TestRun: "Test run",
};

export const typeLabel = (type: string): string => TYPE_LABEL[type] ?? type;

/** Subtypes of Code, so the explorer can group them under one heading and
 *  offer "everything" alongside the specific classes. */
export const CODE_TYPES = [
  "CodeFile",
  "CodeClass",
  "CodeInterface",
  "CodeEnum",
  "CodeRecord",
  "CodeMethod",
  "CodeField",
];

export const isCodeType = (type: string): boolean =>
  type === "Code" || CODE_TYPES.includes(type);
