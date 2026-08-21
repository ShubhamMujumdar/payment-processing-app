import type { RunStatus } from "./code2doc";

export interface DocUpdateNotification {
  runId: string;
  shortSha: string;
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  commitMessage: string;
  commitAuthor: string;
  publishedAt: string;
  rationale: string;
  status: RunStatus;
  emailSentAt: string;
  emailRecipients: string[];
}

export const DOC_UPDATE_FIXTURES: DocUpdateNotification[] = [
  {
    runId: "run-0ccb43f",
    shortSha: "0ccb43f",
    pageId: "2752513",
    pageTitle: "Payment Service Business Overview",
    pageUrl: "https://confluence.example.com/pages/2752513",
    commitMessage: "docs: architecture diagram for the whole system",
    commitAuthor: "Shubham Mujumdar 5",
    publishedAt: "2026-08-21T08:16:43Z",
    rationale:
      "Architecture diagram commit updated the system topology. Section 3 (Technical Architecture) and Section 5 (Integration Points) revised to reflect new component boundaries.",
    status: "published",
    emailSentAt: "2026-08-21T08:16:45Z",
    emailRecipients: ["ops-team@cognizant.com", "platform-sre@cognizant.com"],
  },
  {
    runId: "run-fcdcca5",
    shortSha: "fcdcca5",
    pageId: "2588673",
    pageTitle: "Customer Service Business Overview",
    pageUrl: "https://confluence.example.com/pages/2588673",
    commitMessage: "feat(mcp): expose retrieval and the Confluence write as MCP tools",
    commitAuthor: "Shubham Mujumdar 5",
    publishedAt: "2026-08-20T14:34:12Z",
    rationale:
      "New MCP tool endpoints change the documented API surface. Section 4 (System Interfaces) updated with new tool descriptions and integration examples.",
    status: "published",
    emailSentAt: "2026-08-20T14:34:15Z",
    emailRecipients: ["ops-team@cognizant.com", "platform-sre@cognizant.com"],
  },
  {
    runId: "run-2745ef6",
    shortSha: "2745ef6",
    pageId: "2752513",
    pageTitle: "Payment Service Business Overview",
    pageUrl: "https://confluence.example.com/pages/2752513",
    commitMessage: "feat(setup): install PyTorch, choosing the build from the hardware",
    commitAuthor: "Shubham Mujumdar 5",
    publishedAt: "2026-08-19T10:25:38Z",
    rationale:
      "Infrastructure dependency change (PyTorch hardware-specific build). Section 6 (Infrastructure & Deployment) updated to reflect GPU/CPU conditional build requirements for the ML reranking component.",
    status: "published",
    emailSentAt: "2026-08-19T10:25:41Z",
    emailRecipients: ["ops-team@cognizant.com", "platform-sre@cognizant.com"],
  },
];

export function mockEmailContent(update: DocUpdateNotification): {
  from: string;
  to: string;
  subject: string;
  body: string;
} {
  return {
    from: "code2doc-bot@cognizant.com",
    to: update.emailRecipients.join(", "),
    subject: `[Docs Updated] ${update.pageTitle} — ${update.shortSha}`,
    body: [
      "The following Confluence page was automatically updated by the code2doc pipeline.",
      "",
      `Page:         ${update.pageTitle}`,
      `Triggered by: ${update.commitMessage}`,
      `Author:       ${update.commitAuthor}`,
      `Published:    ${update.publishedAt}`,
      "",
      "What changed:",
      update.rationale,
      "",
      `View updated page: ${update.pageUrl}`,
      "",
      "---",
      "This notification was sent automatically. Do not reply to this email.",
    ].join("\n"),
  };
}
