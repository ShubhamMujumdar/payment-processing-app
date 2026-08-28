import PageMeta from "../components/common/PageMeta";
import { Card, InsightCard, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

/** Project detail for the executive persona. Static, per the design. */

const TEAM = {
  Development: [
    { name: "Sarah Jenkins", role: "Lead Engineer", cap: "95% Cap", tone: "brand" as const },
    { name: "David Chen", role: "Backend Dev", cap: "100% Cap", tone: "warn" as const },
    { name: "Marcus Johnson", role: "Frontend Dev", cap: "110% Cap (Over)", tone: "fail" as const },
  ],
};

const HANDOFF = [
  { label: "Spec Completion", value: "92%", pct: 92, tone: "brand" as const, note: "Core flows documented. Edge cases pending review." },
  { label: "Asset Export", value: "100%", pct: 100, tone: "pass" as const, note: "All SVG/PNG assets synced to repository." },
  { label: "Token Alignment", value: "88%", pct: 88, tone: "warn" as const, note: "Typography tokens mapped. Spacing tokens require sync." },
];

export default function Strategy() {
  return (
    <>
      <PageMeta title="Strategy · Project Apollo" description="Detailed health and execution." />
      <PageHead
        breadcrumb={["Strategy", "Active Projects", "ID: PRJ-009A"]}
        title="Project Apollo: Detailed Health & Execution"
        right={<Pill tone="pass" dot>On Track</Pill>}
      />

      <div className="space-y-6 px-6 pb-10 pt-5">
        <div className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,0.72fr))_1.4fr]">
          <StatCard label="Overall Completion" value="68" unit="%" tone="brand" progress={68} />
          <StatCard label="Health Score" value="94" unit="/100" tone="brand"
            note={<span className="font-semibold text-state-pass">↗ +2 pts vs last sprint</span>} />
          <StatCard label="Strategic Alignment" value="High" tone="brand" note="Direct tie to Q3 OKR #2" />
          <InsightCard
            kicker="Executive Insight"
            title="Predicted bottleneck ahead"
            body="Predicted bottleneck in the upcoming API integration phase. Recommend reallocating 1 backend developer from Project Gemini for Sprint 14 to optimize handoff workflow and maintain velocity."
            action="Review Allocation Proposal"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="px-6 py-5">
            <div className="flex items-baseline justify-between">
              <p className="text-[19px] font-bold text-gray-100">Team Composition</p>
              <span className="text-[12.5px] text-gray-500">7 Active Members</span>
            </div>

            <p className="mt-4 font-mono text-[11.5px] font-bold uppercase tracking-wider text-gray-500">Development (3)</p>
            <ul className="mt-2 divide-y divide-ink-700">
              {TEAM.Development.map((m) => (
                <li key={m.name} className="flex items-center gap-3 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">
                    {m.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-gray-100">{m.name}</span>
                    <span className="block text-[12.5px] text-gray-500">{m.role}</span>
                  </span>
                  <Pill tone={m.tone}>{m.cap}</Pill>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-gray-500">Design (2)</p>
                <p className="mt-2 text-[12.5px] text-gray-500">Both at 80% Cap</p>
              </div>
              <div>
                <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-gray-500">QA / Test (2)</p>
                <p className="mt-2 text-[12.5px] text-gray-500">Available for Sprint 14</p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="px-5 py-5">
              <p className="text-[19px] font-bold text-gray-100">Team Readiness</p>
              <div className="mt-3 flex items-center gap-4">
                <span className="grid size-[76px] shrink-0 place-items-center rounded-full border-[3px] border-accent text-[15px] font-bold text-accent">
                  High
                </span>
                <p className="text-[13px] leading-relaxed text-gray-400">
                  Based on capacity heatmaps, the team has sufficient bandwidth to absorb the
                  upcoming backlog, barring the highlighted API integration phase.
                </p>
              </div>
            </Card>

            <Card className="px-5 py-5">
              <p className="text-[19px] font-bold text-gray-100">Velocity &amp; Scope Tracker</p>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-gray-200">Current Sprint Commitment</span>
                  <span className="font-mono text-[13px] font-bold text-accent">85 SP</span>
                </div>
                <Progress value={72} className="mt-2" />
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-gray-200">Future Backlog (Unscheduled)</span>
                  <span className="font-mono text-[13px] font-bold text-gray-400">450 SP</span>
                </div>
                <Progress value={38} tone="idle" className="mt-2" />
                <p className="mt-2 text-right text-[12px] text-gray-500">~5.2 Sprints Remaining</p>
              </div>
            </Card>
          </div>
        </div>

        <section>
          <Card className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Design-to-Dev Handoff Status</SectionTitle>
              <MockButton>View Figma Spec</MockButton>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {HANDOFF.map((h) => (
                <Card key={h.label} className="px-5 py-4">
                  <p className="text-[13.5px] font-semibold text-gray-300">{h.label}</p>
                  <p className={`mt-1 text-[28px] font-bold leading-none ${
                    h.tone === "pass" ? "text-state-pass" : h.tone === "warn" ? "text-state-warn" : "text-accent"}`}>
                    {h.value}
                  </p>
                  <Progress value={h.pct} tone={h.tone} className="mt-3" />
                  <p className="mt-2 text-[12.5px] leading-snug text-gray-500">{h.note}</p>
                </Card>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}
