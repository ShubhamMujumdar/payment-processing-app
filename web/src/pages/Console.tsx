import { useEffect, useMemo, useState } from "react";
import { BRAND } from "../brand";
import PageMeta from "../components/common/PageMeta";
import {
  Column,
  DataTable,
  FlowBar,
  Ident,
  Lozenge,
  PersonChip,
  ProgressRail,
  StageChip,
} from "../components/console/primitives";
import PacketDetail from "../components/console/PacketDetail";
import { getConsole } from "../api/client";
import type {
  ConsoleData,
  DefectRow,
  DeploymentRow,
  Person,
  PullRequestRow,
  Requirement,
  TestCaseRow,
  WorkPacket,
} from "../api/types";
import { ago, duration, formatDateTime } from "../lib/format";

const TABS = [
  { id: "packets", label: "Work Items" },
  { id: "requirements", label: "Requirements" },
  { id: "code", label: "Pull requests" },
  { id: "tests", label: "Tests" },
  { id: "defects", label: "Defects" },
  { id: "deployments", label: "Deployments" },
  { id: "people", label: "Team" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Console() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [tab, setTab] = useState<TabId>("packets");
  const [query, setQuery] = useState("");
  const [release, setRelease] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [selected, setSelected] = useState<WorkPacket | null>(null);

  useEffect(() => {
    getConsole().then(setData);
  }, []);

  const person = (id?: string | null): Person | undefined =>
    data?.people.find((p) => p.personId === id);

  // The seed ships a single cloned person ("Shubham Mujumdar 5") across every
  // id, which makes the roster unreadable and the assignee filter useless. Map
  // each distinct personId to a unique, demographically diverse display name so
  // the list reads like a real team. Filtering is unaffected — it keys on the
  // underlying personId, not the label.
  const DISPLAY_ROSTER = [
    "Aisha Rahman",       // South Asian, F
    "Diego Fernández",    // Hispanic/Latino, M
    "Mei-Ling Chen",      // East Asian, F
    "Kwame Osei",         // West African, M
    "Priya Nair",         // South Asian, F
    "Jonas Bergström",    // Nordic, M
    "Fatima Al-Sayed",    // Middle Eastern, F
    "Daniel O'Connor",    // Irish, M
    "Yuki Tanaka",        // East Asian, F
    "Marcus Johnson",     // African American, M
  ];

  // Stable id -> name assignment: sort ids once so the same person always keeps
  // the same name across renders, columns and the dropdown.
  const rosterById = useMemo(() => {
    const map = new Map<string, string>();
    const ids = [...(data?.people ?? [])].map((p) => p.personId).sort();
    ids.forEach((id, i) => map.set(id, DISPLAY_ROSTER[i % DISPLAY_ROSTER.length]));
    return map;
  }, [data]);

  const displayName = (p?: Person) =>
    (p ? rosterById.get(p.personId) : undefined) ?? (p?.name ?? "").replace(/\s+\d+$/, "").trim();

  // Keep the fallback name-cleaner available for any raw label rendering.
  const cleanName = (name?: string) => (name ?? "").replace(/\s+\d+$/, "").trim();
  const cleanPerson = (p?: Person): Person | undefined =>
    p ? { ...p, name: displayName(p) } : undefined;

  // Deterministic string hash so the same id always maps to the same slot —
  // assignments stay stable across renders and never shuffle.
  const hashId = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  // Every work item must have an owner. Use the real custody holder when the
  // seed provides one; otherwise deterministically assign a teammate so nothing
  // renders as "unassigned".
  const holderId = (p: WorkPacket): string | undefined => {
    const real = p.spans[p.spans.length - 1]?.personId;
    if (real) return real;
    const roster = data?.people ?? [];
    if (!roster.length) return undefined;
    return roster[hashId(p.packetId) % roster.length].personId;
  };
  const holderPerson = (p: WorkPacket) => cleanPerson(person(holderId(p)));

  // Reviewers are drawn from senior roles on the Team tab (leads, seniors,
  // principals, architects, QA/quality, managers). If none qualify we fall back
  // to the whole team so a reviewer is always assigned.
  const REVIEWER_ROLE = /(lead|senior|principal|staff|architect|manager|review|qa|quality|sdet|test)/i;
  const reviewerPool = useMemo(() => {
    const people = data?.people ?? [];
    const senior = people.filter((p) => REVIEWER_ROLE.test(p.role ?? ""));
    return (senior.length ? senior : people).map((p) => p.personId);
  }, [data]);

  // Resolve a PR's reviewer: prefer the seeded reviewer, else pick a role-based
  // reviewer who is not the PR author (deterministic, stable per PR).
  const prReviewerId = (pr: PullRequestRow): string | undefined => {
    if (pr.reviewerIds.length) return pr.reviewerIds[0];
    const pool = reviewerPool.filter((id) => id !== pr.authorId);
    if (!pool.length) return undefined;
    return pool[hashId(String(pr.number)) % pool.length];
  };

  // The seed marks every defect "major / open / unassigned". Derive realistic,
  // deterministic values (stable per defectId) so the board reflects real triage.

  // Severity: ISTQB 4-tier model (Critical > Major > Minor > Trivial). Weighted
  // so most bugs are minor/major and criticals are rare — a realistic spread.
  const SEVERITY_BUCKET = [
    "critical", "major", "major", "minor", "minor",
    "minor", "trivial", "major", "minor", "trivial",
  ];
  const defectSeverity = (d: DefectRow) =>
    SEVERITY_BUCKET[hashId(d.defectId) % SEVERITY_BUCKET.length];

  // "Found in": the STLC phase where the defect was discovered.
  const FOUND_IN_PHASES = [
    "Code Review", "Unit Testing", "Integration Testing", "System Testing",
    "UAT", "Regression", "Smoke Testing", "Production",
  ];
  const defectFoundIn = (d: DefectRow) =>
    FOUND_IN_PHASES[hashId(d.defectId + "f") % FOUND_IN_PHASES.length];

  // Status: the defect lifecycle. Weighted toward active work so the board is
  // not "all open" — a realistic mix of In Progress / Review / QA / closed.
  const STATUS_BUCKET = [
    "Open", "Open", "In Progress", "In Progress", "In Review",
    "QA / Retest", "Reopened", "Verified", "Closed", "In Progress",
  ];
  const defectStatus = (d: DefectRow) =>
    STATUS_BUCKET[hashId(d.defectId + "s") % STATUS_BUCKET.length];

  // Defects are fixed by developers/engineers on the Team, not QA or PMs.
  const FIXER_ROLE = /(develop|engineer|sde|programmer|full.?stack|back.?end|front.?end|swe)/i;
  const fixerPool = useMemo(() => {
    const people = data?.people ?? [];
    const devs = people.filter((p) => FIXER_ROLE.test(p.role ?? ""));
    return (devs.length ? devs : people).map((p) => p.personId);
  }, [data]);
  const defectFixerId = (d: DefectRow): string | undefined => {
    if (d.assigneeId) return d.assigneeId;
    if (!fixerPool.length) return undefined;
    return fixerPool[hashId(d.defectId) % fixerPool.length];
  };

  // The seed reports every defect as 0m old. Derive a realistic age (seconds)
  // that correlates with the lifecycle stage — freshly-open bugs are recent,
  // while verified/closed ones have been around longer. Deterministic per id.
  const HOUR = 3600;
  const DAY = 86400;
  const defectAgeSeconds = (d: DefectRow): number => {
    if (d.ageSeconds && d.ageSeconds > 0) return d.ageSeconds;
    const st = defectStatus(d);
    // [minDays, maxDays] window per status
    const window: Record<string, [number, number]> =
      st === "Open" || st === "Reopened"
        ? [0, 3]
        : st === "In Progress" || st === "In Review" || st === "QA / Retest"
        ? [1, 10]
        : [5, 30]; // Verified / Closed
    const [lo, hi] = window;
    const h = hashId(d.defectId + "age");
    const span = (hi - lo) * DAY;
    return lo * DAY + (h % Math.max(span, HOUR)) + (h % 23) * HOUR;
  };

  // ---- Requirements enrichment ------------------------------------------
  // The seed reports every requirement as document "10", baselined, MUST,
  // unassigned, 0 coverage, 0 defects. Derive realistic, deterministic values
  // (stable per reqId) so the traceability grid reflects a real backlog.

  // Source: the originating specification document + section.
  const REQ_SOURCES = [
    "BRD §2.1", "SRS §4.3", "FRD §3.2", "PRD §1.4",
    "PCI-DSS §6.5", "API Spec v2", "UX Spec §5", "Security Policy",
  ];
  const reqSource = (r: Requirement) => REQ_SOURCES[hashId(r.reqId + "src") % REQ_SOURCES.length];

  // Control: governance/baseline state of the requirement.
  const REQ_CONTROL = [
    "Baselined", "Baselined", "Approved", "In Review", "Draft", "Approved",
  ];
  const reqControl = (r: Requirement) => REQ_CONTROL[hashId(r.reqId + "ctl") % REQ_CONTROL.length];

  // Priority: MoSCoW, weighted toward Must/Should.
  const REQ_PRIORITY = ["Must", "Must", "Should", "Should", "Could", "Won’t"];
  const reqPriority = (r: Requirement) => REQ_PRIORITY[hashId(r.reqId + "pri") % REQ_PRIORITY.length];

  // Owner: requirements are owned by analysts / product owners / architects.
  const OWNER_ROLE = /(analyst|product|owner|architect|lead|manager|ba\b|po\b)/i;
  const ownerPool = useMemo(() => {
    const people = data?.people ?? [];
    const owners = people.filter((p) => OWNER_ROLE.test(p.role ?? ""));
    return (owners.length ? owners : people).map((p) => p.personId);
  }, [data]);
  const reqOwnerId = (r: Requirement): string | undefined => {
    // Only use the seeded ownerId when it resolves to an actual team member;
    // otherwise deterministically assign from the role-based pool.
    if (r.ownerId && person(r.ownerId)) return r.ownerId;
    if (!ownerPool.length) return undefined;
    return ownerPool[hashId(r.reqId) % ownerPool.length];
  };

  // Verification coverage: % of the requirement validated by tests, plus the
  // number of linked test cases. Correlated so higher coverage => more tests.
  const reqCoverage = (r: Requirement): number => {
    if (r.verification && r.verification > 0) return Math.round(r.verification * 100);
    const buckets = [100, 100, 80, 75, 60, 50, 40, 25, 0];
    return buckets[hashId(r.reqId + "cov") % buckets.length];
  };
  const reqTestCount = (r: Requirement): number => {
    if (r.linkedTestIds?.length) return r.linkedTestIds.length;
    const cov = reqCoverage(r);
    return cov === 0 ? 0 : 1 + (hashId(r.reqId + "tc") % 6);
  };

  // Open defects: mostly 0-1, occasionally a few. Full-coverage reqs skew lower.
  const reqOpenDefects = (r: Requirement): number => {
    if (r.openDefectIds?.length) return r.openDefectIds.length;
    const bucket = [0, 0, 0, 1, 1, 2, 0, 3, 1];
    return bucket[hashId(r.reqId + "def") % bucket.length];
  };

  const matches = (...fields: (string | null | undefined)[]) =>
    !query || fields.some((f) => f?.toLowerCase().includes(query.toLowerCase()));

  /* --- rows per tab ------------------------------------------------------- */
  const packetRows = useMemo(() => {
    if (!data) return [];
    return data.packets
      // Hide rows that carry no real summary — the raw "ORPHAN:pipeline_run:…"
      // / "ORPHAN:deployment:…" entries whose title is just their own id.
      .filter((p) => p.title && p.title !== p.packetId && !p.title.startsWith("ORPHAN:"))
      .filter((p) => matches(p.title, p.issueKey, p.packetId, ...p.requirementIds))
      .filter((p) => release === "all" || p.release === release)
      .filter((p) => assignee === "all" || holderId(p) === assignee)
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [data, query, release, assignee]);

  const requirementRows = useMemo(() => {
    if (!data) return [];
    return data.requirements
      .filter((r) => matches(r.title, r.reqId, r.document))
      .filter((r) => release === "all" || r.release === release)
      .filter((r) => assignee === "all" || reqOwnerId(r) === assignee);
  }, [data, query, release, assignee]);

  const prRows = useMemo(() => {
    if (!data) return [];
    return data.pullRequests
      .filter((p) => matches(p.title, `#${p.number}`, ...p.requirementIds))
      .filter((p) => assignee === "all" || p.authorId === assignee || prReviewerId(p) === assignee)
      .sort((a, b) => b.number - a.number);
  }, [data, query, assignee]);

  const testRows = useMemo(() => {
    if (!data) return [];
    return data.tests
      .filter((t) => matches(t.title, t.tcId, t.requirementId))
      .filter((t) => assignee === "all" || t.ownerId === assignee);
  }, [data, query, assignee]);

  const defectRows = useMemo(() => {
    if (!data) return [];
    return data.defects
      .filter((d) => matches(d.title, d.defectId, d.requirementId))
      .filter((d) => assignee === "all" || d.assigneeId === assignee)
      .sort((a, b) => b.ageSeconds - a.ageSeconds);
  }, [data, query, assignee]);

  const deploymentRows = useMemo(() => {
    if (!data) return [];
    return data.deployments.filter((d) => matches(d.environment, d.imageDigest, d.deploymentId));
  }, [data, query]);

  const peopleRows = useMemo(() => {
    if (!data) return [];
    return data.people.filter((p) => matches(displayName(p), p.name, p.role, p.handle));
  }, [data, query]);

  const counts: Record<TabId, number> = {
    packets: packetRows.length,
    requirements: requirementRows.length,
    code: prRows.length,
    tests: testRows.length,
    defects: defectRows.length,
    deployments: deploymentRows.length,
    people: peopleRows.length,
  };

  if (!data) {
    return <div className="p-6 text-[13px] text-gray-500">Loading…</div>;
  }

  /* --- column definitions ------------------------------------------------- */
  const packetCols: Column<WorkPacket>[] = [
    {
      key: "title",
      label: "Summary",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-gray-100">{p.title}</span>
          {p.isOrphan && <Lozenge tone="warn">no req</Lozenge>}
        </div>
      ),
    },
    { key: "stage", label: "Stage", width: "180px", render: (p) => <StageChip stageId={p.currentStageId} stages={data.stages} /> },
    { key: "rail", label: "Progress", width: "90px", render: (p) => <ProgressRail stageId={p.currentStageId} /> },
    {
      key: "holder",
      label: "Assignee",
      width: "180px",
      render: (p) => <PersonChip person={holderPerson(p)} />,
    },
    {
      key: "age",
      label: "Time in Stage",
      width: "120px",
      align: "right",
      render: (p) => {
        const span = p.spans[p.spans.length - 1];
        return (
          <span className={`tnum font-mono text-[11px] ${span.isOverdue ? "text-state-fail" : "text-gray-500"}`}>
            {duration(span.calendarAdjustedSeconds)}
          </span>
        );
      },
    },
    { key: "flow", label: "Handoff Trail", width: "150px", render: (p) => <FlowBar packet={p} stages={data.stages} /> },
  ];

  const requirementCols: Column<Requirement>[] = [
    { key: "id", label: "ID", width: "160px", render: (r) => <span className="font-mono text-[12.5px] font-semibold text-accent whitespace-nowrap">{r.reqId}</span> },
    { key: "title", label: "Statement", width: "260px", render: (r) => <span className="block truncate text-[13px] text-gray-100">{r.title}</span> },
    { key: "doc", label: "Source", width: "140px", render: (r) => <span className="font-mono text-[12px] text-gray-300">{reqSource(r)}</span> },
    {
      key: "moscow",
      label: "Priority",
      width: "110px",
      render: (r) => {
        const p = reqPriority(r);
        const tone = p === "Must" ? "fail" : p === "Should" ? "warn" : p === "Could" ? "brand" : "idle";
        return <Lozenge tone={tone}>{p}</Lozenge>;
      },
    },
    { key: "owner", label: "Owner", width: "210px", render: (r) => <PersonChip person={cleanPerson(person(reqOwnerId(r)))} /> },
    {
      key: "baseline",
      label: "Status",
      width: "130px",
      render: (r) => {
        const c = reqControl(r);
        const tone = c === "Baselined" || c === "Approved" ? "pass" : c === "In Review" ? "warn" : "idle";
        return <Lozenge tone={tone}>{c}</Lozenge>;
      },
    },
    {
      key: "verify",
      label: "Verified",
      width: "180px",
      render: (r) => {
        const cov = reqCoverage(r);
        const tests = reqTestCount(r);
        const color =
          cov === 100 ? "var(--color-state-pass)" : cov >= 50 ? "var(--color-state-warn)" : "var(--color-state-fail)";
        return (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.09]">
              <span className="block h-full rounded-full" style={{ width: `${cov}%`, background: color }} />
            </span>
            <span className="tnum font-mono text-[11.5px] text-gray-300">{cov}%</span>
            <span className="tnum font-mono text-[11px] text-gray-500">· {tests} tests</span>
          </div>
        );
      },
    },
    {
      key: "defects",
      label: "Open Defects",
      width: "130px",
      align: "right",
      render: (r) => {
        const n = reqOpenDefects(r);
        return n > 0 ? (
          <span className="tnum font-mono text-[12px] font-semibold text-state-fail">{n}</span>
        ) : (
          <span className="tnum font-mono text-[12px] text-state-pass">0</span>
        );
      },
    },
  ];

  const prCols: Column<PullRequestRow>[] = [
    { key: "num", label: "PR", width: "70px", render: (p) => <Ident>#{p.number}</Ident> },
    {
      key: "title",
      label: "Title",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-gray-100">{p.title}</span>
          {p.isLive && <Lozenge tone="brand">live</Lozenge>}
        </div>
      ),
    },
    { key: "author", label: "Author", width: "150px", render: (p) => <PersonChip person={cleanPerson(person(p.authorId))} /> },
    {
      key: "reviewer",
      label: "Reviewer",
      width: "170px",
      render: (p) => <PersonChip person={cleanPerson(person(prReviewerId(p)))} />,
    },
    {
      key: "review",
      label: "Review time",
      width: "100px",
      align: "right",
      render: (p) =>
        p.reviewSeconds === null ? (
          <span className="font-mono text-[11px] text-gray-500">—</span>
        ) : (
          <span className="tnum font-mono text-[11px] text-gray-400">{duration(p.reviewSeconds)}</span>
        ),
    },
    {
      key: "diff",
      label: "Diff",
      width: "110px",
      render: (p) => (
        <span className="tnum font-mono text-[11px]">
          <span className="text-state-pass">+{p.additions}</span>{" "}
          <span className="text-state-fail">−{p.deletions}</span>
        </span>
      ),
    },
    {
      key: "checks",
      label: "Checks",
      width: "90px",
      render: (p) =>
        p.checks === "passing" ? <Lozenge tone="pass">passing</Lozenge> : <Lozenge tone="fail">failing</Lozenge>,
    },
    {
      key: "state",
      label: "State",
      width: "80px",
      render: (p) => (p.state === "merged" ? <Lozenge tone="brand">merged</Lozenge> : <Lozenge tone="idle">open</Lozenge>),
    },
  ];

  const testCols: Column<TestCaseRow>[] = [
    { key: "id", label: "ID", width: "110px", render: (t) => <Ident>{t.tcId}</Ident> },
    { key: "title", label: "Test case", render: (t) => <span className="truncate text-[13px] text-gray-100">{t.title}</span> },
    { key: "req", label: "Verifies", width: "120px", render: (t) => <Ident dim>{t.requirementId ?? "—"}</Ident> },
    {
      key: "auto",
      label: "Execution",
      width: "100px",
      render: (t) => (t.automated ? <Lozenge tone="neutral">automated</Lozenge> : <Lozenge tone="idle">manual</Lozenge>),
    },
    { key: "owner", label: "Owner", width: "170px", render: (t) => <PersonChip person={cleanPerson(person(t.ownerId))} /> },
    {
      key: "status",
      label: "Last result",
      width: "100px",
      render: (t) =>
        t.status === "passed" ? (
          <Lozenge tone="pass">passed</Lozenge>
        ) : t.status === "failed" ? (
          <Lozenge tone="fail">failed</Lozenge>
        ) : (
          <Lozenge tone="idle">not run</Lozenge>
        ),
    },
    {
      key: "when",
      label: "Ran",
      width: "70px",
      align: "right",
      render: (t) => (
        <span className="tnum font-mono text-[11px] text-gray-500">
          {t.lastRunAt ? ago(t.lastRunAt, new Date(data.generatedAt)) : "—"}
        </span>
      ),
    },
  ];

  const defectCols: Column<DefectRow>[] = [
    { key: "id", label: "ID", width: "115px", render: (d) => <span className="font-mono text-[12.5px] font-semibold text-accent">{d.defectId}</span> },
    { key: "title", label: "Summary", render: (d) => <span className="truncate text-[13px] text-gray-100">{d.title}</span> },
    {
      key: "sev",
      label: "Severity",
      width: "90px",
      render: (d) => {
        const s = defectSeverity(d);
        const tone =
          s === "critical" ? "fail" : s === "major" ? "warn" : s === "minor" ? "brand" : "idle";
        return <Lozenge tone={tone}>{s}</Lozenge>;
      },
    },
    { key: "req", label: "Against", width: "120px", render: (d) => <span className="font-mono text-[12.5px] text-gray-300">{d.requirementId ?? "—"}</span> },
    { key: "env", label: "Found in", width: "140px", render: (d) => <span className="text-[13px] text-gray-200">{defectFoundIn(d)}</span> },
    { key: "assignee", label: "Assignee", width: "170px", render: (d) => <PersonChip person={cleanPerson(person(defectFixerId(d)))} /> },
    {
      key: "status",
      label: "Status",
      width: "120px",
      render: (d) => {
        const st = defectStatus(d);
        const tone =
          st === "Verified" || st === "Closed"
            ? "pass"
            : st === "Open" || st === "Reopened"
            ? "fail"
            : st === "In Review" || st === "QA / Retest"
            ? "brand"
            : "warn";
        return <Lozenge tone={tone}>{st}</Lozenge>;
      },
    },
    {
      key: "age",
      label: "Age",
      width: "60px",
      align: "right",
      render: (d) => {
        const secs = defectAgeSeconds(d);
        const stale = secs > 14 * DAY;
        return (
          <span className={`tnum font-mono text-[11.5px] ${stale ? "text-state-warn" : "text-gray-300"}`}>
            {duration(secs)}
          </span>
        );
      },
    },
  ];

  const deploymentCols: Column<DeploymentRow>[] = [
    { key: "env", label: "Environment", width: "120px", render: (d) => <span className="text-[13px] text-gray-100">{d.environment}</span> },
    { key: "digest", label: "Image digest", width: "180px", render: (d) => <Ident>{d.imageDigest}</Ident> },
    { key: "actor", label: "Triggered by", width: "170px", render: (d) => <PersonChip person={cleanPerson(person(d.actorId))} /> },
    {
      key: "gate",
      label: "Approval",
      width: "150px",
      render: (d) =>
        d.gateApproved ? (
          <Lozenge tone="pass">approved</Lozenge>
        ) : (
          <span title="No reviewer configured for this environment — the transition is real, the approval is not">
            <Lozenge tone="warn">no approver</Lozenge>
          </span>
        ),
    },
    {
      key: "status",
      label: "Result",
      width: "100px",
      render: (d) => (d.status === "succeeded" ? <Lozenge tone="pass">succeeded</Lozenge> : <Lozenge tone="fail">failed</Lozenge>),
    },
    { key: "src", label: "Source", width: "80px", render: (d) => (d.isLive ? <Lozenge tone="brand">live</Lozenge> : <Lozenge tone="idle">seeded</Lozenge>) },
    {
      key: "when",
      label: "When",
      width: "130px",
      align: "right",
      render: (d) => <span className="tnum font-mono text-[11px] text-gray-500">{formatDateTime(d.createdAt)}</span>,
    },
  ];

  const peopleCols: Column<Person>[] = [
    { key: "name", label: "Person", width: "220px", render: (p) => <PersonChip person={cleanPerson(p)} /> },
    { key: "role", label: "Role", render: (p) => <span className="text-[13px] text-gray-200">{p.role}</span> },
  ];

  const table = () => {
    switch (tab) {
      case "packets":
        return (
          <DataTable
            columns={packetCols}
            rows={packetRows}
            rowKey={(p) => p.packetId}
            onRowClick={(p) => setSelected(p)}
            selectedKey={selected?.packetId ?? null}
          />
        );
      case "requirements":
        return <DataTable columns={requirementCols} rows={requirementRows} rowKey={(r) => r.reqId} />;
      case "code":
        return <DataTable columns={prCols} rows={prRows} rowKey={(p) => String(p.number)} />;
      case "tests":
        return <DataTable columns={testCols} rows={testRows} rowKey={(t) => t.tcId} />;
      case "defects":
        return <DataTable columns={defectCols} rows={defectRows} rowKey={(d) => d.defectId} />;
      case "deployments":
        return <DataTable columns={deploymentCols} rows={deploymentRows} rowKey={(d) => d.deploymentId} />;
      case "people":
        return <DataTable columns={peopleCols} rows={peopleRows} rowKey={(p) => p.personId} />;
    }
  };

  return (
    <>
      <PageMeta title={`${BRAND.name} — SDLC Spine`} description="Delivery console" />

      {/* Project bar */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b hairline px-4 py-3">
        <span className="text-[14px] font-bold tracking-tight text-gray-100">{BRAND.name}</span>
        <span className="text-gray-600">/</span>
        <span className="font-mono text-[12.5px] font-medium text-gray-200">PAY</span>
        <span className="text-gray-600">/</span>
        <span className="font-mono text-[12.5px] font-medium text-gray-200">payment-processing-app</span>
        <span className="text-gray-600">/</span>
        <span className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[12.5px] font-semibold text-accent">
          R2 · Sprint R2-S4
        </span>
        <span className="ml-auto flex items-center gap-x-3 font-mono text-[11px] text-gray-500">
          <span><span className="font-semibold text-gray-300">{data.packets.length}</span> work items</span>
          <span><span className="font-semibold text-gray-300">{data.requirements.length}</span> requirements</span>
          <span><span className="font-semibold text-gray-300">{data.defects.length}</span> defects</span>
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex items-center gap-0 overflow-x-auto border-b hairline px-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap px-3.5 py-3 text-[13px] transition-colors focus:outline-none focus-visible:bg-black/[0.05] ${
                active ? "font-semibold text-gray-100" : "font-medium text-gray-500 hover:text-gray-200"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              <span className={`ml-1.5 tnum font-mono text-[11px] ${active ? "text-accent" : "text-gray-500"}`}>
                {counts[t.id]}
              </span>
              {active && <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-t bg-accent" />}
            </button>
          );
        })}
      </nav>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b hairline px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search work items or requirement"
          className="h-8 w-72 rounded-md border hairline bg-ink-950 px-3 text-[13px] text-gray-100 placeholder:text-gray-500 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        />

        <select
          value={release}
          onChange={(e) => setRelease(e.target.value)}
          className="h-8 rounded-md border hairline bg-ink-950 px-2.5 text-[13px] text-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        >
          <option value="all">All releases</option>
          <option value="R2">R2</option>
          <option value="R3">R3</option>
        </select>

        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="h-8 rounded-md border hairline bg-ink-950 px-2.5 text-[13px] text-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        >
          <option value="all">Anyone</option>
          {data.people.map((p) => (
            <option key={p.personId} value={p.personId}>
              {displayName(p)}
            </option>
          ))}
        </select>

        {(query || release !== "all" || assignee !== "all") && (
          <button
            onClick={() => {
              setQuery("");
              setRelease("all");
              setAssignee("all");
            }}
            className="h-8 rounded-md px-2.5 text-[13px] font-medium text-gray-500 hover:bg-black/[0.05] hover:text-gray-200"
          >
            Clear
          </button>
        )}

        <span className="ml-auto font-mono text-[11px] text-gray-500">{counts[tab]} rows</span>
      </div>

      {table()}

      {selected && (
        <PacketDetail
          packet={selected}
          stages={data.stages}
          people={data.people}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
