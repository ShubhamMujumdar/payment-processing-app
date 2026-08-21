import { useEffect, useMemo, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { Ident, Lozenge } from "../components/console/primitives";
import { getConsole, getTrace, type TraceClosure } from "../api/client";
import type { ConsoleData, Requirement } from "../api/types";

/**
 * Requirement traceability.
 *
 * Answers the four questions an auditor asks in order: what does this require,
 * what derives from it, what implements it, and what proves it works. Today
 * that answer lives in a hand-maintained matrix; here it is a graph traversal,
 * which is the whole argument for the system.
 */

const STATUS_TONE: Record<string, "pass" | "warn" | "fail" | "idle" | "brand"> = {
  satisfied: "pass",
  partial: "warn",
  delivered_with_defect: "warn",
  delivered_unverified: "warn",
  in_progress: "brand",
  approved: "idle",
  not_started: "idle",
  deferred: "idle",
  not_satisfied: "fail",
  unknown: "idle",
};

const STATUS_LABEL: Record<string, string> = {
  satisfied: "satisfied",
  partial: "partial",
  delivered_with_defect: "defect open",
  delivered_unverified: "unverified",
  in_progress: "in dev",
  approved: "approved",
  not_started: "not started",
  deferred: "deferred",
  not_satisfied: "not satisfied",
  unknown: "—",
};

function StatusChip({ status }: { status?: string }) {
  const key = status ?? "unknown";
  return <Lozenge tone={STATUS_TONE[key] ?? "idle"}>{STATUS_LABEL[key] ?? key}</Lozenge>;
}

export default function Traceability() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceClosure | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    getConsole().then((d) => {
      setData(d);
      const first = d.requirements.find((r) => r.reqId === "BR-PAY-005") ?? d.requirements[0];
      if (first) setSelected(first.reqId);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingTrace(true);
    getTrace(selected)
      .then(setTrace)
      .finally(() => setLoadingTrace(false));
  }, [selected]);

  const requirements = useMemo(() => {
    if (!data) return [];
    return data.requirements
      .filter((r) => !query || `${r.reqId} ${r.title}`.toLowerCase().includes(query.toLowerCase()))
      .filter((r) =>
        !onlyProblems
          ? true
          : ["not_satisfied", "partial", "delivered_with_defect", "delivered_unverified"].includes(
              (r.status as string) ?? "",
            ),
      );
  }, [data, query, onlyProblems]);

  const current: Requirement | undefined = data?.requirements.find((r) => r.reqId === selected);

  if (!data) return <div className="p-6 text-[12px] text-gray-600">Loading…</div>;

  const liveGraph = data.origin === "live";

  return (
    <>
      <PageMeta title="Traceability — SDLC Spine" description="Requirement to code to test to defect" />

      <div className="flex h-[calc(100vh-45px)]">
        {/* Requirement list */}
        <div className="flex w-[420px] shrink-0 flex-col border-r hairline">
          <div className="flex items-center gap-2 border-b hairline px-3 py-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter requirements"
              className="h-7 flex-1 rounded-md border hairline bg-ink-950 px-2.5 text-[12px] text-gray-200 placeholder:text-gray-600 focus:border-cgz-cyan/50 focus:outline-none"
            />
            <button
              onClick={() => setOnlyProblems((v) => !v)}
              className={`h-7 whitespace-nowrap rounded-md border px-2 text-[11px] transition-colors ${
                onlyProblems
                  ? "border-state-warn/40 bg-state-warn/10 text-state-warn"
                  : "hairline text-gray-500 hover:text-gray-300"
              }`}
            >
              Problems only
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {requirements.map((r) => {
              const active = r.reqId === selected;
              return (
                <button
                  key={r.reqId}
                  onClick={() => setSelected(r.reqId)}
                  className={`relative flex w-full flex-col gap-1 border-b border-black/[0.05] px-3 py-2 text-left transition-colors ${
                    active ? "bg-cgz-blue/[0.14]" : "hover:bg-black/[0.04]"
                  }`}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-cgz-cyan" />}
                  <div className="flex items-center gap-2">
                    <Ident>{r.reqId}</Ident>
                    <span className="ml-auto">
                      <StatusChip status={r.status} />
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[12px] leading-snug text-gray-300">{r.title}</p>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-gray-600">
                    <span>{r.document}</span>
                    {r.baselined && <span className="text-cgz-teal">baselined</span>}
                    {(r.testCount ?? r.linkedTestIds.length) > 0 && (
                      <span>{r.testCount ?? r.linkedTestIds.length} tests</span>
                    )}
                    {r.openDefectIds.length > 0 && (
                      <span className="text-state-fail">{r.openDefectIds.length} defects</span>
                    )}
                  </div>
                </button>
              );
            })}
            {!requirements.length && (
              <p className="p-4 text-[12px] text-gray-600">Nothing matches that filter.</p>
            )}
          </div>
        </div>

        {/* Closure */}
        <div className="flex-1 overflow-y-auto">
          {!current ? (
            <p className="p-6 text-[12px] text-gray-600">Select a requirement.</p>
          ) : (
            <div className="p-5">
              <div className="mb-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Ident>{current.reqId}</Ident>
                  <StatusChip status={current.status} />
                  {current.baselined && <Lozenge tone="brand">under change control</Lozenge>}
                  <span className="font-mono text-[10px] text-gray-600">
                    {current.document} · {current.obligation} · {current.moscow}
                  </span>
                </div>
                <p className="max-w-3xl text-[13.5px] leading-relaxed text-gray-200">
                  {current.title}
                </p>
              </div>

              {!liveGraph ? (
                <div className="rounded-md border border-state-warn/25 bg-state-warn/[0.06] p-4">
                  <p className="text-[12px] text-state-warn">
                    Closure needs the graph. Start the spine and set{" "}
                    <code className="font-mono">VITE_SPINE_MODE=live</code> to traverse requirement →
                    code → test → defect.
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-gray-500">
                    cd spine &amp;&amp; ./.venv/Scripts/python -m spine.cli serve
                  </p>
                </div>
              ) : loadingTrace ? (
                <p className="text-[12px] text-gray-600">Traversing…</p>
              ) : !trace ? (
                <p className="text-[12px] text-gray-600">No closure returned.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  <Panel
                    title="Derives from"
                    count={trace.parents.length}
                    empty="Top-level business requirement."
                  >
                    {trace.parents.map((p) => (
                      <Row key={p.reqId} onClick={() => setSelected(p.reqId)}>
                        <Ident>{p.reqId}</Ident>
                        <span className="truncate text-[12px] text-gray-300">{p.statement}</span>
                        <StatusChip status={p.status} />
                      </Row>
                    ))}
                  </Panel>

                  <Panel
                    title="Decomposes into"
                    count={trace.children.length}
                    empty="No child requirements."
                  >
                    {trace.children.map((c) => (
                      <Row key={c.reqId} onClick={() => setSelected(c.reqId)}>
                        <Ident>{c.reqId}</Ident>
                        <span className="truncate text-[12px] text-gray-300">{c.statement}</span>
                        <StatusChip status={c.status} />
                      </Row>
                    ))}
                  </Panel>

                  <Panel
                    title="Implemented by"
                    count={trace.code.length}
                    empty="No code linked to this requirement."
                  >
                    {trace.code
                      .filter((c) => c.kind !== "file")
                      .slice(0, 24)
                      .map((c) => (
                        <Row key={c.unitId}>
                          <Lozenge tone="idle">{c.kind}</Lozenge>
                          <span className="truncate font-mono text-[11px] text-gray-300">
                            {c.name}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-gray-600">
                            {c.path.split("/").pop()}:{c.startLine}
                          </span>
                        </Row>
                      ))}
                  </Panel>

                  <Panel
                    title="Verified by"
                    count={trace.testCount}
                    subtitle={`${trace.verified} of ${trace.testCount} passing`}
                    empty="No test cases. An untested requirement is an assertion, not a control."
                  >
                    {trace.tests.map((t) => (
                      <Row key={t.testId + t.requirementId}>
                        <Ident>{t.testId}</Ident>
                        <span className="truncate text-[12px] text-gray-400">
                          verifies {t.requirementId}
                        </span>
                        <Lozenge tone={t.status === "satisfied" ? "pass" : "fail"}>
                          {t.status === "satisfied" ? "pass" : "fail"}
                        </Lozenge>
                      </Row>
                    ))}
                  </Panel>

                  {trace.defects.length > 0 && (
                    <Panel title="Open defects" count={trace.defects.length} empty="" tone="fail">
                      {trace.defects.map((d) => (
                        <Row key={d.defectId + d.requirementId}>
                          <Ident>{d.defectId}</Ident>
                          <span className="truncate text-[12px] text-gray-300">{d.title}</span>
                          <Lozenge tone="fail">{d.severity}</Lozenge>
                        </Row>
                      ))}
                    </Panel>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Panel({
  title,
  count,
  subtitle,
  empty,
  tone,
  children,
}: {
  title: string;
  count: number;
  subtitle?: string;
  empty: string;
  tone?: "fail";
  children?: React.ReactNode;
}) {
  return (
    <section className={`pane rounded-md ${tone === "fail" ? "border-state-fail/25" : ""}`}>
      <header className="flex items-baseline gap-2 border-b hairline px-3 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">{title}</h3>
        <span className="tnum font-mono text-[11px] text-gray-300">{count}</span>
        {subtitle && <span className="ml-auto font-mono text-[10px] text-gray-600">{subtitle}</span>}
      </header>
      <div className="divide-y divide-black/[0.05]">
        {count === 0 ? <p className="px-3 py-2.5 text-[11px] text-gray-600">{empty}</p> : children}
      </div>
    </section>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const content = (
    <div className="flex items-center gap-2 px-3 py-1.5">{children}</div>
  );
  return onClick ? (
    <button onClick={onClick} className="block w-full text-left hover:bg-black/[0.05]">
      {content}
    </button>
  ) : (
    content
  );
}
