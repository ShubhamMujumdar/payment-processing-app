import { Link } from "react-router";
import PageMeta from "../components/common/PageMeta";
import { Card, InsightCard, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

/**
 * Portfolio Intelligence Centre -- all numbers are literals.
 * Global Health Score is computed from Health, Risk and Velocity dimensions.
 * OKR Alignment, Budget Envelope and Blocked Dependencies per RFP WMT-01/03/05/07/09.
 */

const LOBS = [
  {
    name: "Consumer Banking",    id: "CB-2023-Q3",
    health: 94, risks: 2, riskSeverity: "Low"    as const, velocity: 20,
    okrAligned: 8, okrTotal: 9, budgetUsed: 3.2, budgetTotal: 5.0, blockedDeps: 1,
    healthState: "On Track", tone: "brand" as const,
    healthTrend: [8, 10, 9, 13, 15, 14, 18],
  },
  {
    name: "Commercial Payments", id: "CP-2023-Q3",
    health: 76, risks: 5, riskSeverity: "High"   as const, velocity: -8,
    okrAligned: 5, okrTotal: 9, budgetUsed: 4.8, budgetTotal: 6.0, blockedDeps: 4,
    healthState: "At Risk",  tone: "fail" as const,
    healthTrend: [18, 16, 15, 11, 9, 8, 6],
  },
  {
    name: "Wealth Management",   id: "WM-2023-Q3",
    health: 91, risks: 1, riskSeverity: "Low"    as const, velocity: 18,
    okrAligned: 7, okrTotal: 8, budgetUsed: 2.1, budgetTotal: 3.5, blockedDeps: 0,
    healthState: "On Track", tone: "brand" as const,
    healthTrend: [9, 11, 10, 12, 14, 13, 16],
  },
  {
    name: "Fintech Partners",    id: "FP-2023-Q3",
    health: 82, risks: 3, riskSeverity: "Medium" as const, velocity: 14,
    okrAligned: 6, okrTotal: 8, budgetUsed: 3.5, budgetTotal: 4.0, blockedDeps: 2,
    healthState: "Monitor",  tone: "warn" as const,
    healthTrend: [12, 9, 14, 10, 15, 11, 13],
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

function okrTone(aligned: number, total: number): "brand" | "warn" | "fail" {
  const pct = aligned / total;
  return pct >= 0.85 ? "brand" : pct >= 0.70 ? "warn" : "fail";
}

function depTone(n: number): "brand" | "warn" | "fail" {
  return n === 0 ? "brand" : n <= 2 ? "warn" : "fail";
}

function cc(tone: "brand" | "warn" | "fail"): string {
  return tone === "fail" ? "text-state-fail" : tone === "warn" ? "text-state-warn" : "text-accent";
}

function TH({ children }: { children: string }) {
  return (
    <th className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
      {children}
    </th>
  );
}

function Spark({ points, tone }: { points: number[]; tone: string }) {
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${20 - ((p - min) / span) * 16}`)
    .join(" L ");
  const stroke = tone === "fail" ? "var(--color-state-fail)" : tone === "warn" ? "var(--color-state-warn)" : "var(--color-accent)";
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" className="h-6 w-20" aria-hidden="true">
      <path d={`M ${d}`} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Portfolio() {
  const avgHealth        = Math.round(LOBS.reduce((s, l) => s + l.health, 0) / LOBS.length);
  const totalRisks       = LOBS.reduce((s, l) => s + l.risks, 0);
  const highSevRisks     = LOBS.filter(l => l.riskSeverity === "High").reduce((s, l) => s + l.risks, 0);
  const avgVelocity      = Math.round(LOBS.reduce((s, l) => s + l.velocity, 0) / LOBS.length);
  const posVelCount      = LOBS.filter(l => l.velocity > 0).length;
  const riskPenalty      = LOBS.filter(l => l.riskSeverity === "High").length * 3
                         + LOBS.filter(l => l.riskSeverity === "Medium").length * 1;
  const velocityBonus    = avgVelocity >= 10 ? 3 : avgVelocity >= 0 ? 1 : avgVelocity >= -10 ? -2 : -5;
  const globalHealth     = Math.min(100, Math.max(0, avgHealth - riskPenalty + velocityBonus));
  const globalTone       = globalHealth >= 88 ? "pass" : globalHealth >= 80 ? "warn" : "fail";
  const totalBudgetUsed  = LOBS.reduce((s, l) => s + l.budgetUsed, 0);
  const totalBudgetAll   = LOBS.reduce((s, l) => s + l.budgetTotal, 0);
  const budgetPct        = Math.round(totalBudgetUsed / totalBudgetAll * 100);
  const totalBlockedDeps = LOBS.reduce((s, l) => s + l.blockedDeps, 0);

  return (
    <>
      <PageMeta title="Portfolio · Portfolio Intelligence Centre" description="Portfolio-wide health, risk and momentum." />
      <PageHead
        kicker="Q3 Strategic Execution"
        title="Portfolio Intelligence Centre"
        blurb="Health, risk, velocity and OKR alignment across all lines of business."
        right={<MockButton>Export Report</MockButton>}
      />

      <div className="space-y-4 px-6 pb-6 pt-4">

        {/* ── 4 Stat Cards ── */}
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            label={<Link to="/initiatives" className="text-accent underline underline-offset-2">Global Health Score</Link>}
            value={`${globalHealth}%`}
            tone={globalTone}
            progress={globalHealth}
            note={<span className="text-gray-400">Health {avgHealth}% · Risk -{riskPenalty}pts · Vel +{velocityBonus}pts</span>}
          />
          <StatCard
            label={<Link to="/risk" className="text-accent underline underline-offset-2">Active Risks</Link>}
            value={String(totalRisks)}
            unit={`${highSevRisks} High Severity`}
            tone="fail"
            note={<span className="font-semibold text-state-warn">Requires executive review</span>}
          />
          <StatCard
            label={<Link to="/analytics" className="text-accent underline underline-offset-2">Aggregate Velocity</Link>}
            value={`${avgVelocity >= 0 ? "+" : ""}${avgVelocity}%`}
            unit="vs Q2"
            tone={avgVelocity >= 10 ? "pass" : avgVelocity >= 0 ? "warn" : "fail"}
            note={`${posVelCount} of ${LOBS.length} LOBs trending positive`}
          />
          <StatCard
            label="Budget Envelope"
            value={`$${totalBudgetUsed.toFixed(1)}M`}
            unit={`of $${totalBudgetAll.toFixed(1)}M`}
            tone={budgetPct >= 90 ? "fail" : budgetPct >= 75 ? "warn" : "pass"}
            progress={budgetPct}
            note={`${totalBlockedDeps} cross-functional deps blocked`}
          />
        </div>

        {/* ── LOB Matrix Table ── */}
        <section>
          <SectionTitle aside={`${LOBS.length} active LOBs`}>Lines of Business Overview</SectionTitle>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ink-700 bg-ink-800">
                    <th className="w-[4px] p-0" />
                    <TH>Line of Business</TH>
                    <TH>Health</TH>
                    <TH>Risks</TH>
                    <TH>Velocity</TH>
                    <TH>OKR Align</TH>
                    <TH>Budget</TH>
                    <TH>Blocked Deps</TH>
                    <TH>Status</TH>
                    <TH>Trend</TH>
                  </tr>
                </thead>
                <tbody>
                  {LOBS.map((l) => {
                    const rt  = riskTone(l.riskSeverity);
                    const vt  = velTone(l.velocity);
                    const ot  = okrTone(l.okrAligned, l.okrTotal);
                    const dt  = depTone(l.blockedDeps);
                    const bar = l.tone === "fail" ? "bg-state-fail" : l.tone === "warn" ? "bg-state-warn" : "bg-accent";
                    const bpct = Math.round(l.budgetUsed / l.budgetTotal * 100);
                    const bbar = bpct >= 90 ? "bg-state-fail" : bpct >= 75 ? "bg-state-warn" : "bg-accent";
                    return (
                      <tr key={l.id} className="border-b border-ink-700 last:border-0 hover:bg-white/[0.02]">
                        {/* colour stripe */}
                        <td className={`w-[4px] p-0 ${bar}`} />

                        {/* LOB name */}
                        <td className="px-3 py-2.5 min-w-[160px]">
                          <p className="text-[13px] font-bold text-gray-100 leading-tight">
                            {l.id === "CB-2023-Q3"
                              ? <Link to="/initiatives" className="hover:text-accent hover:underline underline-offset-2">{l.name}</Link>
                              : l.name}
                          </p>
                          <p className="font-mono text-[10.5px] text-gray-500">{l.id}</p>
                        </td>

                        {/* Health */}
                        <td className="px-3 py-2.5">
                          <span className={`font-mono text-[14px] font-bold ${cc(l.tone)}`}>{l.health}%</span>
                        </td>

                        {/* Risks */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`font-mono text-[14px] font-bold ${cc(rt)}`}>{l.risks}</span>
                          <span className={`ml-1 text-[10.5px] ${cc(rt)}`}>{l.riskSeverity}</span>
                        </td>

                        {/* Velocity */}
                        <td className="px-3 py-2.5">
                          <span className={`font-mono text-[14px] font-bold ${cc(vt)}`}>
                            {l.velocity >= 0 ? "+" : ""}{l.velocity}%
                          </span>
                        </td>

                        {/* OKR Alignment */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`font-mono text-[14px] font-bold ${cc(ot)}`}>{l.okrAligned}/{l.okrTotal}</span>
                          <span className="ml-1 text-[10.5px] text-gray-500">aligned</span>
                        </td>

                        {/* Budget */}
                        <td className="px-3 py-2.5 min-w-[110px]">
                          <div className="whitespace-nowrap">
                            <span className="font-mono text-[12.5px] font-bold text-gray-200">${l.budgetUsed.toFixed(1)}M</span>
                            <span className="text-[10.5px] text-gray-500"> / ${l.budgetTotal.toFixed(1)}M</span>
                          </div>
                          <div className="mt-1 h-[3px] w-16 rounded-full bg-ink-700">
                            <div className={`h-[3px] rounded-full ${bbar}`} style={{ width: `${bpct}%` }} />
                          </div>
                        </td>

                        {/* Blocked Deps */}
                        <td className="px-3 py-2.5">
                          <span className={`font-mono text-[14px] font-bold ${cc(dt)}`}>{l.blockedDeps}</span>
                          {l.blockedDeps > 0 && (
                            <span className="ml-1 text-[10.5px] text-gray-500">blocked</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <Pill tone={l.tone} dot>{l.healthState}</Pill>
                        </td>

                        {/* Trend */}
                        <td className="px-3 py-2.5">
                          <Spark points={l.healthTrend} tone={l.tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* ── Command Intelligence (compact 2-col) ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <InsightCard
            kicker="Strategic Insight" meta="Just now"
            title="Reallocation Recommended"
            body="Commercial Payments shows a 15% velocity dip this sprint. Models suggest shifting 3 senior engineers from Fintech Partners to mitigate Q3 delivery risk."
            action="Execute Transfer"
          />
          <Card className="px-4 py-3 space-y-3">
            <div>
              <p className="text-[13.5px] font-bold text-gray-100">Recent Executive Actions</p>
              <ul className="mt-2 space-y-2">
                {ACTIONS.map((a) => (
                  <li key={a.title} className="flex gap-2.5">
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded text-[11px] ${
                      a.tone === "pass" ? "bg-[#e6f7ef] text-state-pass" : "bg-[#fff6e5] text-state-warn"}`}>
                      {a.tone === "pass" ? "✓" : "◷"}
                    </span>
                    <span>
                      <span className="block text-[12.5px] font-semibold text-gray-200">{a.title}</span>
                      <span className="block text-[11px] text-gray-500">{a.by}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-ink-700 pt-2.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-bold text-gray-100">Q3 Commitment</p>
                <span className="font-mono text-[12px] font-bold text-accent">612 / 780 SP</span>
              </div>
              <Progress value={78} className="mt-1.5" />
            </div>
          </Card>
        </div>

      </div>
    </>
  );
}
