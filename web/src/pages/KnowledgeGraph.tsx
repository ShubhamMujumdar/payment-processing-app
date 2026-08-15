import { useEffect, useMemo, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { Ident, Lozenge } from "../components/console/primitives";
import { getCodeGraph, type CodeGraph, type CodeGraphUnit } from "../api/client";

/**
 * The code knowledge graph.
 *
 * Deliberately an ego view rather than a force-directed layout of all 257
 * nodes. A hairball is impressive for about five seconds and then cannot be
 * used to answer anything; showing one unit with its container, callers,
 * callees and requirements answers "what is this, what depends on it, and what
 * breaks if I change it" — which is the question people actually arrive with.
 *
 * Every unit carries pull-request provenance, so the rollback question ("what
 * backs out with PR #N") is a lookup rather than an archaeology exercise.
 */

const KIND_TONE: Record<string, string> = {
  file: "var(--color-stage-3)",
  class: "var(--color-stage-6)",
  interface: "var(--color-stage-8)",
  enum: "var(--color-stage-9)",
  record: "var(--color-stage-9)",
  method: "var(--color-stage-12)",
  field: "var(--color-stage-15)",
};

export default function KnowledgeGraph() {
  const [graph, setGraph] = useState<CodeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [prFilter, setPrFilter] = useState("");

  useEffect(() => {
    getCodeGraph()
      .then(setGraph)
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, CodeGraphUnit>();
    graph?.units.forEach((u) => map.set(u.unitId, u));
    return map;
  }, [graph]);

  const listed = useMemo(() => {
    if (!graph) return [];
    return graph.units
      .filter((u) => u.kind !== "file" && u.kind !== "field")
      .filter((u) => !query || `${u.name} ${u.path}`.toLowerCase().includes(query.toLowerCase()))
      .filter((u) =>
        !prFilter ? true : (u.touchedByPrs ?? "").split(",").includes(prFilter.replace("#", "")),
      )
      .sort((a, b) => a.path.localeCompare(b.path) || a.startLine - b.startLine);
  }, [graph, query, prFilter]);

  const selected = selectedId ? byId.get(selectedId) : undefined;

  const ego = useMemo(() => {
    if (!graph || !selected) return null;
    const parents = graph.edges
      .filter((e) => e.type === "CONTAINS" && e.target === selected.unitId)
      .map((e) => byId.get(e.source))
      .filter(Boolean) as CodeGraphUnit[];
    const children = graph.edges
      .filter((e) => e.type === "CONTAINS" && e.source === selected.unitId)
      .map((e) => byId.get(e.target))
      .filter(Boolean) as CodeGraphUnit[];
    const callers = graph.edges
      .filter((e) => e.type === "CALLS" && e.target === selected.unitId)
      .map((e) => byId.get(e.source))
      .filter(Boolean) as CodeGraphUnit[];
    const callees = graph.edges
      .filter((e) => e.type === "CALLS" && e.source === selected.unitId)
      .map((e) => byId.get(e.target))
      .filter(Boolean) as CodeGraphUnit[];
    const requirements = graph.requirementLinks
      .filter((e) => e.target === selected.unitId)
      .map((e) => e.source);
    return { parents, children, callers, callees, requirements };
  }, [graph, selected, byId]);

  if (loading) return <div className="p-6 text-[12px] text-gray-600">Parsing graph…</div>;

  if (!graph) {
    return (
      <div className="p-6">
        <div className="max-w-xl rounded-[3px] border border-state-warn/25 bg-state-warn/[0.06] p-4">
          <p className="text-[12px] text-state-warn">
            The code graph is built from source, so it only exists against the live spine.
          </p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-gray-500">
            cd spine
            <br />
            ./.venv/Scripts/python -m spine.cli codegraph
            <br />
            ./.venv/Scripts/python -m spine.cli serve
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Knowledge graph — SDLC Spine" description="Codebase mapped to requirements" />

      <div className="flex items-center gap-3 border-b hairline px-4 py-2">
        <span className="text-[13px] font-medium text-gray-100">Code graph</span>
        <span className="font-mono text-[10px] text-gray-600">
          {graph.units.length} units · {graph.edges.length} edges ·{" "}
          {graph.requirementLinks.length} requirement links
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={prFilter}
            onChange={(e) => setPrFilter(e.target.value)}
            placeholder="Rollback: PR #"
            className="h-7 w-32 rounded-[3px] border hairline bg-ink-950 px-2.5 font-mono text-[11px] text-gray-200 placeholder:text-gray-600 focus:border-cgz-cyan/50 focus:outline-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a type or method"
            className="h-7 w-56 rounded-[3px] border hairline bg-ink-950 px-2.5 text-[12px] text-gray-200 placeholder:text-gray-600 focus:border-cgz-cyan/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex h-[calc(100vh-90px)]">
        <div className="w-[380px] shrink-0 overflow-y-auto border-r hairline">
          {prFilter && (
            <p className="border-b hairline px-3 py-2 text-[11px] text-state-warn">
              {listed.length} unit{listed.length === 1 ? "" : "s"} would back out with PR #
              {prFilter.replace("#", "")}
            </p>
          )}
          {listed.map((u) => {
            const active = u.unitId === selectedId;
            return (
              <button
                key={u.unitId}
                onClick={() => setSelectedId(u.unitId)}
                className={`relative flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-1.5 text-left transition-colors ${
                  active ? "bg-cgz-blue/[0.14]" : "hover:bg-white/[0.03]"
                }`}
              >
                {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-cgz-cyan" />}
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: KIND_TONE[u.kind] ?? "var(--color-state-idle)" }}
                />
                <span className="truncate font-mono text-[11.5px] text-gray-300">{u.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[9px] text-gray-600">
                  {u.path.split("/").pop()}:{u.startLine}
                </span>
              </button>
            );
          })}
          {!listed.length && <p className="p-4 text-[12px] text-gray-600">No units match.</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!selected || !ego ? (
            <p className="text-[12px] text-gray-600">Select a unit to see its neighbourhood.</p>
          ) : (
            <>
              <div className="mb-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Lozenge tone="brand">{selected.kind}</Lozenge>
                  <span className="font-mono text-[14px] text-gray-100">{selected.name}</span>
                  <Ident dim>
                    {selected.path}:{selected.startLine}-{selected.endLine}
                  </Ident>
                </div>
                {selected.signature && (
                  <p className="font-mono text-[11px] text-gray-500">{selected.signature}</p>
                )}
              </div>

              {/* Provenance: the rollback answer */}
              <section className="pane mb-4 rounded-[3px] p-3">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  Provenance
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Introduced in PR" value={selected.introducedInPr || "—"} />
                  <Field label="Last changed in PR" value={selected.lastChangedPr || "—"} />
                  <Field label="Live PRs in range" value={selected.touchedByPrs || "—"} />
                </div>
                {!selected.touchedByPrs && (
                  <p className="mt-2 text-[11px] text-gray-600">
                    No pull request touches this range — it arrived in a direct push, so there is
                    nothing to revert it with.
                  </p>
                )}
              </section>

              <EgoGraph selected={selected} ego={ego} onSelect={setSelectedId} byId={byId} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-gray-600">{label}</p>
      <p className="tnum mt-0.5 font-mono text-[13px] text-gray-200">{value}</p>
    </div>
  );
}

function EgoGraph({
  selected,
  ego,
  onSelect,
}: {
  selected: CodeGraphUnit;
  ego: {
    parents: CodeGraphUnit[];
    children: CodeGraphUnit[];
    callers: CodeGraphUnit[];
    callees: CodeGraphUnit[];
    requirements: string[];
  };
  onSelect: (id: string) => void;
  byId: Map<string, CodeGraphUnit>;
}) {
  const columns: { title: string; hint: string; items: CodeGraphUnit[]; tone: string }[] = [
    { title: "Called by", hint: "breaks if this changes", items: ego.callers, tone: "var(--color-stage-6)" },
    { title: "Contains", hint: "", items: ego.children, tone: "var(--color-stage-12)" },
    { title: "Calls", hint: "this depends on", items: ego.callees, tone: "var(--color-stage-14)" },
  ];

  return (
    <div className="space-y-4">
      {ego.parents.length > 0 && (
        <section className="pane rounded-[3px]">
          <header className="border-b hairline px-3 py-1.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
              Declared in
            </h3>
          </header>
          {ego.parents.map((p) => (
            <button
              key={p.unitId}
              onClick={() => onSelect(p.unitId)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.04]"
            >
              <Lozenge tone="idle">{p.kind}</Lozenge>
              <span className="font-mono text-[11.5px] text-gray-300">{p.name}</span>
            </button>
          ))}
        </section>
      )}

      {ego.requirements.length > 0 && (
        <section className="pane rounded-[3px] border-cgz-cyan/20">
          <header className="flex items-baseline gap-2 border-b hairline px-3 py-1.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-cgz-cyan">
              Satisfies
            </h3>
            <span className="tnum font-mono text-[11px] text-gray-400">
              {ego.requirements.length}
            </span>
            <span className="ml-auto text-[10px] text-gray-600">
              changing this code changes what these requirements claim
            </span>
          </header>
          <div className="flex flex-wrap gap-1.5 px-3 py-2">
            {ego.requirements.map((r) => (
              <span
                key={r}
                className="rounded-[3px] border border-cgz-cyan/25 bg-cgz-cyan/[0.07] px-1.5 py-px font-mono text-[10px] text-cgz-cyan"
              >
                {r}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {columns.map((col) => (
          <section key={col.title} className="pane rounded-[3px]">
            <header className="flex items-baseline gap-2 border-b hairline px-3 py-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: col.tone }} />
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                {col.title}
              </h3>
              <span className="tnum font-mono text-[11px] text-gray-400">{col.items.length}</span>
            </header>
            {col.items.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-gray-600">None.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {col.items.map((u) => (
                  <button
                    key={u.unitId + col.title}
                    onClick={() => onSelect(u.unitId)}
                    className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-white/[0.04]"
                  >
                    <span className="truncate font-mono text-[11px] text-gray-400">{u.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-gray-700">
                      {u.path.split("/").pop()}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {col.hint && col.items.length > 0 && (
              <p className="border-t hairline px-3 py-1 text-[10px] text-gray-600">{col.hint}</p>
            )}
          </section>
        ))}
      </div>

      <p className="text-[10px] text-gray-600">
        Call edges are matched on method name without a type checker, so they are indicative rather
        than exact — recorded at 0.4 confidence in the graph.
      </p>
      <span className="hidden">{selected.unitId}</span>
    </div>
  );
}
