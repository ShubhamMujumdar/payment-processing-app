import { useState, Fragment } from "react";
import PageMeta from "../components/common/PageMeta";
import {
  Card, StatCard, Pill, Badge, Progress,
  PageHead, SectionTitle, MockButton,
} from "../components/visa/kit";

// ─── Types ────────────────────────────────────────────────────────────────────

type TraceStatus = "satisfied" | "in-progress" | "at-risk" | "not-started" | "orphan";
type ViewKey = "cross-project" | "audit" | "compliance" | "release-readiness";

interface TraceReq {
  id: string;
  project: string;
  goalId: string;
  name: string;
  epic: string;
  feature: string;
  coverage: number;
  status: TraceStatus;
  release: string;
  isCompliance: boolean;
  regulatoryRef: string;
}

interface BusinessGoal {
  id: string;
  name: string;
  owner: string;
  projects: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const GOALS: BusinessGoal[] = [
  { id: "BG-01", name: "Achieve PCI DSS Level 1 Compliance",         owner: "P. Chen",     projects: ["PAY","FRD"] },
  { id: "BG-02", name: "Reduce Customer Churn by 15%",               owner: "M. Johnson",  projects: ["CSP"] },
  { id: "BG-03", name: "Detect 99.9% of Fraudulent Transactions",    owner: "J. Martinez", projects: ["FRD","PAY"] },
  { id: "BG-04", name: "Onboard 500 New Merchants per Quarter",      owner: "C. Anderson", projects: ["MOB","PAY"] },
  { id: "BG-05", name: "Reduce Support Resolution Time by 25%",      owner: "S. Williams", projects: ["CSP","MOB"] },
  { id: "BG-06", name: "Enable Real-time Transaction Monitoring",     owner: "N. Garcia",   projects: ["FRD","PAY"] },
];

const REQUIREMENTS: TraceReq[] = [
  // PAY ───────────────────────────────────────────────────────────────────────
  { id:"REQ-PAY-001", project:"PAY", goalId:"BG-01", name:"Payment Encryption (TLS 1.3)",        epic:"Security Hardening",   feature:"End-to-end Encryption",     coverage:68, status:"in-progress",  release:"R3", isCompliance:true,  regulatoryRef:"PCI DSS 4.2" },
  { id:"REQ-PAY-002", project:"PAY", goalId:"BG-01", name:"PCI Compliance Reporting",             epic:"Audit Controls",       feature:"Compliance Report Generator",coverage:45, status:"at-risk",      release:"R3", isCompliance:true,  regulatoryRef:"PCI DSS 12.3"},
  { id:"REQ-PAY-003", project:"PAY", goalId:"BG-03", name:"Fraud Screening Integration",          epic:"Risk Integration",     feature:"FRD API Gateway",            coverage:72, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-PAY-004", project:"PAY", goalId:"BG-06", name:"Payment Gateway Failover",             epic:"Resilience",           feature:"Circuit Breaker",            coverage:55, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-PAY-005", project:"PAY", goalId:"BG-04", name:"API Rate Limiting",                    epic:"API Management",       feature:"Token Bucket Limiter",       coverage:80, status:"satisfied",    release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-PAY-006", project:"PAY", goalId:"BG-01", name:"Transaction Reconciliation",           epic:"Finance Ops",          feature:"Reconciliation Engine",      coverage:45, status:"at-risk",      release:"R4", isCompliance:true,  regulatoryRef:"SOX 404" },
  { id:"REQ-PAY-007", project:"PAY", goalId:"BG-01", name:"Audit Log Immutability",               epic:"Audit Controls",       feature:"Immutable Log Archive",      coverage:0,  status:"orphan",       release:"R4", isCompliance:true,  regulatoryRef:"PCI DSS 10.5"},
  { id:"REQ-PAY-008", project:"PAY", goalId:"BG-04", name:"Multi-currency Support",               epic:"Global Payments",      feature:"FX Rate Integration",        coverage:0,  status:"orphan",       release:"R4", isCompliance:false, regulatoryRef:"" },

  // CSP ───────────────────────────────────────────────────────────────────────
  { id:"REQ-CSP-001", project:"CSP", goalId:"BG-02", name:"Agent Dashboard v3.0",                 epic:"Agent Experience",     feature:"Dashboard Redesign",         coverage:96, status:"satisfied",    release:"R2", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-CSP-002", project:"CSP", goalId:"BG-02", name:"AI-powered Case Auto-routing",         epic:"Case Resolution",      feature:"Smart Router",               coverage:88, status:"satisfied",    release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-CSP-003", project:"CSP", goalId:"BG-05", name:"Knowledge Article Search",             epic:"Knowledge Base",       feature:"Semantic Article Search",    coverage:91, status:"satisfied",    release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-CSP-004", project:"CSP", goalId:"BG-05", name:"Real-time Chat Integration",           epic:"Omnichannel",          feature:"Live Chat Widget",           coverage:62, status:"in-progress",  release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-CSP-005", project:"CSP", goalId:"BG-02", name:"Omnichannel Analytics Dashboard",      epic:"Reporting",            feature:"Analytics Board",            coverage:38, status:"at-risk",      release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-CSP-006", project:"CSP", goalId:"BG-02", name:"SLA Breach Monitoring",                epic:"SLA Management",       feature:"SLA Tracker",                coverage:78, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-CSP-007", project:"CSP", goalId:"BG-05", name:"Agent Sentiment Analysis",             epic:"AI Insights",          feature:"Sentiment Scoring API",      coverage:0,  status:"orphan",       release:"R4", isCompliance:false, regulatoryRef:"" },

  // FRD ───────────────────────────────────────────────────────────────────────
  { id:"REQ-FRD-001", project:"FRD", goalId:"BG-03", name:"ML Fraud Scoring Engine v2",           epic:"ML Pipeline",          feature:"Real-time Scoring API",      coverage:52, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-FRD-002", project:"FRD", goalId:"BG-06", name:"Real-time Transaction Monitor",        epic:"Event Processing",     feature:"Kafka Event Stream",         coverage:38, status:"at-risk",      release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-FRD-003", project:"FRD", goalId:"BG-06", name:"Fraud Alert Management",               epic:"Alert System",         feature:"Alert Console",              coverage:20, status:"not-started",  release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-FRD-004", project:"FRD", goalId:"BG-03", name:"Business Rule Engine",                 epic:"Risk Rules",           feature:"Rules DSL Editor",           coverage:55, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-FRD-005", project:"FRD", goalId:"BG-03", name:"Model Explainability (SHAP)",          epic:"ML Pipeline",          feature:"Explanation API",            coverage:0,  status:"orphan",       release:"R4", isCompliance:true,  regulatoryRef:"EU AI Act" },
  { id:"REQ-FRD-006", project:"FRD", goalId:"BG-01", name:"AML Transaction Screening",            epic:"Regulatory Reporting", feature:"AML Reporter",               coverage:25, status:"not-started",  release:"R4", isCompliance:true,  regulatoryRef:"AML Directive 6AMLD"},
  { id:"REQ-FRD-007", project:"FRD", goalId:"BG-03", name:"Risk Threshold Configuration",         epic:"Risk Config",          feature:"Threshold Manager",          coverage:60, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-FRD-008", project:"FRD", goalId:"BG-06", name:"Online Model Feedback Loop",           epic:"ML Pipeline",          feature:"Continuous Learning Module", coverage:0,  status:"orphan",       release:"R4", isCompliance:false, regulatoryRef:"" },

  // MOB ───────────────────────────────────────────────────────────────────────
  { id:"REQ-MOB-001", project:"MOB", goalId:"BG-04", name:"KYC Identity Verification",            epic:"KYC Flow",             feature:"Identity Check Gateway",     coverage:95, status:"satisfied",    release:"R2", isCompliance:true,  regulatoryRef:"KYC/AML" },
  { id:"REQ-MOB-002", project:"MOB", goalId:"BG-04", name:"Document Upload Portal",               epic:"Document Mgmt",        feature:"Upload Portal",              coverage:85, status:"satisfied",    release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-MOB-003", project:"MOB", goalId:"BG-05", name:"Merchant Profile Management",          epic:"Profile Mgmt",         feature:"Merchant Dashboard",         coverage:78, status:"in-progress",  release:"R3", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-MOB-004", project:"MOB", goalId:"BG-04", name:"Payment Method Configuration",         epic:"Payment Setup",        feature:"Method Config UI",           coverage:55, status:"in-progress",  release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-MOB-005", project:"MOB", goalId:"BG-04", name:"Onboarding Funnel Analytics",          epic:"Analytics",            feature:"Funnel Dashboard",           coverage:40, status:"at-risk",      release:"R4", isCompliance:false, regulatoryRef:"" },
  { id:"REQ-MOB-006", project:"MOB", goalId:"BG-04", name:"Document Expiry Notifications",        epic:"Compliance Alerts",    feature:"Alert System",               coverage:68, status:"in-progress",  release:"R3", isCompliance:true,  regulatoryRef:"KYC Renewal" },
  { id:"REQ-MOB-007", project:"MOB", goalId:"BG-04", name:"Multi-language Localisation",          epic:"Localisation",         feature:"i18n Layer",                 coverage:0,  status:"orphan",       release:"R4", isCompliance:false, regulatoryRef:"" },
];

// ─── Lookups ──────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<TraceStatus, "pass"|"brand"|"warn"|"fail"|"idle"> = {
  satisfied:    "pass",
  "in-progress":"brand",
  "at-risk":    "warn",
  "not-started":"idle",
  orphan:       "fail",
};
const STATUS_LABEL: Record<TraceStatus, string> = {
  satisfied:    "Satisfied",
  "in-progress":"In Progress",
  "at-risk":    "At Risk",
  "not-started":"Not Started",
  orphan:       "Orphan",
};

const PROJECT_COLOR: Record<string, string> = {
  PAY: "#946200", CSP: "#00a870", FRD: "#d14343", MOB: "#1434cb",
};
const PROJECT_NAME: Record<string, string> = {
  PAY: "Payments", CSP: "Customer Service Portal", FRD: "Fraud & Risk Engine", MOB: "Merchant Onboarding",
};

function coverageTone(n: number): "pass"|"brand"|"warn"|"fail" {
  return n >= 80 ? "pass" : n >= 50 ? "brand" : n >= 20 ? "warn" : "fail";
}

// ─── Coverage Heatmap ─────────────────────────────────────────────────────────

const HM_CATS  = ["Functional", "Security", "Compliance", "Performance", "Integration"];
const HM_DATA: Record<string, number[]> = {
  PAY: [68, 72, 45, 55, 72],
  CSP: [91, 78, 65, 62, 88],
  FRD: [48, 55, 25, 35, 52],
  MOB: [82, 75, 68, 40, 78],
};

function heatColor(v: number): string {
  return v >= 80 ? "#00a870" : v >= 60 ? "#1434cb" : v >= 40 ? "#946200" : "#d14343";
}

function CoverageHeatmap() {
  const CELL_W = 82, CELL_H = 34, LABEL_W = 44, HEADER_H = 30;
  const projects = ["PAY","CSP","FRD","MOB"];
  const W = LABEL_W + HM_CATS.length * CELL_W + 8;
  const H = HEADER_H + projects.length * CELL_H + 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Test coverage heatmap">
      {HM_CATS.map((cat, ci) => (
        <text key={cat} x={LABEL_W + ci * CELL_W + CELL_W / 2} y={HEADER_H - 8}
          textAnchor="middle" fontSize="9" fill="#94a3b8"
          fontFamily="'JetBrains Mono', monospace">{cat}</text>
      ))}
      {projects.map((proj, pi) => {
        const vals = HM_DATA[proj];
        const y = HEADER_H + pi * CELL_H;
        return (
          <Fragment key={proj}>
            <text x={LABEL_W - 5} y={y + CELL_H / 2 + 4} textAnchor="end"
              fontSize="9" fontWeight="bold" fill="#64748b"
              fontFamily="'JetBrains Mono', monospace">{proj}</text>
            {vals.map((v, ci) => {
              const x = LABEL_W + ci * CELL_W;
              const col = heatColor(v);
              return (
                <Fragment key={ci}>
                  <rect x={x+2} y={y+2} width={CELL_W-4} height={CELL_H-4} rx="4" fill={col} opacity="0.15" />
                  <rect x={x+2} y={y+2} width={CELL_W-4} height={CELL_H-4} rx="4" fill="none" stroke={col} strokeWidth="0.5" opacity="0.4" />
                  <text x={x+CELL_W/2} y={y+CELL_H/2+4} textAnchor="middle"
                    fontSize="10.5" fontWeight="bold" fill={col}
                    fontFamily="'JetBrains Mono', monospace">{v}%</text>
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </svg>
  );
}

// ─── Traceability Sankey ──────────────────────────────────────────────────────

function TraceabilitySankey() {
  const W = 540, H = 300;
  const COL = { goal: 20, project: 210, coverage: 400 };
  const NODE_W = 140, NODE_H = 32, GAP = 8;

  // Goals column
  const goalY = (i: number) => 16 + i * (NODE_H + GAP);
  // Projects column
  const projOrder = ["PAY","CSP","FRD","MOB"];
  const projH = 60;
  const projY = (i: number) => 30 + i * (projH + 10);
  // Coverage tiers
  const tiers = [
    { label: "High ≥80%",   color: "#00a870", reqs: REQUIREMENTS.filter(r => r.coverage >= 80).length },
    { label: "Mid 50–79%",  color: "#1434cb", reqs: REQUIREMENTS.filter(r => r.coverage >= 50 && r.coverage < 80).length },
    { label: "Low 20–49%",  color: "#946200", reqs: REQUIREMENTS.filter(r => r.coverage >= 20 && r.coverage < 50).length },
    { label: "None <20%",   color: "#d14343", reqs: REQUIREMENTS.filter(r => r.coverage < 20).length },
  ];
  const tierH = 48, tierGap = 10;
  const tierY = (i: number) => 24 + i * (tierH + tierGap);

  function bezier(x1: number, y1: number, x2: number, y2: number): string {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Traceability flow">
      {/* ── Goals column ── */}
      <text x={COL.goal + NODE_W/2} y={10} textAnchor="middle" fontSize="8.5" fill="#94a3b8"
        fontFamily="'JetBrains Mono', monospace" fontWeight="bold">BUSINESS GOALS</text>
      {GOALS.map((g, i) => (
        <Fragment key={g.id}>
          <rect x={COL.goal} y={goalY(i)} width={NODE_W} height={NODE_H} rx="4"
            fill="#eef1fb" stroke="#1434cb" strokeWidth="0.5" />
          <text x={COL.goal+6} y={goalY(i)+12} fontSize="8" fontWeight="bold" fill="#1434cb"
            fontFamily="'JetBrains Mono', monospace">{g.id}</text>
          <text x={COL.goal+6} y={goalY(i)+22} fontSize="8" fill="#0f172a"
            fontFamily="'Inter', sans-serif">
            {g.name.length > 26 ? g.name.slice(0,26)+"…" : g.name}
          </text>
        </Fragment>
      ))}

      {/* ── Connections: Goals → Projects ── */}
      {GOALS.map((g, gi) =>
        g.projects.map(proj => {
          const pi = projOrder.indexOf(proj);
          if (pi === -1) return null;
          const x1 = COL.goal + NODE_W;
          const y1 = goalY(gi) + NODE_H / 2;
          const x2 = COL.project;
          const y2 = projY(pi) + projH / 2;
          return (
            <path key={`${g.id}-${proj}`} d={bezier(x1, y1, x2, y2)}
              fill="none" stroke={PROJECT_COLOR[proj]} strokeWidth="1.5" opacity="0.25" />
          );
        })
      )}

      {/* ── Projects column ── */}
      <text x={COL.project + NODE_W/2} y={10} textAnchor="middle" fontSize="8.5" fill="#94a3b8"
        fontFamily="'JetBrains Mono', monospace" fontWeight="bold">PROJECTS</text>
      {projOrder.map((proj, pi) => {
        const reqs = REQUIREMENTS.filter(r => r.project === proj);
        const avgCov = Math.round(reqs.reduce((s,r) => s+r.coverage,0) / reqs.length);
        return (
          <Fragment key={proj}>
            <rect x={COL.project} y={projY(pi)} width={NODE_W} height={projH} rx="4"
              fill={PROJECT_COLOR[proj]} opacity="0.12" stroke={PROJECT_COLOR[proj]} strokeWidth="0.8" />
            <text x={COL.project+8} y={projY(pi)+16} fontSize="10" fontWeight="bold"
              fill={PROJECT_COLOR[proj]} fontFamily="'JetBrains Mono', monospace">{proj}</text>
            <text x={COL.project+8} y={projY(pi)+29} fontSize="8.5" fill="#475569"
              fontFamily="'Inter', sans-serif">{reqs.length} reqs · avg {avgCov}%</text>
            <text x={COL.project+8} y={projY(pi)+42} fontSize="8" fill="#94a3b8"
              fontFamily="'Inter', sans-serif">{PROJECT_NAME[proj].length > 20 ? PROJECT_NAME[proj].slice(0,20)+"…" : PROJECT_NAME[proj]}</text>
          </Fragment>
        );
      })}

      {/* ── Connections: Projects → Coverage tiers ── */}
      {projOrder.map((proj, pi) => {
        const reqs = REQUIREMENTS.filter(r => r.project === proj);
        return tiers.map((tier, ti) => {
          const count = reqs.filter(r =>
            ti === 0 ? r.coverage >= 80 :
            ti === 1 ? r.coverage >= 50 && r.coverage < 80 :
            ti === 2 ? r.coverage >= 20 && r.coverage < 50 :
            r.coverage < 20
          ).length;
          if (count === 0) return null;
          return (
            <path key={`${proj}-t${ti}`}
              d={bezier(COL.project + NODE_W, projY(pi) + projH/2, COL.coverage, tierY(ti) + tierH/2)}
              fill="none" stroke={tier.color} strokeWidth={Math.max(1, count * 0.8)}
              opacity="0.3" />
          );
        });
      })}

      {/* ── Coverage tiers ── */}
      <text x={COL.coverage + NODE_W/2} y={10} textAnchor="middle" fontSize="8.5" fill="#94a3b8"
        fontFamily="'JetBrains Mono', monospace" fontWeight="bold">TEST COVERAGE</text>
      {tiers.map((t, ti) => (
        <Fragment key={t.label}>
          <rect x={COL.coverage} y={tierY(ti)} width={NODE_W} height={tierH} rx="4"
            fill={t.color} opacity="0.12" stroke={t.color} strokeWidth="0.8" />
          <text x={COL.coverage+8} y={tierY(ti)+18} fontSize="9.5" fontWeight="bold"
            fill={t.color} fontFamily="'JetBrains Mono', monospace">{t.label}</text>
          <text x={COL.coverage+8} y={tierY(ti)+33} fontSize="9" fill="#475569"
            fontFamily="'Inter', sans-serif">{t.reqs} requirements</text>
        </Fragment>
      ))}
    </svg>
  );
}

// ─── Compliance Dashboard ─────────────────────────────────────────────────────

function ComplianceDashboard() {
  const complianceReqs = REQUIREMENTS.filter(r => r.isCompliance);
  const byProject = ["PAY","CSP","FRD","MOB"].map(proj => ({
    proj,
    reqs: complianceReqs.filter(r => r.project === proj),
  })).filter(p => p.reqs.length > 0);

  return (
    <div className="divide-y divide-ink-700">
      {byProject.map(({ proj, reqs }) => {
        const satisfied = reqs.filter(r => r.status === "satisfied").length;
        const progress  = Math.round((satisfied / reqs.length) * 100);
        return (
          <div key={proj} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[proj] }} />
                <span className="font-mono text-[12px] font-bold text-gray-200">{proj}</span>
                <span className="text-[12px] text-gray-400">{PROJECT_NAME[proj]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-gray-500">{satisfied}/{reqs.length} satisfied</span>
                <Progress value={progress} tone={coverageTone(progress)} className="w-20" />
                <span className="font-mono text-[12px] font-bold" style={{ color: heatColor(progress) }}>{progress}%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {reqs.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-[8px] bg-ink-750/50 px-3 py-2">
                  <span className="w-28 shrink-0 font-mono text-[10px] text-gray-500">{r.id}</span>
                  <span className="flex-1 text-[12px] text-gray-200">{r.name}</span>
                  {r.regulatoryRef && (
                    <Badge tone="idle">{r.regulatoryRef}</Badge>
                  )}
                  <Pill tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</Pill>
                  <span className="w-10 text-right font-mono text-[12px] font-bold" style={{ color: heatColor(r.coverage) }}>
                    {r.coverage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Matrix table rows ────────────────────────────────────────────────────────

function MatrixRow({ r, showProject = true, showGoal = false }: { r: TraceReq; showProject?: boolean; showGoal?: boolean }) {
  return (
    <tr className="border-b border-ink-700 transition-colors hover:bg-ink-750/50 last:border-0">
      <td className="px-4 py-3">
        <span className="font-mono text-[11px] text-gray-500">{r.id}</span>
      </td>
      {showProject && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: PROJECT_COLOR[r.project] }} />
            <span className="font-mono text-[11px] font-bold text-gray-300">{r.project}</span>
          </div>
        </td>
      )}
      {showGoal && (
        <td className="px-4 py-3">
          <span className="font-mono text-[11px] text-accent">{r.goalId}</span>
        </td>
      )}
      <td className="px-4 py-3 max-w-[200px]">
        <span className="text-[13px] font-medium text-gray-100">{r.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[12px] text-gray-400">{r.epic}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[12px] text-gray-400">{r.feature}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Progress value={r.coverage} tone={coverageTone(r.coverage)} className="w-14" />
          <span className="w-8 text-right font-mono text-[12px] font-bold"
            style={{ color: heatColor(r.coverage) }}>{r.coverage}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Pill tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</Pill>
      </td>
      <td className="px-4 py-3">
        <Badge tone="idle">{r.release}</Badge>
      </td>
    </tr>
  );
}

function MatrixHead({ showProject = true, showGoal = false }: { showProject?: boolean; showGoal?: boolean }) {
  return (
    <thead>
      <tr className="border-b border-ink-700">
        <th className="col-label px-4 py-3 text-left">Requirement ID</th>
        {showProject && <th className="col-label px-4 py-3 text-left">Project</th>}
        {showGoal   && <th className="col-label px-4 py-3 text-left">Goal</th>}
        <th className="col-label px-4 py-3 text-left">Requirement</th>
        <th className="col-label px-4 py-3 text-left">Epic</th>
        <th className="col-label px-4 py-3 text-left">Feature</th>
        <th className="col-label px-4 py-3 text-left">Test Coverage</th>
        <th className="col-label px-4 py-3 text-left">Status</th>
        <th className="col-label px-4 py-3 text-left">Release</th>
      </tr>
    </thead>
  );
}

// ─── View renderers ───────────────────────────────────────────────────────────

function CrossProjectView() {
  return (
    <Card>
      <table className="w-full text-[13px]">
        <MatrixHead showGoal />
        <tbody>
          {GOALS.map(g => {
            const reqs = REQUIREMENTS.filter(r => r.goalId === g.id);
            const avgCov = Math.round(reqs.reduce((s,r)=>s+r.coverage,0)/reqs.length);
            return (
              <Fragment key={g.id}>
                <tr className="border-b border-ink-700 bg-ink-750/60">
                  <td colSpan={9} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-bold text-accent">{g.id}</span>
                      <span className="text-[13px] font-semibold text-gray-100">{g.name}</span>
                      <span className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
                        {g.owner}
                        <Badge tone="idle">{reqs.length} reqs</Badge>
                        <span className="font-mono font-bold" style={{ color: heatColor(avgCov) }}>avg {avgCov}%</span>
                      </span>
                    </div>
                  </td>
                </tr>
                {reqs.map(r => <MatrixRow key={r.id} r={r} showGoal={false} />)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function AuditView() {
  const flagged = REQUIREMENTS.filter(r => r.status === "orphan" || r.status === "at-risk" || r.status === "not-started");
  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-3">
        <Pill tone="fail" dot>{flagged.filter(r=>r.status==="orphan").length} orphan</Pill>
        <Pill tone="warn" dot>{flagged.filter(r=>r.status==="at-risk").length} at risk</Pill>
        <Pill tone="idle" dot>{flagged.filter(r=>r.status==="not-started").length} not started</Pill>
        <span className="ml-auto text-[12px] text-gray-500">Requirements requiring immediate attention</span>
      </div>
      <table className="w-full text-[13px]">
        <MatrixHead showGoal />
        <tbody>
          {flagged.map(r => <MatrixRow key={r.id} r={r} showGoal />)}
        </tbody>
      </table>
    </Card>
  );
}

function ComplianceView() {
  return (
    <Card>
      <ComplianceDashboard />
    </Card>
  );
}

function ReleaseReadinessView() {
  const releases = ["R2","R3","R4"];
  const releaseMeta: Record<string, { label: string; period: string }> = {
    R2: { label: "Release 2", period: "Completed · Jul 2026" },
    R3: { label: "Release 3", period: "Sep 30, 2026" },
    R4: { label: "Release 4", period: "Dec 31, 2026" },
  };
  return (
    <Card>
      <table className="w-full text-[13px]">
        <MatrixHead showGoal />
        <tbody>
          {releases.map(rel => {
            const reqs = REQUIREMENTS.filter(r => r.release === rel);
            const satisfied = reqs.filter(r => r.status === "satisfied").length;
            const readiness = Math.round((satisfied / reqs.length) * 100);
            const meta = releaseMeta[rel];
            return (
              <Fragment key={rel}>
                <tr className="border-b border-ink-700 bg-ink-750/60">
                  <td colSpan={9} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Badge tone={rel==="R2" ? "pass" : rel==="R3" ? "warn" : "brand"}>{rel}</Badge>
                      <span className="text-[13px] font-semibold text-gray-100">{meta.label}</span>
                      <span className="font-mono text-[11px] text-gray-500">{meta.period}</span>
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-[11px] text-gray-500">{satisfied}/{reqs.length} satisfied</span>
                        <Progress value={readiness} tone={coverageTone(readiness)} className="w-20" />
                        <span className="font-mono text-[12px] font-bold"
                          style={{ color: heatColor(readiness) }}>{readiness}%</span>
                      </span>
                    </div>
                  </td>
                </tr>
                {reqs.map(r => <MatrixRow key={r.id} r={r} showGoal />)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── View tabs ────────────────────────────────────────────────────────────────

const VIEWS: { key: ViewKey; label: string; icon: string }[] = [
  { key: "cross-project",      label: "Cross-Project",      icon: "M3 5h14M3 9h14M3 13h14" },
  { key: "audit",              label: "Audit View",         icon: "M10 3v14M5 7h5m0 0h5M5 11h5m0 0h5" },
  { key: "compliance",         label: "Compliance View",    icon: "M9 3H5a1 1 0 0 0-1 1v14h12V7l-4-4zM9 3v4h4" },
  { key: "release-readiness",  label: "Release Readiness",  icon: "M4 7h12v10H4zM8 7V4h4v3" },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconReq    = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.4"><path d="M3 2h6l3 3v8H3V2z" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 2v3h3M5 7h4M5 9.5h2" strokeLinecap="round"/></svg>;
const IconTest   = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M2 7l3 3 7-6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconOrphan = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M7 1.5L13 12.5H1L7 1.5z" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 5.5v3M7 10v.5" strokeLinecap="round"/></svg>;
const IconMissed = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5"/><path d="M7 4.5v3M7 9v.5" strokeLinecap="round"/></svg>;
const IconMap    = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="4" height="4" rx="0.5"/><rect x="8.5" y="1.5" width="4" height="4" rx="0.5"/><rect x="1.5" y="8.5" width="4" height="4" rx="0.5"/><path d="M5.5 4h3M7 4v4.5" strokeLinecap="round"/></svg>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramManagerTraceability() {
  const [view, setView] = useState<ViewKey>("cross-project");

  const totalReqs    = REQUIREMENTS.length;
  const withCoverage = REQUIREMENTS.filter(r => r.coverage > 0).length;
  const reqCovPct    = Math.round((withCoverage / totalReqs) * 100);
  const avgTestCov   = Math.round(REQUIREMENTS.reduce((s,r)=>s+r.coverage,0) / totalReqs);
  const orphans      = REQUIREMENTS.filter(r => r.status === "orphan").length;
  const missingTests = REQUIREMENTS.filter(r => r.coverage < 50 && r.status !== "orphan").length;
  const unmapped     = 4; // features with no goal link

  return (
    <>
      <PageMeta title="Traceability" />
      <div className="min-h-screen pb-12">

        <PageHead
          kicker="Program Manager"
          title="Traceability"
          blurb="Portfolio requirements traceability across PAY · CSP · FRD · MOB"
          right={
            <div className="flex gap-2">
              <MockButton>Export Matrix</MockButton>
              <MockButton variant="solid">Run Audit</MockButton>
            </div>
          }
        />

        <div className="space-y-7 px-6 pt-6">

          {/* ── 1. Portfolio KPIs ────────────────────────────────────────── */}
          <section>
            <SectionTitle>Portfolio KPIs</SectionTitle>
            <div className="grid grid-cols-5 gap-4">
              <StatCard label="Requirements Coverage" value={reqCovPct}    unit="%" tone={coverageTone(reqCovPct)}   progress={reqCovPct}   icon={<IconReq />}    />
              <StatCard label="Avg Test Coverage"     value={avgTestCov}   unit="%" tone={coverageTone(avgTestCov)}  progress={avgTestCov}  icon={<IconTest />}   />
              <StatCard label="Total Requirements"    value={totalReqs}         tone="brand"                                                icon={<IconMap />}    />
              <StatCard label="Orphan Requirements"   value={orphans}           tone="fail"                                                 icon={<IconOrphan />}
                note="No test coverage or unmapped feature" />
              <StatCard label="Low Coverage (<50%)"   value={missingTests}      tone="warn"                                                 icon={<IconMissed />}
                note={`+${unmapped} unmapped features`} />
            </div>
          </section>

          {/* ── 2. Traceability Matrix ────────────────────────────────────── */}
          <section>
            <SectionTitle>Traceability Matrix</SectionTitle>

            {/* View tabs */}
            <div className="mb-3 flex w-fit gap-1 rounded-[10px] border border-ink-700 bg-white p-1">
              {VIEWS.map(v => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className={`flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors
                    ${view === v.key ? "bg-nav-bottom text-white" : "text-gray-400 hover:text-gray-200"}`}>
                  <svg viewBox="0 0 20 20" fill="none" className="size-3.5 shrink-0" stroke="currentColor"
                    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d={v.icon} />
                  </svg>
                  {v.label}
                </button>
              ))}
            </div>

            {view === "cross-project"     && <CrossProjectView />}
            {view === "audit"             && <AuditView />}
            {view === "compliance"        && <ComplianceView />}
            {view === "release-readiness" && <ReleaseReadinessView />}
          </section>

          {/* ── 3. Coverage Heatmap + Sankey ─────────────────────────────── */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <SectionTitle aside="test coverage % by category">Coverage Heatmap</SectionTitle>
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap gap-3">
                  {[["≥80%","#00a870"],["≥60%","#1434cb"],["≥40%","#946200"],["<40%","#d14343"]].map(([l,c]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className="size-2.5 rounded-sm" style={{ backgroundColor: c as string, opacity:0.6 }} />
                      <span className="text-[10px] text-gray-500">{l}</span>
                    </div>
                  ))}
                </div>
                <CoverageHeatmap />
              </Card>
            </div>

            <div className="col-span-3">
              <SectionTitle aside="goals → projects → coverage tiers">Traceability Flow</SectionTitle>
              <Card className="p-5">
                <TraceabilitySankey />
              </Card>
            </div>
          </div>

          {/* ── 4. Compliance Dashboard ──────────────────────────────────── */}
          <section>
            <SectionTitle
              aside={
                <div className="flex gap-2">
                  <Pill tone="pass" dot>PCI DSS</Pill>
                  <Pill tone="warn" dot>AML / 6AMLD</Pill>
                  <Pill tone="warn" dot>EU AI Act</Pill>
                  <Pill tone="brand" dot>KYC/AML</Pill>
                </div>
              }
            >
              Compliance Coverage
            </SectionTitle>
            <Card>
              <ComplianceDashboard />
            </Card>
          </section>

        </div>
      </div>
    </>
  );
}
