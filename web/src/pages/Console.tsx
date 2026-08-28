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
  { id: "packets", label: "Work packets" },
  { id: "requirements", label: "Requirements" },
  { id: "code", label: "Pull requests" },
  { id: "tests", label: "Tests" },
  { id: "defects", label: "Defects" },
  { id: "deployments", label: "Deployments" },
  { id: "people", label: "People" },
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

  const matches = (...fields: (string | null | undefined)[]) =>
    !query || fields.some((f) => f?.toLowerCase().includes(query.toLowerCase()));

  /* --- rows per tab ------------------------------------------------------- */
  const packetRows = useMemo(() => {
    if (!data) return [];
    return data.packets
      .filter((p) => matches(p.title, p.issueKey, p.packetId, ...p.requirementIds))
      .filter((p) => release === "all" || p.release === release)
      .filter((p) => assignee === "all" || p.spans[p.spans.length - 1].personId === assignee)
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [data, query, release, assignee]);

  const requirementRows = useMemo(() => {
    if (!data) return [];
    return data.requirements
      .filter((r) => matches(r.title, r.reqId, r.document))
      .filter((r) => release === "all" || r.release === release)
      .filter((r) => assignee === "all" || r.ownerId === assignee);
  }, [data, query, release, assignee]);

  const prRows = useMemo(() => {
    if (!data) return [];
    return data.pullRequests
      .filter((p) => matches(p.title, `#${p.number}`, ...p.requirementIds))
      .filter((p) => assignee === "all" || p.authorId === assignee || p.reviewerIds.includes(assignee))
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
    return data.people.filter((p) => matches(p.name, p.role, p.handle));
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
    return <div className="p-6 text-[12px] text-gray-600">Loading…</div>;
  }

  /* --- column definitions ------------------------------------------------- */
  const packetCols: Column<WorkPacket>[] = [
    { key: "id", label: "Key", width: "88px", render: (p) => <Ident>{p.issueKey ?? p.packetId}</Ident> },
    {
      key: "title",
      label: "Summary",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] text-gray-200">{p.title}</span>
          {p.isOrphan && <Lozenge tone="warn">no req</Lozenge>}
        </div>
      ),
    },
    {
      key: "req",
      label: "Requirement",
      width: "120px",
      render: (p) => <Ident dim>{p.requirementIds[0] ?? "—"}</Ident>,
    },
    { key: "stage", label: "Stage", width: "180px", render: (p) => <StageChip stageId={p.currentStageId} stages={data.stages} /> },
    { key: "rail", label: "Progress", width: "80px", render: (p) => <ProgressRail stageId={p.currentStageId} /> },
    {
      key: "holder",
      label: "Holder",
      width: "170px",
      render: (p) => <PersonChip person={person(p.spans[p.spans.length - 1].personId)} />,
    },
    {
      key: "age",
      label: "In stage",
      width: "80px",
      align: "right",
      render: (p) => {
        const span = p.spans[p.spans.length - 1];
        return (
          <span className={`tnum font-mono text-[11px] ${span.isOverdue ? "text-state-fail" : "text-gray-400"}`}>
            {duration(span.calendarAdjustedSeconds)}
          </span>
        );
      },
    },
    { key: "flow", label: "Custody", width: "150px", render: (p) => <FlowBar packet={p} stages={data.stages} /> },
  ];

  const requirementCols: Column<Requirement>[] = [
    { key: "id", label: "ID", width: "110px", render: (r) => <Ident>{r.reqId}</Ident> },
    { key: "title", label: "Statement", render: (r) => <span className="truncate text-[12.5px] text-gray-200">{r.title}</span> },
    { key: "doc", label: "Source", width: "90px", render: (r) => <Ident dim>{r.document}</Ident> },
    {
      key: "baseline",
      label: "Control",
      width: "100px",
      render: (r) => (r.baselined ? <Lozenge tone="brand">baselined</Lozenge> : <Lozenge tone="idle">draft</Lozenge>),
    },
    { key: "moscow", label: "Priority", width: "80px", render: (r) => <Ident dim>{r.moscow}</Ident> },
    { key: "owner", label: "Owner", width: "170px", render: (r) => <PersonChip person={person(r.ownerId)} /> },
    {
      key: "verify",
      label: "Verified",
      width: "110px",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="h-1 w-12 overflow-hidden rounded-full bg-black/[0.09]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${r.verification * 100}%`,
                background: r.verification === 1 ? "var(--color-state-pass)" : "var(--color-state-warn)",
              }}
            />
          </span>
          <span className="tnum font-mono text-[10px] text-gray-500">
            {r.linkedTestIds.length} tc
          </span>
        </div>
      ),
    },
    {
      key: "defects",
      label: "Open defects",
      width: "100px",
      align: "right",
      render: (r) =>
        r.openDefectIds.length ? (
          <span className="tnum font-mono text-[11px] text-state-fail">{r.openDefectIds.length}</span>
        ) : (
          <span className="tnum font-mono text-[11px] text-gray-700">0</span>
        ),
    },
  ];

  const prCols: Column<PullRequestRow>[] = [
    { key: "num", label: "PR", width: "70px", render: (p) => <Ident>#{p.number}</Ident> },
    {
      key: "title",
      label: "Title",
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] text-gray-200">{p.title}</span>
          {p.isLive && <Lozenge tone="brand">live</Lozenge>}
        </div>
      ),
    },
    { key: "author", label: "Author", width: "150px", render: (p) => <PersonChip person={person(p.authorId)} /> },
    {
      key: "reviewer",
      label: "Reviewer",
      width: "170px",
      render: (p) =>
        p.reviewerIds.length ? (
          <PersonChip person={person(p.reviewerIds[0])} />
        ) : (
          <span className="text-[11px] text-state-warn" title="Merged without a review — GitHub does not permit self-review">
            none
          </span>
        ),
    },
    {
      key: "review",
      label: "Review time",
      width: "100px",
      align: "right",
      render: (p) =>
        p.reviewSeconds === null ? (
          <span className="font-mono text-[11px] text-gray-700">—</span>
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
    { key: "title", label: "Test case", render: (t) => <span className="truncate text-[12.5px] text-gray-200">{t.title}</span> },
    { key: "req", label: "Verifies", width: "120px", render: (t) => <Ident dim>{t.requirementId ?? "—"}</Ident> },
    {
      key: "auto",
      label: "Execution",
      width: "100px",
      render: (t) => (t.automated ? <Lozenge tone="neutral">automated</Lozenge> : <Lozenge tone="idle">manual</Lozenge>),
    },
    { key: "owner", label: "Owner", width: "170px", render: (t) => <PersonChip person={person(t.ownerId)} /> },
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
    { key: "id", label: "ID", width: "115px", render: (d) => <Ident>{d.defectId}</Ident> },
    { key: "title", label: "Summary", render: (d) => <span className="truncate text-[12.5px] text-gray-200">{d.title}</span> },
    {
      key: "sev",
      label: "Severity",
      width: "90px",
      render: (d) =>
        d.severity === "critical" ? (
          <Lozenge tone="fail">critical</Lozenge>
        ) : d.severity === "major" ? (
          <Lozenge tone="warn">major</Lozenge>
        ) : (
          <Lozenge tone="idle">minor</Lozenge>
        ),
    },
    { key: "req", label: "Against", width: "120px", render: (d) => <Ident dim>{d.requirementId ?? "—"}</Ident> },
    { key: "env", label: "Found in", width: "90px", render: (d) => <Ident dim>{d.environment}</Ident> },
    { key: "assignee", label: "Assignee", width: "170px", render: (d) => <PersonChip person={person(d.assigneeId)} /> },
    {
      key: "status",
      label: "Status",
      width: "110px",
      render: (d) =>
        d.status === "verified" || d.status === "resolved" ? (
          <Lozenge tone="pass">{d.status}</Lozenge>
        ) : d.status === "open" ? (
          <Lozenge tone="fail">open</Lozenge>
        ) : (
          <Lozenge tone="warn">{d.status}</Lozenge>
        ),
    },
    {
      key: "age",
      label: "Age",
      width: "60px",
      align: "right",
      render: (d) => <span className="tnum font-mono text-[11px] text-gray-400">{duration(d.ageSeconds)}</span>,
    },
  ];

  const deploymentCols: Column<DeploymentRow>[] = [
    { key: "env", label: "Environment", width: "120px", render: (d) => <span className="text-[12.5px] text-gray-200">{d.environment}</span> },
    { key: "digest", label: "Image digest", width: "180px", render: (d) => <Ident>{d.imageDigest}</Ident> },
    { key: "actor", label: "Triggered by", width: "170px", render: (d) => <PersonChip person={person(d.actorId)} /> },
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
    { key: "name", label: "Person", width: "220px", render: (p) => <PersonChip person={p} /> },
    { key: "role", label: "Role", render: (p) => <span className="text-[12.5px] text-gray-300">{p.role}</span> },
    {
      key: "resolved",
      label: "Identity",
      width: "130px",
      render: (p) => (p.resolved ? <Lozenge tone="pass">mapped</Lozenge> : <Lozenge tone="warn">unmapped</Lozenge>),
    },
    {
      key: "active",
      label: "Holding",
      width: "80px",
      align: "right",
      render: (p) => {
        const s = data.personStats.find((x) => x.personId === p.personId);
        return <span className="tnum font-mono text-[11px] text-gray-300">{s?.activePackets ?? 0}</span>;
      },
    },
    {
      key: "custody",
      label: "Total custody",
      width: "110px",
      align: "right",
      render: (p) => {
        const s = data.personStats.find((x) => x.personId === p.personId);
        return <span className="tnum font-mono text-[11px] text-gray-400">{duration(s?.totalCustodySeconds ?? 0)}</span>;
      },
    },
    {
      key: "review",
      label: "Median review",
      width: "120px",
      align: "right",
      render: (p) => {
        const s = data.personStats.find((x) => x.personId === p.personId);
        return (
          <span className="tnum font-mono text-[11px] text-gray-400">
            {s?.medianReviewSeconds ? duration(s.medianReviewSeconds) : "—"}
          </span>
        );
      },
    },
    {
      key: "tests",
      label: "Tests authored",
      width: "110px",
      align: "right",
      render: (p) => {
        const s = data.personStats.find((x) => x.personId === p.personId);
        return <span className="tnum font-mono text-[11px] text-gray-400">{s?.testsAuthored ?? 0}</span>;
      },
    },
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b hairline px-4 py-2.5">
        <span className="text-[13px] font-medium text-gray-100">{BRAND.name}</span>
        <Ident dim>PAY</Ident>
        <span className="text-gray-800">/</span>
        <Ident dim>payment-processing-app</Ident>
        <span className="text-gray-800">/</span>
        <Ident dim>R2 · Sprint R2-S4</Ident>
        <span className="ml-auto font-mono text-[10px] text-gray-600">
          {data.packets.length} packets · {data.requirements.length} requirements ·{" "}
          {data.defects.length} defects
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
              className={`relative whitespace-nowrap px-3 py-2.5 text-[12.5px] transition-colors focus:outline-none focus-visible:bg-black/[0.05] ${
                active ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              <span className={`ml-1.5 tnum font-mono text-[10px] ${active ? "text-cgz-cyan" : "text-gray-700"}`}>
                {counts[t.id]}
              </span>
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-t bg-cgz-cyan" />}
            </button>
          );
        })}
      </nav>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b hairline px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by text, key or requirement"
          className="h-7 w-64 rounded-md border hairline bg-ink-950 px-2.5 text-[12px] text-gray-200 placeholder:text-gray-600 focus:border-cgz-cyan/50 focus:outline-none"
        />

        <select
          value={release}
          onChange={(e) => setRelease(e.target.value)}
          className="h-7 rounded-md border hairline bg-ink-950 px-2 text-[12px] text-gray-300 focus:border-cgz-cyan/50 focus:outline-none"
        >
          <option value="all">All releases</option>
          <option value="R2">R2</option>
          <option value="R3">R3</option>
        </select>

        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="h-7 rounded-md border hairline bg-ink-950 px-2 text-[12px] text-gray-300 focus:border-cgz-cyan/50 focus:outline-none"
        >
          <option value="all">Anyone</option>
          {data.people.map((p) => (
            <option key={p.personId} value={p.personId}>
              {p.name}
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
            className="h-7 rounded-md px-2 text-[12px] text-gray-500 hover:bg-black/[0.05] hover:text-gray-300"
          >
            Clear
          </button>
        )}

        <span className="ml-auto font-mono text-[10px] text-gray-600">{counts[tab]} rows</span>
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
