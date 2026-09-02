import { useState } from "react";
import { DOC_UPDATE_FIXTURES, mockEmailContent, type DocUpdateNotification } from "../../api/docUpdateFixtures";
import { ago } from "../../lib/format";
import { SectionTitle } from "../visa/kit";

// ── Document classification ───────────────────────────────────────────

type DocMeta = {
  label: string;
  icon: string;
  colorClass: string;   // text color
  iconBg: string;       // icon box bg
  badgeBg: string;      // type badge bg + border
  accentHex: string;    // left-bar inline color
};

function classifyDoc(update: DocUpdateNotification): DocMeta {
  const msg   = update.commitMessage.toLowerCase();
  const title = update.pageTitle.toLowerCase();

  if (msg.includes("architecture") || msg.includes("diagram")) {
    return {
      label: "Architecture", icon: "⬡",
      colorClass: "text-[#a78bfa]",
      iconBg:     "bg-[#4c1d95]/20",
      badgeBg:    "bg-[#4c1d95]/15 border border-[#7c3aed]/30",
      accentHex:  "#7c3aed",
    };
  }
  if (msg.includes("mcp") || msg.includes("api") || msg.includes("interface")) {
    return {
      label: "API Reference", icon: "⟨/⟩",
      colorClass: "text-state-pass",
      iconBg:     "bg-state-pass/10",
      badgeBg:    "bg-state-pass/10 border border-state-pass/25",
      accentHex:  "#16a34a",
    };
  }
  if (msg.includes("setup") || msg.includes("torch") || msg.includes("build") || msg.includes("infrastructure")) {
    return {
      label: "Infrastructure", icon: "⚙",
      colorClass: "text-[#38bdf8]",
      iconBg:     "bg-[#0c4a6e]/25",
      badgeBg:    "bg-[#0c4a6e]/20 border border-[#0891b2]/30",
      accentHex:  "#0891b2",
    };
  }
  if (title.includes("payment")) {
    return {
      label: "Payment", icon: "◈",
      colorClass: "text-accent",
      iconBg:     "bg-accent/10",
      badgeBg:    "bg-accent/10 border border-accent/25",
      accentHex:  "#1a1f71",
    };
  }
  return {
    label: "Business", icon: "▤",
    colorClass: "text-accent",
    iconBg:     "bg-accent/10",
    badgeBg:    "bg-accent/10 border border-accent/25",
    accentHex:  "#1a1f71",
  };
}

function shortAuthor(full: string): string {
  const parts = full.split(" ").filter(Boolean);
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : full;
}

// ── Component ────────────────────────────────────────────────────────

export default function DocUpdatesTile({ now }: { now: Date }) {
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  return (
    <section>
      <SectionTitle
        icon="◎"
        aside={
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent">
            {DOC_UPDATE_FIXTURES.length} updates
          </span>
        }
      >
        Knowledge Feed
      </SectionTitle>

      <ul className="space-y-3">
        {DOC_UPDATE_FIXTURES.map((update) => {
          const email      = mockEmailContent(update);
          const isExpanded = expandedEmail === update.runId;
          const doc        = classifyDoc(update);

          return (
            <li
              key={update.runId}
              className="group relative overflow-hidden rounded-[12px] border border-ink-700 bg-black/[0.03] transition-all duration-150 hover:border-ink-500 hover:bg-black/[0.06] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
            >
              {/* left accent bar keyed to doc type */}
              <div
                className="absolute inset-y-0 left-0 w-[3px] rounded-l-[12px]"
                style={{ backgroundColor: doc.accentHex, opacity: 0.85 }}
              />

              <div className="px-4 py-3.5 pl-5">

                {/* ── Row 1: icon · title · status pill ── */}
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] text-[15px] font-bold ${doc.colorClass} ${doc.iconBg}`}
                  >
                    {doc.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="flex-1 text-[14px] font-bold leading-snug text-gray-100">
                        {update.pageTitle}
                      </span>
                      {/* modern status pill */}
                      <span className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-state-pass/30 bg-state-pass/10 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-state-pass">
                        <span className="size-1.5 rounded-full bg-state-pass" />
                        Published
                      </span>
                    </div>

                    {/* commit message */}
                    <p className="mt-1 truncate text-[12px] text-gray-500">
                      {update.commitMessage}
                    </p>
                  </div>
                </div>

                {/* ── Row 2: rationale (max 2 lines) ── */}
                <p className="mt-2.5 text-[12px] leading-relaxed text-gray-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {update.rationale}
                </p>

                {/* ── Row 3: metadata badges ── */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 text-[11px] text-gray-400">
                    <span className="text-gray-600 text-[10px]">✎</span>
                    {shortAuthor(update.commitAuthor)}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${doc.colorClass} ${doc.badgeBg}`}>
                    {doc.icon} {doc.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-gray-500">
                    <span className="text-gray-600 text-[10px]">⌚</span>
                    {ago(update.publishedAt, now)}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-gray-600">
                    {update.shortSha}
                  </span>
                </div>

                {/* ── Row 4: quick actions ── */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-2.5">
                  <a
                    href={update.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-accent/30 bg-accent/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/[0.16]"
                  >
                    ↗ View Document
                  </a>
                  <a
                    href="https://confluence.example.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11.5px] font-medium text-gray-400 transition-colors hover:border-ink-500 hover:text-gray-200"
                  >
                    ▤ Open KB
                  </a>
                  <button
                    onClick={() => setExpandedEmail(isExpanded ? null : update.runId)}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-state-warn/25 bg-state-warn/[0.06] px-2.5 py-1 text-[11.5px] font-medium text-state-warn transition-colors hover:bg-state-warn/[0.12]"
                  >
                    ✉ {isExpanded ? "Hide Email ↑" : "View Email ↓"}
                  </button>
                  <span className="ml-auto shrink-0 text-[11px] text-gray-600">
                    → {update.emailRecipients.length} recipient{update.emailRecipients.length !== 1 ? "s" : ""}:{" "}
                    <span className="text-gray-500">{update.emailRecipients.join(", ")}</span>
                  </span>
                </div>

                {/* ── Email panel (expandable) ── */}
                {isExpanded && (
                  <div className="mt-3 rounded-[10px] border border-state-warn/20 bg-state-warn/[0.04] p-3.5">
                    <div className="space-y-0.5 font-mono text-[11px]">
                      <p>
                        <span className="text-gray-600">From:    </span>
                        <span className="text-gray-400">{email.from}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">To:      </span>
                        <span className="text-gray-400">{email.to}</span>
                      </p>
                      <p>
                        <span className="text-gray-600">Subject: </span>
                        <span className="text-gray-300">{email.subject}</span>
                      </p>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-500">
                      {email.body}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
