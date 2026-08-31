import { Link } from "react-router";
import PageMeta from "../components/common/PageMeta";
import { Card, InsightCard, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

/**
 * Portfolio Intelligence Centre — all numbers are literals.
 * Global Health Score is computed from Health, Risk and Velocity dimensions.
 */

const LOBS = [
  {
    name: "Consumer Banking",    id: "CB-2023-Q3",
    health: 94, risks: 2, riskSeverity: "Low"    as const, velocity: 20,
    healthState: "On Track",  riskState: "Managed",   velState: "Accelerating",
    tone: "brand" as const,
    healthTrend: [8,  10, 9,  13, 15, 14, 18],
    riskTrend:   [4,  3,  3,  2,  3,  2,  2],
    velTrend:    [10, 12, 13, 14, 16, 18, 20],
  },
  {
    name: "Commercial Payments", id: "CP-2023-Q3",
    health: 76, risks: 5, riskSeverity: "High"   as const, velocity: -8,
    healthState: "At Risk",   riskState: "Escalate",  velState: "Declining",
    tone: "fail" as const,
    healthTrend: [18, 16, 15, 11, 9,  8,  6],
    riskTrend:   [1,  2,  2,  3,  4,  5,  5],
    velTrend:    [18, 16, 15, 11, 9,  8,  6],
  },
  {
    name: "Wealth Management",   id: "WM-2023-Q3",
    health: 91, risks: 1, riskSeverity: "Low"    as const, velocity: 18,
    healthState: "On Track",  riskState: "Managed",   velState: "Accelerating",
    tone: "brand" as const,
    healthTrend: [9,  11, 10, 12, 14, 13, 16],
    riskTrend:   [3,  2,  2,  1,  1,  1,  1],
    velTrend:    [7,  8,  9,  10, 11, 13, 18],
  },
  {
    name: "Fintech Partners",    id: "FP-2023-Q3",
    health: 82, risks: 3, riskSeverity: "Medium" as const, velocity: 14,
    healthState: "Monitor",   riskState: "Monitor",   velState: "Steady",
    tone: "warn" as const,
    healthTrend: [12, 9,  14, 10, 15, 11, 13],
    riskTrend:   [2,  2,  3,  3,  2,  3,  3],
    velTrend:    [4,  5,  3,  6,  4,  5,  14],
  },
];

const ACTIONS = [
  { title: "Approved Q4 Budget Draft",       by: "By CEO · 2 hrs ago",           tone: "pass" as const },
  { title: "Pending: Security Audit Review", by: "Assigned to CISO · Due today", tone: "warn" as const },
];

function riskTone(s: "Low" | "Medium" | "High"): "brand" | "warn" | "fail" {
  return s === "High" ? "fail" : s === "Medium" ? "warn" : "brand";
}

function velTone(v: number): "brand" | "warn" | "fail" {
  return v >= 10 ? "brand" : v >= 0 ? "warn" : "fail";
}

function LobName({ name, to }: { name: string; to: string }) {
  if (name === "Consumer Banking") {
    return (
      <Link to={to} className="underline text-accent">
        {name}
      </Link>
    );
  }
  return <>{name}</>;
}

function Spark({ points, tone }: { points: number[]; tone: string }) {
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

function cardAccent(tone: string) {
  return tone === "fail" ? "before:bg-state-fail" : tone === "warn" ? "before:bg-state-warn" : "before:bg-accent";
}

function valueTone(tone: string) {
  return tone === "fail" ? "text-state-fail" : tone === "warn" ? "text-state-warn" : "text-gray-100";
}

export default function Portfolio() {
  const avgHealth       = Math.round(LOBS.reduce((s, l) => s + l.health, 0) / LOBS.length);
  const totalRisks      = LOBS.reduce((s, l) => s + l.risks, 0);
  const highSevRisks    = LOBS.filter(l => l.riskSeverity === "High").reduce((s, l) => s + l.risks, 0);
  const avgVelocity     = Math.round(LOBS.reduce((s, l) => s + l.velocity, 0) / LOBS.length);
  const posVelCount     = LOBS.filter(l => l.velocity > 0).length;
  const riskPenalty     = LOBS.filter(l => l.riskSeverity === "High").length * 3
                        + LOBS.filter(l => l.riskSeverity === "Medium").length * 1;
  const velocityBonus   = avgVelocity >= 10 ? 3 : avgVelocity >= 0 ? 1 : avgVelocity >= -10 ? -2 : -5;
  const globalHealth    = Math.min(100, Math.max(0, avgHealth - riskPenalty + velocityBonus));
  const globalTone      = globalHealth >= 88 ? "pass" : globalHealth >= 80 ? "warn" : "fail";

  return (
    <>
      <PageMeta title="Portfolio · Portfolio Intelligence Centre" description="Portfolio-wide health, risk and momentum." />
      <PageHead
        kicker="Q3 Strategic Execution"
        title="Portfolio Intelligence Centre"
        blurb="Portfolio-wide view of health, risk, and velocity across every line of business."
        right={<MockButton>Export Report</MockButton>}
      />

      <div className="space-y-6 px-6 pb-10 pt-5">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Global Health Score"
            value={`${globalHealth}%`}
            tone={globalTone}
            progress={globalHealth}
            note={<span className="font-semibold text-gray-400">Health {avgHealth}% · Risk −{riskPenalty}pts · Velocity +{velocityBonus}pts</span>}
          />
          <StatCard
            label="Active Risks"
            value={String(totalRisks)}
            unit={`${highSevRisks} High Severity`}
            tone="fail"
            note={<span className="font-semibold text-state-warn">Requires immediate executive review</span>}
          />
          <StatCard
            label="Aggregate Velocity"
            value={`${avgVelocity >= 0 ? "+" : ""}${avgVelocity}%`}
            unit="vs Q2"
            tone={avgVelocity >= 10 ? "pass" : avgVelocity >= 0 ? "warn" : "fail"}
            note={`${posVelCount} of ${LOBS.length} LOBs trending positive`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div className="space-y-6">

            {/* ── Lines of Business Health ── */}
            <section>
              <SectionTitle aside={`${LOBS.length} active LOBs`}>Lines of Business Health</SectionTitle>
              <div className="space-y-3">
                {LOBS.map((l) => (
                  <Card key={l.id}
                    className={`relative flex flex-wrap items-center gap-4 overflow-hidden py-4 pl-6 pr-5 before:absolute before:inset-y-0 before:left-0 before:w-[4px] ${cardAccent(l.tone)}`}>
                    <div className="min-w-[168px] flex-1">
                      <p className="text-[15px] font-bold text-gray-100"><LobName name={l.name} to="/initiatives" /></p>
                      <p className="mt-0.5 font-mono text-[12px] text-gray-500">ID: {l.id}</p>
                    </div>
                    <div className="w-[92px]">
                      <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Health</p>
                      <p className={`text-[22px] font-bold leading-tight ${valueTone(l.tone)}`}>{l.health}%</p>
                    </div>
                    <Pill tone={l.tone} dot>{l.healthState}</Pill>
                    <Spark points={l.healthTrend} tone={l.tone} />
                    <span className="text-gray-600" aria-hidden="true">›</span>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── Lines of Business Risks ── */}
            <section>
              <SectionTitle aside={`${totalRisks} risks tracked`}>Lines of Business Risks</SectionTitle>
              <div className="space-y-3">
                {LOBS.map((l) => {
                  const tone = riskTone(l.riskSeverity);
                  return (
                    <Card key={l.id}
                      className={`relative flex flex-wrap items-center gap-4 overflow-hidden py-4 pl-6 pr-5 before:absolute before:inset-y-0 before:left-0 before:w-[4px] ${cardAccent(tone)}`}>
                      <div className="min-w-[168px] flex-1">
                        <p className="text-[15px] font-bold text-gray-100"><LobName name={l.name} to="/risk" /></p>
                        <p className="mt-0.5 font-mono text-[12px] text-gray-500">ID: {l.id}</p>
                      </div>
                      <div className="w-[92px]">
                        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Risks</p>
                        <p className={`text-[22px] font-bold leading-tight ${valueTone(tone)}`}>{l.risks}</p>
                      </div>
                      <Pill tone={tone} dot>{l.riskState}</Pill>
                      <Spark points={l.riskTrend} tone={tone} />
                      <span className="text-gray-600" aria-hidden="true">›</span>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* ── Lines of Business Aggregate Velocity ── */}
            <section>
              <SectionTitle aside={`${posVelCount} of ${LOBS.length} trending positive`}>Lines of Business Aggregate Velocity</SectionTitle>
              <div className="space-y-3">
                {LOBS.map((l) => {
                  const tone = velTone(l.velocity);
                  return (
                    <Card key={l.id}
                      className={`relative flex flex-wrap items-center gap-4 overflow-hidden py-4 pl-6 pr-5 before:absolute before:inset-y-0 before:left-0 before:w-[4px] ${cardAccent(tone)}`}>
                      <div className="min-w-[168px] flex-1">
                        <p className="text-[15px] font-bold text-gray-100"><LobName name={l.name} to="/initiatives" /></p>
                        <p className="mt-0.5 font-mono text-[12px] text-gray-500">ID: {l.id}</p>
                      </div>
                      <div className="w-[92px]">
                        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Velocity</p>
                        <p className={`text-[22px] font-bold leading-tight ${valueTone(tone)}`}>
                          {l.velocity >= 0 ? "+" : ""}{l.velocity}%
                        </p>
                      </div>
                      <Pill tone={tone} dot>{l.velState}</Pill>
                      <Spark points={l.velTrend} tone={tone} />
                      <span className="text-gray-600" aria-hidden="true">›</span>
                    </Card>
                  );
                })}
              </div>
            </section>

          </div>

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
