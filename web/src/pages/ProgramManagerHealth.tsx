import { useLocation, useNavigate } from "react-router";
import PageMeta from "../components/common/PageMeta";
import {
  Card, StatCard, Pill, Badge, Progress,
  PageHead, SectionTitle, MockButton,
} from "../components/visa/kit";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectStatus = "on-track" | "at-risk" | "off-track";
type RiskSeverity = "critical" | "high" | "medium";
type DepStatus = "blocked" | "at-risk" | "active";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PROJECTS: {
  code: string; name: string; status: ProjectStatus;
  schedule: number; budget: number; scope: number; quality: number; risk: string;
  team: number; sprint: number;
}[] = [
  { code: "PAY", name: "Payments", status: "at-risk",   schedule: 72, budget: 81, scope: 68, quality: 74, risk: "HIGH",     team: 18, sprint: 21 },
  { code: "CSP", name: "Customer Service Portal", status: "on-track",  schedule: 94, budget: 97, scope: 91, quality: 96, risk: "LOW",      team: 12, sprint: 34 },
  { code: "FRD", name: "Fraud & Risk Engine", status: "off-track", schedule: 48, budget: 63, scope: 52, quality: 57, risk: "CRITICAL", team: 21, sprint: 19 },
  { code: "MOB", name: "Merchant Onboarding", status: "on-track",  schedule: 89, budget: 92, scope: 87, quality: 93, risk: "LOW",      team: 14, sprint: 31 },
];

const CROSS_METRICS: { label: string; value: string; trend: string; up: boolean }[] = [
  { label: "Sprint Predictability",  value: "78%",     trend: "+3% vs last sprint",       up: true  },
  { label: "Defect Trend",           value: "↓ 12%",   trend: "improvement this sprint",  up: true  },
  { label: "Release Confidence",     value: "71%",     trend: "−5% vs last quarter",      up: false },
  { label: "Delivery Forecast",      value: "Q3 '26",  trend: "2 of 4 on track",          up: true  },
  { label: "Capacity Utilization",   value: "84%",     trend: "+2% vs last sprint",       up: true  },
];

const TOP_RISKS: { id: string; project: string; title: string; severity: RiskSeverity }[] = [
  { id: "R-041", project: "FRD", title: "ML model latency exceeding SLA thresholds in prod", severity: "critical" },
  { id: "R-038", project: "PAY", title: "PCI DSS audit finding — compensating controls required", severity: "high" },
  { id: "R-039", project: "FRD", title: "Insufficient test coverage on fraud scoring rules", severity: "high" },
  { id: "R-035", project: "PAY", title: "Third-party payment gateway API deprecation in Dec 2026", severity: "medium" },
  { id: "R-042", project: "MOB", title: "KYC provider rate limits impacting onboarding velocity", severity: "medium" },
];

const ESCALATIONS: { project: string; summary: string; owner: string; escalatedTo: string; days: number }[] = [
  { project: "FRD", summary: "Sprint 18 velocity dropped 40% — resource conflict with Platform team", owner: "J. Martinez", escalatedTo: "VP Engineering", days: 4 },
  { project: "PAY", summary: "Security audit incomplete, blocking Q3 release certification window", owner: "P. Chen", escalatedTo: "CISO Office", days: 7 },
];

const DEPENDENCIES: { from: string; to: string; description: string; status: DepStatus }[] = [
  { from: "PAY", to: "FRD", description: "Fraud scoring API required for payment validation",          status: "blocked"  },
  { from: "MOB", to: "PAY", description: "Payment integration needed for merchant activation flow",    status: "at-risk"  },
  { from: "CSP", to: "MOB", description: "Merchant profile data feed for support agent context",       status: "active"   },
];

const MILESTONES: { project: string; title: string; date: string; daysOut: number; status: ProjectStatus }[] = [
  { project: "PAY", title: "Security Audit Completion",  date: "Sep 15, 2026", daysOut: 14, status: "at-risk"  },
  { project: "FRD", title: "ML Model v2 Deployment",     date: "Sep 22, 2026", daysOut: 21, status: "off-track" },
  { project: "MOB", title: "Go-Live Phase 2",            date: "Oct 1, 2026",  daysOut: 30, status: "on-track"  },
  { project: "CSP", title: "v3.2 Production Release",   date: "Oct 8, 2026",  daysOut: 37, status: "on-track"  },
];

// ─── Knowledge Management KPIs (moved from KnowledgeManagement landing page) ──

type KmKpi = {
  label: string; value: string;
  delta?: string; dir?: "up" | "down" | "flat";
  description: string; progress?: number;
};

const KM_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const PM_KM_KPIS: KmKpi[] = [
  { label: "Documentation Completion", value: "81%",  delta: "+7%",      dir: "up",   progress: 81, description: "Required project artifacts completed" },
  { label: "Open Content Requests",    value: "46",   delta: "9 overdue", dir: "flat", progress: 62, description: "Requests across Payments, CSP, Fraud & Risk Engine, and Merchant Onboarding" },
  { label: "Approval Cycle Time",      value: "3.4d", delta: "Target 2d", dir: "down", progress: 59, description: "Average draft-to-approval duration" },
  { label: "SLA Compliance",           value: "88%",  delta: "+2%",      dir: "up",   progress: 88, description: "Reviews and approvals completed on time" },
  { label: "Action Items Captured",    value: "93%",  delta: "+5%",      dir: "up",   progress: 93, description: "Meeting actions stored with owners" },
  { label: "Decision Traceability",    value: "86%",  delta: "+6%",      dir: "up",   progress: 86, description: "Decisions linked to delivery artifacts" },
  { label: "Release Doc Readiness",    value: "84%",  delta: "+4%",      dir: "up",   progress: 84, description: "Milestones with approved release documentation" },
  { label: "Project KM Health",        value: "79%",  delta: "+3%",      dir: "up",   progress: 79, description: "Aggregate health across the four projects" },
];

const KM_CHART_SERIES = [
  { name: "Documentation Completion", values: [64, 68, 76, 81, 89, 95], color: "#A855F7" },
  { name: "SLA Compliance",           values: [88, 84, 90, 86, 92, 89], color: "#22D3EE" },
  { name: "Release Doc Readiness",    values: [48, 57, 63, 74, 82, 91], color: "#E879F9" },
];

function kmDirSymbol(dir: "up" | "down" | "flat" = "flat") {
  return dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
}

function KmKpiCard({ kpi }: { kpi: KmKpi }) {
  return (
    <Card className="flex min-h-[120px] flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase leading-tight tracking-wide text-gray-500">
          {kpi.label}
        </p>
        {kpi.delta && (
          <span className="shrink-0 rounded-full bg-ink-750 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
            {kmDirSymbol(kpi.dir)} {kpi.delta}
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

function KmMonthlyBarChart() {
  const max = Math.max(...KM_CHART_SERIES.flatMap(s => s.values), 1);
  return (
    <Card className="mt-5 p-3.5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[18px] font-bold text-gray-100">Monthly KPI Trend</h2>
        <p className="text-[12px] text-gray-500">Mar to Aug</p>
      </div>
      <div className="flex h-32 items-end gap-2 border-b border-ink-700 px-1 pb-4 pt-2">
        {KM_MONTHS.map((month, i) => (
          <div key={month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex h-full items-end justify-center gap-0.5">
              {KM_CHART_SERIES.map(s => (
                <div
                  key={s.name}
                  title={`${s.name}: ${s.values[i]}`}
                  className="w-full max-w-3 rounded-t-sm transition-opacity hover:opacity-80"
                  style={{ height: `${Math.max((s.values[i] / max) * 100, 5)}%`, background: s.color }}
                />
              ))}
            </div>
            <span className="mt-1.5 text-center text-[9px] text-gray-500">{month}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3">
        {KM_CHART_SERIES.map(s => (
          <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <i className="h-1.5 w-1.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ─── Project-specific KPIs ────────────────────────────────────────────────────

type ProjectKpi = { label: string; value: string; delta: string; up: boolean; progress: number; description: string };

const PROJECT_KPIS: Record<string, ProjectKpi[]> = {
  PAY: [
    { label: "Sprint Velocity",   value: "42 pts", delta: "−8 vs avg",    up: false, progress: 68, description: "Story points completed in current sprint" },
    { label: "Defect Trend",      value: "↓ 14%",  delta: "Improving",    up: true,  progress: 72, description: "Defect rate vs prior 3 sprints" },
    { label: "API Completion",    value: "74%",    delta: "Target 85%",   up: false, progress: 74, description: "Payment APIs with full implementation & tests" },
    { label: "Release Readiness", value: "61%",    delta: "−5% vs plan",  up: false, progress: 61, description: "Pre-release checklist completion rate" },
  ],
  CSP: [
    { label: "User Story Progress",   value: "91%", delta: "+3% this sprint", up: true,  progress: 91, description: "Sprint stories delivered vs committed" },
    { label: "UAT Pass Rate",         value: "96%", delta: "+1%",             up: true,  progress: 96, description: "User acceptance test scenarios passing" },
    { label: "Escaped Defects",       value: "2",   delta: "−3 vs last",      up: true,  progress: 90, description: "Defects found post-UAT in this release" },
    { label: "Deployment Readiness",  value: "93%", delta: "On track",        up: true,  progress: 93, description: "Release pipeline and rollback checks complete" },
  ],
  FRD: [
    { label: "Rule Engine Coverage",  value: "58%", delta: "−12% vs plan",    up: false, progress: 58, description: "Fraud rules with full coverage in test suite" },
    { label: "Detection Accuracy",    value: "87%", delta: "+2% this sprint",  up: true,  progress: 87, description: "Fraud detection model accuracy in staging" },
    { label: "Test Coverage",         value: "52%", delta: "Target 80%",      up: false, progress: 52, description: "Unit and integration test coverage" },
    { label: "Production Incidents",  value: "4",   delta: "+2 this month",   up: false, progress: 40, description: "P1/P2 incidents in last 30 days" },
  ],
  MOB: [
    { label: "Onboarding Completion", value: "87%",    delta: "+4% this sprint", up: true,  progress: 87, description: "Merchants completing full onboarding flow" },
    { label: "Integration Readiness", value: "92%",    delta: "On track",        up: true,  progress: 92, description: "API integrations validated end-to-end" },
    { label: "Story Completion",      value: "89%",    delta: "+2% vs target",   up: true,  progress: 89, description: "Sprint stories delivered vs committed" },
    { label: "Go-Live Status",        value: "Phase 2",delta: "Oct 1, 2026",     up: true,  progress: 75, description: "Phase 2 go-live on track per milestone" },
  ],
};

// 8-week health % per project (most-recent last)
const TREND_WEEKS  = ["Jul 7", "Jul 14", "Jul 21", "Jul 28", "Aug 4", "Aug 11", "Aug 18", "Aug 25"];
const TREND_DATA: Record<string, number[]> = {
  PAY: [85, 82, 79, 77, 74, 72, 70, 72],
  CSP: [92, 93, 94, 95, 94, 95, 96, 94],
  FRD: [71, 68, 63, 59, 54, 50, 48, 48],
  MOB: [85, 86, 87, 88, 89, 90, 89, 89],
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<ProjectStatus, "pass" | "warn" | "fail"> = {
  "on-track": "pass", "at-risk": "warn", "off-track": "fail",
};
const STATUS_LABEL: Record<ProjectStatus, string> = {
  "on-track": "On Track", "at-risk": "At Risk", "off-track": "Off Track",
};
const RISK_TONE: Record<RiskSeverity, "fail" | "warn" | "idle"> = {
  critical: "fail", high: "warn", medium: "idle",
};
const DEP_TONE: Record<DepStatus, "fail" | "warn" | "pass"> = {
  blocked: "fail", "at-risk": "warn", active: "pass",
};
const DEP_LABEL: Record<DepStatus, string> = {
  blocked: "Blocked", "at-risk": "At Risk", active: "Active",
};
const RISK_BADGE_TONE: Record<string, "fail" | "warn" | "brand" | "pass"> = {
  CRITICAL: "fail", HIGH: "warn", MEDIUM: "brand", LOW: "pass",
};
const PROJECT_COLOR: Record<string, string> = {
  PAY: "#946200", CSP: "#00a870", FRD: "#d14343", MOB: "#1434cb",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PctCell({ value }: { value: number }) {
  const cls =
    value >= 90 ? "text-state-pass" :
    value >= 75 ? "text-accent" :
    value >= 60 ? "text-state-warn" : "text-state-fail";
  return <span className={`font-mono text-[13px] font-bold ${cls}`}>{value}%</span>;
}

function HealthTrendChart() {
  const W = 500, H = 140;
  const PAD = { top: 12, right: 14, bottom: 28, left: 32 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const MIN_V = 40, MAX_V = 100;

  const pt = (val: number, idx: number): [number, number] => [
    PAD.left + (idx / (TREND_WEEKS.length - 1)) * iw,
    PAD.top + ih - ((val - MIN_V) / (MAX_V - MIN_V)) * ih,
  ];

  const makePath = (vals: number[]) =>
    vals.map((v, i) => pt(v, i)).map(([x, y], i) =>
      `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    ).join(" ");

  const yTicks = [50, 60, 70, 80, 90, 100];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {PROJECTS.map(p => (
          <div key={p.code} className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[p.code] }} />
            <span className="font-mono text-[11px] text-gray-400">{p.code} — {p.name}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Portfolio health trend">
        {yTicks.map(t => {
          const y = PAD.top + ih - ((t - MIN_V) / (MAX_V - MIN_V)) * ih;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray={t % 20 === 0 ? "none" : "3 3"} />
              <text x={PAD.left - 5} y={y + 3.5} textAnchor="end"
                fontSize="8.5" fill="#94a3b8" fontFamily="'JetBrains Mono', monospace">{t}</text>
            </g>
          );
        })}
        {TREND_WEEKS.map((w, i) => {
          const x = PAD.left + (i / (TREND_WEEKS.length - 1)) * iw;
          return (
            <text key={w} x={x} y={H - 6} textAnchor="middle"
              fontSize="8.5" fill="#94a3b8" fontFamily="'JetBrains Mono', monospace">{w}</text>
          );
        })}
        {PROJECTS.map(p => (
          <path key={p.code} d={makePath(TREND_DATA[p.code])}
            fill="none" stroke={PROJECT_COLOR[p.code]} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {PROJECTS.map(p => {
          const vals = TREND_DATA[p.code];
          const [x, y] = pt(vals[vals.length - 1], vals.length - 1);
          return <circle key={p.code} cx={x} cy={y} r="3" fill={PROJECT_COLOR[p.code]} />;
        })}
      </svg>
    </div>
  );
}

function RiskDistributionChart() {
  const counts = { CRITICAL: 1, HIGH: 2, MEDIUM: 2, LOW: 0 };
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const colors: Record<string, string> = {
    CRITICAL: "#d14343", HIGH: "#946200", MEDIUM: "#1434cb", LOW: "#00a870",
  };
  let cumAngle = -Math.PI / 2;
  const R = 42, CX = 55, CY = 55;

  const slices = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, val]) => {
      const angle = (val / total) * 2 * Math.PI;
      const x1 = CX + R * Math.cos(cumAngle);
      const y1 = CY + R * Math.sin(cumAngle);
      cumAngle += angle;
      const x2 = CX + R * Math.cos(cumAngle);
      const y2 = CY + R * Math.sin(cumAngle);
      const large = angle > Math.PI ? 1 : 0;
      return { key, val, color: colors[key], x1, y1, x2, y2, large };
    });

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 110 110" className="size-[90px] shrink-0" aria-label="Risk distribution">
        {slices.map(s => (
          <path key={s.key}
            d={`M${CX},${CY} L${s.x1.toFixed(2)},${s.y1.toFixed(2)} A${R},${R} 0 ${s.large},1 ${s.x2.toFixed(2)},${s.y2.toFixed(2)} Z`}
            fill={s.color} opacity="0.85" />
        ))}
        <circle cx={CX} cy={CY} r="22" fill="white" />
        <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontWeight="bold" fill="#0f172a" fontFamily="'Space Grotesk', sans-serif">
          {total}
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle"
          fontSize="8" fill="#94a3b8" fontFamily="'JetBrains Mono', monospace">
          risks
        </text>
      </svg>
      <div className="space-y-1.5">
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: colors[key] }} />
            <span className="w-14 font-mono text-[11px] text-gray-400">{key}</span>
            <span className="font-mono text-[12px] font-bold text-gray-200">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Project Focus Panel ──────────────────────────────────────────────────────

function ProjectFocusPanel({ code }: { code: string }) {
  const project = PROJECTS.find(p => p.code === code);
  const kpis = PROJECT_KPIS[code];
  if (!project || !kpis) return null;

  return (
    <section>
      <SectionTitle aside={`Filtered to ${code}`}>
        Project Focus — {project.name}
      </SectionTitle>
      <Card className="border-accent/50 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: PROJECT_COLOR[code] }} />
          <span className="font-mono text-[13px] font-bold text-gray-100">{code}</span>
          <span className="text-[15px] font-semibold text-gray-100">{project.name}</span>
          <Pill tone={STATUS_TONE[project.status]} dot>{STATUS_LABEL[project.status]}</Pill>
          <Badge tone={RISK_BADGE_TONE[project.risk]}>{project.risk} RISK</Badge>
          <span className="ml-auto font-mono text-[12px] text-gray-500">Sprint {project.sprint} · {project.team} ppl</span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg border border-ink-700 bg-ink-800 p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">{k.label}</p>
              <p className="mt-2 text-[24px] font-bold leading-none text-gray-100">{k.value}</p>
              <div className="mt-2">
                <Progress
                  value={k.progress}
                  tone={k.progress >= 85 ? "pass" : k.progress >= 65 ? "warn" : "fail"}
                  className="w-full"
                />
              </div>
              <p className={`mt-1.5 text-[11px] font-semibold ${k.up ? "text-state-pass" : "text-state-fail"}`}>
                {k.up ? "↑" : "↓"} {k.delta}
              </p>
              <p className="mt-1 text-[10.5px] leading-4 text-gray-500">{k.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconGrid   = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="5" height="5" rx="0.5" /><rect x="8" y="1" width="5" height="5" rx="0.5" /><rect x="1" y="8" width="5" height="5" rx="0.5" /><rect x="8" y="8" width="5" height="5" rx="0.5" /></svg>;
const IconCheck  = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.6"><path d="M2 7l3 3 7-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconWarn   = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M7 1.5L13 12.5H1L7 1.5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 5.5v3M7 10v.5" strokeLinecap="round" /></svg>;
const IconAlert  = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v3M7 9v.5" strokeLinecap="round" /></svg>;
const IconHealth = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M1 7h2l2-4 2 8 2-5 1 1h3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ArrowRight = () => (
  <svg viewBox="0 0 16 8" fill="none" className="size-4 shrink-0 text-gray-500" stroke="currentColor" strokeWidth="1.5">
    <path d="M0 4h12M9 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramManagerHealth() {
  const location = useLocation();
  const navigate  = useNavigate();
  const selectedProject: string | undefined = (location.state as { selectedProject?: string } | null)?.selectedProject;

  const onTrack  = PROJECTS.filter(p => p.status === "on-track").length;
  const atRisk   = PROJECTS.filter(p => p.status === "at-risk").length;
  const offTrack = PROJECTS.filter(p => p.status === "off-track").length;
  const healthPct = Math.round((onTrack * 100 + atRisk * 50 + offTrack * 0) / PROJECTS.length);
  const healthTone = healthPct >= 80 ? "pass" : healthPct >= 60 ? "warn" : "fail";

  return (
    <>
      <PageMeta title="Portfolio Health" />
      <div className="min-h-screen pb-12">

        <PageHead
          kicker="Program Manager"
          title="Portfolio Health"
          blurb={selectedProject
            ? `Focused view — ${PROJECTS.find(p => p.code === selectedProject)?.name ?? selectedProject} · PAY · CSP · FRD · MOB`
            : "Portfolio health across 4 active projects · PAY · CSP · FRD · MOB"
          }
          right={null}
        />

        <div className="space-y-7 px-6 pt-6">

          {/* ── 1. Portfolio Summary ──────────────────────────────────────── */}
          <section>
            <SectionTitle>Consumer Banking : Portfolio Summary</SectionTitle>
            <Card className="overflow-hidden p-0">
              <div className="grid grid-cols-5 gap-px bg-ink-700">

                {/* Total Projects */}
                <div className="flex flex-col items-center justify-center gap-0.5 bg-ink-800 px-5 py-3.5 text-center transition-colors hover:bg-ink-750/50">
                  <span className="font-mono text-[32px] font-bold leading-none text-accent">{PROJECTS.length}</span>
                  <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Active</span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                    <IconGrid />Total Projects
                  </span>
                </div>

                {/* On Track */}
                <div className="flex flex-col items-center justify-center gap-0.5 bg-ink-800 px-5 py-3.5 text-center transition-colors hover:bg-ink-750/50">
                  <span className="font-mono text-[32px] font-bold leading-none text-state-pass">{onTrack}</span>
                  <span className="mt-0.5 text-[11px] font-semibold text-state-pass">{Math.round(onTrack / PROJECTS.length * 100)}%</span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                    <IconCheck />On Track
                  </span>
                </div>

                {/* At Risk */}
                <div className="flex flex-col items-center justify-center gap-0.5 bg-ink-800 px-5 py-3.5 text-center transition-colors hover:bg-ink-750/50">
                  <span className="font-mono text-[32px] font-bold leading-none text-state-warn">{atRisk}</span>
                  <span className="mt-0.5 text-[11px] font-semibold text-state-warn">{Math.round(atRisk / PROJECTS.length * 100)}%</span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                    <IconWarn />At Risk
                  </span>
                </div>

                {/* Off Track */}
                <div className="flex flex-col items-center justify-center gap-0.5 bg-ink-800 px-5 py-3.5 text-center transition-colors hover:bg-ink-750/50">
                  <span className="font-mono text-[32px] font-bold leading-none text-state-fail">{offTrack}</span>
                  <span className="mt-0.5 text-[11px] font-semibold text-state-fail">{Math.round(offTrack / PROJECTS.length * 100)}%</span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                    <IconAlert />Off Track
                  </span>
                </div>

                {/* Portfolio Health */}
                <div className="flex flex-col items-center justify-center gap-0.5 bg-ink-800 px-5 py-3.5 text-center transition-colors hover:bg-ink-750/50">
                  <span className="font-mono text-[32px] font-bold leading-none" style={{ color: "#d97706" }}>{healthPct}%</span>
                  <div className="mt-0.5 w-20">
                    <Progress value={healthPct} tone={healthTone} />
                  </div>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                    <IconHealth />Portfolio Health
                  </span>
                </div>

              </div>
            </Card>
          </section>

          {/* ── 1b. Project Focus KPIs (shown when navigated from KnowledgeManagement) */}
          {selectedProject && <ProjectFocusPanel code={selectedProject} />}

          {/* ── 2. Portfolio Health Grid ──────────────────────────────────── */}
          <section>
            <SectionTitle aside="Updated · Aug 25, 2026">Portfolio Health Grid</SectionTitle>
            <Card>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-ink-700">
                    <th className="col-label px-5 py-3 text-left">Project</th>
                    <th className="col-label px-4 py-3 text-center">Status</th>
                    <th className="col-label px-4 py-3 text-center">Schedule</th>
                    <th className="col-label px-4 py-3 text-center">Budget</th>
                    <th className="col-label px-4 py-3 text-center">Scope</th>
                    <th className="col-label px-4 py-3 text-center">Quality</th>
                    <th className="col-label px-4 py-3 text-center">Team</th>
                    <th className="col-label px-4 py-3 text-center">Risk</th>
                    <th className="col-label px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {PROJECTS.map((p, i) => (
                    <tr
                      key={p.code}
                      className={`${i < PROJECTS.length - 1 ? "border-b border-ink-700" : ""} transition-colors ${
                        selectedProject === p.code ? "bg-accent/10 ring-1 ring-inset ring-accent/30" : "hover:bg-ink-750/60"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: PROJECT_COLOR[p.code] }} />
                          <span className="font-mono text-[11px] font-bold text-gray-400">{p.code}</span>
                          <span className="font-semibold text-gray-100">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Pill tone={STATUS_TONE[p.status]} dot>{STATUS_LABEL[p.status]}</Pill>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <PctCell value={p.schedule} />
                          <Progress value={p.schedule} tone={STATUS_TONE[p.status]} className="w-16" />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <PctCell value={p.budget} />
                          <Progress value={p.budget} tone={STATUS_TONE[p.status]} className="w-16" />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <PctCell value={p.scope} />
                          <Progress value={p.scope} tone={STATUS_TONE[p.status]} className="w-16" />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <PctCell value={p.quality} />
                          <Progress value={p.quality} tone={STATUS_TONE[p.status]} className="w-16" />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-mono text-[13px] font-bold text-gray-200">{p.team}</span>
                        <span className="ml-1 text-[11px] text-gray-500">ppl</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge tone={RISK_BADGE_TONE[p.risk]}>{p.risk}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            { label: "Deliverables", path: "/pm-deliverables" },
                            { label: "KnowledgeBase", path: "/pm-knowledge"    },
                            { label: "Traceability",  path: "/pm-traceability" },
                          ] as const).map(a => (
                            <button
                              key={a.label}
                              onClick={() => navigate(a.path, { state: { selectedProject: p.code, fromHealth: true } })}
                              className="rounded-[7px] border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10"
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          {/* ── 2b. Knowledge Management KPIs ─────────────────────────────── */}
          <section>
            <SectionTitle aside="Mar → Aug 2026 · documentation health indicators">
              Knowledge Management KPIs
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PM_KM_KPIS.map(k => <KmKpiCard key={k.label} kpi={k} />)}
            </div>
            <KmMonthlyBarChart />
          </section>

          {/* ── 3. Cross-Project Metrics + Health Trend ───────────────────── */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2 flex flex-col gap-4">
              <SectionTitle>Cross-Project Metrics</SectionTitle>
              <Card className="divide-y divide-ink-700 flex-1">
                {CROSS_METRICS.map(m => (
                  <div key={m.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <span className="text-[13px] text-gray-300">{m.label}</span>
                    <div className="shrink-0 text-right">
                      <span className="block font-mono text-[16px] font-bold text-gray-100">{m.value}</span>
                      <span className={`text-[11px] ${m.up ? "text-state-pass" : "text-state-fail"}`}>{m.trend}</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div className="col-span-3 flex flex-col gap-4">
              <SectionTitle aside="8-week rolling · portfolio health %">Health Trend</SectionTitle>
              <Card className="flex-1 p-5">
                <HealthTrendChart />
              </Card>
            </div>
          </div>

          {/* ── 4. Top Risks + Escalations ────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionTitle>Top 5 Risks</SectionTitle>
              <Card className="divide-y divide-ink-700">
                {TOP_RISKS.map(r => (
                  <div key={r.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="mt-0.5 w-11 shrink-0 font-mono text-[11px] text-gray-500">{r.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-gray-200">{r.title}</p>
                      <span className="font-mono text-[11px] text-gray-500">{r.project}</span>
                    </div>
                    <Badge tone={RISK_TONE[r.severity]}>{r.severity}</Badge>
                  </div>
                ))}
              </Card>
            </div>

            <div className="space-y-4">
              <div>
                <SectionTitle>Escalations</SectionTitle>
                <Card className="divide-y divide-ink-700">
                  {ESCALATIONS.map((e, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-state-fail">{e.project}</span>
                        <span className="text-[11px] text-gray-500">{e.days}d ago</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-snug text-gray-200">{e.summary}</p>
                      <p className="mt-1.5 text-[12px] text-gray-500">
                        {e.owner} · Escalated to{" "}
                        <span className="font-semibold text-accent">{e.escalatedTo}</span>
                      </p>
                    </div>
                  ))}
                </Card>
              </div>

              <div>
                <SectionTitle>Cross-Project Dependencies</SectionTitle>
                <Card className="divide-y divide-ink-700">
                  {DEPENDENCIES.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-8 shrink-0 font-mono text-[11px] font-bold text-gray-200">{d.from}</span>
                      <ArrowRight />
                      <span className="w-8 shrink-0 font-mono text-[11px] font-bold text-gray-200">{d.to}</span>
                      <span className="flex-1 truncate text-[12px] text-gray-400">{d.description}</span>
                      <Pill tone={DEP_TONE[d.status]} dot>{DEP_LABEL[d.status]}</Pill>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>

          {/* ── 5. Upcoming Milestones + Risk Distribution ────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <SectionTitle>Upcoming Milestones</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                {MILESTONES.map((m, i) => (
                  <Card key={i} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: PROJECT_COLOR[m.project] }} />
                        <span className="font-mono text-[11px] font-bold text-gray-400">{m.project}</span>
                      </div>
                      <Pill tone={STATUS_TONE[m.status]} dot>{STATUS_LABEL[m.status]}</Pill>
                    </div>
                    <p className="mt-2.5 text-[14px] font-semibold leading-snug text-gray-100">{m.title}</p>
                    <p className="mt-1.5 font-mono text-[12px] text-gray-500">{m.date}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress
                        value={Math.max(10, 100 - (m.daysOut / 60) * 100)}
                        tone={m.daysOut <= 14 ? "warn" : "brand"}
                        className="flex-1"
                      />
                      <span className="shrink-0 font-mono text-[11px] text-gray-500">{m.daysOut}d</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>Risk Distribution</SectionTitle>
              <Card className="flex h-full flex-col justify-center px-5 py-6">
                <RiskDistributionChart />
                <div className="mt-5 border-t border-ink-700 pt-4">
                  <p className="text-[12px] text-gray-500">
                    1 critical risk requires immediate escalation. FRD carries the highest concentration.
                  </p>
                </div>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
