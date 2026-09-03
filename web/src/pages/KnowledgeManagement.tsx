import { useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../components/common/PageMeta";
import { Card, Progress } from "../components/visa/kit";

type Dir = "up" | "down" | "flat";
type Kpi = { label: string; value: string; delta?: string; dir?: Dir; description: string; progress?: number };
type WatchItem = { text: string; status: "Risk" | "Warn" | "Good" };

const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const STATUS_STYLE = {
  Risk: "border-state-fail/40 bg-state-fail/20 text-state-fail",
  Warn: "border-state-warn/40 bg-state-warn/20 text-state-warn",
  Good: "border-state-pass/40 bg-state-pass/20 text-state-pass",
};

function dirSymbol(dir: Dir = "flat") {
  return dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <Card className="flex min-h-[120px] flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase leading-tight tracking-wide text-gray-500">{kpi.label}</p>
        {kpi.delta && (
          <span className="shrink-0 rounded-full bg-ink-750 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
            {dirSymbol(kpi.dir)} {kpi.delta}
          </span>
        )}
      </div>
      <p className="mt-2 text-[22px] font-bold leading-none tracking-tight text-gray-100">{kpi.value}</p>
      {kpi.progress !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          <Progress
            value={kpi.progress}
            tone={kpi.progress >= 90 ? "pass" : kpi.progress >= 75 ? "brand" : kpi.progress >= 60 ? "warn" : "fail"}
            className="flex-1"
          />
          <span className="w-7 text-right text-[10px] font-semibold text-gray-500">{kpi.progress}%</span>
        </div>
      )}
      <p className="mt-auto pt-2 text-[10.5px] leading-4 text-gray-500">{kpi.description}</p>
    </Card>
  );
}

function KpiGrid({ items }: { items: Kpi[] }) {
  return <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(k => <KpiCard key={k.label} kpi={k} />)}</section>;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-[18px] font-bold text-gray-100">{title}</h2>
      {subtitle && <p className="text-[12px] text-gray-500">{subtitle}</p>}
    </div>
  );
}

function MonthlyBarChart({ title, series }: { title?: string; series: { name: string; values: number[]; color: string }[] }) {
  const max = Math.max(...series.flatMap(s => s.values), 1);
  return (
    <Card className="p-3.5">
      <SectionHeading title={title ?? "Monthly KPI Trend"} subtitle="Mar to Aug" />
      <div className="flex h-32 items-end gap-2 border-b border-ink-700 px-1 pb-4 pt-2">
        {MONTHS.map((month, i) => (
          <div key={month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5">
              {series.map(s => (
                <div key={s.name} title={`${s.name}: ${s.values[i]}`} className="w-full max-w-3 rounded-t-sm transition-opacity hover:opacity-80"
                  style={{ height: `${Math.max((s.values[i] / max) * 100, 5)}%`, background: s.color }} />
              ))}
            </div>
            <span className="mt-1.5 text-center text-[9px] text-gray-500">{month}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3">
        {series.map(s => <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-gray-500"><i className="h-1.5 w-1.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </Card>
  );
}

function Watchlist({ items }: { items: WatchItem[] }) {
  return (
    <Card className="p-5">
      <SectionHeading title="High-Priority Watchlist" subtitle={`${items.length} items requiring attention`} />
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item, i) => (
          <div key={`${item.text}-${i}`} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-800 p-3">
            <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[item.status]}`}>{item.status}</span>
            <p className="text-[12px] leading-5 text-gray-300">{item.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PageHeader({ scope }: { scope: string }) {
  return (
    <header>
      <h1 className="text-[28px] font-bold tracking-tight text-gray-100">Knowledge Management</h1>
      <p className="mt-1 text-[13px] text-gray-500">{scope} · Q3 2026</p>
    </header>
  );
}

const EXEC_KPIS: Kpi[] = [
  { label: "Knowledge Coverage", value: "89%", delta: "+6%", dir: "up", progress: 89, description: "Complete documentation across all lines of business" },
  { label: "Freshness Compliance", value: "84%", delta: "+4%", dir: "up", progress: 84, description: "Content reviewed within policy windows" },
  { label: "AI Update Adoption", value: "78%", delta: "+8%", dir: "up", progress: 78, description: "Suggested updates accepted across the organisation" },
  { label: "Search Success", value: "87%", delta: "+3%", dir: "up", progress: 87, description: "Search sessions ending with a useful result" },
  { label: "Release Readiness", value: "91%", delta: "+5%", dir: "up", progress: 91, description: "Releases with approved supporting documentation" },
  { label: "Teams Decisions Captured", value: "82%", delta: "+7%", dir: "up", progress: 82, description: "Key decisions converted into governed knowledge" },
  { label: "Knowledge Graph Coverage", value: "76%", delta: "+9%", dir: "up", progress: 76, description: "Priority assets connected through validated relationships" },
  { label: "Top Knowledge Gaps", value: "34", delta: "-8", dir: "down", progress: 66, description: "High-impact gaps requiring an owner or approved content" },
];

type LobStatus = "Good" | "Warn" | "Risk";
type Lob = {
  name: string;
  status: LobStatus;
  health: number;
  coverage: number;
  freshness: number;
  projects: number;
  healthTrend: number[];
  metrics: { label: string; value: string; progress: number }[];
  segments: { name: string; health: number; status: LobStatus }[];
};

const STATUS_COLOR: Record<LobStatus, string> = {
  Good: "var(--color-state-pass)",
  Warn: "var(--color-state-warn)",
  Risk: "var(--color-state-fail)",
};

const STATUS_TONE = {
  Good: "pass",
  Warn: "warn",
  Risk: "fail",
} as const;

const LOBS: Lob[] = [
  {
    name: "Consumer Banking", status: "Good", health: 90, coverage: 92, freshness: 88, projects: 19,
    healthTrend: [85, 86, 87, 88, 89, 90],
    metrics: [
      { label: "AI Update Adoption", value: "81%", progress: 81 },
      { label: "Search Success", value: "90%", progress: 90 },
      { label: "Release Readiness", value: "93%", progress: 93 },
      { label: "Open Knowledge Gaps", value: "6", progress: 82 },
    ],
    segments: [
      { name: "Cards & Payments", health: 93, status: "Good" },
      { name: "Deposits & Savings", health: 91, status: "Good" },
      { name: "Lending", health: 86, status: "Good" },
    ],
  },
  {
    name: "Commercial Payments", status: "Warn", health: 83, coverage: 85, freshness: 80, projects: 24,
    healthTrend: [83, 82, 83, 82, 83, 83],
    metrics: [
      { label: "AI Update Adoption", value: "74%", progress: 74 },
      { label: "Search Success", value: "83%", progress: 83 },
      { label: "Release Readiness", value: "85%", progress: 85 },
      { label: "Open Knowledge Gaps", value: "11", progress: 66 },
    ],
    segments: [
      { name: "Acquiring", health: 87, status: "Good" },
      { name: "B2B Transfers", health: 82, status: "Warn" },
      { name: "Settlement", health: 76, status: "Warn" },
    ],
  },
  {
    name: "Wealth Management", status: "Good", health: 87, coverage: 88, freshness: 86, projects: 14,
    healthTrend: [82, 83, 84, 85, 86, 87],
    metrics: [
      { label: "AI Update Adoption", value: "79%", progress: 79 },
      { label: "Search Success", value: "88%", progress: 88 },
      { label: "Release Readiness", value: "89%", progress: 89 },
      { label: "Open Knowledge Gaps", value: "7", progress: 80 },
    ],
    segments: [
      { name: "Advisory", health: 90, status: "Good" },
      { name: "Portfolio Mgmt", health: 88, status: "Good" },
      { name: "Retirement", health: 84, status: "Good" },
    ],
  },
  {
    name: "Fintech Partners", status: "Risk", health: 78, coverage: 81, freshness: 75, projects: 17,
    healthTrend: [83, 82, 81, 80, 79, 78],
    metrics: [
      { label: "AI Update Adoption", value: "70%", progress: 70 },
      { label: "Search Success", value: "80%", progress: 80 },
      { label: "Release Readiness", value: "82%", progress: 82 },
      { label: "Open Knowledge Gaps", value: "14", progress: 58 },
    ],
    segments: [
      { name: "Embedded Finance", health: 82, status: "Warn" },
      { name: "API Marketplace", health: 78, status: "Warn" },
      { name: "Partner Onboarding", health: 71, status: "Risk" },
    ],
  },
];

function LobDrilldown({ lob }: { lob: Lob }) {
  return (
    <Card className="mt-4 border-accent/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[18px] font-bold text-gray-100">{lob.name}</h3>
          <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[lob.status]}`}>{lob.status}</span>
        </div>
        <p className="text-[12px] text-gray-500">{lob.projects} active projects · {lob.health}% KM health</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Knowledge indicators</p>
          <div className="space-y-3">
            {lob.metrics.map(m => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[12px] text-gray-400">{m.label}</span>
                <Progress value={m.progress} tone={m.progress >= 90 ? "pass" : m.progress >= 75 ? "brand" : m.progress >= 60 ? "warn" : "fail"} className="flex-1" />
                <span className="w-10 text-right text-[12px] font-semibold text-gray-200">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Segment breakdown</p>
          <div className="space-y-2">
            {lob.segments.map(s => (
              <div key={s.name} className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                  <span className="text-[12px] text-gray-300">{s.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={s.health} tone={s.health >= 90 ? "pass" : s.health >= 75 ? "brand" : s.health >= 60 ? "warn" : "fail"} className="w-24" />
                  <span className="w-9 text-right text-[12px] font-semibold text-gray-200">{s.health}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ExecutiveDashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const activeLob = LOBS.find(l => l.name === selected) ?? null;
  return (
    <DashboardShell>
      <PageHeader scope="Executive · Organisation-wide aggregate across 4 LOBs" />
      <KpiGrid items={EXEC_KPIS} />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-5">
          <SectionHeading title="KM Health Score" subtitle="Aggregate across all LOBs" />
          <div className="flex items-end justify-between"><p className="text-[42px] font-bold text-gray-100">86%</p><span className="mb-2 text-[12px] font-semibold text-state-pass">↑ 5%</span></div>
          <Progress value={86} className="mt-4" />
          <p className="mt-4 text-[12px] text-gray-500">Composite of coverage, freshness, adoption, search success, and release readiness.</p>
        </Card>
        <MonthlyBarChart series={[
          { name: "Coverage", values: [77, 79, 81, 84, 87, 89], color: "var(--color-state-pass)" },
          { name: "Freshness", values: [74, 76, 78, 80, 82, 84], color: "#60a5fa" },
          { name: "Adoption", values: [55, 60, 63, 68, 74, 78], color: "#f59e0b" },
        ]} />
      </section>
      <section>
        <SectionHeading title="Lines of Business" subtitle="Select a card to drill into details" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LOBS.map(lob => {
            const isActive = selected === lob.name;
            return (
              <button
                key={lob.name}
                type="button"
                onClick={() => setSelected(isActive ? null : lob.name)}
                aria-expanded={isActive}
                className="text-left"
              >
                <Card className={`h-full p-5 transition ${isActive ? "ring-2 ring-accent" : "hover:border-gray-500"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Line of Business</p>
                      <h3 className="mt-1 min-h-[3.25rem] text-[18px] font-bold leading-tight text-gray-100">{lob.name}</h3>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[lob.status]}`}>{lob.status}</span>
                  </div>
                  <p className="mt-4 text-[30px] font-bold text-gray-100">{lob.health}%</p>
                  <Progress value={lob.health} tone={STATUS_TONE[lob.status]} className="mt-2" />
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div><p className="font-semibold text-gray-200">{lob.coverage}%</p><p className="text-[10px] text-gray-500">Coverage</p></div>
                    <div><p className="font-semibold text-gray-200">{lob.freshness}%</p><p className="text-[10px] text-gray-500">Freshness</p></div>
                    <div><p className="font-semibold text-gray-200">{lob.projects}</p><p className="text-[10px] text-gray-500">Projects</p></div>
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-accent">{isActive ? "Hide details ▲" : "View details ▼"}</p>
                </Card>
              </button>
            );
          })}
        </div>
        {activeLob && <LobDrilldown lob={activeLob} />}
      </section>
      <Watchlist items={[
        { status: "Risk", text: "Fintech Partners freshness is below the organisation target." },
        { status: "Warn", text: "Commercial Payments has elevated unresolved knowledge gaps." },
        { status: "Good", text: "Wealth Management KM health has improved 5 points over 6 sprints, with Advisory segment leading at 90% coverage." },
        { status: "Good", text: "Consumer Banking is above target for coverage and freshness." },
      ]} />
    </DashboardShell>
  );
}

const PM_KPIS: Kpi[] = [
  { label: "Documentation Completion", value: "81%", delta: "+7%", dir: "up", progress: 81, description: "Required project artifacts completed" },
  { label: "Open Content Requests", value: "46", delta: "9 overdue", dir: "flat", progress: 62, description: "Requests across Payments, Customer Service Portal, Fraud & Risk Engine, and Merchant Onboarding" },
  { label: "Approval Cycle Time", value: "3.4d", delta: "Target 2d", dir: "down", progress: 59, description: "Average draft-to-approval duration" },
  { label: "SLA Compliance", value: "88%", delta: "+2%", dir: "up", progress: 88, description: "Reviews and approvals completed on time" },
  { label: "Action Items Captured", value: "93%", delta: "+5%", dir: "up", progress: 93, description: "Meeting actions stored with owners" },
  { label: "Decision Traceability", value: "86%", delta: "+6%", dir: "up", progress: 86, description: "Decisions linked to delivery artifacts" },
  { label: "Release Doc Readiness", value: "84%", delta: "+4%", dir: "up", progress: 84, description: "Milestones with approved release documentation" },
  { label: "Project KM Health", value: "79%", delta: "+3%", dir: "up", progress: 79, description: "Aggregate health across the four projects" },
];

// Portfolio entities — matches Executive Portfolio page (Portfolio.tsx LOBS)
const PROJECTS = [
  { code: "CB-2023-Q3", shortCode: "CB", name: "Consumer Banking",    status: "Good" as const, health: 94, programs: 3,  projects: 12, milestoneProgress: 87, risks: 2,  budgetUsed: 3.2, budgetTotal: 5.0 },
  { code: "CP-2023-Q3", shortCode: "CP", name: "Commercial Payments", status: "Risk" as const, health: 76, programs: 2,  projects:  9, milestoneProgress: 58, risks: 5,  budgetUsed: 4.8, budgetTotal: 6.0 },
  { code: "WM-2023-Q3", shortCode: "WM", name: "Wealth Management",   status: "Good" as const, health: 91, programs: 2,  projects:  8, milestoneProgress: 91, risks: 1,  budgetUsed: 2.1, budgetTotal: 3.5 },
  { code: "FP-2023-Q3", shortCode: "FP", name: "Fintech Partners",    status: "Warn" as const, health: 82, programs: 2,  projects:  7, milestoneProgress: 74, risks: 3,  budgetUsed: 3.5, budgetTotal: 4.0 },
];

function ProgramManagerDashboard() {
  const navigate = useNavigate();
  return (
    <DashboardShell>
      <PageHeader scope="Program Manager · Aggregate of Consumer Banking — Payments, Customer Service Portal, Fraud & Risk Engine, and Merchant Onboarding" />
      <section>
        <SectionHeading title="Portfolio Health" subtitle="Click Consumer Banking to view portfolio health details" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROJECTS.map(p => {
            const isCB = p.shortCode === "CB";
            const progressTone = p.status === "Good" ? "pass" : p.status === "Risk" ? "fail" : "warn";
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => isCB && navigate("/pm-health", { state: { selectedPortfolio: p.code } })}
                disabled={!isCB}
                className={`text-left ${!isCB ? "cursor-not-allowed" : ""}`}
              >
                <Card className={`flex h-full flex-col p-5 transition ${isCB ? "hover:border-accent hover:ring-1 hover:ring-accent" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Portfolio · {p.shortCode}</p>
                      <h3 className="mt-1 text-[18px] font-bold leading-tight text-gray-100">{p.name}</h3>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="mt-4 text-[30px] font-bold text-gray-100">{p.health}%</p>
                  <Progress value={p.health} tone={progressTone} className="mt-2" />
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div><p className="font-semibold text-gray-200">{p.programs}</p><p className="text-[10px] text-gray-500">Programs</p></div>
                    <div><p className="font-semibold text-gray-200">{p.projects}</p><p className="text-[10px] text-gray-500">Projects</p></div>
                    <div><p className="font-semibold text-gray-200">{p.risks}</p><p className="text-[10px] text-gray-500">Risks</p></div>
                  </div>
                  {isCB
                    ? <p className="mt-3 text-[11px] font-medium text-accent">View Details →</p>
                    : <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-white/35">Coming soon</p>
                  }
                </Card>
              </button>
            );
          })}
        </div>
      </section>
      <Watchlist items={[
        { status: "Risk", text: "Merchant Onboarding release documentation and SLA compliance require escalation." },
        { status: "Risk", text: "Customer Service Portal approval cycle remains above the programme target." },
        { status: "Warn", text: "Nine open content requests are overdue." },
        { status: "Good", text: "Payments is ready for the next documentation milestone." },
      ]} />
    </DashboardShell>
  );
}

const OPS_KPIS: Kpi[] = [
  { label: "Monthly Active KM Users", value: "8.4k", delta: "+11%", dir: "up", progress: 84, description: "Unique active users in the current month" },
  { label: "Self-Service Rate", value: "82%", delta: "+6%", dir: "up", progress: 82, description: "Queries resolved without expert intervention" },
  { label: "Search Abandonment", value: "18%", delta: "-3%", dir: "down", progress: 82, description: "Sessions ending without result engagement" },
  { label: "Article Engagement", value: "71%", delta: "+5%", dir: "up", progress: 71, description: "Users engaging with surfaced content" },
  { label: "Template Adoption", value: "76%", delta: "+9%", dir: "up", progress: 76, description: "New content created from approved templates" },
  { label: "Lifecycle Compliance", value: "88%", delta: "+4%", dir: "up", progress: 88, description: "Articles following review and retirement controls" },
  { label: "Missing Content Signals", value: "39", delta: "-7", dir: "down", progress: 61, description: "Repeated unsuccessful searches requiring content" },
  { label: "Productivity Saved", value: "520h", delta: "+64h", dir: "up", progress: 87, description: "Operational time saved this month" },
];

function OperationsDashboard() {
  return (
    <DashboardShell>
      <PageHeader scope="Operations · Platform-wide adoption, compliance, usage, and productivity" />
      <KpiGrid items={OPS_KPIS} />
      <MonthlyBarChart series={[
        { name: "Active Users", values: [62, 66, 70, 74, 79, 84], color: "var(--color-state-pass)" },
        { name: "Self-Service", values: [69, 71, 74, 77, 80, 82], color: "#60a5fa" },
        { name: "Template Adoption", values: [51, 56, 61, 67, 72, 76], color: "#f59e0b" },
      ]} />
      <Watchlist items={[
        { status: "Risk", text: "High-frequency abandoned searches need content-owner assignment." },
        { status: "Warn", text: "Template adoption remains uneven across delivery groups." },
        { status: "Warn", text: "Several lifecycle reviews are approaching their SLA window." },
        { status: "Good", text: "Self-service and active usage continue to improve month over month." },
      ]} />
    </DashboardShell>
  );
}

const DEV_KPIS: Kpi[] = [
  { label: "PR-to-Doc Automation", value: "71%", delta: "+14%", dir: "up", progress: 71, description: "Merged PRs generating linked documentation updates" },
  { label: "Documentation Lag", value: "2.8d", delta: "-0.6d", dir: "down", progress: 64, description: "Average delay between code and documentation" },
  { label: "API Doc Completeness", value: "84%", delta: "+5%", dir: "up", progress: 84, description: "Project APIs with current linked documentation" },
  { label: "Chat with Document Usage", value: "1.9k", delta: "+18%", dir: "up", progress: 79, description: "Project-specific document assistant interactions" },
  { label: "CI/CD Doc Compliance", value: "68%", delta: "+4%", dir: "up", progress: 68, description: "Pipelines meeting documentation controls" },
  { label: "Broken Link Rate", value: "2.1%", delta: "-0.8%", dir: "down", progress: 79, description: "Invalid links detected in project documentation" },
  { label: "Reusable Asset Discovery", value: "76%", delta: "+9%", dir: "up", progress: 76, description: "Searches finding an approved reusable asset" },
  { label: "Tech Debt Doc Score", value: "72%", delta: "+6%", dir: "up", progress: 72, description: "Documentation health for tracked technical debt" },
];

function DeveloperDashboard() {
  return (
    <DashboardShell>
      <PageHeader scope="Developer · Project Payments only" />
      <KpiGrid items={DEV_KPIS} />
      <MonthlyBarChart series={[
        { name: "Automation", values: [50, 54, 58, 63, 67, 71], color: "var(--color-state-pass)" },
        { name: "API Completeness", values: [72, 75, 78, 80, 82, 84], color: "#60a5fa" },
        { name: "CI/CD Compliance", values: [56, 59, 61, 63, 66, 68], color: "#f59e0b" },
      ]} />
      <Watchlist items={[
        { status: "Risk", text: "Twelve documentation exceptions remain open for Project Payments." },
        { status: "Warn", text: "CI/CD documentation compliance is below the project target." },
        { status: "Warn", text: "Documentation lag remains above the two-day objective." },
        { status: "Good", text: "API completeness and PR-to-doc automation improved this month." },
      ]} />
    </DashboardShell>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageMeta title="Knowledge Management" description="Role-based Knowledge Management dashboard" />
      <main className="space-y-6 p-6">{children}</main>
    </>
  );
}

export default function KnowledgeManagement() {
  const role = localStorage.getItem("demo_role");
  if (role === "user_program_manager") return <ProgramManagerDashboard />;
  if (role === "user_product_ops") return <OperationsDashboard />;
  if (role === "user_executive") return <ExecutiveDashboard />;
  return <DeveloperDashboard />;
}
