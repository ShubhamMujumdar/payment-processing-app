import { useState, Fragment } from "react";
import { useLocation, useNavigate } from "react-router";
import PageMeta from "../components/common/PageMeta";
import {
  Card, StatCard, Pill, Badge, Progress,
  PageHead, SectionTitle, MockButton,
} from "../components/visa/kit";

// ─── Types ────────────────────────────────────────────────────────────────────

type DelivStatus = "delivered" | "on-track" | "at-risk" | "delayed";

interface Deliverable {
  id: string;
  project: string;
  name: string;
  owner: string;
  targetDate: string;
  targetISO: string;
  startISO: string;
  completion: number;
  status: DelivStatus;
  quarter: string;
  release: string;
  deps: string[];
  approvalRequired: boolean;
  docType?: string;
  lastUpdated?: string;
  version?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ALL: Deliverable[] = [
  { id: "D-PAY-001", project: "PAY", name: "PCI DSS Compliance Report",        owner: "P. Chen",     targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-07-01", completion: 65,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: true  },
  { id: "D-PAY-002", project: "PAY", name: "Payment Gateway Migration",         owner: "A. Sharma",   targetDate: "Sep 15, 2026", targetISO: "2026-09-15", startISO: "2026-07-01", completion: 72,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: ["D-FRD-002"],   approvalRequired: false },
  { id: "D-PAY-003", project: "PAY", name: "Transaction Reconciliation Module", owner: "K. Patel",    targetDate: "Nov 15, 2026", targetISO: "2026-11-15", startISO: "2026-08-01", completion: 45,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
  { id: "D-PAY-004", project: "PAY", name: "Security Audit Remediation",        owner: "P. Chen",     targetDate: "Aug 31, 2026", targetISO: "2026-08-31", startISO: "2026-06-01", completion: 30,  status: "delayed",   quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: true  },
  { id: "D-PAY-005", project: "PAY", name: "API Rate Limiting Framework",       owner: "J. Lee",      targetDate: "Oct 30, 2026", targetISO: "2026-10-30", startISO: "2026-08-01", completion: 80,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
  { id: "D-CSP-001", project: "CSP", name: "Agent Dashboard v3.0",             owner: "M. Johnson",  targetDate: "Jul 15, 2026", targetISO: "2026-07-15", startISO: "2026-05-01", completion: 100, status: "delivered", quarter: "Q2 2026", release: "R2", deps: [],             approvalRequired: false },
  { id: "D-CSP-002", project: "CSP", name: "Case Management System",           owner: "S. Williams", targetDate: "Sep 22, 2026", targetISO: "2026-09-22", startISO: "2026-07-15", completion: 91,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: false },
  { id: "D-CSP-003", project: "CSP", name: "Knowledge Article Search",         owner: "R. Davis",    targetDate: "Sep 8, 2026",  targetISO: "2026-09-08", startISO: "2026-07-15", completion: 95,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: false },
  { id: "D-CSP-004", project: "CSP", name: "Real-time Chat Integration",       owner: "M. Johnson",  targetDate: "Oct 15, 2026", targetISO: "2026-10-15", startISO: "2026-08-01", completion: 62,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: ["D-MOB-003"],   approvalRequired: false },
  { id: "D-CSP-005", project: "CSP", name: "Omnichannel Analytics Dashboard",  owner: "T. Brown",    targetDate: "Nov 30, 2026", targetISO: "2026-11-30", startISO: "2026-09-01", completion: 38,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
  { id: "D-FRD-001", project: "FRD", name: "ML Fraud Detection v2.0",          owner: "J. Martinez", targetDate: "Sep 22, 2026", targetISO: "2026-09-22", startISO: "2026-07-01", completion: 48,  status: "delayed",   quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: true  },
  { id: "D-FRD-002", project: "FRD", name: "Risk Scoring API",                 owner: "N. Garcia",   targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-07-01", completion: 52,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: false },
  { id: "D-FRD-003", project: "FRD", name: "Real-time Transaction Monitor",    owner: "J. Martinez", targetDate: "Oct 31, 2026", targetISO: "2026-10-31", startISO: "2026-08-01", completion: 30,  status: "at-risk",   quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
  { id: "D-FRD-004", project: "FRD", name: "Regulatory Compliance Suite",      owner: "L. Torres",   targetDate: "Nov 15, 2026", targetISO: "2026-11-15", startISO: "2026-09-01", completion: 20,  status: "delayed",   quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: true  },
  { id: "D-FRD-005", project: "FRD", name: "Fraud Alert Management System",    owner: "N. Garcia",   targetDate: "Dec 15, 2026", targetISO: "2026-12-15", startISO: "2026-09-01", completion: 15,  status: "at-risk",   quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
  { id: "D-MOB-001", project: "MOB", name: "KYC Verification v1.0",            owner: "C. Anderson", targetDate: "Jul 30, 2026", targetISO: "2026-07-30", startISO: "2026-05-15", completion: 100, status: "delivered", quarter: "Q2 2026", release: "R2", deps: [],             approvalRequired: false },
  { id: "D-MOB-002", project: "MOB", name: "Document Upload Portal",           owner: "B. Taylor",   targetDate: "Aug 20, 2026", targetISO: "2026-08-20", startISO: "2026-07-01", completion: 100, status: "delivered", quarter: "Q3 2026", release: "R3", deps: [],             approvalRequired: false },
  { id: "D-MOB-003", project: "MOB", name: "Merchant Profile Management",      owner: "C. Anderson", targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-07-15", completion: 78,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: ["D-PAY-002"],   approvalRequired: false },
  { id: "D-MOB-004", project: "MOB", name: "Payment Method Configuration",     owner: "D. Wilson",   targetDate: "Oct 20, 2026", targetISO: "2026-10-20", startISO: "2026-08-15", completion: 55,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
  { id: "D-MOB-005", project: "MOB", name: "Onboarding Analytics Dashboard",   owner: "B. Taylor",   targetDate: "Nov 30, 2026", targetISO: "2026-11-30", startISO: "2026-09-01", completion: 40,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [],             approvalRequired: false },
];

// ─── Project Document Deliverables (Phase 3) ─────────────────────────────────

const DOC_DELIVERABLES: Deliverable[] = [
  // Payments
  { id: "D-PAY-A01", project: "PAY", name: "Architecture Document",     owner: "A. Sharma",   targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-07-01", completion: 95,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Architecture",  lastUpdated: "Aug 28, 2026", version: "v2.1"      },
  { id: "D-PAY-A02", project: "PAY", name: "API Specifications",         owner: "J. Lee",      targetDate: "Sep 15, 2026", targetISO: "2026-09-15", startISO: "2026-07-01", completion: 85,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "API Specs",     lastUpdated: "Aug 29, 2026", version: "v1.4"      },
  { id: "D-PAY-A03", project: "PAY", name: "Sprint Release Notes",       owner: "K. Patel",    targetDate: "Aug 31, 2026", targetISO: "2026-08-31", startISO: "2026-08-18", completion: 100, status: "delivered", quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Release Notes", lastUpdated: "Aug 25, 2026", version: "Sprint 21"  },
  { id: "D-PAY-A04", project: "PAY", name: "Deployment Guide",           owner: "P. Chen",     targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-08-01", completion: 60,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: true,  docType: "Deployment",    lastUpdated: "Aug 20, 2026", version: "v1.2"      },
  { id: "D-PAY-A05", project: "PAY", name: "Test Summary",               owner: "K. Patel",    targetDate: "Sep 15, 2026", targetISO: "2026-09-15", startISO: "2026-08-15", completion: 55,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Test Report",   lastUpdated: "Aug 22, 2026", version: "Sprint 21"  },
  // Customer Service Portal
  { id: "D-CSP-A01", project: "CSP", name: "Requirements Document",      owner: "M. Johnson",  targetDate: "Jul 10, 2026", targetISO: "2026-07-10", startISO: "2026-05-01", completion: 100, status: "delivered", quarter: "Q2 2026", release: "R2", deps: [], approvalRequired: false, docType: "Requirements",  lastUpdated: "Jul 10, 2026", version: "v3.0"      },
  { id: "D-CSP-A02", project: "CSP", name: "UI Designs",                 owner: "R. Davis",    targetDate: "Aug 5, 2026",  targetISO: "2026-08-05", startISO: "2026-06-01", completion: 100, status: "delivered", quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Design",        lastUpdated: "Aug 5, 2026",  version: "v2.5"      },
  { id: "D-CSP-A03", project: "CSP", name: "UAT Results",                owner: "S. Williams", targetDate: "Sep 22, 2026", targetISO: "2026-09-22", startISO: "2026-09-01", completion: 92,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Test Report",   lastUpdated: "Aug 29, 2026", version: "Sprint 34" },
  { id: "D-CSP-A04", project: "CSP", name: "Release Package",            owner: "T. Brown",    targetDate: "Sep 22, 2026", targetISO: "2026-09-22", startISO: "2026-09-01", completion: 88,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: true,  docType: "Release",       lastUpdated: "Aug 27, 2026", version: "R3"        },
  { id: "D-CSP-A05", project: "CSP", name: "User Guide",                 owner: "M. Johnson",  targetDate: "Oct 15, 2026", targetISO: "2026-10-15", startISO: "2026-09-01", completion: 75,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [], approvalRequired: false, docType: "Documentation", lastUpdated: "Aug 18, 2026", version: "v1.0"      },
  // Fraud & Risk Engine
  { id: "D-FRD-A01", project: "FRD", name: "Rule Configuration Guide",        owner: "J. Martinez", targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-08-01", completion: 55,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Configuration",  lastUpdated: "Aug 20, 2026", version: "v1.1"      },
  { id: "D-FRD-A02", project: "FRD", name: "Integration Specs",               owner: "N. Garcia",   targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-08-01", completion: 50,  status: "at-risk",   quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Integration",    lastUpdated: "Aug 25, 2026", version: "v1.0"      },
  { id: "D-FRD-A03", project: "FRD", name: "Risk Assessment Report",           owner: "L. Torres",   targetDate: "Oct 15, 2026", targetISO: "2026-10-15", startISO: "2026-09-01", completion: 35,  status: "delayed",   quarter: "Q4 2026", release: "R4", deps: [], approvalRequired: true,  docType: "Assessment",     lastUpdated: "Aug 10, 2026", version: "Draft"     },
  { id: "D-FRD-A04", project: "FRD", name: "Test Coverage Report",             owner: "J. Martinez", targetDate: "Sep 22, 2026", targetISO: "2026-09-22", startISO: "2026-08-15", completion: 40,  status: "delayed",   quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Test Report",    lastUpdated: "Aug 22, 2026", version: "Sprint 19" },
  { id: "D-FRD-A05", project: "FRD", name: "Production Readiness Checklist",   owner: "N. Garcia",   targetDate: "Oct 31, 2026", targetISO: "2026-10-31", startISO: "2026-09-15", completion: 25,  status: "at-risk",   quarter: "Q4 2026", release: "R4", deps: [], approvalRequired: true,  docType: "Checklist",      lastUpdated: "Aug 15, 2026", version: "v0.5"      },
  // Merchant Onboarding
  { id: "D-MOB-A01", project: "MOB", name: "Workflow Design",             owner: "C. Anderson", targetDate: "Jul 25, 2026", targetISO: "2026-07-25", startISO: "2026-05-15", completion: 100, status: "delivered", quarter: "Q2 2026", release: "R2", deps: [], approvalRequired: false, docType: "Design",    lastUpdated: "Jul 25, 2026", version: "v2.0" },
  { id: "D-MOB-A02", project: "MOB", name: "Integration Plan",            owner: "D. Wilson",   targetDate: "Aug 1, 2026",  targetISO: "2026-08-01", startISO: "2026-06-01", completion: 100, status: "delivered", quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Planning",  lastUpdated: "Aug 1, 2026",  version: "v1.3" },
  { id: "D-MOB-A03", project: "MOB", name: "Data Mapping Document",       owner: "B. Taylor",   targetDate: "Sep 30, 2026", targetISO: "2026-09-30", startISO: "2026-08-01", completion: 82,  status: "on-track",  quarter: "Q3 2026", release: "R3", deps: [], approvalRequired: false, docType: "Data",      lastUpdated: "Aug 26, 2026", version: "v1.1" },
  { id: "D-MOB-A04", project: "MOB", name: "Training Materials",          owner: "C. Anderson", targetDate: "Oct 1, 2026",  targetISO: "2026-10-01", startISO: "2026-08-15", completion: 70,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [], approvalRequired: false, docType: "Training",  lastUpdated: "Aug 20, 2026", version: "v1.0" },
  { id: "D-MOB-A05", project: "MOB", name: "Go-Live Checklist",           owner: "D. Wilson",   targetDate: "Oct 1, 2026",  targetISO: "2026-10-01", startISO: "2026-09-01", completion: 60,  status: "on-track",  quarter: "Q4 2026", release: "R4", deps: [], approvalRequired: false, docType: "Checklist", lastUpdated: "Aug 28, 2026", version: "v0.8" },
];

const ALL_COMBINED: Deliverable[] = [...ALL, ...DOC_DELIVERABLES];

// ─── Lookups ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DelivStatus, string> = {
  delivered: "Delivered", "on-track": "On Track", "at-risk": "At Risk", delayed: "Delayed",
};

const PROJECT_COLOR: Record<string, string> = {
  PAY: "#946200", CSP: "#00a870", FRD: "#d14343", MOB: "#1434cb",
};

const PROJECT_NAMES: Record<string, string> = {
  PAY: "Payments",
  CSP: "Customer Service Portal",
  FRD: "Fraud & Risk Engine",
  MOB: "Merchant Onboarding",
};

const STATUS_COLOR: Record<DelivStatus, string> = {
  delivered: "#00a870", "on-track": "#1434cb", "at-risk": "#946200", delayed: "#d14343",
};

type KitTone = "brand" | "pass" | "warn" | "fail" | "idle";
const toneFor = (s: DelivStatus): KitTone =>
  s === "delivered" ? "pass" : s === "on-track" ? "brand" : s === "at-risk" ? "warn" : "fail";

// ─── Grouping helpers ─────────────────────────────────────────────────────────

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return Array.from(map.entries());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DelivRow({ d, showProject = true }: { d: Deliverable; showProject?: boolean }) {
  return (
    <tr className="border-b border-ink-700 transition-colors hover:bg-ink-750/50 last:border-0">
      <td className="px-4 py-3">
        <span className="font-mono text-[11px] text-gray-500">{d.id}</span>
      </td>
      {showProject && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: PROJECT_COLOR[d.project] }} />
            <span className="font-mono text-[11px] font-bold text-gray-300">{d.project}</span>
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        <span className="text-[13px] font-medium text-gray-100">{d.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[12px] text-gray-400">{d.owner}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-[12px] text-gray-300">{d.targetDate}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Progress
            value={d.completion}
            tone={d.status === "delivered" ? "pass" : d.status === "on-track" ? "brand" : d.status === "at-risk" ? "warn" : "fail"}
            className="w-16"
          />
          <span className="w-8 text-right font-mono text-[12px] font-bold text-gray-200">{d.completion}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Pill tone={toneFor(d.status)} dot>{STATUS_LABEL[d.status]}</Pill>
      </td>
      <td className="px-4 py-3">
        {d.deps.length > 0
          ? <div className="flex flex-wrap gap-1">
              {d.deps.map(dep => (
                <span key={dep} className="font-mono text-[10px] text-accent bg-accent-soft px-1.5 py-0.5 rounded">{dep}</span>
              ))}
            </div>
          : <span className="font-mono text-[11px] text-gray-600">—</span>
        }
      </td>
    </tr>
  );
}

function TableHead({ showProject = true }: { showProject?: boolean }) {
  return (
    <thead>
      <tr className="border-b border-ink-700">
        <th className="col-label px-4 py-3 text-left">ID</th>
        {showProject && <th className="col-label px-4 py-3 text-left">Project</th>}
        <th className="col-label px-4 py-3 text-left">Deliverable</th>
        <th className="col-label px-4 py-3 text-left">Owner</th>
        <th className="col-label px-4 py-3 text-left">Target Date</th>
        <th className="col-label px-4 py-3 text-left">Completion</th>
        <th className="col-label px-4 py-3 text-left">Status</th>
        <th className="col-label px-4 py-3 text-left">Dependencies</th>
      </tr>
    </thead>
  );
}

function GroupHeader({ label, count, tone }: { label: string; count: number; tone?: KitTone }) {
  return (
    <tr className="bg-ink-750/60 border-b border-ink-700">
      <td colSpan={8} className="px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
          <Badge tone={tone ?? "idle"}>{count}</Badge>
        </div>
      </td>
    </tr>
  );
}

// ─── Delivery Timeline SVG ────────────────────────────────────────────────────

const TL_START = new Date("2026-07-01").getTime();
const TL_END   = new Date("2026-12-31").getTime();
const TL_MS    = TL_END - TL_START;
const TODAY_MS = new Date("2026-09-01").getTime();

function dateX(iso: string, width: number): number {
  const t = new Date(iso).getTime();
  return Math.max(0, Math.min(width, ((t - TL_START) / TL_MS) * width));
}

function DeliveryTimeline() {
  const W = 660, ROW_H = 22, LABEL_W = 44, PAD_TOP = 28, PAD_BOT = 12;
  const chartW = W - LABEL_W - 8;

  const groups = groupBy(ALL, d => d.project);
  const rows: { project: string; d: Deliverable }[] = [];
  for (const [proj, items] of groups) {
    for (const item of items.sort((a, b) => a.targetISO.localeCompare(b.targetISO))) {
      rows.push({ project: proj, d: item });
    }
  }

  const H = PAD_TOP + rows.length * ROW_H + PAD_BOT + 2;
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthStarts = [
    "2026-07-01","2026-08-01","2026-09-01","2026-10-01","2026-11-01","2026-12-01",
  ];
  const todayX = LABEL_W + dateX("2026-09-01", chartW);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Delivery timeline">
      {months.map((m, i) => {
        const x = LABEL_W + dateX(monthStarts[i], chartW);
        return (
          <g key={m}>
            <line x1={x} y1={PAD_TOP - 6} x2={x} y2={H - PAD_BOT}
              stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" />
            <text x={x + 3} y={PAD_TOP - 10} fontSize="9" fill="#94a3b8"
              fontFamily="'JetBrains Mono', monospace">{m}</text>
          </g>
        );
      })}

      <line x1={todayX} y1={PAD_TOP - 6} x2={todayX} y2={H - PAD_BOT}
        stroke="#1434cb" strokeWidth="1.5" opacity="0.5" />
      <text x={todayX + 3} y={PAD_TOP - 10} fontSize="9" fill="#1434cb"
        fontFamily="'JetBrains Mono', monospace">Today</text>

      {rows.map(({ project, d }, i) => {
        const y = PAD_TOP + i * ROW_H + ROW_H / 2;
        const x1 = LABEL_W + dateX(d.startISO, chartW);
        const x2 = LABEL_W + dateX(d.targetISO, chartW);
        const fillW = (x2 - x1) * (d.completion / 100);
        const color = STATUS_COLOR[d.status];

        return (
          <g key={d.id}>
            <text x={LABEL_W - 4} y={y + 3.5} fontSize="8.5" textAnchor="end" fill="#64748b"
              fontFamily="'JetBrains Mono', monospace">{d.id.replace("D-", "")}</text>
            <rect x={x1} y={y - 6} width={Math.max(2, x2 - x1)} height={12}
              rx="2" fill={color} opacity="0.12" />
            <rect x={x1} y={y - 6} width={Math.max(2, fillW)} height={12}
              rx="2" fill={color} opacity="0.7" />
            <circle cx={x2} cy={y} r="3.5" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Burn-up Chart ────────────────────────────────────────────────────────────

function BurnupChart() {
  const W = 360, H = 180;
  const PAD = { top: 14, right: 16, bottom: 30, left: 32 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const total = ALL.length;

  const data = [
    { m: "Jul",  ideal: 0,  actual: 0    },
    { m: "Aug",  ideal: 3,  actual: 3    },
    { m: "Sep",  ideal: 8,  actual: 3    },
    { m: "Oct",  ideal: 13, actual: null },
    { m: "Nov",  ideal: 17, actual: null },
    { m: "Dec",  ideal: 20, actual: null },
  ];

  const xStep = iw / (data.length - 1);
  const yScale = (v: number) => PAD.top + ih - (v / total) * ih;

  const linePath = (pts: (number | null)[], startIdx = 0): string => {
    let path = "";
    pts.forEach((v, i) => {
      if (v === null) return;
      const x = PAD.left + (i + startIdx) * xStep;
      const y = yScale(v);
      path += path === "" ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return path;
  };

  const yTicks = [0, 5, 10, 15, 20];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Burn-up progress">
      {yTicks.map(t => {
        const y = yScale(t);
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray={t === 0 ? "none" : "3 3"} />
            <text x={PAD.left - 5} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#94a3b8"
              fontFamily="'JetBrains Mono', monospace">{t}</text>
          </g>
        );
      })}

      {data.map((d, i) => (
        <text key={d.m} x={PAD.left + i * xStep} y={H - 8} textAnchor="middle"
          fontSize="8.5" fill="#94a3b8" fontFamily="'JetBrains Mono', monospace">{d.m}</text>
      ))}

      <line x1={PAD.left} y1={yScale(total)} x2={W - PAD.right} y2={yScale(total)}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" />
      <text x={W - PAD.right + 2} y={yScale(total) + 3.5} fontSize="8" fill="#94a3b8">Plan</text>

      <path d={linePath(data.map(d => d.ideal))} fill="none"
        stroke="#1434cb" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.5" />

      <path d={linePath(data.filter(d => d.actual !== null).map(d => d.actual as number))}
        fill="none" stroke="#00a870" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {data.map((d, i) => d.actual !== null
        ? <circle key={i} cx={PAD.left + i * xStep} cy={yScale(d.actual)} r="3"
            fill="#00a870" />
        : null
      )}

      <g>
        <line x1={PAD.left} y1={H - 2} x2={PAD.left + 16} y2={H - 2} stroke="#00a870" strokeWidth="2" />
        <text x={PAD.left + 19} y={H - 0.5} fontSize="8" fill="#64748b">Actual</text>
        <line x1={PAD.left + 60} y1={H - 2} x2={PAD.left + 76} y2={H - 2}
          stroke="#1434cb" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />
        <text x={PAD.left + 79} y={H - 0.5} fontSize="8" fill="#64748b">Ideal</text>
      </g>
    </svg>
  );
}

// ─── Release Roadmap ──────────────────────────────────────────────────────────

function ReleaseRoadmap() {
  const releases = [
    { id: "R2", label: "Release 2", period: "Q2 2026 · Completed", locked: true },
    { id: "R3", label: "Release 3", period: "Q3 2026 · Sep 30, 2026", locked: false },
    { id: "R4", label: "Release 4", period: "Q4 2026 · Dec 31, 2026", locked: false },
  ];
  const projects = ["PAY", "CSP", "FRD", "MOB"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-[12px]">
        <thead>
          <tr className="border-b border-ink-700">
            <th className="col-label px-5 py-3 text-left w-24">Project</th>
            {releases.map(r => (
              <th key={r.id} className="col-label px-5 py-3 text-left">
                <div>
                  <span className="block font-bold text-[12px] text-gray-200">{r.label}</span>
                  <span className="block font-mono text-[10px] text-gray-500">{r.period}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((proj, pi) => (
            <tr key={proj} className={`${pi < projects.length - 1 ? "border-b border-ink-700" : ""} hover:bg-ink-750/40`}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full" style={{ backgroundColor: PROJECT_COLOR[proj] }} />
                  <span className="font-mono text-[12px] font-bold text-gray-200">{proj}</span>
                </div>
              </td>
              {releases.map(r => {
                const items = ALL.filter(d => d.project === proj && d.release === r.id);
                if (items.length === 0) {
                  return <td key={r.id} className="px-5 py-4"><span className="text-gray-600 font-mono text-[11px]">—</span></td>;
                }
                return (
                  <td key={r.id} className="px-5 py-4">
                    <div className="space-y-1.5">
                      {items.map(d => (
                        <div key={d.id} className="flex items-center gap-2">
                          <Pill tone={toneFor(d.status)} dot>{STATUS_LABEL[d.status]}</Pill>
                          <span className="truncate text-[12px] text-gray-300 max-w-[200px]">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── View tabs ────────────────────────────────────────────────────────────────

type ViewKey = "all" | "quarter" | "release" | "project" | "owner";

const VIEW_TABS: { key: ViewKey; label: string }[] = [
  { key: "all",     label: "All"        },
  { key: "quarter", label: "By Quarter" },
  { key: "release", label: "By Release" },
  { key: "project", label: "By Project" },
  { key: "owner",   label: "By Owner"   },
];

function DeliverableTable({ view, search }: { view: ViewKey; search: string }) {
  const filtered = ALL.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.project.toLowerCase().includes(search.toLowerCase()) ||
    d.owner.toLowerCase().includes(search.toLowerCase()) ||
    d.id.toLowerCase().includes(search.toLowerCase())
  );

  if (view === "all") {
    const sorted = [...filtered].sort((a, b) => a.targetISO.localeCompare(b.targetISO));
    return (
      <Card>
        <table className="w-full text-[13px]">
          <TableHead />
          <tbody>{sorted.map(d => <DelivRow key={d.id} d={d} />)}</tbody>
        </table>
      </Card>
    );
  }

  const groupKey: (d: Deliverable) => string =
    view === "quarter" ? d => d.quarter :
    view === "release" ? d => `Release ${d.release} · ${d.release === "R2" ? "Q2 2026" : d.release === "R3" ? "Q3 2026" : "Q4 2026"}` :
    view === "project" ? d => `${d.project} — ${d.project === "PAY" ? "Payments" : d.project === "CSP" ? "Customer Service Portal" : d.project === "FRD" ? "Fraud & Risk Engine" : "Merchant Onboarding"}` :
    d => d.owner;

  const groups = groupBy(filtered.sort((a, b) => a.targetISO.localeCompare(b.targetISO)), groupKey);

  return (
    <Card>
      <table className="w-full text-[13px]">
        <TableHead showProject={view !== "project"} />
        <tbody>
          {groups.map(([label, items]) => (
            <Fragment key={label}>
              <GroupHeader label={label} count={items.length} />
              {items.map(d => <DelivRow key={d.id} d={d} showProject={view !== "project"} />)}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconBox    = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="3" width="11" height="9" rx="1" /><path d="M5 3V1.5h4V3" strokeLinecap="round" /></svg>;
const IconDone   = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.6"><path d="M2 7l3 3 7-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconWarn   = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M7 1.5L13 12.5H1L7 1.5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 5.5v3M7 10v.5" strokeLinecap="round" /></svg>;
const IconClock  = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconChevron = ({ dir = "right" }: { dir?: "left" | "right" }) => (
  <svg viewBox="0 0 8 14" fill="none" className="size-3 shrink-0" stroke="currentColor" strokeWidth="1.5">
    {dir === "right"
      ? <path d="M1 1l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M7 1L1 7l6 6" strokeLinecap="round" strokeLinejoin="round" />
    }
  </svg>
);
// ─── Breadcrumb (Phase 5) ─────────────────────────────────────────────────────

function Breadcrumb({ projectName, onHome, onHealth }: {
  projectName: string;
  onHome: () => void;
  onHealth: () => void;
}) {
  return (
    <nav
      className="flex items-center gap-2 border-b border-ink-700 bg-ink-800/60 px-6 py-3"
      aria-label="Breadcrumb"
    >
      <button
        onClick={onHome}
        className="text-[12px] text-gray-500 transition-colors hover:text-gray-300"
      >
        Knowledge Management
      </button>
      <IconChevron dir="right" />
      <button
        onClick={onHealth}
        className="text-[12px] text-gray-500 transition-colors hover:text-gray-300"
      >
        Project Health
      </button>
      <IconChevron dir="right" />
      <span className="text-[12px] font-semibold text-gray-200">
        Deliverables ({projectName})
      </span>
      <button
        onClick={onHealth}
        className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-ink-700 px-3 py-1.5 text-[12px] text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
      >
        <IconChevron dir="left" />
        Back to Project Health
      </button>
    </nav>
  );
}

// ─── Project deliverable row (Phase 4 columns) ────────────────────────────────

function ProjectDelivRow({ d }: { d: Deliverable }) {
  return (
    <tr className="border-b border-ink-700 transition-colors hover:bg-ink-750/50 last:border-0">
      <td className="px-4 py-3">
        <span className="font-mono text-[11px] text-gray-500">{d.id}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[13px] font-medium text-gray-100">{d.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-[6px] border border-ink-700 bg-ink-750 px-2 py-0.5 font-mono text-[11px] text-gray-400">
          {d.docType ?? "Engineering"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[12px] text-gray-400">{d.owner}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-[12px] text-gray-300">{d.version ?? "—"}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-[12px] text-gray-400">{d.lastUpdated ?? d.targetDate}</span>
      </td>
      <td className="px-4 py-3">
        <Pill tone={toneFor(d.status)} dot>{STATUS_LABEL[d.status]}</Pill>
      </td>
    </tr>
  );
}

// ─── Project deliverables section (Phases 2–4) ────────────────────────────────

function ProjectDeliverablesSection({ projectCode }: { projectCode: string }) {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  const projectItems = ALL_COMBINED
    .filter(d => d.project === projectCode)
    .sort((a, b) => a.targetISO.localeCompare(b.targetISO));

  const docTypes = [...new Set(projectItems.map(d => d.docType ?? "Engineering"))].sort();

  const filtered = projectItems.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (docTypeFilter !== "all" && (d.docType ?? "Engineering") !== docTypeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.docType ?? "Engineering").toLowerCase().includes(q) ||
        (d.version ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const total     = projectItems.length;
  const delivered = projectItems.filter(d => d.status === "delivered").length;
  const atRisk    = projectItems.filter(d => d.status === "at-risk").length;
  const delayed   = projectItems.filter(d => d.status === "delayed").length;

  return (
    <section>
      <SectionTitle>Project Deliverables</SectionTitle>

      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-4 gap-4">
        <StatCard label="Total Deliverables" value={total}     tone="brand" icon={<IconBox />} />
        <StatCard label="Delivered"          value={delivered} tone="pass"  icon={<IconDone />} />
        <StatCard label="At Risk"            value={atRisk}    tone="warn"  icon={<IconWarn />} />
        <StatCard label="Delayed"            value={delayed}   tone="fail"  icon={<IconClock />} />
      </div>

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-500" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l3 3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search deliverables…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 rounded-[10px] border border-ink-700 bg-white py-2 pl-9 pr-4 text-[13px] text-gray-200 placeholder-gray-600 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-ink-700 bg-ink-800 px-3 py-2 text-[13px] text-gray-300 outline-none focus:border-accent"
        >
          <option value="all">All Statuses</option>
          <option value="delivered">Delivered</option>
          <option value="on-track">On Track</option>
          <option value="at-risk">At Risk</option>
          <option value="delayed">Delayed</option>
        </select>

        {/* Document type filter */}
        <select
          value={docTypeFilter}
          onChange={e => setDocTypeFilter(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-ink-700 bg-ink-800 px-3 py-2 text-[13px] text-gray-300 outline-none focus:border-accent"
        >
          <option value="all">All Document Types</option>
          {docTypes.map(dt => (
            <option key={dt} value={dt}>{dt}</option>
          ))}
        </select>

        <span className="ml-auto font-mono text-[12px] text-gray-500">
          {filtered.length} of {total}
        </span>
      </div>

      {/* Table */}
      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink-700">
              <th className="col-label px-4 py-3 text-left">ID</th>
              <th className="col-label px-4 py-3 text-left">Deliverable</th>
              <th className="col-label px-4 py-3 text-left">Document Type</th>
              <th className="col-label px-4 py-3 text-left">Owner</th>
              <th className="col-label px-4 py-3 text-left">Version</th>
              <th className="col-label px-4 py-3 text-left">Last Updated</th>
              <th className="col-label px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center font-mono text-[13px] text-gray-600">
                  No deliverables match the current filters
                </td>
              </tr>
            ) : (
              filtered.map(d => <ProjectDelivRow key={d.id} d={d} />)
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramManagerDeliverables() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [view, setView]     = useState<ViewKey>("all");
  const [search, setSearch] = useState("");

  const state = location.state as { selectedProject?: string; fromHealth?: boolean } | null;
  const selectedProject = state?.selectedProject;

  const delivered  = ALL.filter(d => d.status === "delivered").length;
  const onTrack    = ALL.filter(d => d.status === "on-track").length;
  const atRisk     = ALL.filter(d => d.status === "at-risk").length;
  const delayed    = ALL.filter(d => d.status === "delayed").length;

  const upcoming      = ALL.filter(d => d.status !== "delivered")
    .sort((a, b) => a.targetISO.localeCompare(b.targetISO)).slice(0, 4);
  const delayedItems  = ALL.filter(d => d.status === "delayed");
  const critical      = ALL.filter(d => d.status === "at-risk" || d.status === "delayed")
    .sort((a, b) => a.targetISO.localeCompare(b.targetISO)).slice(0, 4);
  const needsApproval = ALL.filter(d => d.approvalRequired && d.status !== "delivered");

  // ── Project-filtered view (Phases 2–5) ────────────────────────────────────
  if (selectedProject) {
    const projectName = PROJECT_NAMES[selectedProject] ?? selectedProject;
    return (
      <>
        <PageMeta title={`Deliverables — ${projectName}`} />
        <div className="min-h-screen pb-12">
          <Breadcrumb
            projectName={projectName}
            onHome={() => navigate("/knowledge-management")}
            onHealth={() => navigate("/pm-health")}
          />
          <PageHead
            kicker="Program Manager"
            title="Deliverables"
            blurb={`${projectName} · Documentation, artifacts and delivery tracking`}
          />
          <div className="space-y-7 px-6 pt-6">
            <ProjectDeliverablesSection projectCode={selectedProject} />
          </div>
        </div>
      </>
    );
  }

  // ── All-projects view (unchanged) ────────────────────────────────────────
  return (
    <>
      <PageMeta title="Deliverables" />
      <div className="min-h-screen pb-12">

        <PageHead
          kicker="Program Manager"
          title="Deliverables"
          blurb="Program deliverable management across PAY · CSP · FRD · MOB"
        />

        <div className="space-y-7 px-6 pt-6">

          {/* ── 1. Summary Stats ────────────────────────────────────────── */}
          <section>
            <SectionTitle>Deliverables Summary</SectionTitle>
            <div className="grid grid-cols-5 gap-4">
              <StatCard label="Total Deliverables" value={ALL.length}  tone="brand" icon={<IconBox />} />
              <StatCard label="Delivered"           value={delivered}  tone="pass"  icon={<IconDone />} />
              <StatCard label="On Track"            value={onTrack}    tone="brand" icon={<IconBox />} />
              <StatCard label="At Risk"             value={atRisk}     tone="warn"  icon={<IconWarn />} />
              <StatCard label="Delayed"             value={delayed}    tone="fail"  icon={<IconClock />}
                note={`${delayedItems.map(d => d.id).join(" · ")}`} />
            </div>
          </section>

          {/* ── 2. Deliverables Table ────────────────────────────────────── */}
          <section>
            <SectionTitle>Deliverables</SectionTitle>

            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex gap-1 rounded-[10px] border border-ink-700 bg-white p-1">
                {VIEW_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setView(t.key)}
                    className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors
                      ${view === t.key
                        ? "bg-nav-bottom text-white"
                        : "text-gray-400 hover:text-gray-200"
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-500" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="6.5" cy="6.5" r="4" />
                  <path d="M10 10l3 3" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="Search deliverables…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="rounded-[10px] border border-ink-700 bg-white py-2 pl-9 pr-4 text-[13px] text-gray-200 placeholder-gray-600 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
                />
              </div>
            </div>

            <DeliverableTable view={view} search={search} />
          </section>

          {/* ── 3. Widgets row ───────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <SectionTitle aside={`${upcoming.length} items`}>Upcoming</SectionTitle>
              <Card className="divide-y divide-ink-700">
                {upcoming.map(d => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="size-1.5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[d.project] }} />
                        <span className="font-mono text-[10px] text-gray-500">{d.id}</span>
                      </div>
                      <span className="font-mono text-[11px] text-gray-500">{d.targetDate.replace(", 2026","")}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-gray-200">{d.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={d.completion} tone={toneFor(d.status)} className="flex-1" />
                      <Pill tone={toneFor(d.status)}>{d.completion}%</Pill>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div>
              <SectionTitle aside={`${delayedItems.length} items`}>Delayed</SectionTitle>
              <Card className="divide-y divide-ink-700">
                {delayedItems.map(d => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-state-fail">{d.project}</span>
                      <span className="font-mono text-[11px] text-gray-500">{d.targetDate.replace(", 2026","")}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-gray-200">{d.name}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{d.owner}</p>
                    <Progress value={d.completion} tone="fail" className="mt-1.5" />
                  </div>
                ))}
              </Card>
            </div>

            <div>
              <SectionTitle aside={`${critical.length} items`}>Critical Path</SectionTitle>
              <Card className="divide-y divide-ink-700">
                {critical.map(d => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Pill tone={toneFor(d.status)} dot>{STATUS_LABEL[d.status]}</Pill>
                      <span className="font-mono text-[11px] text-gray-500">{d.targetDate.replace(", 2026","")}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-gray-200">{d.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="size-1.5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[d.project] }} />
                      <span className="font-mono text-[10px] text-gray-500">{d.project}</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div>
              <SectionTitle aside={`${needsApproval.length} items`}>Needs Approval</SectionTitle>
              <Card className="divide-y divide-ink-700">
                {needsApproval.map(d => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-gray-400">{d.id}</span>
                      <Pill tone={toneFor(d.status)}>{STATUS_LABEL[d.status]}</Pill>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-gray-200">{d.name}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{d.owner} · {d.targetDate.replace(", 2026","")}</p>
                    <button type="button" title="Not built yet"
                      className="mt-2 w-full cursor-not-allowed rounded-[8px] border border-accent/30 bg-accent-soft py-1.5 text-[11px] font-semibold text-accent">
                      Review &amp; Approve
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* ── 4. Delivery Timeline + Burn-up ──────────────────────────── */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3">
              <SectionTitle aside="Jul — Dec 2026">Delivery Timeline</SectionTitle>
              <Card className="p-5 overflow-x-auto">
                <div className="mb-3 flex flex-wrap gap-3">
                  {Object.entries(STATUS_COLOR).map(([s, c]) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className="size-2 rounded-sm" style={{ backgroundColor: c }} />
                      <span className="text-[11px] text-gray-500 capitalize">{STATUS_LABEL[s as DelivStatus]}</span>
                    </div>
                  ))}
                </div>
                <DeliveryTimeline />
              </Card>
            </div>

            <div className="col-span-2">
              <SectionTitle aside="Deliverables completed">Burn-up Progress</SectionTitle>
              <Card className="p-5">
                <div className="mb-1 flex gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <div className="h-0.5 w-4 bg-state-pass rounded-full" />
                    <span className="text-gray-500">Actual</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="h-0.5 w-4 bg-accent opacity-50 rounded-full" style={{ borderTop: "1.5px dashed" }} />
                    <span className="text-gray-500">Ideal</span>
                  </span>
                  <span className="ml-auto text-gray-500">Target: <span className="font-bold text-gray-200">20</span></span>
                </div>
                <BurnupChart />
                <div className="mt-3 rounded-[8px] bg-ink-750 px-4 py-2.5 text-[12px]">
                  <span className="text-gray-400">Current: </span>
                  <span className="font-bold text-state-pass">{delivered} delivered</span>
                  <span className="text-gray-500"> · Ideal at this point: </span>
                  <span className="font-bold text-accent">8</span>
                  <span className="text-state-fail font-semibold"> · Behind by 5</span>
                </div>
              </Card>
            </div>
          </div>

          {/* ── 5. Release Roadmap ───────────────────────────────────────── */}
          <section>
            <SectionTitle
              aside={
                <div className="flex gap-2">
                  <Pill tone="pass" dot>R2 Complete</Pill>
                  <Pill tone="warn" dot>R3 At Risk</Pill>
                  <Pill tone="brand" dot>R4 Planned</Pill>
                </div>
              }
            >
              Release Roadmap
            </SectionTitle>
            <Card>
              <ReleaseRoadmap />
            </Card>
          </section>

        </div>
      </div>
    </>
  );
}
