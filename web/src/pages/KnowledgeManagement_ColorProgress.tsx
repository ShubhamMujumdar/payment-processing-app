import { useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { Card, Progress } from "../components/visa/kit";

type Dir = "up" | "down" | "flat";
type Kpi = { label: string; value: string; delta?: string; dir?: Dir; description: string; progress?: number };
type WatchItem = { text: string; status: "Risk" | "Warn" | "Good" };
type Signal = { label: string; value: string; detail: string };

const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const STATUS_STYLE = {
  Risk: "border-red-200 bg-red-50 text-red-700",
  Warn: "border-amber-200 bg-amber-50 text-amber-700",
  Good: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function dirSymbol(dir: Dir = "flat") {
  return dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <Card className="flex min-h-[156px] flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{kpi.label}</p>
        {kpi.delta && (
          <span className="rounded-full bg-ink-750 px-2 py-1 text-[11px] font-semibold text-gray-400">
            {dirSymbol(kpi.dir)} {kpi.delta}
          </span>
        )}
      </div>
      <p className="mt-3 text-[30px] font-bold tracking-tight text-gray-100">{kpi.value}</p>
      {kpi.progress !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <Progress
            value={kpi.progress}
            tone={kpi.progress >= 90 ? "pass" : kpi.progress >= 75 ? "brand" : kpi.progress >= 60 ? "warn" : "fail"}
            className="flex-1"
          />
          <span className="text-[11px] font-semibold text-gray-400">{kpi.progress}%</span>
        </div>
      )}
      <p className="mt-auto pt-3 text-[12px] leading-5 text-gray-500">{kpi.description}</p>
    </Card>
  );
}

function KpiGrid({ items }: { items: Kpi[] }) {
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(k => <KpiCard key={k.label} kpi={k} />)}</section>;
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
    <Card className="p-5">
      <SectionHeading title={title ?? "Monthly KPI Trend"} subtitle="Mar to Aug" />
      <div className="flex h-56 items-end gap-3 border-b border-ink-700 px-2 pb-6 pt-3">
        {MONTHS.map((month, i) => (
          <div key={month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-1">
              {series.map(s => (
                <div key={s.name} title={`${s.name}: ${s.values[i]}`} className="w-full max-w-5 rounded-t-sm transition-opacity hover:opacity-80"
                  style={{ height: `${Math.max((s.values[i] / max) * 100, 5)}%`, background: s.color }} />
              ))}
            </div>
            <span className="mt-2 text-center text-[10px] text-gray-500">{month}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {series.map(s => <span key={s.name} className="flex items-center gap-2 text-[11px] text-gray-500"><i className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </Card>
  );
}

function Signals({ items }: { items: Signal[] }) {
  return (
    <section>
      <SectionHeading title="Business / Platform Signals" subtitle="Role-relevant operational indicators" />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map(item => (
          <Card key={item.label} className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
            <p className="mt-2 text-[28px] font-bold text-gray-100">{item.value}</p>
            <p className="mt-2 text-[12px] text-gray-500">{item.detail}</p>
          </Card>
        ))}
      </div>
    </section>
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
  { label: "Knowledge Coverage", value: "89%", delta: "+6%", dir: "up", description: "Complete documentation across all lines of business" },
  { label: "Freshness Compliance", value: "84%", delta: "+4%", dir: "up", description: "Content reviewed within policy windows" },
  { label: "AI Update Adoption", value: "78%", delta: "+8%", dir: "up", description: "Suggested updates accepted across the organisation" },
  { label: "Search Success", value: "87%", delta: "+3%", dir: "up", description: "Search sessions ending with a useful result" },
  { label: "Release Readiness", value: "91%", delta: "+5%", dir: "up", description: "Releases with approved supporting documentation" },
  { label: "Teams Decisions Captured", value: "82%", delta: "+7%", dir: "up", description: "Key decisions converted into governed knowledge" },
  { label: "Knowledge Graph Coverage", value: "76%", delta: "+9%", dir: "up", description: "Priority assets connected through validated relationships" },
  { label: "Top Knowledge Gaps", value: "34", delta: "-8", dir: "down", description: "High-impact gaps requiring an owner or approved content" },
];

const LOBS = [
  { name: "Consumer Banking", coverage: 92, freshness: 88, health: 90, note: "19 active projects" },
  { name: "Commercial Payments", coverage: 85, freshness: 80, health: 83, note: "24 active projects" },
  { name: "Wealth Management", coverage: 88, freshness: 86, health: 87, note: "14 active projects" },
  { name: "Fintech Partners", coverage: 81, freshness: 75, health: 78, note: "17 active projects" },
];

function ExecutiveDashboard() {
  const [selected, setSelected] = useState<string | null>(null);
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
      <Signals items={[
        { label: "SME Time Saved", value: "410h", detail: "Time redirected from repeat knowledge queries" },
        { label: "Search Abandonment", value: "18%", detail: "Sessions ending without a selected result" },
        { label: "Priority Knowledge Gaps", value: "34", detail: "Organisation-level gaps requiring action" },
      ]} />
      <section>
        <SectionHeading title="Lines of Business" subtitle="Select a card to highlight its health" />
        <div className="grid gap-4 md:grid-cols-2">
          {LOBS.map(lob => (
            <button key={lob.name} type="button" onClick={() => setSelected(selected === lob.name ? null : lob.name)} className="text-left">
              <Card className={`h-full p-5 transition ${selected === lob.name ? "ring-2 ring-accent" : "hover:border-gray-500"}`}>
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-gray-100">{lob.name}</h3><p className="mt-1 text-[11px] text-gray-500">{lob.note}</p></div><span className="text-[24px] font-bold text-gray-100">{lob.health}%</span></div>
                <div className="mt-5 grid grid-cols-2 gap-4"><div><p className="text-[11px] text-gray-500">Coverage</p><Progress value={lob.coverage} className="mt-2" /></div><div><p className="text-[11px] text-gray-500">Freshness</p><Progress value={lob.freshness} className="mt-2" /></div></div>
              </Card>
            </button>
          ))}
        </div>
      </section>
      <Watchlist items={[
        { status: "Risk", text: "Fintech Partners freshness is below the organisation target." },
        { status: "Warn", text: "Commercial Payments has elevated unresolved knowledge gaps." },
        { status: "Warn", text: "Knowledge graph coverage trails the other executive KPIs." },
        { status: "Good", text: "Consumer Banking is above target for coverage and freshness." },
      ]} />
    </DashboardShell>
  );
}

const PM_KPIS: Kpi[] = [
  { label: "Documentation Completion", value: "81%", delta: "+7%", dir: "up", description: "Required project artifacts completed" },
  { label: "Open Content Requests", value: "46", delta: "9 overdue", dir: "flat", description: "Requests across Alpha, Bravo, Charlie, and Delta" },
  { label: "Approval Cycle Time", value: "3.4d", delta: "Target 2d", dir: "down", description: "Average draft-to-approval duration" },
  { label: "SLA Compliance", value: "88%", delta: "+2%", dir: "up", description: "Reviews and approvals completed on time" },
  { label: "Action Items Captured", value: "93%", delta: "+5%", dir: "up", description: "Meeting actions stored with owners" },
  { label: "Decision Traceability", value: "86%", delta: "+6%", dir: "up", description: "Decisions linked to delivery artifacts" },
  { label: "Release Doc Readiness", value: "84%", delta: "+4%", dir: "up", description: "Milestones with approved release documentation" },
  { label: "Project KM Health", value: "79%", delta: "+3%", dir: "up", description: "Aggregate health across the four projects" },
];

const PROJECTS = [
  { name: "Alpha", status: "Good" as const, health: 91, coverage: 91, sla: 95, cycle: "2.1d" },
  { name: "Bravo", status: "Warn" as const, health: 74, coverage: 74, sla: 71, cycle: "4.8d" },
  { name: "Charlie", status: "Good" as const, health: 88, coverage: 88, sla: 89, cycle: "2.7d" },
  { name: "Delta", status: "Risk" as const, health: 51, coverage: 51, sla: 42, cycle: "7.2d" },
];

function ProgramManagerDashboard() {
  return (
    <DashboardShell>
      <PageHeader scope="Program Manager · Aggregate across Alpha, Bravo, Charlie, and Delta" />
      <KpiGrid items={PM_KPIS} />
      <MonthlyBarChart series={[
        { name: "Completion", values: [67, 70, 73, 76, 79, 81], color: "var(--color-state-pass)" },
        { name: "SLA", values: [82, 83, 84, 85, 87, 88], color: "#60a5fa" },
        { name: "Readiness", values: [70, 73, 75, 78, 81, 84], color: "#f59e0b" },
      ]} />
      <Signals items={[
        { label: "Open Content Requests", value: "46", detail: "Requests across the four-project programme" },
        { label: "Approval Cycle Time", value: "3.4d", detail: "Average draft-to-approval duration" },
        { label: "Action Capture", value: "93", detail: "Actions captured in the current reporting period" },
      ]} />
      <section>
        <SectionHeading title="Project Health" subtitle="Individual project view" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROJECTS.map(p => <Card key={p.name} className="p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] uppercase tracking-wide text-gray-500">Project</p><h3 className="mt-1 text-[18px] font-bold text-gray-100">{p.name}</h3></div><span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[p.status]}`}>{p.status}</span></div><p className="mt-4 text-[30px] font-bold text-gray-100">{p.health}%</p><Progress value={p.health} className="mt-2" /><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="font-semibold text-gray-200">{p.coverage}%</p><p className="text-[10px] text-gray-500">Coverage</p></div><div><p className="font-semibold text-gray-200">{p.sla}%</p><p className="text-[10px] text-gray-500">SLA</p></div><div><p className="font-semibold text-gray-200">{p.cycle}</p><p className="text-[10px] text-gray-500">Cycle</p></div></div></Card>)}
        </div>
      </section>
      <Watchlist items={[
        { status: "Risk", text: "Delta release documentation and SLA compliance require escalation." },
        { status: "Risk", text: "Bravo approval cycle remains above the programme target." },
        { status: "Warn", text: "Nine open content requests are overdue." },
        { status: "Good", text: "Alpha is ready for the next documentation milestone." },
      ]} />
    </DashboardShell>
  );
}

const OPS_KPIS: Kpi[] = [
  { label: "Monthly Active KM Users", value: "8.4k", delta: "+11%", dir: "up", description: "Unique active users in the current month" },
  { label: "Self-Service Rate", value: "82%", delta: "+6%", dir: "up", description: "Queries resolved without expert intervention" },
  { label: "Search Abandonment", value: "18%", delta: "-3%", dir: "down", description: "Sessions ending without result engagement" },
  { label: "Article Engagement", value: "71%", delta: "+5%", dir: "up", description: "Users engaging with surfaced content" },
  { label: "Template Adoption", value: "76%", delta: "+9%", dir: "up", description: "New content created from approved templates" },
  { label: "Lifecycle Compliance", value: "88%", delta: "+4%", dir: "up", description: "Articles following review and retirement controls" },
  { label: "Missing Content Signals", value: "39", delta: "-7", dir: "down", description: "Repeated unsuccessful searches requiring content" },
  { label: "Productivity Saved", value: "520h", delta: "+64h", dir: "up", description: "Operational time saved this month" },
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
      <Signals items={[
        { label: "Self-Service Rate", value: "82%", detail: "Queries resolved without expert support" },
        { label: "Productivity Saved", value: "520h", detail: "Estimated operational time saved" },
        { label: "Missing Content Signals", value: "39", detail: "Repeated searches with no useful result" },
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
  { label: "PR-to-Doc Automation", value: "71%", delta: "+14%", dir: "up", description: "Merged PRs generating linked documentation updates" },
  { label: "Documentation Lag", value: "2.8d", delta: "-0.6d", dir: "down", description: "Average delay between code and documentation" },
  { label: "API Doc Completeness", value: "84%", delta: "+5%", dir: "up", description: "Project APIs with current linked documentation" },
  { label: "Chat with Document Usage", value: "1.9k", delta: "+18%", dir: "up", description: "Project-specific document assistant interactions" },
  { label: "CI/CD Doc Compliance", value: "68%", delta: "+4%", dir: "up", description: "Pipelines meeting documentation controls" },
  { label: "Broken Link Rate", value: "2.1%", delta: "-0.8%", dir: "down", description: "Invalid links detected in project documentation" },
  { label: "Reusable Asset Discovery", value: "76%", delta: "+9%", dir: "up", description: "Searches finding an approved reusable asset" },
  { label: "Tech Debt Doc Score", value: "72%", delta: "+6%", dir: "up", description: "Documentation health for tracked technical debt" },
];

function DeveloperDashboard() {
  return (
    <DashboardShell>
      <PageHeader scope="Developer · Project Mercury only" />
      <KpiGrid items={DEV_KPIS} />
      <MonthlyBarChart series={[
        { name: "Automation", values: [50, 54, 58, 63, 67, 71], color: "var(--color-state-pass)" },
        { name: "API Completeness", values: [72, 75, 78, 80, 82, 84], color: "#60a5fa" },
        { name: "CI/CD Compliance", values: [56, 59, 61, 63, 66, 68], color: "#f59e0b" },
      ]} />
      <Signals items={[
        { label: "Documentation Lag", value: "2.8d", detail: "Average code-to-documentation delay" },
        { label: "Document Assistant Usage", value: "1.9k", detail: "Project Mercury interactions" },
        { label: "Open Doc Exceptions", value: "12", detail: "Project items requiring developer action" },
      ]} />
      <Watchlist items={[
        { status: "Risk", text: "Twelve documentation exceptions remain open for Project Mercury." },
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
