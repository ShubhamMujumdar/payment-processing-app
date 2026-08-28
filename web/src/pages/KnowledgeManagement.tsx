import PageMeta from "../components/common/PageMeta";
import { Card } from "../components/visa/kit";

/* ── executive seeded data ─────────────────────────────────────── */
const HEALTH = 82;
const PRIORITY = "Priority: increase release documentation readiness";

type Dir = "up" | "down" | "flat";
interface Kpi { label: string; value: string; delta: string; bar: number; dir: Dir; def: string; spark?: number[]; }

const ROW1: Kpi[] = [
  { label: "Knowledge Coverage",   value: "86%", delta: "+6% vs last month",  bar: 86, dir: "up",   def: "Products / services with complete docs" },
  { label: "Freshness Compliance", value: "78%", delta: "−4% risk",           bar: 78, dir: "down", def: "Pages reviewed within SLA" },
];

const ROW2: Kpi[] = [
  { label: "Search Success",           value: "91%", delta: "+3%",               bar: 91, dir: "up",   def: "Answers found without escalation" },
  { label: "Release Readiness",        value: "73%", delta: "7 launches at risk", bar: 73, dir: "flat", def: "Releases with linked current docs" },
  { label: "AI Update Adoption",       value: "64%", delta: "+12% uplift",       bar: 64, dir: "up",   def: "AI drafts accepted by authors" },
  { label: "Teams Decisions Captured", value: "128", delta: "+21 decisions",     bar: 72, dir: "up",   def: "Decisions / actions persisted" },
];

const GRAPH_COV: Kpi = { label: "Knowledge Graph Coverage", value: "69%", delta: "+9%", bar: 69, dir: "up", def: "Services mapped to docs / code / incidents" };
const GAPS: Kpi = { label: "Top Knowledge Gaps", value: "24", delta: "Needs triage", bar: 58, dir: "flat", def: "Open gaps from requests / search misses" };

type WStatus = "Risk" | "Warn" | "Good";
interface Watch { text: string; status: WStatus; }
const WATCHLIST: Watch[] = [
  { text: "Stale product documentation in payment authorization stream", status: "Risk" },
  { text: "7 launch workstreams missing approved runbooks",              status: "Warn" },
  { text: "High search volume for settlement flows indicates demand",    status: "Good" },
  { text: "AI-assisted updates pending author approval",                 status: "Warn" },
];

const TREND = [68, 72, 74, 77, 80, 82];

const SIGNALS = [
  { value: "410h", label: "Estimated SME time saved" },
  { value: "18%",  label: "Lower documentation cycle variance" },
  { value: "34",   label: "New graph relationships" },
];

/* ── helpers ──────────────────────────────────────────────────── */
function barColor(pct: number) {
  if (pct >= 80) return "var(--color-state-pass)";
  if (pct >= 60) return "var(--color-state-warn)";
  return "var(--color-state-fail)";
}

function DirArrow({ dir }: { dir: Dir }) {
  if (dir === "up")   return <span style={{ color: "var(--color-state-pass)", fontWeight: 600 }}>↑</span>;
  if (dir === "down") return <span style={{ color: "var(--color-state-fail)", fontWeight: 600 }}>↓</span>;
  return <span style={{ color: "var(--color-state-idle)" }}>→</span>;
}

const STATUS_STYLE: Record<WStatus, import("react").CSSProperties> = {
  Risk: { background: "#fef2f2", color: "var(--color-state-fail)", border: "1px solid #fecaca" },
  Warn: { background: "#fffbeb", color: "var(--color-state-warn)", border: "1px solid #fde68a" },
  Good: { background: "#f0fdf4", color: "var(--color-state-pass)", border: "1px solid #bbf7d0" },
};

/* ── shared sub-components ────────────────────────────────────── */
function MiniSpark({ data, dir }: { data: number[]; dir: Dir }) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const W = 72, H = 20;
  const pts = data.map((v, i): [number, number] => [
    (i / (data.length - 1)) * (W - 4) + 2,
    H - 2 - ((v - min) / span) * (H - 6),
  ]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const color = dir === "up" ? "var(--color-state-pass)" : dir === "down" ? "var(--color-state-fail)" : "var(--color-state-idle)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="shrink-0">
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.75" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

function KpiCard({ k }: { k: Kpi }) {
  return (
    <div className="pane flex flex-col gap-2 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{k.label}</p>
        {k.spark && <MiniSpark data={k.spark} dir={k.dir} />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[28px] font-bold leading-none text-gray-100">{k.value}</span>
        <span className="mb-0.5 flex items-center gap-1 text-[11px] text-gray-400">
          <DirArrow dir={k.dir} /> {k.delta}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-750">
        <div className="h-full rounded-full transition-all" style={{ width: `${k.bar}%`, background: barColor(k.bar) }} />
      </div>
      <p className="text-[10.5px] text-gray-500">{k.def}</p>
    </div>
  );
}

interface HealthCardProps {
  health: number;
  priority: string;
  trend: number[];
  signals: { value: string; label: string }[];
  deltaLabel?: string;
}

function HealthScoreCard({ health, priority, trend, signals, deltaLabel = "+2 pts vs last month" }: HealthCardProps) {
  const yMin = Math.max(0, Math.min(...trend) - 8);
  const yMax = Math.max(...trend) + 5;
  const svgW = 200, chartH = 52, padX = 8;
  const pts: [number, number][] = trend.map((v, i) => [
    padX + (i * (svgW - 2 * padX) / (trend.length - 1)),
    chartH - ((v - yMin) / (yMax - yMin)) * (chartH - 8) + 2,
  ]);
  const linePts = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPath = `M${pts[0][0]},${chartH} ${pts.map(([x, y]) => `L${x},${y}`).join(" ")} L${pts[pts.length - 1][0]},${chartH} Z`;

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Knowledge Health Score</p>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <span style={{ color: "var(--color-state-pass)", fontWeight: 600 }}>↑</span> {deltaLabel}
        </span>
      </div>
      <div className="flex items-end gap-4">
        <div className="flex shrink-0 flex-col">
          <span className="text-[42px] font-bold leading-none text-gray-100">{health}</span>
          <span className="text-[11px] text-gray-500">/100</span>
        </div>
        <div className="min-w-0 flex-1 pb-4">
          <svg viewBox={`0 0 ${svgW} ${chartH + 16}`} width="100%" aria-hidden="true">
            <defs>
              <linearGradient id="km-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-state-pass)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-state-pass)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#km-spark-fill)" />
            <polyline points={linePts} fill="none" stroke="var(--color-state-pass)"
              strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y}
                r={i === trend.length - 1 ? 3.5 : 2}
                fill={i === trend.length - 1 ? "var(--color-state-pass)" : "#fff"}
                stroke="var(--color-state-pass)" strokeWidth="1.5" />
            ))}
            {pts.map(([x], i) => (
              <text key={i} x={x} y={chartH + 14} textAnchor="middle"
                fontSize="9" fill="var(--color-gray-500)">P{i + 1}</text>
            ))}
          </svg>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-750">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${health}%`, background: barColor(health) }} />
      </div>
      <p className="text-[10.5px] text-gray-500">{priority}</p>
      <div className="flex gap-5 border-t border-ink-700 pt-2.5">
        {signals.map(s => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold leading-none text-gray-100">{s.value}</span>
            <span className="text-[10px] leading-tight text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GapsCard() {
  return (
    <div className="pane flex flex-col gap-3 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{GAPS.label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[36px] font-bold leading-none text-gray-100">{GAPS.value}</span>
        <span className="mb-1 flex items-center gap-1 text-[11px] text-gray-400">
          <DirArrow dir={GAPS.dir} /> {GAPS.delta}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-750">
        <div className="h-full rounded-full" style={{ width: `${GAPS.bar}%`, background: barColor(GAPS.bar) }} />
      </div>
      <p className="text-[10.5px] text-gray-500">{GAPS.def}</p>
      <div className="mt-auto flex flex-wrap gap-1.5">
        {["Authorization", "Settlement", "Refunds", "Onboarding", "Disputes"].map(g => (
          <span key={g} className="rounded-md bg-ink-750 px-2 py-0.5 text-[10px] text-gray-400">{g}</span>
        ))}
      </div>
    </div>
  );
}

function WatchlistCard({ watchlist }: { watchlist: Watch[] }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">High-Priority Watchlist</p>
      <div className="flex flex-col gap-2">
        {watchlist.map((w, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-lg bg-ink-800 px-3 py-2.5">
            <span className="mt-px shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={STATUS_STYLE[w.status]}>
              {w.status}
            </span>
            <span className="text-[12px] text-gray-300">{w.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── developer dashboard — data ───────────────────────────────── */
const DEV_HEALTH = 76;
const DEV_PRIORITY = "Priority: reduce PR-to-doc lag";
const DEV_TREND = [54, 59, 63, 67, 72, 76];
const DEV_SIGNALS = [
  { value: "2.8d", label: "Current doc lag" },
  { value: "1.9k", label: "Doc chat queries" },
  { value: "12",   label: "Pending PR updates" },
];
const DEV_ROW2: Kpi[] = [
  { label: "PR-to-Doc Automation",  value: "71%",  delta: "+14%",       bar: 71, dir: "up",   def: "Merged PRs generating doc suggestions", spark: [50, 54, 58, 63, 67, 71] },
  { label: "Documentation Lag",     value: "2.8d", delta: "Target <2d", bar: 62, dir: "down", def: "Merge to approved update",               spark: [42, 44, 50, 55, 60, 62] },
  { label: "API Doc Completeness",  value: "84%",  delta: "+5%",        bar: 84, dir: "up",   def: "APIs with current docs",                 spark: [72, 75, 78, 80, 82, 84] },
  { label: "CI/CD Doc Compliance",  value: "68%",  delta: "Needs lift", bar: 68, dir: "flat", def: "Releases linked to notes",               spark: [66, 67, 66, 68, 67, 68] },
];
const DEV_ROW3: Kpi[] = [
  { label: "Chat with Doc Usage",      value: "1.9k", delta: "+22%",   bar: 78, dir: "up",   def: "Natural language queries",         spark: [60, 65, 68, 72, 75, 78] },
  { label: "Reusable Asset Discovery", value: "59%",  delta: "+8%",    bar: 59, dir: "up",   def: "Component reuse via graph",        spark: [44, 47, 50, 53, 56, 59] },
  { label: "Tech Debt Doc Score",      value: "72%",  delta: "Stable", bar: 72, dir: "flat", def: "Code-doc consistency health",      spark: [71, 72, 71, 73, 72, 72] },
  { label: "Broken Link Rate",         value: "3.7%", delta: "−1.1%",  bar: 86, dir: "up",   def: "Broken links across pages",       spark: [78, 80, 82, 84, 85, 86] },
];
const DEV_WATCHLIST: Watch[] = [
  { text: "12 merged PRs have unapproved AI doc suggestions",  status: "Warn" },
  { text: "Checkout API docs have high chat query volume",      status: "Good" },
  { text: "CI/CD release notes missing for 5 builds",          status: "Risk" },
  { text: "Knowledge graph missing topology for 3 services",   status: "Warn" },
];

/* ── developer dashboard ──────────────────────────────────────── */
function KnowledgeManagementDev() {
  return (
    <>
      <PageMeta title="Knowledge Management — Developer" description="Developer KM KPI Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
            <p className="mt-0.5 text-[12px] text-gray-500">Developer KPI Dashboard · Q3 2026</p>
          </div>
        </div>

        {/* Row 1 — Hero health card + Watchlist */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <HealthScoreCard health={DEV_HEALTH} priority={DEV_PRIORITY} trend={DEV_TREND}
              signals={DEV_SIGNALS} deltaLabel="+4 pts vs last month" />
          </div>
          <div className="col-span-2">
            <WatchlistCard watchlist={DEV_WATCHLIST} />
          </div>
        </div>

        {/* Row 2 — Automation & compliance KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {DEV_ROW2.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* Row 3 — Usage & quality KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {DEV_ROW3.map(k => <KpiCard key={k.label} k={k} />)}
        </div>
      </div>
    </>
  );
}

/* ── product ops dashboard — data ─────────────────────────────── */
const OPS_HEALTH = 76;
const OPS_PRIORITY = "Priority: boost self-service rate and close missing content gaps";
const OPS_TREND = [54, 59, 63, 67, 72, 76];
const OPS_SIGNALS = [
  { value: "2.8d", label: "Avg doc lag" },
  { value: "1.9k", label: "Chat queries / mo" },
  { value: "12",   label: "Pending approvals" },
];
const OPS_TIER1_SEC: Kpi[] = [
  { label: "Monthly Active KM Users", value: "847",  delta: "+12% vs last month", bar: 73, dir: "up", def: "Active users accessing KM platform this month" },
  { label: "Productivity Saved",      value: "310h", delta: "+18% vs last qtr",   bar: 75, dir: "up", def: "Estimated SME time saved this quarter" },
];
const OPS_TIER2: Kpi[] = [
  { label: "Self-Service Rate",    value: "73%", delta: "+5%",      bar: 73, dir: "up",   def: "Queries resolved without escalation",    spark: [55, 58, 62, 65, 70, 73] },
  { label: "Article Engagement",   value: "62%", delta: "+8%",      bar: 62, dir: "up",   def: "Articles with meaningful read activity",  spark: [40, 44, 49, 54, 58, 62] },
  { label: "Template Adoption",    value: "54%", delta: "+11%",     bar: 54, dir: "up",   def: "Teams using approved content templates",  spark: [32, 35, 40, 44, 48, 54] },
  { label: "Lifecycle Compliance", value: "69%", delta: "−2% risk", bar: 69, dir: "down", def: "Articles reviewed within governance SLA", spark: [74, 73, 72, 70, 71, 69] },
];

interface RiskMetric { label: string; value: string; delta: string; dir: Dir; def: string; tags?: string[]; }
const OPS_TIER3: RiskMetric[] = [
  {
    label: "Missing Content Signals", value: "34", delta: "Needs triage", dir: "flat",
    def: "Search misses and reader requests without matching content",
    tags: ["Authorization", "Onboarding", "Disputes", "Refunds", "Webhooks"],
  },
  {
    label: "Search Abandonment", value: "18%", delta: "−3% improvement", dir: "up",
    def: "Searches ending without a result click",
  },
];
const OPS_WATCHLIST: Watch[] = [
  { text: "18 articles past SLA review window",                  status: "Risk" },
  { text: "Template adoption below target in 4 squads",          status: "Warn" },
  { text: "Self-service rate improving for onboarding content",  status: "Good" },
  { text: "34 missing content signals awaiting triage",          status: "Warn" },
];
const BIZ_SIGNALS = [
  { value: "$2.1M", label: "Estimated cost avoided" },
  { value: "88%",   label: "Stakeholder coverage" },
  { value: "−22%",  label: "Time-to-resolution" },
];
const PLATFORM_SIGNALS = [
  { value: "98ms",  label: "Avg search response" },
  { value: "99.8%", label: "Platform uptime" },
  { value: "3.2%",  label: "Failed search rate" },
];

/* ── product ops dashboard — components ──────────────────────── */
function RiskMetricCard({ m }: { m: RiskMetric }) {
  return (
    <div className="pane flex flex-col gap-3 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{m.label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[36px] font-bold leading-none text-gray-100">{m.value}</span>
        <span className="mb-1 flex items-center gap-1 text-[11px] text-gray-400">
          <DirArrow dir={m.dir} /> {m.delta}
        </span>
      </div>
      <p className="text-[10.5px] text-gray-500">{m.def}</p>
      {m.tags && (
        <div className="mt-auto flex flex-wrap gap-1.5">
          {m.tags.map(t => (
            <span key={t} className="rounded-md bg-ink-750 px-2 py-0.5 text-[10px] text-gray-400">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalsCard({ title, signals }: { title: string; signals: { value: string; label: string }[] }) {
  return (
    <div className="pane flex flex-col gap-3 rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="flex flex-wrap gap-6">
        {signals.map(s => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className="text-[22px] font-bold leading-none text-gray-100">{s.value}</span>
            <span className="text-[11px] leading-tight text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── product ops dashboard ────────────────────────────────────── */
function KnowledgeManagementOps() {
  return (
    <>
      <PageMeta title="Knowledge Management — Product Ops" description="KM Operations Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
            <p className="mt-0.5 text-[12px] text-gray-500">Operations Dashboard · Q3 2026</p>
          </div>
        </div>

        {/* Tier 1 — Hero health score + secondary hero KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <HealthScoreCard health={OPS_HEALTH} priority={OPS_PRIORITY} trend={OPS_TREND}
              signals={OPS_SIGNALS} deltaLabel="+4 pts vs last month" />
          </div>
          {OPS_TIER1_SEC.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* Tier 2 — Operational KPIs with embedded sparklines */}
        <div className="grid grid-cols-4 gap-3">
          {OPS_TIER2.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* Tier 3 — Risk metrics + Watchlist */}
        <div className="grid grid-cols-4 gap-3">
          {OPS_TIER3.map(m => <RiskMetricCard key={m.label} m={m} />)}
          <div className="col-span-2">
            <WatchlistCard watchlist={OPS_WATCHLIST} />
          </div>
        </div>

        {/* Tier 4 — Business & Platform Signals */}
        <div className="grid grid-cols-2 gap-3">
          <SignalsCard title="Business Signals" signals={BIZ_SIGNALS} />
          <SignalsCard title="Platform Signals" signals={PLATFORM_SIGNALS} />
        </div>
      </div>
    </>
  );
}

/* ── program manager data ─────────────────────────────────────── */
const PM_HEALTH = 79;
const PM_PRIORITY = "Priority: unblock approval bottlenecks";
const PM_TREND = [65, 68, 72, 74, 78, 79];
const PM_SIGNALS = [
  { value: "46",   label: "Open content requests" },
  { value: "3.4d", label: "Approval cycle time" },
  { value: "93",   label: "Captured actions" },
];
const PM_ROW2: Kpi[] = [
  { label: "Documentation Completion", value: "81%",  delta: "+7%",       bar: 81, dir: "up",   def: "Project artifacts completed" },
  { label: "Open Content Requests",    value: "46",   delta: "9 overdue", bar: 64, dir: "flat", def: "Reader / team requests" },
  { label: "Approval Cycle Time",      value: "3.4d", delta: "Target 2d", bar: 58, dir: "down", def: "Draft to publish" },
  { label: "SLA Compliance",           value: "88%",  delta: "+2%",       bar: 88, dir: "up",   def: "Reviews and approvals on time" },
];
const PM_ROW3: Kpi[] = [
  { label: "Action Items Captured",  value: "93",  delta: "+18",    bar: 77, dir: "up",   def: "Teams actions persisted" },
  { label: "Decision Traceability",  value: "74%", delta: "+6%",    bar: 74, dir: "up",   def: "Decisions linked to docs / releases" },
  { label: "Release Doc Readiness",  value: "69%", delta: "Risk",   bar: 69, dir: "flat", def: "Projects with approved release docs" },
  { label: "Project KM Health",      value: "79%", delta: "Stable", bar: 79, dir: "flat", def: "Composite delivery confidence" },
];
const PM_WATCHLIST: Watch[] = [
  { text: "Two programs have overdue content requests",          status: "Risk" },
  { text: "Approval queue concentrated with 4 reviewers",        status: "Warn" },
  { text: "Release readiness improved for digital onboarding",   status: "Good" },
  { text: "Decisions not linked for 3 steering meetings",        status: "Warn" },
];

/* ── program manager page ─────────────────────────────────────── */
function KnowledgeManagementPM() {
  return (
    <>
      <PageMeta title="Knowledge Management — Program Manager" description="PM KM KPI Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
            <p className="mt-0.5 text-[12px] text-gray-500">Program Manager KPI Dashboard · Q3 2026</p>
          </div>
        </div>

        {/* Row 1 — Hero health card + Watchlist */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <HealthScoreCard health={PM_HEALTH} priority={PM_PRIORITY} trend={PM_TREND}
              signals={PM_SIGNALS} deltaLabel="+1 pt vs last month" />
          </div>
          <div className="col-span-2">
            <WatchlistCard watchlist={PM_WATCHLIST} />
          </div>
        </div>

        {/* Row 2 — Completion & compliance KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {PM_ROW2.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* Row 3 — Delivery & traceability KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {PM_ROW3.map(k => <KpiCard key={k.label} k={k} />)}
        </div>
      </div>
    </>
  );
}

/* ── page ─────────────────────────────────────────────────────── */
export default function KnowledgeManagement() {
  const role = localStorage.getItem("demo_role");
  if (role === "user_program_manager") return <KnowledgeManagementPM />;
  if (role === "user_product_ops")     return <KnowledgeManagementOps />;
  if (role !== "user_executive")       return <KnowledgeManagementDev />;

  return (
    <>
      <PageMeta title="Knowledge Management — VISA" description="Executive KM KPI Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
            <p className="mt-0.5 text-[12px] text-gray-500">Executive KPI Dashboard · Q3 2026</p>
          </div>
        </div>

        {/* Row 1 — Hero health card (col-span-2) + 2 primary KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <HealthScoreCard health={HEALTH} priority={PRIORITY} trend={TREND} signals={SIGNALS} />
          </div>
          {ROW1.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* Row 2 — 4 operational KPIs */}
        <div className="grid grid-cols-4 gap-3">
          {ROW2.map(k => <KpiCard key={k.label} k={k} />)}
        </div>

        {/* Row 3 — Graph Coverage + Gaps + Watchlist */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard k={GRAPH_COV} />
          <GapsCard />
          <div className="col-span-2">
            <WatchlistCard watchlist={WATCHLIST} />
          </div>
        </div>
      </div>
    </>
  );
}
