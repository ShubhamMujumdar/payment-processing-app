import { useMemo, useState } from "react";
import { CODE_TYPES, NODE_COLOR, typeLabel } from "./nodeStyle";
import type { SavedQuery } from "../../api/client";

/**
 * Left rail of the explorer: what exists in the store, and the questions worth
 * asking about it.
 *
 * Classes are clickable because "show me all the methods" is the first thing
 * anyone tries, and making them read-only decoration forces people to guess a
 * search term for data they can already see the count of.
 *
 * The Code hierarchy is grouped under one heading with its own total, since a
 * flat list of eight code classes buries the eight non-code ones that matter
 * just as much.
 */

interface Props {
  types: { type: string; count: number }[];
  onLoadClass: (type: string) => void;
  queries: SavedQuery[];
  onRunQuery: (q: SavedQuery) => void;
  onRunCypher: (cypher: string) => void;
  busy: string | null;
  queryError: string | null;
}

export default function ClassBrowser({
  types,
  onLoadClass,
  queries,
  onRunQuery,
  onRunCypher,
  busy,
  queryError,
}: Props) {
  const [tab, setTab] = useState<"classes" | "queries">("classes");
  const [cypher, setCypher] = useState("");

  const { codeTypes, otherTypes, codeTotal } = useMemo(() => {
    const code = types.filter((t) => CODE_TYPES.includes(t.type));
    const other = types.filter((t) => !CODE_TYPES.includes(t.type) && t.type !== "Code");
    const total = types.find((t) => t.type === "Code")?.count ?? 0;
    return { codeTypes: code, otherTypes: other, codeTotal: total };
  }, [types]);

  const row = (t: { type: string; count: number }, indent = false) => (
    <button
      key={t.type}
      onClick={() => onLoadClass(t.type)}
      disabled={busy !== null}
      className={`group flex w-full items-center gap-2 rounded-[3px] py-1 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-40 ${
        indent ? "pl-5 pr-2" : "px-2"
      }`}
      title={`Show all ${t.count} ${typeLabel(t.type)} nodes`}
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: NODE_COLOR[t.type] ?? "var(--color-state-idle)" }}
      />
      <span className="truncate text-[12px] text-gray-300 group-hover:text-gray-100">
        {typeLabel(t.type)}
      </span>
      <span className="tnum ml-auto font-mono text-[10px] text-gray-600 group-hover:text-cgz-cyan">
        {busy === t.type ? "…" : t.count}
      </span>
    </button>
  );

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r hairline bg-ink-900">
      <div className="flex border-b hairline">
        {(["classes", "queries"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex-1 px-3 py-2 text-[12px] transition-colors ${
              tab === id ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {id === "classes" ? "Classes" : "Queries"}
            {tab === id && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-cgz-cyan" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tab === "classes" ? (
          <>
            <p className="px-2 pb-1.5 text-[10px] text-gray-600">
              Click a class to put its nodes on the canvas.
            </p>

            {otherTypes.map((t) => row(t))}

            {codeTypes.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => onLoadClass("Code")}
                  disabled={busy !== null}
                  className="group flex w-full items-center gap-2 rounded-[3px] px-2 py-1 text-left hover:bg-white/[0.05] disabled:opacity-40"
                  title={`Show all ${codeTotal} code nodes of every kind`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: NODE_COLOR.Code }}
                  />
                  <span className="text-[12px] font-medium text-gray-200">Code</span>
                  <span className="tnum ml-auto font-mono text-[10px] text-gray-600 group-hover:text-cgz-cyan">
                    {busy === "Code" ? "…" : codeTotal}
                  </span>
                </button>
                {/* Every code node is both Code and its concrete class, so the
                    subtypes are shown nested rather than as siblings. */}
                {codeTypes.map((t) => row(t, true))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="px-1 pb-2 text-[10px] leading-relaxed text-gray-600">
              Saved traversals. Each one answers a question somebody asks in a
              governance review.
            </p>

            <div className="space-y-1">
              {queries.map((q) => (
                <button
                  key={q.id}
                  onClick={() => onRunQuery(q)}
                  disabled={busy !== null}
                  className="w-full rounded-[3px] border hairline px-2 py-1.5 text-left transition-colors hover:border-cgz-cyan/40 hover:bg-cgz-cyan/[0.06] disabled:opacity-40"
                >
                  <p className="text-[12px] text-gray-200">{q.label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-gray-600">{q.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 border-t hairline pt-3">
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-gray-600">
                Cypher
              </p>
              <textarea
                value={cypher}
                onChange={(e) => setCypher(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onRunCypher(cypher);
                }}
                rows={5}
                spellCheck={false}
                placeholder={"MATCH (m:CodeMethod)\nWHERE m.name = 'initiateRefund'\nRETURN m"}
                className="w-full resize-y rounded-[3px] border hairline bg-ink-950 p-2 font-mono text-[11px] leading-relaxed text-gray-200 placeholder:text-gray-700 focus:border-cgz-cyan/50 focus:outline-none"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  onClick={() => onRunCypher(cypher)}
                  disabled={busy !== null || !cypher.trim()}
                  className="rounded-[3px] border border-cgz-cyan/30 bg-cgz-cyan/[0.08] px-2 py-1 font-mono text-[10px] text-cgz-cyan hover:bg-cgz-cyan/[0.14] disabled:opacity-40"
                >
                  run
                </button>
                <span className="font-mono text-[9px] text-gray-700">ctrl+enter</span>
              </div>

              {queryError && (
                <p className="mt-2 break-words rounded-[3px] border border-state-fail/30 bg-state-fail/[0.07] p-2 font-mono text-[10px] leading-relaxed text-state-fail">
                  {queryError}
                </p>
              )}

              <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
                Read-only. Writes are refused by the server, not just hidden here.
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
