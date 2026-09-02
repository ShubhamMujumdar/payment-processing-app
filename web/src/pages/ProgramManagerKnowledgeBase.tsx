import { useState, Fragment } from "react";
import { useLocation, useNavigate } from "react-router";
import PageMeta from "../components/common/PageMeta";
import {
  Card, StatCard, Pill, Badge, Progress,
  PageHead, SectionTitle, MockButton,
} from "../components/visa/kit";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = "current" | "stale" | "missing";
type SectionKey = "overview" | "architecture" | "adrs" | "release" | "runbooks" | "compliance";

interface KBDoc {
  id: string;
  title: string;
  project: string;
  owner: string;
  updated: string;
  updatedISO: string;
  status: DocStatus;
  type: string;
}

interface ProjectKBDoc extends KBDoc {
  category: string;
  version: string;
  tags: string[];
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

const PROJECT_COLOR: Record<string, string> = {
  PAY: "#946200", CSP: "#00a870", FRD: "#d14343", MOB: "#1434cb",
};

const PROJECT_NAMES: Record<string, string> = {
  PAY: "Payments",
  CSP: "Customer Service Portal",
  FRD: "Fraud & Risk Engine",
  MOB: "Merchant Onboarding",
};

const DOC_STATUS_TONE: Record<DocStatus, "pass" | "warn" | "fail"> = {
  current: "pass", stale: "warn", missing: "fail",
};

const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  current: "Current", stale: "Stale", missing: "Missing",
};

// ─── Global KB Mock Data ──────────────────────────────────────────────────────

const DOCS: Record<SectionKey, KBDoc[]> = {
  overview: [
    { id: "KB-001", title: "Program Charter v2.1",                  project: "ALL", owner: "V. Lakkaraj",   updated: "Aug 15, 2026", updatedISO: "2026-08-15", status: "current", type: "Charter"   },
    { id: "KB-002", title: "Q3 2026 Program Status Report",          project: "ALL", owner: "V. Lakkaraj",   updated: "Aug 25, 2026", updatedISO: "2026-08-25", status: "current", type: "Report"    },
    { id: "KB-003", title: "Stakeholder Communication Plan",         project: "ALL", owner: "P. Chen",       updated: "Jun 10, 2026", updatedISO: "2026-06-10", status: "stale",   type: "Plan"      },
    { id: "KB-004", title: "Program Governance Framework",           project: "ALL", owner: "V. Lakkaraj",   updated: "Jul 20, 2026", updatedISO: "2026-07-20", status: "current", type: "Framework" },
    { id: "KB-005", title: "Program Risk Management Policy",         project: "ALL", owner: "J. Martinez",   updated: "May 5, 2026",  updatedISO: "2026-05-05", status: "stale",   type: "Policy"    },
  ],
  architecture: [
    { id: "KB-010", title: "Payment Processing Architecture v3",     project: "PAY", owner: "A. Sharma",     updated: "Aug 10, 2026", updatedISO: "2026-08-10", status: "current", type: "Design"   },
    { id: "KB-011", title: "Agent Platform Architecture",            project: "CSP", owner: "M. Johnson",    updated: "Jul 28, 2026", updatedISO: "2026-07-28", status: "current", type: "Design"   },
    { id: "KB-012", title: "Fraud Detection System Design",          project: "FRD", owner: "J. Martinez",   updated: "Jun 3, 2026",  updatedISO: "2026-06-03", status: "stale",   type: "Design"   },
    { id: "KB-013", title: "Merchant Onboarding Architecture",       project: "MOB", owner: "C. Anderson",   updated: "Aug 18, 2026", updatedISO: "2026-08-18", status: "current", type: "Design"   },
    { id: "KB-014", title: "ML Fraud Model Training Pipeline",       project: "FRD", owner: "N. Garcia",     updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Design"   },
    { id: "KB-015", title: "Cross-Project Integration Architecture", project: "ALL", owner: "A. Sharma",     updated: "May 20, 2026", updatedISO: "2026-05-20", status: "stale",   type: "Design"   },
  ],
  adrs: [
    { id: "ADR-041", title: "Adopt Kafka for real-time fraud event streaming", project: "FRD", owner: "J. Martinez", updated: "Aug 12, 2026", updatedISO: "2026-08-12", status: "current", type: "ADR" },
    { id: "ADR-039", title: "Use React Query for CSP dashboard state",         project: "CSP", owner: "R. Davis",    updated: "Jul 22, 2026", updatedISO: "2026-07-22", status: "current", type: "ADR" },
    { id: "ADR-038", title: "Multi-cloud payment failover strategy",            project: "PAY", owner: "A. Sharma",  updated: "Jul 18, 2026", updatedISO: "2026-07-18", status: "current", type: "ADR" },
    { id: "ADR-036", title: "KYC provider selection rationale",                project: "MOB", owner: "C. Anderson", updated: "Jun 15, 2026", updatedISO: "2026-06-15", status: "current", type: "ADR" },
    { id: "ADR-035", title: "Microservices decomposition for merchant profile", project: "MOB", owner: "D. Wilson",  updated: "May 28, 2026", updatedISO: "2026-05-28", status: "stale",   type: "ADR" },
    { id: "ADR-033", title: "Fraud Rule Engine Architecture Decision",          project: "FRD", owner: "N. Garcia",  updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "ADR" },
  ],
  release: [
    { id: "REL-R2-01", title: "R2 Release Notes — CSP Agent Dashboard v3.0",   project: "CSP", owner: "M. Johnson",  updated: "Jul 16, 2026", updatedISO: "2026-07-16", status: "current", type: "Release Notes" },
    { id: "REL-R2-02", title: "R2 Release Notes — MOB KYC Verification v1.0",  project: "MOB", owner: "C. Anderson", updated: "Jul 31, 2026", updatedISO: "2026-07-31", status: "current", type: "Release Notes" },
    { id: "REL-R3-01", title: "R3 Release Candidate Checklist",                 project: "ALL", owner: "V. Lakkaraj", updated: "Aug 20, 2026", updatedISO: "2026-08-20", status: "current", type: "Checklist"     },
    { id: "REL-R3-02", title: "R3 PAY Deployment Runbook",                      project: "PAY", owner: "P. Chen",     updated: "Aug 22, 2026", updatedISO: "2026-08-22", status: "current", type: "Runbook"       },
    { id: "REL-R3-03", title: "R3 FRD Deployment Runbook",                      project: "FRD", owner: "J. Martinez", updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Runbook"       },
  ],
  runbooks: [
    { id: "RUN-001", title: "Payment Gateway Failover Runbook",       project: "PAY", owner: "P. Chen",      updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Runbook" },
    { id: "RUN-002", title: "Agent Dashboard Incident Response",      project: "CSP", owner: "S. Williams",  updated: "Aug 5, 2026",  updatedISO: "2026-08-05", status: "current", type: "Runbook" },
    { id: "RUN-003", title: "Fraud Alert Triage Guide",               project: "FRD", owner: "N. Garcia",    updated: "Jun 28, 2026", updatedISO: "2026-06-28", status: "stale",   type: "Runbook" },
    { id: "RUN-004", title: "KYC Escalation Procedures",              project: "MOB", owner: "B. Taylor",    updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Runbook" },
    { id: "RUN-005", title: "On-call Escalation Matrix",              project: "ALL", owner: "V. Lakkaraj",  updated: "Jul 10, 2026", updatedISO: "2026-07-10", status: "current", type: "Policy"  },
  ],
  compliance: [
    { id: "COM-001", title: "PCI DSS Compliance Assessment 2026",     project: "PAY", owner: "P. Chen",      updated: "Aug 8, 2026",  updatedISO: "2026-08-08", status: "current", type: "Compliance" },
    { id: "COM-002", title: "GDPR Data Handling Policy",              project: "FRD", owner: "L. Torres",    updated: "Apr 15, 2026", updatedISO: "2026-04-15", status: "stale",   type: "Compliance" },
    { id: "COM-003", title: "SOC 2 Type II Audit Checklist",          project: "PAY", owner: "P. Chen",      updated: "Jul 5, 2026",  updatedISO: "2026-07-05", status: "current", type: "Compliance" },
    { id: "COM-004", title: "AML Transaction Screening Documentation",project: "FRD", owner: "L. Torres",    updated: "May 20, 2026", updatedISO: "2026-05-20", status: "stale",   type: "Compliance" },
    { id: "COM-005", title: "Merchant Data Privacy Framework",        project: "MOB", owner: "C. Anderson",  updated: "Aug 1, 2026",  updatedISO: "2026-08-01", status: "current", type: "Compliance" },
  ],
};

const ALL_DOCS = Object.values(DOCS).flat();

const PROJECT_STATS: { code: string; name: string; total: number; current: number; stale: number; missing: number; freshness: number; coverage: number }[] = [
  { code: "PAY", name: "Payments",                total: 24, current: 18, stale: 4, missing: 2, freshness: 75, coverage: 72 },
  { code: "CSP", name: "Customer Service Portal", total: 31, current: 28, stale: 2, missing: 1, freshness: 90, coverage: 88 },
  { code: "FRD", name: "Fraud & Risk Engine",     total: 19, current: 12, stale: 4, missing: 3, freshness: 63, coverage: 54 },
  { code: "MOB", name: "Merchant Onboarding",     total: 27, current: 24, stale: 2, missing: 1, freshness: 89, coverage: 83 },
];

const HEATMAP_CATS = ["Overview", "Architecture", "ADRs", "Runbooks", "Compliance"];
const HEATMAP: Record<string, number[]> = {
  PAY: [90, 72, 85, 45, 76],
  CSP: [95, 88, 92, 90, 85],
  FRD: [70, 48, 75, 50, 52],
  MOB: [92, 83, 88, 65, 80],
};

const DIST_CATS   = ["Overview", "Architecture", "ADRs", "Release", "Runbooks", "Compliance"];
const DIST_COLORS = ["#1434cb", "#00a870", "#946200", "#8b5cf6", "#0ea5e9", "#ec4899"];
const DIST_DATA: Record<string, number[]> = {
  PAY: [4, 5, 6, 3, 2, 4],
  CSP: [5, 7, 7, 5, 4, 3],
  FRD: [3, 3, 4, 2, 2, 5],
  MOB: [5, 6, 6, 5, 3, 2],
};

const REUSE_ITEMS = [
  { title: "On-call Escalation Matrix",        projects: ["PAY","CSP","FRD","MOB"], saving: "4 docs → 1" },
  { title: "Program Governance Framework",     projects: ["PAY","CSP","FRD","MOB"], saving: "4 docs → 1" },
  { title: "Release Checklist Template",       projects: ["PAY","CSP","FRD","MOB"], saving: "4 docs → 1" },
  { title: "Cross-project Security Baseline",  projects: ["PAY","FRD"],             saving: "2 docs → 1" },
];

// ─── Project-specific KB documents (Phase 3) ─────────────────────────────────

const PROJECT_KB: Record<string, ProjectKBDoc[]> = {
  PAY: [
    { id: "PAY-K001", title: "System Architecture Overview v3",      project: "PAY", category: "Architecture Docs",  owner: "A. Sharma",  updated: "Aug 10, 2026", updatedISO: "2026-08-10", status: "current", type: "Architecture",  version: "v3.0",      tags: ["architecture","system-design","core"]     },
    { id: "PAY-K002", title: "Payment Data Flow Diagram",            project: "PAY", category: "Architecture Docs",  owner: "A. Sharma",  updated: "Aug 5, 2026",  updatedISO: "2026-08-05", status: "current", type: "Diagram",       version: "v2.1",      tags: ["data-flow","architecture"]                },
    { id: "PAY-K003", title: "Security Architecture & PCI Scope",    project: "PAY", category: "Architecture Docs",  owner: "P. Chen",    updated: "Jul 20, 2026", updatedISO: "2026-07-20", status: "stale",   type: "Architecture",  version: "v1.8",      tags: ["security","pci","architecture"]           },
    { id: "PAY-K004", title: "Payment Gateway API v3.2",             project: "PAY", category: "API Specs",          owner: "J. Lee",     updated: "Aug 29, 2026", updatedISO: "2026-08-29", status: "current", type: "API Spec",      version: "v3.2",      tags: ["api","gateway","rest"]                    },
    { id: "PAY-K005", title: "Webhook Event Catalog",                project: "PAY", category: "API Specs",          owner: "J. Lee",     updated: "Aug 15, 2026", updatedISO: "2026-08-15", status: "current", type: "API Spec",      version: "v1.5",      tags: ["api","webhooks","events"]                 },
    { id: "PAY-K006", title: "Error Code Reference Guide",           project: "PAY", category: "API Specs",          owner: "K. Patel",   updated: "Jul 10, 2026", updatedISO: "2026-07-10", status: "stale",   type: "Reference",     version: "v2.0",      tags: ["api","errors","reference"]                },
    { id: "PAY-K007", title: "ADR-038: Multi-cloud Failover",        project: "PAY", category: "Design Decisions",   owner: "A. Sharma",  updated: "Jul 18, 2026", updatedISO: "2026-07-18", status: "current", type: "ADR",           version: "v1.0",      tags: ["adr","resilience","cloud"]                },
    { id: "PAY-K008", title: "Rate Limiting Architecture Decision",  project: "PAY", category: "Design Decisions",   owner: "J. Lee",     updated: "Aug 1, 2026",  updatedISO: "2026-08-01", status: "current", type: "ADR",           version: "v1.0",      tags: ["adr","rate-limiting","api"]               },
    { id: "PAY-K009", title: "Payment Gateway Failover Runbook",     project: "PAY", category: "Runbooks",           owner: "P. Chen",    updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Runbook",       version: "—",         tags: ["runbook","incident","failover"]           },
    { id: "PAY-K010", title: "Transaction Reconciliation SOP",       project: "PAY", category: "Runbooks",           owner: "K. Patel",   updated: "Aug 3, 2026",  updatedISO: "2026-08-03", status: "current", type: "Runbook",       version: "v1.2",      tags: ["runbook","reconciliation","sop"]          },
    { id: "PAY-K011", title: "Sprint 21 Release Notes",              project: "PAY", category: "Release Notes",      owner: "K. Patel",   updated: "Aug 25, 2026", updatedISO: "2026-08-25", status: "current", type: "Release Notes", version: "Sprint 21", tags: ["release","sprint-notes"]                  },
    { id: "PAY-K012", title: "R3 Deployment Runbook",                project: "PAY", category: "Release Notes",      owner: "P. Chen",    updated: "Aug 22, 2026", updatedISO: "2026-08-22", status: "current", type: "Runbook",       version: "R3",        tags: ["release","deployment","runbook"]          },
  ],
  CSP: [
    { id: "CSP-K001", title: "Requirements Document v3.0",           project: "CSP", category: "Requirements",  owner: "M. Johnson",  updated: "Jul 10, 2026", updatedISO: "2026-07-10", status: "current", type: "Requirements",   version: "v3.0",      tags: ["requirements","core"]                     },
    { id: "CSP-K002", title: "Agent Workflow Functional Spec",       project: "CSP", category: "Requirements",  owner: "S. Williams", updated: "Jul 25, 2026", updatedISO: "2026-07-25", status: "current", type: "Functional Spec",version: "v2.1",      tags: ["requirements","workflow","agent"]         },
    { id: "CSP-K003", title: "Omnichannel Feature Requirements",     project: "CSP", category: "Requirements",  owner: "T. Brown",    updated: "Jun 15, 2026", updatedISO: "2026-06-15", status: "stale",   type: "Requirements",   version: "v1.4",      tags: ["requirements","omnichannel"]              },
    { id: "CSP-K004", title: "Agent Dashboard UI Designs v2.5",     project: "CSP", category: "UI Specs",      owner: "R. Davis",    updated: "Aug 5, 2026",  updatedISO: "2026-08-05", status: "current", type: "Design",         version: "v2.5",      tags: ["ui","design","dashboard"]                 },
    { id: "CSP-K005", title: "Case Management UI Specifications",   project: "CSP", category: "UI Specs",      owner: "R. Davis",    updated: "Jul 28, 2026", updatedISO: "2026-07-28", status: "current", type: "Design",         version: "v1.3",      tags: ["ui","case-management"]                    },
    { id: "CSP-K006", title: "Agent User Guide v1.0",               project: "CSP", category: "User Guides",   owner: "M. Johnson",  updated: "Aug 18, 2026", updatedISO: "2026-08-18", status: "current", type: "User Guide",     version: "v1.0",      tags: ["user-guide","training"]                   },
    { id: "CSP-K007", title: "Supervisor Workflow Guide",           project: "CSP", category: "User Guides",   owner: "S. Williams", updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "User Guide",     version: "—",         tags: ["user-guide","supervisor"]                 },
    { id: "CSP-K008", title: "UAT Results — Sprint 34",             project: "CSP", category: "UAT Reports",   owner: "S. Williams", updated: "Aug 29, 2026", updatedISO: "2026-08-29", status: "current", type: "Test Report",    version: "Sprint 34", tags: ["uat","testing","sprint"]                   },
    { id: "CSP-K009", title: "Agent Dashboard v3.0 UAT Sign-off",  project: "CSP", category: "UAT Reports",   owner: "M. Johnson",  updated: "Jul 15, 2026", updatedISO: "2026-07-15", status: "current", type: "Test Report",    version: "R2",        tags: ["uat","sign-off","dashboard"]               },
  ],
  FRD: [
    { id: "FRD-K001", title: "Fraud Rule Configuration Guide v1.1",      project: "FRD", category: "Risk Rules",       owner: "J. Martinez", updated: "Aug 20, 2026", updatedISO: "2026-08-20", status: "current", type: "Configuration", version: "v1.1",      tags: ["rules","fraud","config"]                  },
    { id: "FRD-K002", title: "Rule Engine Decision Matrix",               project: "FRD", category: "Risk Rules",       owner: "N. Garcia",   updated: "Aug 12, 2026", updatedISO: "2026-08-12", status: "current", type: "Reference",     version: "v2.0",      tags: ["rules","decision-matrix"]                 },
    { id: "FRD-K003", title: "ML Model Risk Thresholds",                  project: "FRD", category: "Risk Rules",       owner: "J. Martinez", updated: "Jun 28, 2026", updatedISO: "2026-06-28", status: "stale",   type: "Policy",        version: "v1.3",      tags: ["ml","thresholds","risk"]                  },
    { id: "FRD-K004", title: "Fraud Scoring API Integration Spec",        project: "FRD", category: "Integration Docs", owner: "N. Garcia",   updated: "Aug 25, 2026", updatedISO: "2026-08-25", status: "current", type: "Integration",   version: "v1.0",      tags: ["integration","api","scoring"]             },
    { id: "FRD-K005", title: "Kafka Event Streaming Integration",         project: "FRD", category: "Integration Docs", owner: "J. Martinez", updated: "Aug 12, 2026", updatedISO: "2026-08-12", status: "current", type: "Integration",   version: "v1.0",      tags: ["integration","kafka","events"]            },
    { id: "FRD-K006", title: "Payment System Integration Guide",          project: "FRD", category: "Integration Docs", owner: "N. Garcia",   updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Integration",   version: "—",         tags: ["integration","payments"]                  },
    { id: "FRD-K007", title: "Test Coverage Report — Sprint 19",          project: "FRD", category: "Test Assets",      owner: "J. Martinez", updated: "Aug 22, 2026", updatedISO: "2026-08-22", status: "current", type: "Test Report",   version: "Sprint 19", tags: ["testing","coverage","sprint"]             },
    { id: "FRD-K008", title: "Fraud Detection Regression Suite",          project: "FRD", category: "Test Assets",      owner: "N. Garcia",   updated: "Aug 10, 2026", updatedISO: "2026-08-10", status: "current", type: "Test Assets",   version: "v2.1",      tags: ["testing","regression"]                    },
    { id: "FRD-K009", title: "Performance Benchmark Results Q2 2026",    project: "FRD", category: "Test Assets",      owner: "J. Martinez", updated: "Jul 5, 2026",  updatedISO: "2026-07-05", status: "stale",   type: "Benchmark",     version: "Q2 2026",   tags: ["testing","performance","benchmark"]        },
  ],
  MOB: [
    { id: "MOB-K001", title: "Merchant Onboarding Workflow Design v2.0", project: "MOB", category: "Workflow Docs",       owner: "C. Anderson", updated: "Jul 25, 2026", updatedISO: "2026-07-25", status: "current", type: "Design",       version: "v2.0", tags: ["workflow","onboarding","design"]          },
    { id: "MOB-K002", title: "KYC Verification Process Flow",            project: "MOB", category: "Workflow Docs",       owner: "C. Anderson", updated: "Aug 18, 2026", updatedISO: "2026-08-18", status: "current", type: "Process Flow", version: "v1.5", tags: ["workflow","kyc","process"]                },
    { id: "MOB-K003", title: "Merchant Activation Checklist",           project: "MOB", category: "Workflow Docs",       owner: "D. Wilson",   updated: "Aug 28, 2026", updatedISO: "2026-08-28", status: "current", type: "Checklist",    version: "v1.0", tags: ["workflow","activation","checklist"]        },
    { id: "MOB-K004", title: "Payment Method Integration Guide",        project: "MOB", category: "Integration Guides",  owner: "D. Wilson",   updated: "Aug 1, 2026",  updatedISO: "2026-08-01", status: "current", type: "Integration",  version: "v1.3", tags: ["integration","payments","guide"]          },
    { id: "MOB-K005", title: "KYC Provider API Guide",                  project: "MOB", category: "Integration Guides",  owner: "C. Anderson", updated: "Jul 22, 2026", updatedISO: "2026-07-22", status: "current", type: "Integration",  version: "v2.0", tags: ["integration","kyc","api"]                 },
    { id: "MOB-K006", title: "Data Mapping & Field Reference",          project: "MOB", category: "Integration Guides",  owner: "B. Taylor",   updated: "Aug 26, 2026", updatedISO: "2026-08-26", status: "current", type: "Reference",    version: "v1.1", tags: ["integration","data-mapping"]              },
    { id: "MOB-K007", title: "Onboarding Team Training Manual",         project: "MOB", category: "Training Material",   owner: "C. Anderson", updated: "Aug 20, 2026", updatedISO: "2026-08-20", status: "current", type: "Training",     version: "v1.0", tags: ["training","onboarding"]                   },
    { id: "MOB-K008", title: "Go-Live Preparation Guide",               project: "MOB", category: "Training Material",   owner: "D. Wilson",   updated: "Aug 28, 2026", updatedISO: "2026-08-28", status: "current", type: "Training",     version: "v0.8", tags: ["training","go-live"]                       },
    { id: "MOB-K009", title: "Support Escalation Procedures",           project: "MOB", category: "Training Material",   owner: "B. Taylor",   updated: "—",            updatedISO: "1970-01-01", status: "missing", type: "Runbook",      version: "—",    tags: ["training","support","escalation"]          },
  ],
};

// ─── Global helpers ───────────────────────────────────────────────────────────

function freshColor(pct: number): string {
  if (pct >= 85) return "#00a870";
  if (pct >= 70) return "#1434cb";
  if (pct >= 55) return "#946200";
  return "#d14343";
}

function freshTone(pct: number): "pass" | "brand" | "warn" | "fail" {
  return pct >= 85 ? "pass" : pct >= 70 ? "brand" : pct >= 55 ? "warn" : "fail";
}

// ─── Global visuals (unchanged) ──────────────────────────────────────────────

function FreshnessHeatmap() {
  const CELL_W = 72, CELL_H = 32, LABEL_W = 44, HEADER_H = 28;
  const projects = Object.keys(HEATMAP);
  const W = LABEL_W + HEATMAP_CATS.length * CELL_W + 8;
  const H = HEADER_H + projects.length * CELL_H + 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Knowledge freshness heatmap">
      {HEATMAP_CATS.map((cat, ci) => (
        <text key={cat} x={LABEL_W + ci * CELL_W + CELL_W / 2} y={HEADER_H - 8}
          textAnchor="middle" fontSize="9" fill="#94a3b8"
          fontFamily="'JetBrains Mono', monospace">{cat}</text>
      ))}
      {projects.map((proj, pi) => {
        const vals = HEATMAP[proj];
        const y = HEADER_H + pi * CELL_H;
        return (
          <Fragment key={proj}>
            <text x={LABEL_W - 5} y={y + CELL_H / 2 + 4} textAnchor="end"
              fontSize="9" fontWeight="bold" fill="#64748b"
              fontFamily="'JetBrains Mono', monospace">{proj}</text>
            {vals.map((v, ci) => {
              const x = LABEL_W + ci * CELL_W;
              const color = freshColor(v);
              return (
                <Fragment key={ci}>
                  <rect x={x + 2} y={y + 2} width={CELL_W - 4} height={CELL_H - 4} rx="4" fill={color} opacity="0.15" />
                  <rect x={x + 2} y={y + 2} width={CELL_W - 4} height={CELL_H - 4} rx="4" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
                  <text x={x + CELL_W / 2} y={y + CELL_H / 2 + 4} textAnchor="middle"
                    fontSize="10" fontWeight="bold" fill={color}
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

function ContentDistChart() {
  const W = 300, H = 150;
  const PAD = { top: 12, right: 12, bottom: 28, left: 30 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const projects = Object.keys(DIST_DATA);
  const barW = iw / projects.length;
  const maxTotal = Math.max(...projects.map(p => DIST_DATA[p].reduce((s, v) => s + v, 0)));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Content distribution">
        {[0, 10, 20, 30].map(t => {
          const y = PAD.top + ih - (t / maxTotal) * ih;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize="8"
                fill="#94a3b8" fontFamily="'JetBrains Mono', monospace">{t}</text>
            </g>
          );
        })}
        {projects.map((proj, pi) => {
          const vals = DIST_DATA[proj];
          let stackY = PAD.top + ih;
          const x = PAD.left + pi * barW + barW * 0.15;
          const bw = barW * 0.7;
          return (
            <Fragment key={proj}>
              {vals.map((v, ci) => {
                const bh = (v / maxTotal) * ih;
                stackY -= bh;
                return <rect key={ci} x={x} y={stackY} width={bw} height={bh} fill={DIST_COLORS[ci]} opacity="0.82" />;
              })}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="9"
                fontWeight="bold" fill="#64748b"
                fontFamily="'JetBrains Mono', monospace">{proj}</text>
            </Fragment>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {DIST_CATS.map((c, i) => (
          <div key={c} className="flex items-center gap-1">
            <div className="size-2 rounded-sm" style={{ backgroundColor: DIST_COLORS[i] }} />
            <span className="text-[10px] text-gray-500">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Global KB section tabs ───────────────────────────────────────────────────

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: "overview",     label: "Program Overview",        icon: "M4 6h12M4 10h12M4 14h8" },
  { key: "architecture", label: "Architecture Repository", icon: "M3 14l4-5 3 3 4-6 3 4" },
  { key: "adrs",         label: "Decisions & ADRs",        icon: "M10 3v14M5 7h5m0 0h5M5 11h5m0 0h5" },
  { key: "release",      label: "Release Artifacts",       icon: "M4 7h12v10H4zM8 7V4h4v3M7 11h6M7 13h4" },
  { key: "runbooks",     label: "Operational Runbooks",    icon: "M4 5h3v3H4zM4 11h3v3H4zM9 6h7M9 12h7" },
  { key: "compliance",   label: "Compliance Documents",    icon: "M9 3H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM9 3v4h4" },
];

function SectionContent({ sectionKey }: { sectionKey: SectionKey }) {
  const docs = DOCS[sectionKey];
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-ink-700">
          <th className="col-label px-5 py-3 text-left">ID</th>
          <th className="col-label px-5 py-3 text-left">Document Title</th>
          <th className="col-label px-4 py-3 text-left">Project</th>
          <th className="col-label px-4 py-3 text-left">Owner</th>
          <th className="col-label px-4 py-3 text-left">Type</th>
          <th className="col-label px-4 py-3 text-left">Last Updated</th>
          <th className="col-label px-4 py-3 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((doc, i) => (
          <tr key={doc.id}
            className={`${i < docs.length - 1 ? "border-b border-ink-700" : ""} transition-colors hover:bg-ink-750/50`}>
            <td className="px-5 py-3.5"><span className="font-mono text-[11px] text-gray-500">{doc.id}</span></td>
            <td className="px-5 py-3.5">
              <span className={`text-[13px] font-medium ${doc.status === "missing" ? "italic text-gray-500" : "text-gray-100"}`}>
                {doc.title}
              </span>
            </td>
            <td className="px-4 py-3.5">
              {doc.project === "ALL" ? (
                <span className="font-mono text-[11px] text-gray-500">All</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: PROJECT_COLOR[doc.project] }} />
                  <span className="font-mono text-[11px] font-bold text-gray-300">{doc.project}</span>
                </div>
              )}
            </td>
            <td className="px-4 py-3.5"><span className="text-[12px] text-gray-400">{doc.owner}</span></td>
            <td className="px-4 py-3.5"><Badge tone="idle">{doc.type}</Badge></td>
            <td className="px-4 py-3.5">
              <span className={`font-mono text-[12px] ${doc.status === "missing" ? "text-gray-600" : "text-gray-300"}`}>
                {doc.updated}
              </span>
            </td>
            <td className="px-4 py-3.5">
              <Pill tone={DOC_STATUS_TONE[doc.status]} dot>{DOC_STATUS_LABEL[doc.status]}</Pill>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconDocs    = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.4"><path d="M3 2h6l3 3v8H3V2z" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 2v3h3M5 7h4M5 9.5h3" strokeLinecap="round" /></svg>;
const IconHealth  = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M1 7h2l2-4 2 8 2-5 1 1h3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconWarn    = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M7 1.5L13 12.5H1L7 1.5z" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 5.5v3M7 10v.5" strokeLinecap="round" /></svg>;
const IconGap     = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v3M7 9v.5" strokeLinecap="round" /></svg>;
const IconReuse   = () => <svg viewBox="0 0 14 14" fill="none" className="size-3.5" stroke="currentColor" strokeWidth="1.5"><path d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3" strokeLinecap="round" /><path d="M11 4l1 2-2 0M3 10l-1-2 2 0" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IconChevron = ({ dir = "right" }: { dir?: "left" | "right" }) => (
  <svg viewBox="0 0 8 14" fill="none" className="size-3 shrink-0" stroke="currentColor" strokeWidth="1.5">
    {dir === "right"
      ? <path d="M1 1l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M7 1L1 7l6 6" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 14 14" fill="none" className="size-3 shrink-0" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 1v8M4 6l3 3 3-3M2 11h10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 14 14" fill="none" className="size-3 shrink-0" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" strokeLinecap="round" />
    <circle cx="7" cy="7" r="1.5" />
  </svg>
);

// ─── Breadcrumbs (Phase 4) ────────────────────────────────────────────────────

function GlobalBreadcrumb({ onHome }: { onHome: () => void }) {
  return (
    <nav className="flex items-center gap-2 border-b border-ink-700 bg-ink-800/60 px-6 py-3" aria-label="Breadcrumb">
      <button onClick={onHome} className="text-[12px] text-gray-500 transition-colors hover:text-gray-300">
        Knowledge Management
      </button>
      <IconChevron dir="right" />
      <span className="text-[12px] font-semibold text-gray-200">KnowledgeBase</span>
    </nav>
  );
}

function ProjectBreadcrumb({ projectName, onHome, onHealth }: {
  projectName: string;
  onHome: () => void;
  onHealth: () => void;
}) {
  return (
    <nav className="flex items-center gap-2 border-b border-ink-700 bg-ink-800/60 px-6 py-3" aria-label="Breadcrumb">
      <button onClick={onHome} className="text-[12px] text-gray-500 transition-colors hover:text-gray-300">
        Knowledge Management
      </button>
      <IconChevron dir="right" />
      <button onClick={onHealth} className="text-[12px] text-gray-500 transition-colors hover:text-gray-300">
        Portfolio Health
      </button>
      <IconChevron dir="right" />
      <span className="text-[12px] text-gray-500">{projectName}</span>
      <IconChevron dir="right" />
      <span className="text-[12px] font-semibold text-gray-200">KnowledgeBase</span>
      <button
        onClick={onHealth}
        className="ml-auto flex items-center gap-1.5 rounded-[8px] border border-ink-700 px-3 py-1.5 text-[12px] text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
      >
        <IconChevron dir="left" />
        Back to Portfolio Health
      </button>
    </nav>
  );
}

// ─── Project KB row (Phase 5) ─────────────────────────────────────────────────

function ProjectKBRow({ doc }: { doc: ProjectKBDoc }) {
  return (
    <tr className="border-b border-ink-700 transition-colors hover:bg-ink-750/50 last:border-0">
      <td className="px-4 py-3">
        <span className="font-mono text-[11px] text-gray-500">{doc.id}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[13px] font-medium ${doc.status === "missing" ? "italic text-gray-500" : "text-gray-100"}`}>
          {doc.title}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-[6px] border border-ink-700 bg-ink-750 px-2 py-0.5 font-mono text-[11px] text-gray-400">
          {doc.category}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[12px] text-gray-400">{doc.owner}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-[12px] text-gray-300">{doc.version}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`font-mono text-[12px] ${doc.status === "missing" ? "text-gray-600" : "text-gray-400"}`}>
          {doc.updated}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-full bg-ink-750 border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <Pill tone={DOC_STATUS_TONE[doc.status]} dot>{DOC_STATUS_LABEL[doc.status]}</Pill>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="View document — not built yet"
            className="flex cursor-not-allowed items-center gap-1 rounded-[6px] border border-ink-700 bg-ink-750 px-2 py-1 text-[11px] text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
          >
            <IconEye /> View
          </button>
          <button
            type="button"
            title="Download — not built yet"
            className="flex cursor-not-allowed items-center gap-1 rounded-[6px] border border-ink-700 bg-ink-750 px-2 py-1 text-[11px] text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
          >
            <IconDownload />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Project KB section (Phases 3 & 5) ───────────────────────────────────────

function ProjectKBSection({ projectCode }: { projectCode: string }) {
  const [search, setSearch]               = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");

  const allDocs   = PROJECT_KB[projectCode] ?? [];
  const categories = [...new Set(allDocs.map(d => d.category))];

  const filtered = allDocs.filter(d => {
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
    if (statusFilter   !== "all" && d.status   !== statusFilter)   return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.owner.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.tags.some(t => t.includes(q))
      );
    }
    return true;
  });

  const total   = allDocs.length;
  const current = allDocs.filter(d => d.status === "current").length;
  const stale   = allDocs.filter(d => d.status === "stale").length;
  const missing = allDocs.filter(d => d.status === "missing").length;

  return (
    <section>
      <SectionTitle>Knowledge Repository</SectionTitle>

      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-4 gap-4">
        <StatCard label="Total Documents"  value={total}   tone="brand" icon={<IconDocs />} />
        <StatCard label="Current"          value={current} tone="pass"  icon={<IconDocs />} />
        <StatCard label="Stale"            value={stale}   tone="warn"  icon={<IconWarn />} />
        <StatCard label="Knowledge Gaps"   value={missing} tone="fail"  icon={<IconGap />} />
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
            placeholder="Search documents, tags, owners…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-72 rounded-[10px] border border-ink-700 bg-white py-2 pl-9 pr-4 text-[13px] text-gray-200 placeholder-gray-600 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
          />
        </div>
        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-ink-700 bg-ink-800 px-3 py-2 text-[13px] text-gray-300 outline-none focus:border-accent"
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-ink-700 bg-ink-800 px-3 py-2 text-[13px] text-gray-300 outline-none focus:border-accent"
        >
          <option value="all">All Statuses</option>
          <option value="current">Current</option>
          <option value="stale">Stale</option>
          <option value="missing">Missing</option>
        </select>
        <span className="ml-auto font-mono text-[12px] text-gray-500">{filtered.length} of {total}</span>
      </div>

      {/* Table */}
      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink-700">
              <th className="col-label px-4 py-3 text-left">ID</th>
              <th className="col-label px-4 py-3 text-left">Document Title</th>
              <th className="col-label px-4 py-3 text-left">Category</th>
              <th className="col-label px-4 py-3 text-left">Owner</th>
              <th className="col-label px-4 py-3 text-left">Version</th>
              <th className="col-label px-4 py-3 text-left">Last Updated</th>
              <th className="col-label px-4 py-3 text-left">Tags</th>
              <th className="col-label px-4 py-3 text-left">Status</th>
              <th className="col-label px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center font-mono text-[13px] text-gray-600">
                  No documents match the current filters
                </td>
              </tr>
            ) : (
              filtered.map(doc => <ProjectKBRow key={doc.id} doc={doc} />)
            )}
          </tbody>
        </table>
      </Card>

      {/* Category breakdown cards */}
      <div className="mt-6">
        <SectionTitle>By Category</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map(cat => {
            const catDocs = allDocs.filter(d => d.category === cat);
            const catCur  = catDocs.filter(d => d.status === "current").length;
            const catMis  = catDocs.filter(d => d.status === "missing").length;
            const health  = catDocs.length > 0 ? Math.round((catCur / catDocs.length) * 100) : 0;
            return (
              <Card key={cat} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-gray-100">{cat}</span>
                  <span className="font-mono text-[12px] font-bold text-gray-200">{catDocs.length} docs</span>
                </div>
                <Progress value={health} tone={freshTone(health)} className="mt-2" />
                <div className="mt-2 flex gap-3 text-[11px]">
                  <span className="text-state-pass">{catCur} current</span>
                  {catMis > 0 && <span className="text-state-fail">{catMis} missing</span>}
                  <span className="ml-auto font-mono font-bold" style={{ color: freshColor(health) }}>{health}%</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramManagerKnowledgeBase() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [section, setSection] = useState<SectionKey>("overview");

  const state = location.state as { selectedProject?: string; fromHealth?: boolean } | null;
  const selectedProject = state?.selectedProject;

  const totalDocs   = ALL_DOCS.length;
  const currentDocs = ALL_DOCS.filter(d => d.status === "current").length;
  const staleDocs   = ALL_DOCS.filter(d => d.status === "stale").length;
  const missingDocs = ALL_DOCS.filter(d => d.status === "missing").length;
  const healthScore = Math.round((currentDocs / (totalDocs - missingDocs)) * 100);

  const recentlyUpdated = [...ALL_DOCS]
    .filter(d => d.status === "current")
    .sort((a, b) => b.updatedISO.localeCompare(a.updatedISO))
    .slice(0, 5);

  // ── Project-specific view (Mode B) ────────────────────────────────────────
  if (selectedProject) {
    const projectName = PROJECT_NAMES[selectedProject] ?? selectedProject;
    return (
      <>
        <PageMeta title={`KnowledgeBase — ${projectName}`} />
        <div className="min-h-screen pb-12">
          <ProjectBreadcrumb
            projectName={projectName}
            onHome={() => navigate("/knowledge-management")}
            onHealth={() => navigate("/pm-health")}
          />
          <PageHead
            kicker="Program Manager"
            title="KnowledgeBase"
            blurb={`${projectName} · Documentation, architecture, runbooks and knowledge assets`}
            right={
              <div className="flex gap-2">
                <MockButton variant="solid">Export Index</MockButton>
                <MockButton variant="solid">Add Document</MockButton>
              </div>
            }
          />
          <div className="space-y-7 px-6 pt-6">
            <ProjectKBSection projectCode={selectedProject} />
          </div>
        </div>
      </>
    );
  }

  // ── Global view (Mode A) ──────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="KnowledgeBase" />
      <div className="min-h-screen pb-12">

        <GlobalBreadcrumb onHome={() => navigate("/knowledge-management")} />

        <PageHead
          kicker="Program Manager"
          title="KnowledgeBase"
          blurb="Program-level knowledge assets across PAY · CSP · FRD · MOB"
          right={
            <div className="flex gap-2">
              <MockButton variant="solid">Export Index</MockButton>
              <MockButton variant="solid">Add Document</MockButton>
            </div>
          }
        />

        <div className="space-y-7 px-6 pt-6">

          {/* ── 1. Portfolio Insights ────────────────────────────────────── */}
          <section>
            <SectionTitle>Portfolio Knowledge Insights</SectionTitle>
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="Documentation Health"
                value={healthScore} unit="%"
                tone={freshTone(healthScore)}
                progress={healthScore}
                icon={<IconHealth />}
              />
              <StatCard label="Total Documents"  value={totalDocs}   tone="brand" icon={<IconDocs />} />
              <StatCard label="Current"          value={currentDocs} tone="pass"  icon={<IconDocs />} />
              <StatCard label="Stale Documents"  value={staleDocs}   tone="warn"  icon={<IconWarn />}
                note="Older than 90 days without review" />
              <StatCard label="Knowledge Gaps"   value={missingDocs} tone="fail"  icon={<IconGap />}
                note="Documents identified as missing" />
            </div>
          </section>

          {/* ── 2. Widget Row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 items-stretch gap-3">
            {/* Col 1 — By Project */}
            <div className="flex flex-col">
              <SectionTitle>By Project</SectionTitle>
              <Card className="flex-1 divide-y divide-ink-700">
                {PROJECT_STATS.map(p => (
                  <div key={p.code} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: PROJECT_COLOR[p.code] }} />
                        <span className="font-mono text-[11px] font-bold text-gray-200">{p.code}</span>
                        <span className="text-[12px] text-gray-400">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-bold text-gray-200">{p.total}</span>
                        <button
                          onClick={() => navigate("/pm-knowledge", { state: { selectedProject: p.code } })}
                          className="rounded-[6px] border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent transition-colors hover:border-accent"
                        >
                          View →
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between">
                          <span className="text-[10px] text-gray-500">Freshness</span>
                          <span className="font-mono text-[10px]" style={{ color: freshColor(p.freshness) }}>{p.freshness}%</span>
                        </div>
                        <Progress value={p.freshness} tone={freshTone(p.freshness)} />
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between">
                          <span className="text-[10px] text-gray-500">Coverage</span>
                          <span className="font-mono text-[10px]" style={{ color: freshColor(p.coverage) }}>{p.coverage}%</span>
                        </div>
                        <Progress value={p.coverage} tone={freshTone(p.coverage)} />
                      </div>
                    </div>
                    <div className="mt-2 flex gap-3 text-[11px] text-gray-500">
                      <span className="text-state-pass">{p.current} current</span>
                      <span className="text-state-warn">{p.stale} stale</span>
                      <span className="text-state-fail">{p.missing} missing</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Col 2 — Missing Documentation (stretches to fill column) */}
            <div className="flex flex-col">
              <SectionTitle aside={`${missingDocs} gaps`}>Missing Documentation</SectionTitle>
              <Card className="flex-1 divide-y divide-ink-700">
                {ALL_DOCS.filter(d => d.status === "missing").map(doc => (
                  <div key={doc.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] text-state-fail">{doc.id}</span>
                      {doc.project !== "ALL" && (
                        <div className="flex items-center gap-1">
                          <div className="size-1.5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[doc.project] }} />
                          <span className="font-mono text-[10px] text-gray-500">{doc.project}</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] italic leading-snug text-gray-400">{doc.title}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{doc.owner} · {doc.type}</p>
                    <button type="button" title="Not built yet"
                      className="mt-1.5 cursor-not-allowed rounded-[6px] border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                      Assign Author
                    </button>
                  </div>
                ))}
              </Card>
            </div>

            {/* Col 3 — Recently Updated + Reuse Opportunities (Reuse grows to fill) */}
            <div className="flex flex-col gap-3">
              <div>
                <SectionTitle>Recently Updated</SectionTitle>
                <Card className="divide-y divide-ink-700">
                  {recentlyUpdated.map(doc => (
                    <div key={doc.id} className="flex items-start gap-3 px-4 py-2.5">
                      <div className="mt-0.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: doc.project === "ALL" ? "#94a3b8" : PROJECT_COLOR[doc.project] }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium leading-snug text-gray-100">{doc.title}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">{doc.owner}</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-gray-500">
                        {doc.updated.replace(", 2026","")}
                      </span>
                    </div>
                  ))}
                </Card>
              </div>

              <div className="flex flex-1 flex-col">
                <SectionTitle aside={`${REUSE_ITEMS.length} opportunities`}>Reuse Opportunities</SectionTitle>
                <Card className="flex-1 divide-y divide-ink-700">
                  {REUSE_ITEMS.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <IconReuse />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-gray-100">{r.title}</p>
                        <p className="text-[11px] text-gray-500">{r.projects.join(" · ")}</p>
                      </div>
                      <Badge tone="brand">{r.saving}</Badge>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>

          {/* ── 3. Knowledge Sections ────────────────────────────────────── */}
          <section>
            <SectionTitle>Knowledge Repository</SectionTitle>
            <div className="mb-3 flex flex-wrap gap-1 rounded-[10px] border border-ink-700 bg-white p-1 w-fit">
              {SECTIONS.map(s => (
                <button key={s.key} onClick={() => setSection(s.key)}
                  className={`flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors
                    ${section === s.key ? "bg-nav-bottom text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="size-3.5 shrink-0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.icon} />
                  </svg>
                  {s.label}
                </button>
              ))}
            </div>
            {(() => {
              const docs = DOCS[section];
              const cur = docs.filter(d => d.status === "current").length;
              const stl = docs.filter(d => d.status === "stale").length;
              const mis = docs.filter(d => d.status === "missing").length;
              return (
                <div className="mb-3 flex items-center gap-4 px-1 text-[12px] text-gray-500">
                  <span><span className="font-bold text-gray-200">{docs.length}</span> documents</span>
                  <span className="text-state-pass">{cur} current</span>
                  <span className="text-state-warn">{stl} stale</span>
                  <span className="text-state-fail">{mis} missing</span>
                </div>
              );
            })()}
            <Card><SectionContent sectionKey={section} /></Card>
          </section>

          {/* ── 4. Visuals ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3">
              <SectionTitle aside="% freshness by project × category">Freshness Heatmap</SectionTitle>
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-1">
                  <span className="mr-2 text-[10px] text-gray-500">Freshness:</span>
                  {[
                    { label: "≥85%", color: "#00a870" },
                    { label: "≥70%", color: "#1434cb" },
                    { label: "≥55%", color: "#946200" },
                    { label: "<55%", color: "#d14343" },
                  ].map(l => (
                    <div key={l.label} className="mr-3 flex items-center gap-1">
                      <div className="size-2.5 rounded-sm" style={{ backgroundColor: l.color, opacity: 0.6 }} />
                      <span className="text-[10px] text-gray-500">{l.label}</span>
                    </div>
                  ))}
                </div>
                <FreshnessHeatmap />
              </Card>
            </div>
            <div className="col-span-2">
              <SectionTitle aside="docs by type per project">Content Distribution</SectionTitle>
              <Card className="p-5">
                <ContentDistChart />
                <div className="mt-4 space-y-1.5 border-t border-ink-700 pt-3">
                  {PROJECT_STATS.map(p => (
                    <div key={p.code} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full" style={{ backgroundColor: PROJECT_COLOR[p.code] }} />
                        <span className="text-gray-400">{p.code}</span>
                      </div>
                      <div className="flex gap-3 text-[11px]">
                        <span className="font-mono font-bold text-gray-200">{p.total}</span>
                        <span className="text-state-pass">{p.current}✓</span>
                        <span className="text-state-warn">{p.stale}~</span>
                        <span className="text-state-fail">{p.missing}✗</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
