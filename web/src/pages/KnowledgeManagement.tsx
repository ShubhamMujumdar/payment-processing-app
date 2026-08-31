import { useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { Card } from "../components/visa/kit";

/* ── tone helpers ───────────────────────────────────────────────── */
type Dir = "up" | "down" | "flat";

function barColor(v: number) {
  if (v >= 85) return "var(--color-state-pass)";
  if (v >= 65) return "var(--color-state-warn)";
  return "var(--color-state-fail)";
}

function DirArrow({ dir }: { dir: Dir }) {
  if (dir === "up")   return <span style={{ color: "var(--color-state-pass)", fontWeight: 700 }}>↑</span>;
  if (dir === "down") return <span style={{ color: "var(--color-state-fail)", fontWeight: 700 }}>↓</span>;
  return <span style={{ color: "var(--color-state-idle)" }}>→</span>;
}

/* ── mini sparkline ─────────────────────────────────────────────── */
function Spark({ data, color = "var(--color-state-pass)" }: { data: number[]; color?: string }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const W = 64, H = 20;
  const pts = data.map((v, i): [number, number] => [
    (i / (data.length - 1)) * (W - 4) + 2,
    H - 2 - ((v - min) / span) * (H - 6),
  ]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <polyline points={pts.map(([x, y]) => `${x},${y}`).join(" ")} fill="none"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeOpacity="0.85" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ── full-width trend line chart ────────────────────────────────── */
function TrendChart({
  series, xLabels, title, height = 130, gradId = "g",
}: {
  series: { name: string; data: number[]; color: string }[];
  xLabels: string[];
  title?: string;
  height?: number;
  gradId?: string;
}) {
  const VW = 560, VH = height;
  const L = 6, R = 6, T = 8, B = 22;
  const allV = series.flatMap(s => s.data);
  const lo = Math.max(0, Math.min(...allV) - 5), hi = Math.max(...allV) + 5;
  const span = hi - lo || 1;
  const cx = (i: number) => L + (i / Math.max(xLabels.length - 1, 1)) * (VW - L - R);
  const cy = (v: number) => T + (VH - T - B) - ((v - lo) / span) * (VH - T - B);

  return (
    <div className="flex flex-col gap-1.5">
      {title && <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>}
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" aria-hidden>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`${gradId}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.33, 0.66, 1].map(t => (
          <line key={t} x1={L} y1={T + t * (VH - T - B)} x2={VW - R} y2={T + t * (VH - T - B)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {xLabels.map((lb, i) => (
          <text key={i} x={cx(i)} y={VH - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">{lb}</text>
        ))}
        {series.map((s, si) => {
          const ptStr = s.data.map((v, i) => `${cx(i)},${cy(v)}`).join(" ");
          const area = `M${cx(0)},${VH - B} ` +
            s.data.map((v, i) => `L${cx(i)},${cy(v)}`).join(" ") +
            ` L${cx(s.data.length - 1)},${VH - B} Z`;
          return (
            <g key={si}>
              <path d={area} fill={`url(#${gradId}-${si})`} />
              <polyline points={ptStr} fill="none" stroke={s.color}
                strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.data.map((v, i) => (
                <circle key={i} cx={cx(i)} cy={cy(v)}
                  r={i === s.data.length - 1 ? 3 : 0}
                  fill={s.color} stroke={s.color} strokeWidth="1.5" />
              ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 px-1">
          {series.map((s, si) => (
            <span key={si} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="inline-block h-1 w-5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── horizontal comparison bar chart ───────────────────────────── */
function CompBar({ items, title }: { items: { label: string; value: number }[]; title?: string }) {
  const mx = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {title && <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>}
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-2.5">
          <span className="w-36 shrink-0 text-right text-[11px] text-gray-400">{it.label}</span>
          <div className="relative flex-1 h-5 rounded-md bg-ink-750 overflow-hidden">
            <div className="h-full rounded-md transition-all"
              style={{ width: `${(it.value / mx) * 100}%`, background: barColor(it.value) }} />
            <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold text-gray-200">
              {it.value}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── KPI stat card ──────────────────────────────────────────────── */
function StatCard({
  label, value, unit, delta, dir = "flat", def, spark, onClick,
}: {
  label: string; value: string; unit?: string; delta?: string; dir?: Dir;
  def?: string; spark?: number[]; onClick?: () => void;
}) {
  return (
    <div
      className={`pane flex flex-col gap-2 rounded-xl p-4 ${onClick ? "cursor-pointer hover:bg-ink-700 transition-colors" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        {spark && <Spark data={spark} color={barColor(spark[spark.length - 1])} />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-bold leading-none text-gray-100">{value}</span>
          {unit && <span className="text-[13px] text-gray-500">{unit}</span>}
        </div>
        {delta && (
          <span className="mb-0.5 flex items-center gap-1 text-[11px] text-gray-400">
            <DirArrow dir={dir} /> {delta}
          </span>
        )}
      </div>
      {def && <p className="text-[10.5px] text-gray-500">{def}</p>}
    </div>
  );
}

/* ── breadcrumb ─────────────────────────────────────────────────── */
function Crumb({ parts, onBack }: { parts: string[]; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button"
        className="rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 transition-colors"
        onClick={onBack}>← Back</button>
      <span className="text-[12px] text-gray-500">
        {parts.map((p, i) => (
          <span key={p}>
            {i > 0 && <span className="mx-1.5 text-gray-600">/</span>}
            <span className={i === parts.length - 1 ? "font-semibold text-gray-200" : ""}>{p}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

/* ── watchlist card ─────────────────────────────────────────────── */
type WStatus = "Risk" | "Warn" | "Good";
const W_STYLE: Record<WStatus, import("react").CSSProperties> = {
  Risk: { background: "#fef2f2", color: "var(--color-state-fail)", border: "1px solid #fecaca" },
  Warn: { background: "#fffbeb", color: "var(--color-state-warn)", border: "1px solid #fde68a" },
  Good: { background: "#f0fdf4", color: "var(--color-state-pass)", border: "1px solid #bbf7d0" },
};

function WatchList({ title = "Watchlist", items }: { title?: string; items: { text: string; status: WStatus }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>}
      {items.map((w, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg bg-ink-800 px-3 py-2.5">
          <span className="mt-px shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={W_STYLE[w.status]}>{w.status}</span>
          <span className="text-[11.5px] text-gray-300">{w.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXECUTIVE
═══════════════════════════════════════════════════════════════════ */

const EXEC_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const EXEC_KPIS = [
  { label: "Knowledge Coverage",       value: "89%",  delta: "+6%",   dir: "up"   as Dir, def: "Products / services with complete docs",          spark: [77, 79, 81, 84, 87, 89] },
  { label: "Freshness Compliance",     value: "84%",  delta: "+4%",   dir: "up"   as Dir, def: "Pages reviewed within SLA window",                spark: [74, 76, 78, 80, 82, 84] },
  { label: "SME Time Saved",           value: "2,340h",delta: "+340h",dir: "up"   as Dir, def: "Hours redirected from doc queries this quarter",   spark: [170, 180, 190, 200, 220, 234].map(v => v * 10) },
  { label: "Cycle Variance Reduction", value: "23%",  delta: "+5%",   dir: "up"   as Dir, def: "Reduction in doc-to-release cycle variance",      spark: [11, 14, 17, 19, 21, 23] },
];

const EXEC_TREND_SERIES = [
  { name: "Coverage",  data: [77, 79, 81, 84, 87, 89], color: "var(--color-state-pass)" },
  { name: "Freshness", data: [74, 76, 78, 80, 82, 84], color: "#60a5fa" },
  { name: "Adoption",  data: [55, 60, 63, 68, 74, 78], color: "#f59e0b" },
];

type LOBEntry = {
  name: string; coverage: number; freshness: number; projects: number;
  trend: number[];
  portfolios: { name: string; coverage: number; freshness: number; projects: number }[];
};

const LOB_LIST: LOBEntry[] = [
  {
    name: "Consumer Banking", coverage: 92, freshness: 88, projects: 19,
    trend: [85, 87, 88, 90, 91, 92],
    portfolios: [
      { name: "Retail Banking",    coverage: 94, freshness: 91, projects: 8 },
      { name: "Digital Banking",   coverage: 91, freshness: 87, projects: 6 },
      { name: "Branch Operations", coverage: 88, freshness: 82, projects: 5 },
    ],
  },
  {
    name: "Commercial Payments", coverage: 85, freshness: 80, projects: 24,
    trend: [74, 77, 79, 81, 83, 85],
    portfolios: [
      { name: "Corporate Payments", coverage: 87, freshness: 84, projects: 9 },
      { name: "SMB Payments",       coverage: 83, freshness: 78, projects: 8 },
      { name: "FX Services",        coverage: 84, freshness: 79, projects: 7 },
    ],
  },
  {
    name: "Wealth Management", coverage: 88, freshness: 86, projects: 14,
    trend: [80, 82, 84, 85, 87, 88],
    portfolios: [
      { name: "Wealth Advisory",     coverage: 91, freshness: 89, projects: 5 },
      { name: "Investment Products", coverage: 86, freshness: 84, projects: 5 },
      { name: "Trust Services",      coverage: 88, freshness: 86, projects: 4 },
    ],
  },
  {
    name: "Fintech Partners", coverage: 81, freshness: 75, projects: 17,
    trend: [68, 71, 74, 77, 79, 81],
    portfolios: [
      { name: "API Partners",     coverage: 85, freshness: 80, projects: 6 },
      { name: "Open Banking",     coverage: 79, freshness: 73, projects: 6 },
      { name: "Embedded Finance", coverage: 78, freshness: 72, projects: 5 },
    ],
  },
];

function LOBTile({ lob, onClick }: { lob: LOBEntry; onClick: () => void }) {
  return (
    <div
      className="pane flex flex-col gap-3 rounded-xl p-4 cursor-pointer hover:bg-ink-700 transition-colors"
      onClick={onClick} role="button"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-bold text-gray-200">{lob.name}</p>
        <span className="text-[10px] font-semibold text-gray-500">{lob.projects} projects</span>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-[32px] font-bold leading-none" style={{ color: barColor(lob.coverage) }}>
          {lob.coverage}%
        </span>
        <div className="mb-1">
          <Spark data={lob.trend} color={barColor(lob.coverage)} />
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-750">
        <div className="h-full rounded-full" style={{ width: `${lob.coverage}%`, background: barColor(lob.coverage) }} />
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-gray-500">
        <span>Freshness: <span className="font-semibold text-gray-300">{lob.freshness}%</span></span>
        <span style={{ color: "#60a5fa" }}>Drill down →</span>
      </div>
    </div>
  );
}

function ExecLOBView({ lob, onBack }: { lob: LOBEntry; onBack: () => void }) {
  return (
    <>
      <Crumb parts={["Organisation", lob.name]} onBack={onBack} />

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="LOB Coverage"    value={`${lob.coverage}%`} dir="up" delta="+4% vs last qtr"
          def="Across all portfolios" spark={lob.trend} />
        <StatCard label="Freshness"       value={`${lob.freshness}%`} dir="up" delta="+3% vs last qtr"
          def="Within SLA window" />
        <StatCard label="Active Projects" value={String(lob.projects)} dir="up" delta="+2 this quarter"
          def="Projects with active docs" />
        <StatCard label="SLA Compliance"  value="91%" dir="up" delta="+2%"
          def="Reviews completed on time" />
      </div>

      <Card className="p-4">
        <TrendChart
          title={`${lob.name} — Knowledge Coverage Trend`}
          series={[{ name: "Coverage", data: lob.trend, color: "var(--color-state-pass)" }]}
          xLabels={EXEC_MONTHS}
          gradId={`lob-${lob.name.replace(/\s/g, "-")}`}
          height={110}
        />
      </Card>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Portfolio Breakdown</p>
        <div className="grid grid-cols-3 gap-3">
          {lob.portfolios.map(p => (
            <div key={p.name} className="pane flex flex-col gap-3 rounded-xl p-4">
              <p className="text-[12px] font-bold text-gray-200">{p.name}</p>
              <span className="text-[28px] font-bold leading-none" style={{ color: barColor(p.coverage) }}>
                {p.coverage}%
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-750">
                <div className="h-full rounded-full" style={{ width: `${p.coverage}%`, background: barColor(p.coverage) }} />
              </div>
              <div className="flex justify-between text-[10.5px] text-gray-500">
                <span>Freshness: <span className="font-semibold text-gray-300">{p.freshness}%</span></span>
                <span>{p.projects} projects</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-4">
        <CompBar
          title="Portfolio Coverage Comparison"
          items={lob.portfolios.map(p => ({ label: p.name, value: p.coverage }))}
        />
      </Card>
    </>
  );
}

function KnowledgeManagementExec() {
  const [drillLOB, setDrillLOB] = useState<LOBEntry | null>(null);

  return (
    <>
      <PageMeta title="Knowledge Management — Executive" description="Executive KM KPI Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
            <p className="mt-0.5 text-[12px] text-gray-500">Executive · Organisation-wide · Q3 2026</p>
          </div>
        </div>

        {drillLOB ? (
          <ExecLOBView lob={drillLOB} onBack={() => setDrillLOB(null)} />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              {EXEC_KPIS.map(k => (
                <StatCard key={k.label} label={k.label} value={k.value}
                  delta={k.delta} dir={k.dir} def={k.def} spark={k.spark} />
              ))}
            </div>

            <Card className="p-4">
              <TrendChart title="Monthly KPI Trend — 6 Month"
                series={EXEC_TREND_SERIES} xLabels={EXEC_MONTHS}
                gradId="exec-trend" height={130} />
            </Card>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Lines of Business — click to drill down
              </p>
              <div className="grid grid-cols-4 gap-3">
                {LOB_LIST.map(lob => (
                  <LOBTile key={lob.name} lob={lob} onClick={() => setDrillLOB(lob)} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Platform Adoption" value="78%" delta="+8%" dir="up"
                def="Users actively using KM platform"
                spark={[55, 60, 63, 68, 74, 78]} />
              <StatCard label="Graph Relationships" value="247" delta="+34 this qtr" dir="up"
                def="Services, docs and incidents linked"
                spark={[190, 200, 213, 225, 238, 247]} />
              <div className="col-span-2">
                <Card className="h-full p-4">
                  <WatchList title="Executive Summary" items={[
                    { text: "Knowledge Coverage above 85% target for 3 of 4 LOBs", status: "Good" },
                    { text: "Fintech Partners coverage at 81% — below 85% target",  status: "Warn" },
                    { text: "SME time savings tracking 23% above forecast",          status: "Good" },
                    { text: "Commercial Payments freshness at 80% — monitor closely", status: "Warn" },
                  ]} />
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROGRAM MANAGER
═══════════════════════════════════════════════════════════════════ */

const PM_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

type ProjEntry = {
  name: string; status: "healthy" | "at-risk" | "blocked";
  coverage: number; cycle: string; sla: number; lead: string;
  trend: number[];
  watchlist: { text: string; status: WStatus }[];
};

const PM_PROJECTS: ProjEntry[] = [
  {
    name: "Alpha", status: "healthy", coverage: 91, cycle: "2.1d", sla: 95, lead: "J. Chen",
    trend: [83, 85, 87, 89, 90, 91],
    watchlist: [
      { text: "Release docs approved and current for next milestone", status: "Good" },
      { text: "API docs ahead of schedule by 1 sprint",              status: "Good" },
      { text: "2 knowledge graph links pending team confirmation",   status: "Warn" },
    ],
  },
  {
    name: "Bravo", status: "at-risk", coverage: 74, cycle: "4.8d", sla: 71, lead: "M. Patel",
    trend: [71, 72, 73, 73, 74, 74],
    watchlist: [
      { text: "Doc cycle time 4.8d vs 2d target — escalate to lead", status: "Risk" },
      { text: "4 PRs without doc updates in past 2 sprints",         status: "Risk" },
      { text: "SLA compliance dropped 11 pts this month",            status: "Warn" },
    ],
  },
  {
    name: "Charlie", status: "healthy", coverage: 88, cycle: "2.7d", sla: 89, lead: "S. Kim",
    trend: [80, 82, 84, 85, 87, 88],
    watchlist: [
      { text: "Coverage improved 8% following template adoption",  status: "Good" },
      { text: "3 articles pending review to close minor SLA gap",  status: "Warn" },
      { text: "Integration test docs complete for Q3 milestone",   status: "Good" },
    ],
  },
  {
    name: "Delta", status: "blocked", coverage: 51, cycle: "7.2d", sla: 42, lead: "A. Torres",
    trend: [58, 56, 55, 53, 52, 51],
    watchlist: [
      { text: "SLA compliance at 42% — escalation required",       status: "Risk" },
      { text: "Coverage declining: 7 stale critical pages",        status: "Risk" },
      { text: "Team capacity gap blocks doc cycle improvement",    status: "Risk" },
      { text: "Release readiness at risk for upcoming milestone",  status: "Risk" },
    ],
  },
];

const PM_KPIS = [
  { label: "Programme Coverage",  value: "81%",  delta: "+7%",       dir: "up"   as Dir, def: "Project artifacts completed",         spark: [67, 70, 73, 76, 79, 81] },
  { label: "Doc Cycle Time",      value: "3.4d", delta: "Target 2d", dir: "down" as Dir, def: "Draft to approved publication",       spark: [48, 45, 42, 40, 37, 34] },
  { label: "SLA Compliance",      value: "88%",  delta: "+2%",       dir: "up"   as Dir, def: "Reviews and approvals on time",       spark: [82, 83, 84, 85, 87, 88] },
  { label: "Open Requests",       value: "46",   delta: "9 overdue", dir: "flat" as Dir, def: "Reader and team content requests",    spark: [52, 50, 49, 47, 47, 46] },
];

const PROJ_BADGE = {
  healthy:   { bg: "#f0fdf4", text: "var(--color-state-pass)", label: "Healthy"  },
  "at-risk": { bg: "#fffbeb", text: "var(--color-state-warn)", label: "At Risk"  },
  blocked:   { bg: "#fef2f2", text: "var(--color-state-fail)", label: "Blocked"  },
};

function ProjectCard({ p, onClick }: { p: ProjEntry; onClick: () => void }) {
  const badge = PROJ_BADGE[p.status];
  return (
    <div className="pane flex flex-col gap-3 rounded-xl p-4 cursor-pointer hover:bg-ink-700 transition-colors"
      onClick={onClick} role="button">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold text-gray-100">Project {p.name}</p>
          <p className="text-[10px] text-gray-500">Lead: {p.lead}</p>
        </div>
        <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
      </div>
      <Spark data={p.trend} color={barColor(p.coverage)} />
      <div className="h-1 overflow-hidden rounded-full bg-ink-750">
        <div className="h-full rounded-full" style={{ width: `${p.coverage}%`, background: barColor(p.coverage) }} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {([["Coverage", `${p.coverage}%`], ["Cycle", p.cycle], ["SLA", `${p.sla}%`]] as [string, string][]).map(([lbl, val]) => (
          <div key={lbl} className="rounded-lg bg-ink-800 py-2">
            <p className="text-[13px] font-bold text-gray-100">{val}</p>
            <p className="text-[9px] text-gray-500">{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PMProjectView({ project, onBack }: { project: ProjEntry; onBack: () => void }) {
  const badge = PROJ_BADGE[project.status];
  return (
    <>
      <Crumb parts={["Programme", `Project ${project.name}`]} onBack={onBack} />
      <div className="flex items-center gap-3">
        <span className="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
        <span className="text-[12px] text-gray-500">Lead: <span className="text-gray-300">{project.lead}</span></span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Doc Coverage"   value={`${project.coverage}%`}
          dir={project.coverage >= 80 ? "up" : "down"}
          delta={`${project.coverage >= 80 ? "+" : ""}${project.coverage - 75}% vs baseline`}
          def="Project documentation completeness" spark={project.trend} />
        <StatCard label="Doc Cycle Time" value={project.cycle} dir="down" delta="Target: 2.0d"
          def="Draft to approved publication" />
        <StatCard label="SLA Compliance" value={`${project.sla}%`}
          dir={project.sla >= 85 ? "up" : "down"}
          delta={project.sla >= 85 ? "+3%" : "Below target"}
          def="Reviews completed on time" />
        <StatCard label="Freshness" value={`${Math.round(project.sla * 0.95)}%`} dir="up"
          delta="+2%" def="Pages within review SLA" />
      </div>
      <Card className="p-4">
        <TrendChart title={`Project ${project.name} — Coverage Trend`}
          series={[{ name: "Coverage", data: project.trend, color: barColor(project.coverage) }]}
          xLabels={PM_MONTHS} gradId={`pm-proj-${project.name}`} height={110} />
      </Card>
      <Card className="p-4">
        <WatchList title="Project Watchlist" items={project.watchlist} />
      </Card>
    </>
  );
}

function KnowledgeManagementPM() {
  const [drillProject, setDrillProject] = useState<ProjEntry | null>(null);

  return (
    <>
      <PageMeta title="Knowledge Management — Program Manager" description="PM KM KPI Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">Programme Manager · Payments Platform · Q3 2026</p>
        </div>

        {drillProject ? (
          <PMProjectView project={drillProject} onBack={() => setDrillProject(null)} />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3">
              {PM_KPIS.map(k => (
                <StatCard key={k.label} label={k.label} value={k.value}
                  delta={k.delta} dir={k.dir} def={k.def} spark={k.spark} />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <TrendChart title="Programme Coverage Trend"
                  series={[{ name: "Coverage", data: [67, 70, 73, 76, 79, 81], color: "var(--color-state-pass)" }]}
                  xLabels={PM_MONTHS} gradId="pm-cov" height={110} />
              </Card>
              <Card className="p-4">
                <TrendChart title="Doc Cycle Time Trend (×10 days)"
                  series={[{ name: "Cycle Time", data: [48, 45, 42, 40, 37, 34], color: "#f59e0b" }]}
                  xLabels={PM_MONTHS} gradId="pm-cycle" height={110} />
              </Card>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Projects — click to drill down
              </p>
              <div className="grid grid-cols-4 gap-3">
                {PM_PROJECTS.map(p => (
                  <ProjectCard key={p.name} p={p} onClick={() => setDrillProject(p)} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OPERATIONS
═══════════════════════════════════════════════════════════════════ */

const OPS_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const OPS_KPIS = [
  { label: "SLA Compliance",  value: "91%", delta: "+3%", dir: "up" as Dir, def: "Reviews completed within governance window",  spark: [84, 86, 87, 88, 90, 91] },
  { label: "Freshness",       value: "84%", delta: "+4%", dir: "up" as Dir, def: "Pages reviewed within SLA",                  spark: [76, 78, 80, 81, 83, 84] },
  { label: "Open Backlog",    value: "23",  delta: "−5",  dir: "up" as Dir, def: "Open governance exceptions requiring action", spark: [38, 35, 32, 29, 26, 23] },
  { label: "Process Health",  value: "87%", delta: "+2%", dir: "up" as Dir, def: "Composite governance KPI score",             spark: [81, 82, 84, 85, 86, 87] },
];

type GovEx = { id: string; type: string; program: string; owner: string; age: string; sev: "High" | "Med" | "Low" };
const GOV_EX: GovEx[] = [
  { id: "GOV-041", type: "SLA Breach",    program: "Payments Platform",  owner: "K. Sharma",  age: "8d",  sev: "High" },
  { id: "GOV-038", type: "Stale Content", program: "Digital Onboarding", owner: "L. Torres",  age: "12d", sev: "High" },
  { id: "GOV-035", type: "Approval Gap",  program: "Fraud Detection",    owner: "P. Nguyen",  age: "6d",  sev: "Med"  },
  { id: "GOV-033", type: "Ownership Gap", program: "Risk Analytics",     owner: "R. Mehta",   age: "15d", sev: "Med"  },
  { id: "GOV-029", type: "Template OOC",  program: "API Gateway",        owner: "C. Wilson",  age: "3d",  sev: "Low"  },
  { id: "GOV-027", type: "Stale Content", program: "Settlement Engine",  owner: "M. Patel",   age: "9d",  sev: "High" },
];
const SEV_STYLE: Record<string, import("react").CSSProperties> = {
  High: { background: "#fef2f2", color: "var(--color-state-fail)", border: "1px solid #fecaca" },
  Med:  { background: "#fffbeb", color: "var(--color-state-warn)", border: "1px solid #fde68a" },
  Low:  { background: "#f0fdf4", color: "var(--color-state-pass)", border: "1px solid #bbf7d0" },
};

function GovTable({ data }: { data: GovEx[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-6 gap-2 px-3 pb-1">
        {["ID", "Type", "Program", "Owner", "Age", "Severity"].map(h => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">{h}</p>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {data.map(r => (
          <div key={r.id} className="grid grid-cols-6 gap-2 rounded-lg bg-ink-800 px-3 py-2.5 items-center">
            <span className="font-mono text-[11px] text-gray-400">{r.id}</span>
            <span className="text-[11px] text-gray-300">{r.type}</span>
            <span className="text-[11px] text-gray-300">{r.program}</span>
            <span className="text-[11px] text-gray-400">{r.owner}</span>
            <span className="text-[11px] text-gray-400">{r.age}</span>
            <span className="w-fit rounded-[4px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={SEV_STYLE[r.sev]}>{r.sev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeManagementOps() {
  const [lobFilter, setLobFilter] = useState("All");

  const filtered = lobFilter === "All" ? GOV_EX
    : lobFilter === "Payments" ? GOV_EX.filter(e => e.program.includes("Payment") || e.program.includes("Settlement"))
    : lobFilter === "Digital"  ? GOV_EX.filter(e => e.program.includes("Digital") || e.program.includes("API"))
    : GOV_EX.filter(e => e.program.includes("Risk") || e.program.includes("Fraud"));

  return (
    <>
      <PageMeta title="Knowledge Management — Operations" description="KM Operations Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
            <p className="mt-0.5 text-[12px] text-gray-500">Operations · Cross-programme Governance · Q3 2026</p>
          </div>
          <div className="flex gap-1.5">
            {["All", "Payments", "Digital", "Risk"].map(f => (
              <button key={f} type="button"
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  lobFilter === f
                    ? "bg-ink-600 text-gray-100"
                    : "border border-ink-700 bg-ink-800 text-gray-400 hover:text-gray-200"
                }`}
                onClick={() => setLobFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {OPS_KPIS.map(k => (
            <StatCard key={k.label} label={k.label} value={k.value}
              delta={k.delta} dir={k.dir} def={k.def} spark={k.spark} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <TrendChart title="SLA Compliance & Freshness Trend"
              series={[
                { name: "SLA Compliance", data: [84, 86, 87, 88, 90, 91], color: "var(--color-state-pass)" },
                { name: "Freshness",      data: [76, 78, 80, 81, 83, 84], color: "#60a5fa" },
              ]}
              xLabels={OPS_MONTHS} gradId="ops-sla" height={120} />
          </Card>
          <Card className="p-4">
            <CompBar title="LOB Coverage Comparison" items={[
              { label: "Consumer Banking",  value: 92 },
              { label: "Wealth Management", value: 88 },
              { label: "Commercial Pmts",   value: 85 },
              { label: "Fintech Partners",  value: 81 },
            ]} />
          </Card>
        </div>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Governance Exceptions</p>
            <span className="text-[11px] text-gray-500">{filtered.length} of {GOV_EX.length} shown</span>
          </div>
          <GovTable data={filtered} />
        </Card>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DEVELOPER
═══════════════════════════════════════════════════════════════════ */

const DEV_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const DEV_KPIS = [
  { label: "Doc Coverage",        value: "67%",  delta: "+5%",       dir: "up"   as Dir, def: "Files with up-to-date documentation",  spark: [54, 57, 59, 62, 65, 67] },
  { label: "PR-to-Doc Rate",      value: "71%",  delta: "+14%",      dir: "up"   as Dir, def: "Merged PRs with doc suggestions",      spark: [50, 54, 58, 63, 67, 71] },
  { label: "API Doc Completeness",value: "84%",  delta: "+5%",       dir: "up"   as Dir, def: "APIs with current linked docs",        spark: [72, 75, 78, 80, 82, 84] },
  { label: "CI/CD Compliance",    value: "68%",  delta: "Needs lift",dir: "flat" as Dir, def: "Releases with linked release notes",   spark: [66, 67, 66, 68, 67, 68] },
];

const REPO_MAP = [
  { name: "api-gateway",      coverage: 85, files: 42 },
  { name: "payment-service",  coverage: 67, files: 38 },
  { name: "auth-service",     coverage: 91, files: 29 },
  { name: "settlement",       coverage: 72, files: 33 },
  { name: "notifications",    coverage: 48, files: 21 },
];

const REC_DOCS = [
  { title: "API Gateway — Request Routing Spec",  updated: "3d ago", priority: "High" },
  { title: "Payment Service — Transaction Flows", updated: "1d ago", priority: "High" },
  { title: "Auth Patterns — OAuth2 Token Guide",  updated: "5d ago", priority: "Med"  },
  { title: "Settlement Flow — Reconciliation",    updated: "8d ago", priority: "Med"  },
  { title: "Notification Service — Event Schema", updated: "2w ago", priority: "Low"  },
];

function KnowledgeManagementDev() {
  return (
    <>
      <PageMeta title="Knowledge Management — Developer" description="Developer KM Dashboard" />
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "#60a5fa" }}>Project Mercury</p>
          <h1 className="text-[18px] font-bold text-gray-100">Knowledge Management</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">Developer · Project Mercury · Q3 2026</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {DEV_KPIS.map(k => (
            <StatCard key={k.label} label={k.label} value={k.value}
              delta={k.delta} dir={k.dir} def={k.def} spark={k.spark} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <TrendChart title="Doc Coverage Trend"
              series={[{ name: "Coverage", data: [54, 57, 59, 62, 65, 67], color: "var(--color-state-pass)" }]}
              xLabels={DEV_MONTHS} gradId="dev-cov" height={110} />
          </Card>
          <Card className="p-4">
            <TrendChart title="Code Knowledge Index"
              series={[
                { name: "PR-to-Doc", data: [50, 54, 58, 63, 67, 71], color: "#60a5fa" },
                { name: "API Docs",  data: [72, 75, 78, 80, 82, 84], color: "#f59e0b" },
              ]}
              xLabels={DEV_MONTHS} gradId="dev-code" height={110} />
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="pane flex flex-col gap-3 rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Repo Knowledge Map</p>
            <div className="flex flex-col gap-2">
              {REPO_MAP.map(r => (
                <div key={r.name} className="flex items-center gap-2.5">
                  <span className="w-36 shrink-0 font-mono text-[11px] text-gray-400">{r.name}</span>
                  <div className="relative flex-1 h-5 overflow-hidden rounded-md bg-ink-750">
                    <div className="h-full rounded-md transition-all"
                      style={{ width: `${r.coverage}%`, background: barColor(r.coverage) }} />
                    <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold text-gray-200">
                      {r.coverage}%
                    </span>
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] text-gray-600">{r.files}f</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recommended Docs</p>
            <div className="flex flex-col gap-2">
              {REC_DOCS.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg bg-ink-800 px-3 py-2.5">
                  <span className="mt-px shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={SEV_STYLE[d.priority === "Med" ? "Med" : d.priority === "High" ? "High" : "Low"]}>
                    {d.priority}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-gray-200">{d.title}</p>
                    <p className="text-[10px] text-gray-500">Updated {d.updated}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROUTER
═══════════════════════════════════════════════════════════════════ */
export default function KnowledgeManagement() {
  const role = localStorage.getItem("demo_role");
  if (role === "user_program_manager") return <KnowledgeManagementPM />;
  if (role === "user_product_ops")     return <KnowledgeManagementOps />;
  if (role !== "user_executive")       return <KnowledgeManagementDev />;
  return <KnowledgeManagementExec />;
}
