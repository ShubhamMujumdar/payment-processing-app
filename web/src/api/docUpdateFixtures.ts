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
    runId: "run-b6837b8",
    shortSha: "b6837b8",
    pageId: "2752513",
    pageTitle: "Payment Service Business Overview",
    pageUrl: "https://confluence.example.com/pages/2752513",
    commitMessage: "feat: raise minimum payment amount to 25",
    commitAuthor: "Shubham Mujumdar 5",
    publishedAt: "2026-09-03T08:16:43Z",
    rationale:
      "Minimum payment threshold raised from $10 to $25. Section 2 (Validation Rules) and Section 4 (Business Constraints) updated to reflect the new floor value and downstream rejection criteria.",
    status: "published",
    emailSentAt: "2026-09-03T08:16:45Z",
    emailRecipients: ["ops-team@cognizant.com", "platform-sre@cognizant.com"],
  },
  {
    runId: "run-356a384",
    shortSha: "356a384",
    pageId: "2588673",
    pageTitle: "Payment Limits & Controls",
    pageUrl: "https://confluence.example.com/pages/2588673",
    commitMessage: "feat: enforce per-payer daily and per-transaction limits",
    commitAuthor: "Shubham Mujumdar 5",
    publishedAt: "2026-09-02T14:34:12Z",
    rationale:
      "New per-payer daily cap and per-transaction ceiling introduced. Section 3 (Rate Limiting) updated with limit values, enforcement order, and error response codes.",
    status: "published",
    emailSentAt: "2026-09-02T14:34:15Z",
    emailRecipients: ["ops-team@cognizant.com", "platform-sre@cognizant.com"],
  },
  {
    runId: "run-1981ae3",
    shortSha: "1981ae3",
    pageId: "2752514",
    pageTitle: "Refund Processing — Business Rules",
    pageUrl: "https://confluence.example.com/pages/2752514",
    commitMessage: "feat: require a refund reason code",
    commitAuthor: "Shubham Mujumdar 5",
    publishedAt: "2026-09-01T10:25:38Z",
    rationale:
      "Refund requests now require a mandatory reason code field. Section 5 (Refund Request Schema) updated to mark reason_code as required and document accepted enum values.",
    status: "published",
    emailSentAt: "2026-09-01T10:25:41Z",
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
