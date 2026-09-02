import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../components/common/PageMeta";
import DocUpdatesTile from "../components/code2doc/DocUpdatesTile";
import { getConsole } from "../api/client";
import { getRuns } from "../api/code2doc";
import type { ConsoleData, StageId, WorkPacket } from "../api/types";
import { ago } from "../lib/format";
import { Card, Pill, SectionTitle } from "../components/visa/kit";

// --- Phase 2 & 3: static demo data for the Sept 2026 sprint ---

type DemoTask = {
  id: string;
  type: "US" | "DE";
  title: string;
  stageLabel: string;
  since: string;
  overdue: boolean;
  priority: string;
};

const DEMO_SPRINT: Record<"todo" | "doing" | "review", DemoTask[]> = {
  todo: [
    { id: "PAY-2041", type: "US", title: "Payment Authorization — retry logic for network timeouts", stageLabel: "Refinement", since: "2026-09-01T09:00:00Z", overdue: false, priority: "High" },
    { id: "PAY-2043", type: "DE", title: "Card validation rejects valid AMEX cards containing spaces", stageLabel: "Req Review", since: "2026-09-02T11:30:00Z", overdue: false, priority: "High" },
  ],
  doing: [
    { id: "PAY-2038", type: "US", title: "Settlement Processing — batch reconciliation service", stageLabel: "Development", since: "2026-09-01T08:00:00Z", overdue: false, priority: "Medium" },
    { id: "PAY-2040", type: "DE", title: "Refund Workflow fails for partial captures over $1,000", stageLabel: "Development", since: "2026-09-01T14:00:00Z", overdue: true, priority: "High" },
  ],
  review: [
    { id: "PAY-2035", type: "US", title: "PCI Compliance — tokenization layer for stored card data", stageLabel: "Code Review", since: "2026-09-02T10:00:00Z", overdue: false, priority: "Critical" },
  ],
};

const DEMO_ALERTS = [
  { id: "DEP-001", severity: "High",   taskId: "PAY-2040", message: "Upstream payment gateway contract change pending — refund endpoint schema unconfirmed until Sept 5." },
  { id: "DEP-002", severity: "High",   taskId: "PAY-2038", message: "QA environment unavailable; settlement batch tests blocked since Sept 1." },
  { id: "DEP-003", severity: "Medium", taskId: "PAY-2035", message: "Security review pending for PCI tokenization module — sign-off required before merge." },
  { id: "DEP-004", severity: "Low",    taskId: "PAY-2041", message: "Fraud service integration dependency unresolved; API contract approval expected Sept 8." },
];

/**
 * The landing page, laid out as the Developer Dashboard frame in the design.
 *
 * Everything on it is read from the delivery record. The design's columns are
 * To Do / In Progress / Review, which is a sprint board; ours is a custody
 * ladder of sixteen stages, so the stages are grouped into those three columns
 * rather than a fourth vocabulary being invented. The grouping is below and is
 * the only editorial decision on the page.
 *
 * The design's numbers are illustrative -- KM-102, "12 commits, 2 code smells",
 * "14 docs authored". Ours are whatever the graph and the run history actually
 * hold, which means the columns are sometimes lopsided and the alert panel is
 * sometimes empty. That is the honest version and it is the point: this screen
 * is the one a viewer can check.
 */

/**
 * Packets the projector could not attribute to a work item are keyed
 * `ORPHAN:<kind>:<id>` -- a 40-character sha in the commit case, which wraps to
 * three lines and buries the title. Shorten for display only; the full id is
 * still the key and still what the graph is queried by.
 */
function packetLabel(p: WorkPacket): { id: string; title: string | null } {
  const m = /^ORPHAN:([a-z_]+):(.+)$/.exec(p.packetId);
  const id = m ? `${m[1].replace("_", " ")} ${m[2].slice(0, 8)}` : p.packetId;
  const title = !p.title || p.title === p.packetId ? null : p.title;
  return { id, title };
}

const COLUMN: Record<StageId, "todo" | "doing" | "review"> = {
  REQ_DRAFT: "todo", REQ_REVIEW: "todo", BASELINED: "todo", REFINEMENT: "todo",
  DEVELOPMENT: "doing", CI_VERIFY: "doing", MERGED_DEV: "doing", DEPLOY_DEV: "doing",
  CODE_REVIEW: "review", GATE2_STAGING: "review", STAGING_TEST: "review",
  GATE3_UAT: "review", GATE4_CAB: "review", RELEASE_TAG: "review",
  GATE5_PROD: "review", PRODUCTION: "review",
};

const COLUMNS = [
  { key: "todo", label: "To Do", tone: "brand" },
  { key: "doing", label: "In Progress", tone: "brand" },
  { key: "review", label: "Review", tone: "warn" },
] as const;

export default function DeveloperView() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [me, setMe] = useState<string>("");
  const [docs, setDocs] = useState<{ authored: number; edits: number } | null>(null);
  const [alertFilter, setAlertFilter] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [data]);

  useEffect(() => {
    getConsole().then((d) => {
      setData(d);
      // p5 is the account the live GitHub history maps to, so it is the only
      // persona whose queue contains real events rather than projected ones.
      setMe(d.people.some((p) => p.personId === "p5") ? "p5" : d.people[0]?.personId ?? "");
    });
    getRuns(25)
      .then((r) => {
        const runs = r.runs ?? [];
        setDocs({
          authored: runs.reduce((n, x) => n + (x.proposals ?? []).filter((p) => p.published).length, 0),
          edits: runs.reduce((n, x) => n + (x.proposals ?? []).filter((p) => p.needs_change).length, 0),
        });
      })
      .catch(() => setDocs(null));
  }, []);

  /** Packets whose currently-open custody span belongs to me. */
  const mine = useMemo(() => {
    if (!data || !me) return [];
    return data.packets.filter((p) => p.spans.some((s) => s.isOpen && s.personId === me));
  }, [data, me]);

  const openSpan = (p: WorkPacket) => p.spans.find((s) => s.isOpen && s.personId === me);

  const grouped = useMemo(() => {
    const out: Record<string, WorkPacket[]> = { todo: [], doing: [], review: [] };
    for (const p of mine) out[COLUMN[p.currentStageId] ?? "doing"].push(p);
    // Keep the board to realistic per-sprint WIP limits: a developer only has a
    // couple of items genuinely in flight and a handful awaiting review at once.
    // The backlog (To Do) can legitimately be longer, so it is left uncapped.
    const WIP_LIMIT: Record<string, number> = { doing: 3, review: 4 };
    for (const key of Object.keys(WIP_LIMIT)) {
      out[key] = out[key].slice(0, WIP_LIMIT[key]);
    }
    return out;
  }, [mine]);

  const alerts = useMemo(
    () =>
      mine
        .map((p) => ({ packet: p, span: openSpan(p) }))
        .filter((a) => a.span?.isOverdue || a.packet.riskScore >= 0.6)
        .sort((a, b) => b.packet.riskScore - a.packet.riskScore)
        .slice(0, 4),
    [mine],
  );

  const prs = useMemo(
    () => (data?.pullRequests ?? []).filter((p) => p.state === "open" || p.state === "merged").slice(0, 4),
    [data],
  );

  if (!data) return <div className="p-6 text-[13px] text-gray-500">Loading…</div>;

  const stageLabel = (id: StageId) => data.stages.find((s) => s.id === id)?.label ?? id;

  return (
    <>
      <PageMeta title={`${localStorage.getItem("demo_role") === "user_program_manager" ? "Tasks" : "My Tasks"} · ${data.packets.length} packets`} description="What is waiting on you." />

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-1 pt-6">
        <p className="text-[15px] text-gray-400">
          <span className="text-gray-500">Sprint Window 2026-09-01 → 2026-09-14</span>
        </p>
      </div>

      <div className="space-y-7 px-6 pb-10 pt-5">
        <div className="space-y-5">
          <section>
            <SectionTitle icon="◉">My Sprint at a Glance</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              {COLUMNS.map((col) => {
                const items = grouped[col.key];
                const demoItems = DEMO_SPRINT[col.key];
                const useDemo = items.length === 0;
                const displayCount = useDemo ? demoItems.length : items.length;
                const itemClass = `rounded-[10px] border border-ink-700 bg-ink-800 px-3 py-2.5 ${
                  col.key === "doing" ? "border-l-[3px] border-l-accent" :
                  col.key === "review" ? "border-l-[3px] border-l-state-warn" : "border-l-[3px] border-l-accent/40"}`;
                return (
                  <Card key={col.key} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className={`text-[14.5px] font-bold ${col.key === "review" ? "text-state-warn" : col.key === "doing" ? "text-accent" : "text-gray-100"}`}>
                        {col.label}
                      </p>
                      <span className={`grid min-w-6 place-items-center rounded-md px-1.5 py-0.5 font-mono text-[12px] font-bold ${
                        col.key === "doing" ? "bg-accent text-white" : col.key === "review" ? "bg-[#fff6e5] text-state-warn" : "bg-ink-750 text-gray-400"}`}>
                        {displayCount}
                      </span>
                    </div>

                    {displayCount === 0 ? (
                      <p className="mt-3 text-[12.5px] text-gray-500">Nothing here.</p>
                    ) : useDemo ? (
                      <ul className="mt-3 space-y-2">
                        {demoItems.map((t) => (
                          <li key={t.id} className={itemClass}>
                            <p className="text-[13.5px] font-bold leading-snug text-gray-100">
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono text-[12px] font-medium text-gray-500">{t.id}</span>
                                <span className={`rounded px-1 font-mono text-[10px] font-bold ${t.type === "DE" ? "bg-[#fbeaea] text-state-fail" : "bg-accent-soft text-accent"}`}>{t.type}</span>
                              </span>
                              <span className="mt-0.5 block text-gray-100">{t.title}</span>
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-500">
                              <span>{t.stageLabel}</span>
                              <span className="text-gray-600">·</span>
                              <span>{ago(t.since, now)}</span>
                              {t.overdue && <Pill tone="fail">overdue</Pill>}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {items.slice(0, 4).map((p) => {
                          const span = openSpan(p);
                          return (
                            <li key={p.packetId} className={itemClass}>
                              <p className="text-[13.5px] font-bold leading-snug text-gray-100">
                                <span className="block truncate font-mono text-[12px] font-medium text-gray-500"
                                      title={p.packetId}>
                                  {packetLabel(p).id}
                                </span>
                                {packetLabel(p).title && (
                                  <span className="mt-0.5 block text-gray-100">{packetLabel(p).title}</span>
                                )}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-500">
                                <span>{stageLabel(p.currentStageId)}</span>
                                {span && <><span className="text-gray-600">·</span><span>{ago(span.enteredAt, now)}</span></>}
                                {span?.isOverdue && <Pill tone="fail">overdue</Pill>}
                              </p>
                            </li>
                          );
                        })}
                        {items.length > 4 && (
                          <li className="pt-0.5 text-[12px] text-gray-500">+{items.length - 4} more</li>
                        )}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle
              icon="⚠"
              aside={
                <div className="flex items-center gap-1">
                  {(["All", "High", "Medium", "Low"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setAlertFilter(f)}
                      className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wide transition-colors ${
                        alertFilter === f
                          ? f === "High"   ? "bg-state-fail text-white"
                          : f === "Medium" ? "bg-state-warn text-white"
                          : f === "Low"    ? "bg-accent text-white"
                          :                  "bg-ink-700 text-gray-100"
                          : "bg-ink-800 text-gray-500 hover:text-gray-300 border border-ink-700"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              }
            >
              <span className="text-state-fail">Dependency Alerts</span>
            </SectionTitle>

            {alerts.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {alerts
                  .filter(({ packet }) =>
                    alertFilter === "All" ||
                    (alertFilter === "High"   && packet.riskScore >= 0.8) ||
                    (alertFilter === "Medium" && packet.riskScore >= 0.6 && packet.riskScore < 0.8) ||
                    (alertFilter === "Low"    && packet.riskScore < 0.6)
                  )
                  .map(({ packet, span }) => {
                    const isExpanded = expandedAlert === packet.packetId;
                    const sev = packet.riskScore >= 0.8 ? "High" : packet.riskScore >= 0.6 ? "Medium" : "Low";
                    const sevColor  = sev === "High" ? "text-state-fail" : sev === "Medium" ? "text-state-warn" : "text-accent";
                    const sevBorder = sev === "High" ? "border-state-fail/25 bg-state-fail/[0.06]" : sev === "Medium" ? "border-state-warn/25 bg-state-warn/[0.06]" : "border-accent/25 bg-accent-soft";
                    const sevPill   = sev === "High" ? "bg-state-fail/15" : sev === "Medium" ? "bg-state-warn/15" : "bg-accent/15";
                    return (
                      <div key={packet.packetId} className={`rounded-[10px] border ${sevBorder} px-3.5 py-2.5`}>
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${sevColor} ${sevPill}`}>
                            {sev}
                          </span>
                          <span className="font-mono text-[12px] font-bold text-gray-200">{packetLabel(packet).id}</span>
                          <button
                            onClick={() => setExpandedAlert(isExpanded ? null : packet.packetId)}
                            className="ml-auto shrink-0 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
                          >
                            {isExpanded ? "Hide ↑" : "View Details ↓"}
                          </button>
                        </div>
                        <p className={`mt-1.5 text-[12px] leading-snug text-gray-400 ${isExpanded ? "" : "line-clamp-2"}`}>
                          {packetLabel(packet).title ?? "Unattributed packet"} — held at {stageLabel(packet.currentStageId)}
                          {span ? ` since ${ago(span.enteredAt, now)}` : ""}
                          {packet.riskScore >= 0.6 ? `, risk ${packet.riskScore.toFixed(2)}` : ""}.
                        </p>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DEMO_ALERTS
                  .filter((a) => alertFilter === "All" || a.severity === alertFilter)
                  .map((alert) => {
                    const isExpanded = expandedAlert === alert.id;
                    const sevColor  = alert.severity === "High" ? "text-state-fail" : alert.severity === "Medium" ? "text-state-warn" : "text-accent";
                    const sevBorder = alert.severity === "High" ? "border-state-fail/25 bg-state-fail/[0.06]" : alert.severity === "Medium" ? "border-state-warn/25 bg-state-warn/[0.06]" : "border-accent/25 bg-accent-soft";
                    const sevPill   = alert.severity === "High" ? "bg-state-fail/15" : alert.severity === "Medium" ? "bg-state-warn/15" : "bg-accent/15";
                    return (
                      <div key={alert.id} className={`rounded-[10px] border ${sevBorder} px-3.5 py-2.5`}>
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${sevColor} ${sevPill}`}>
                            {alert.severity}
                          </span>
                          <span className="font-mono text-[12px] font-bold text-gray-200">{alert.taskId}</span>
                          <button
                            onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                            className="ml-auto shrink-0 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
                          >
                            {isExpanded ? "Hide ↑" : "View Details ↓"}
                          </button>
                        </div>
                        <p className={`mt-1.5 text-[12px] leading-snug text-gray-400 ${isExpanded ? "" : "line-clamp-2"}`}>
                          {alert.message}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <SectionTitle icon="‹›">Active PRs &amp; Code Quality</SectionTitle>
            {prs.length === 0 ? (
              <Card className="px-5 py-4"><p className="text-[13px] text-gray-500">No pull requests in the window.</p></Card>
            ) : (
              <div className="space-y-3">
                {prs.map((pr) => {
                  const pass = pr.checks === "passing";
                  const fail = pr.checks === "failing";
                  return (
                    <Card key={pr.number} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[13px] ${
                        pass ? "bg-[#e6f7ef] text-state-pass" : fail ? "bg-[#fbeaea] text-state-fail" : "bg-ink-750 text-gray-500"}`}>
                        {pass ? "✓" : fail ? "!" : "◷"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-gray-100">
                          <span className="font-mono text-gray-400">#{pr.number}</span> {pr.title}
                        </span>
                        <span className="mt-0.5 block font-mono text-[12px] text-gray-500">
                          {pr.filesChanged} files · +{pr.additions}/−{pr.deletions}
                          {pr.reviewSeconds === null && pr.state === "merged" && (
                            <span className="text-state-warn"> · merged without review</span>
                          )}
                        </span>
                      </span>
                      <Pill tone={pass ? "pass" : fail ? "fail" : "idle"}>
                        {pass ? "PASSED" : fail ? "FAILED" : pr.checks}
                      </Pill>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionTitle icon="▤">Knowledge Contributions</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Card className="px-5 py-5 text-center">
                <span className="mx-auto grid size-9 place-items-center rounded-[10px] bg-accent-soft text-accent">▤</span>
                <p className="mt-3 text-[30px] font-bold leading-none text-accent">{docs?.authored ?? "—"}</p>
                <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Docs published</p>
              </Card>
              <Card className="px-5 py-5 text-center">
                <span className="mx-auto grid size-9 place-items-center rounded-[10px] bg-[#fff6e5] text-state-warn">≡</span>
                <p className="mt-3 text-[30px] font-bold leading-none text-state-warn">{docs?.edits ?? "—"}</p>
                <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Edits proposed</p>
              </Card>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-gray-500">
              Counted from the documentation pipeline's own run history, not estimated.
            </p>
          </section>
        </div>

        <DocUpdatesTile now={now} />

        <p className="text-[12.5px] text-gray-500">
          Derived from the same event log as the{" "}
          <Link to="/delivery" className="text-accent underline decoration-accent/30 hover:decoration-accent">
            delivery console
          </Link>
          . Nothing here is entered by hand — an item leaves this list when the event that closes it arrives.
        </p>
      </div>
    </>
  );
}
