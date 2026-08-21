import PageMeta from "../components/common/PageMeta";
import { Card, InsightCard, MockBanner, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

/**
 * Executive OKR alignment, reproduced from the design and fed entirely by the
 * constants below.
 *
 * This persona is outside what the system actually does -- there is no
 * portfolio, no line-of-business model and no OKR anywhere in the spine -- so
 * inventing a data source for it would be worse than admitting it. Every number
 * on this page is a literal, and the banner says so.
 */

const LOBS = [
  { name: "Consumer Banking", id: "CB-2023-Q3", alignment: 94, state: "On Track", tone: "brand", trend: [8, 10, 9, 13, 15, 14, 18] },
  { name: "Commercial Payments", id: "CP-2023-Q3", alignment: 76, state: "At Risk", tone: "fail", trend: [18, 16, 15, 11, 9, 8, 6] },
  { name: "Wealth Management", id: "WM-2023-Q3", alignment: 91, state: "On Track", tone: "brand", trend: [9, 11, 10, 12, 14, 13, 16] },
  { name: "Fintech Partners", id: "FP-2023-Q3", alignment: 82, state: "Monitor", tone: "warn", trend: [12, 9, 14, 10, 15, 11, 13] },
] as const;

const ACTIONS = [
  { title: "Approved Q4 Budget Draft", by: "By CEO · 2 hrs ago", tone: "pass" as const },
  { title: "Pending: Security Audit Review", by: "Assigned to CISO · Due today", tone: "warn" as const },
];

function Spark({ points, tone }: { points: readonly number[]; tone: string }) {
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${28 - ((p - min) / span) * 24}`)
    .join(" L ");
  const stroke = tone === "fail" ? "var(--color-state-fail)" : tone === "warn" ? "var(--color-state-warn)" : "var(--color-accent)";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-[104px]" aria-hidden="true">
      <path d={`M ${d}`} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Portfolio() {
  return (
    <>
      <PageMeta title="Portfolio · Executive OKR Alignment" description="Portfolio-wide health, risk and momentum." />
      <MockBanner what="It reproduces the executive portfolio view from the design." />

      <PageHead
        kicker="Q3 Strategic Execution"
        title="Executive OKR Alignment"
        blurb="Portfolio-wide view of health, risk, and momentum across every line of business."
        right={<><MockButton>↓ Export Report</MockButton><MockButton variant="solid">+ New Initiative</MockButton></>}
      />

      <div className="space-y-6 px-6 pb-10 pt-5">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Global Health Score" value="88%" tone="brand" progress={88}
            note={<span className="font-semibold text-state-warn">Target: 90%</span>} />
          <StatCard label="Active Risks" value="4" unit="High Impact" tone="fail"
            note="Requires immediate executive review" />
          <StatCard label="Aggregate Velocity" value="+12%" unit="vs Q2" tone="pass"
            note="Sustained upward trend across 3 of 4 LOBs" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <section>
            <SectionTitle aside="4 active LOBs">Lines of Business Alignment</SectionTitle>
            <div className="space-y-3">
              {LOBS.map((l) => (
                <Card key={l.id}
                  className={`relative flex flex-wrap items-center gap-4 overflow-hidden py-4 pl-6 pr-5 before:absolute before:inset-y-0 before:left-0 before:w-[4px] ${
                    l.tone === "fail" ? "before:bg-state-fail" : l.tone === "warn" ? "before:bg-state-warn" : "before:bg-accent"}`}>
                  <div className="min-w-[168px] flex-1">
                    <p className="text-[15px] font-bold text-gray-100">{l.name}</p>
                    <p className="mt-0.5 font-mono text-[12px] text-gray-500">ID: {l.id}</p>
                  </div>
                  <div className="w-[92px]">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Alignment</p>
                    <p className={`text-[22px] font-bold leading-tight ${l.tone === "fail" ? "text-state-fail" : l.tone === "warn" ? "text-state-warn" : "text-gray-100"}`}>
                      {l.alignment}%
                    </p>
                  </div>
                  <Pill tone={l.tone} dot>{l.state}</Pill>
                  <Spark points={l.trend} tone={l.tone} />
                  <span className="text-gray-600" aria-hidden="true">›</span>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>Command Intelligence</SectionTitle>
            <InsightCard
              kicker="Strategic Insight" meta="Just now"
              title="Reallocation Recommended"
              body="Commercial Payments shows a 15% velocity dip this sprint. Models suggest shifting 3 senior engineers from Fintech Partners to mitigate Q3 delivery risk."
              action="Execute Transfer"
            />
            <Card className="mt-4 px-5 py-4">
              <p className="text-[15px] font-bold text-gray-100">Recent Executive Actions</p>
              <ul className="mt-3 space-y-3">
                {ACTIONS.map((a) => (
                  <li key={a.title} className="flex gap-3">
                    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-[12px] ${
                      a.tone === "pass" ? "bg-[#e6f7ef] text-state-pass" : "bg-[#fff6e5] text-state-warn"}`}>
                      {a.tone === "pass" ? "✓" : "◷"}
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold text-gray-200">{a.title}</span>
                      <span className="block text-[12px] text-gray-500">{a.by}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="mt-4 px-5 py-4">
              <p className="text-[13px] font-bold text-gray-100">Q3 Commitment</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12.5px] text-gray-500">Delivered</span>
                <span className="font-mono text-[13px] font-bold text-accent">612 / 780 SP</span>
              </div>
              <Progress value={78} className="mt-2" />
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
