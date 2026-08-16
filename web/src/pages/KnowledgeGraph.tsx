import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import GraphCanvas from "../components/graph/GraphCanvas";
import ClassBrowser from "../components/graph/ClassBrowser";
import { NODE_COLOR, typeLabel } from "../components/graph/nodeStyle";
import {
  expandNode,
  getGraphNode,
  getGraphSchema,
  getSavedQueries,
  nodesOfType,
  runCypher,
  searchGraph,
  seedGraph,
  type GraphEdge,
  type GraphNode,
  type GraphSchema,
  type SavedQuery,
} from "../api/client";

/**
 * Graph explorer.
 *
 * The whole graph is far too large to draw at once — 700-odd nodes would be a
 * hairball nobody can read. So it works the way a graph browser does: start
 * from something, expand outwards, and keep only what you asked for on screen.
 */

export default function KnowledgeGraph() {
  const [schema, setSchema] = useState<GraphSchema | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GraphNode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GraphNode[]>([]);
  const searchTimer = useRef<number | null>(null);

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loadingClass, setLoadingClass] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  /* --- bootstrap ---------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const [s, seed, saved] = await Promise.all([
        getGraphSchema(),
        seedGraph("Requirement"),
        getSavedQueries(),
      ]);
      setSchema(s);
      setSavedQueries(saved);
      setNodes(seed.nodes);
      setEdges(seed.edges);
      // The seed already includes one node's neighbourhood, so mark it opened.
      const seededRoot = seed.edges.length
        ? seed.nodes.find((n) =>
            seed.edges.some((e) => e.source === n.id || e.target === n.id),
          )
        : undefined;
      if (seededRoot) setExpandedIds(new Set([seededRoot.id]));
      setLoading(false);
    })();
  }, []);

  /* --- search ------------------------------------------------------------- */
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      searchGraph(query, 25).then(setResults);
    }, 220);
  }, [query]);

  /* --- graph mutation ----------------------------------------------------- */
  const merge = useCallback((slice: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
    setNodes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      slice.nodes.forEach((n) => map.set(n.id, map.get(n.id) ?? n));
      return [...map.values()];
    });
    setEdges((prev) => {
      const seen = new Set(prev.map((e) => `${e.source}|${e.type}|${e.target}`));
      const added = slice.edges.filter(
        (e) => !seen.has(`${e.source}|${e.type}|${e.target}`),
      );
      return [...prev, ...added];
    });
  }, []);

  const expand = useCallback(
    async (id: string) => {
      // One expansion at a time. A double-click can otherwise fire two, and the
      // second arrives while the first is still merging.
      if (busyIdRef.current) return;
      busyIdRef.current = id;
      setBusyId(id);
      const slice = await expandNode(id, 25);
      merge({ nodes: [...slice.nodes], edges: slice.edges });
      setExpandedIds((prev) => new Set(prev).add(id));
      busyIdRef.current = null;
      setBusyId(null);
    },
    [merge],
  );

  const loadClass = useCallback(
    async (type: string) => {
      setLoadingClass(type);
      setQueryError(null);
      const slice = await nodesOfType(type, 250);
      if (slice.nodes.length === 0) {
        setQueryError(`No ${typeLabel(type)} nodes found.`);
      }
      merge(slice);
      setLoadingClass(null);
    },
    [merge],
  );

  const runSaved = useCallback(
    async (q: SavedQuery) => {
      setLoadingClass(q.id);
      setQueryError(null);
      const { slice, error } = await runCypher(q.cypher);
      if (error) setQueryError(error);
      else if (slice.nodes.length === 0) setQueryError("Query returned no nodes.");
      merge(slice);
      setLoadingClass(null);
    },
    [merge],
  );

  const runCustom = useCallback(
    async (cypher: string) => {
      if (!cypher.trim()) return;
      setLoadingClass("custom");
      setQueryError(null);
      const { slice, error } = await runCypher(cypher);
      if (error) setQueryError(error);
      else if (slice.nodes.length === 0) setQueryError("Query returned no nodes.");
      merge(slice);
      setLoadingClass(null);
    },
    [merge],
  );

  const addFromSearch = useCallback(
    async (node: GraphNode) => {
      merge({ nodes: [node], edges: [] });
      setSelectedId(node.id);
      setQuery("");
      setResults([]);
      await expand(node.id);
    },
    [merge, expand],
  );

  const removeSelected = () => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const clear = async () => {
    setNodes([]);
    setEdges([]);
    setExpandedIds(new Set());
    setSelectedId(null);
  };

  /* --- selection detail --------------------------------------------------- */
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const local = nodes.find((n) => n.id === selectedId) ?? null;
    setDetail(local);
    getGraphNode(selectedId).then((full) => full && setDetail(full));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const legend = useMemo(() => {
    const present = new Map<string, number>();
    nodes.forEach((n) => present.set(n.type, (present.get(n.type) ?? 0) + 1));
    return [...present.entries()].sort((a, b) => b[1] - a[1]);
  }, [nodes]);

  const relationshipCounts = useMemo(() => {
    const counts = new Map<string, number>();
    edges.forEach((e) => counts.set(e.type, (counts.get(e.type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [edges]);

  if (loading) return <div className="p-6 text-[12px] text-gray-600">Loading graph…</div>;

  if (!schema) {
    return (
      <div className="p-6">
        <div className="max-w-xl rounded-[3px] border border-state-warn/25 bg-state-warn/[0.06] p-4">
          <p className="text-[12px] text-state-warn">
            The graph explorer reads the live store, so it needs the spine running.
          </p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-gray-500">
            cd spine
            <br />
            ./.venv/Scripts/python -m spine.cli serve
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Graph explorer — SDLC Spine" description="Explore the knowledge graph" />

      {/* Toolbar */}
      <div className="relative z-20 flex flex-wrap items-center gap-2 border-b hairline px-3 py-2">
        <span className="text-[13px] font-medium text-gray-100">Graph explorer</span>
        <span className="font-mono text-[10px] text-gray-600">
          {nodes.length} shown · {edges.length} relationships ·{" "}
          {schema.types.reduce((sum, t) => sum + t.count, 0)} in store
        </span>

        <div className="relative ml-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any node — FR-PAY-044, RefundServiceImpl, DEF-001"
            className="h-7 w-[340px] rounded-[3px] border hairline bg-ink-950 px-2.5 text-[12px] text-gray-200 placeholder:text-gray-600 focus:border-cgz-cyan/50 focus:outline-none"
          />
          {results.length > 0 && (
            <div className="absolute right-0 top-8 z-50 max-h-[380px] w-[420px] overflow-y-auto rounded-[3px] border hairline bg-ink-900 shadow-2xl">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addFromSearch(r)}
                  className="flex w-full items-center gap-2 border-b border-white/[0.04] px-3 py-1.5 text-left hover:bg-white/[0.05]"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: NODE_COLOR[r.type] ?? "var(--color-state-idle)" }}
                  />
                  <span className="truncate font-mono text-[11.5px] text-gray-200">{r.caption}</span>
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-gray-600">
                    {typeLabel(r.type)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={clear}
          className="h-7 rounded-[3px] border hairline px-2 font-mono text-[10px] text-gray-500 hover:text-gray-200"
        >
          clear canvas
        </button>
      </div>

      <div className="flex h-[calc(100vh-90px)]">
        <ClassBrowser
          types={schema.types}
          onLoadClass={loadClass}
          queries={savedQueries}
          onRunQuery={runSaved}
          onRunCypher={runCustom}
          busy={loadingClass}
          queryError={queryError}
        />

        {/* Canvas */}
        <div className="relative flex-1">
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-sm text-center text-[12px] leading-relaxed text-gray-600">
                Canvas is empty. Click a class on the left, run a saved query, or search for
                something specific — then double-click nodes to expand outwards.
              </p>
            </div>
          ) : (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onExpand={expand}
              expandedIds={expandedIds}
              busyId={busyId}
            />
          )}
        </div>

        {/* Inspector */}
        <aside className="flex w-[330px] shrink-0 flex-col overflow-y-auto border-l hairline bg-ink-900">
          {detail ? (
            <>
              <header className="border-b hairline px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: NODE_COLOR[detail.type] ?? "var(--color-state-idle)" }}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                    {typeLabel(detail.type)}
                  </span>
                  {detail.degree != null && (
                    <span className="ml-auto font-mono text-[10px] text-gray-600">
                      {detail.degree} relationships
                    </span>
                  )}
                </div>
                <p className="break-words font-mono text-[12.5px] text-gray-100">{detail.caption}</p>
              </header>

              <div className="flex gap-1.5 border-b hairline px-3 py-2">
                <button
                  onClick={() => expand(detail.id)}
                  className="rounded-[3px] border border-cgz-cyan/30 bg-cgz-cyan/[0.08] px-2 py-1 font-mono text-[10px] text-cgz-cyan hover:bg-cgz-cyan/[0.14]"
                >
                  expand
                </button>
                <button
                  onClick={removeSelected}
                  className="rounded-[3px] border hairline px-2 py-1 font-mono text-[10px] text-gray-500 hover:text-gray-200"
                >
                  hide
                </button>
              </div>

              <div className="px-3 py-2">
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-gray-600">
                  Properties
                </p>
                <dl className="space-y-1.5">
                  {Object.entries(detail.properties)
                    .filter(([, v]) => v !== "" && v != null)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-mono text-[9.5px] text-gray-600">{k}</dt>
                        <dd className="break-words text-[11.5px] leading-snug text-gray-300">
                          {String(v)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>

              <div className="mt-auto border-t hairline px-3 py-2">
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-gray-600">
                  Connected here
                </p>
                {edges
                  .filter((e) => e.source === detail.id || e.target === detail.id)
                  .slice(0, 14)
                  .map((e, i) => {
                    const outgoing = e.source === detail.id;
                    const other = outgoing ? e.target : e.source;
                    return (
                      <button
                        key={`${e.type}-${other}-${i}`}
                        onClick={() => setSelectedId(other)}
                        className="flex w-full items-center gap-1.5 py-0.5 text-left hover:text-gray-200"
                      >
                        <span className="font-mono text-[9px] text-gray-600">
                          {outgoing ? "→" : "←"}
                        </span>
                        <span className="font-mono text-[9px] text-cgz-cyan">{e.type}</span>
                        <span className="truncate font-mono text-[10px] text-gray-500">
                          {other.split(":")[1]}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </>
          ) : (
            <div className="p-3">
              <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-gray-600">
                On canvas
              </p>
              {legend.length === 0 ? (
                <p className="text-[11px] text-gray-600">Nothing yet.</p>
              ) : (
                <ul className="mb-4 space-y-1">
                  {legend.map(([type, count]) => (
                    <li key={type} className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: NODE_COLOR[type] ?? "var(--color-state-idle)" }}
                      />
                      <span className="text-[11.5px] text-gray-300">{typeLabel(type)}</span>
                      <span className="tnum ml-auto font-mono text-[10px] text-gray-600">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {relationshipCounts.length > 0 && (
                <>
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-gray-600">
                    Relationships
                  </p>
                  <ul className="space-y-0.5">
                    {relationshipCounts.map(([type, count]) => (
                      <li key={type} className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-cgz-cyan">{type}</span>
                        <span className="tnum ml-auto font-mono text-[10px] text-gray-600">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="mt-4 border-t hairline pt-3 text-[11px] leading-relaxed text-gray-600">
                Click a node to inspect it. Double-click to pull in its neighbours. A dot in the
                corner of a node means it has neighbours not yet on screen.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
