import { useState } from "react";
import { DOC_UPDATE_FIXTURES, mockEmailContent } from "../../api/docUpdateFixtures";
import { Lozenge } from "../console/primitives";
import { ago } from "../../lib/format";

export default function DocUpdatesTile({ now }: { now: Date }) {
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
        Documentation updates
        <span className="tnum font-mono text-gray-600">{DOC_UPDATE_FIXTURES.length}</span>
        <span className="ml-auto inline-flex items-center gap-1 font-normal normal-case text-[10px] text-state-pass/80">
          ✉ ops team notified
        </span>
      </h2>

      <ul className="space-y-1.5">
        {DOC_UPDATE_FIXTURES.map((update) => {
          const email = mockEmailContent(update);
          const isExpanded = expandedEmail === update.runId;

          return (
            <li
              key={update.runId}
              className="rounded border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-gray-400">{update.shortSha}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-gray-200">
                  {update.pageTitle}
                </span>
                <Lozenge tone="pass">published</Lozenge>
                <span className="tnum shrink-0 font-mono text-[11px] text-gray-500">
                  {ago(update.publishedAt, now)}
                </span>
              </div>

              <p className="mt-1 truncate text-[12px] text-gray-500">
                {update.commitMessage}
                {" · "}
                <span className="text-gray-600">{update.commitAuthor}</span>
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded border border-state-pass/20 bg-state-pass/5 px-2 py-0.5 text-[11px] text-state-pass">
                  ✉ Email sent · {ago(update.emailSentAt, now)}
                </span>
                <span className="text-[11px] text-gray-600">
                  {update.emailRecipients.join(" · ")}
                </span>
                <button
                  onClick={() => setExpandedEmail(isExpanded ? null : update.runId)}
                  className="ml-auto text-[11px] text-brand-cyan/70 hover:text-brand-cyan"
                >
                  {isExpanded ? "hide email ↑" : "view email ↓"}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-3 rounded border border-white/[0.06] bg-black/20 p-3">
                  <div className="space-y-0.5 font-mono text-[11px]">
                    <p>
                      <span className="text-gray-600">From: </span>
                      <span className="text-gray-400">{email.from}</span>
                    </p>
                    <p>
                      <span className="text-gray-600">To: </span>
                      <span className="text-gray-400">{email.to}</span>
                    </p>
                    <p>
                      <span className="text-gray-600">Subject: </span>
                      <span className="text-gray-300">{email.subject}</span>
                    </p>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap font-mono text-[11px] text-gray-500">
                    {email.body}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
