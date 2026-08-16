/**
 * Spine API client.
 *
 * Two data sources, one contract. In live mode this reads the FastAPI service;
 * otherwise it resolves seeded fixtures. Both satisfy the same types, so no
 * component knows or cares which it got.
 *
 * Live mode falls back to fixtures if the API is unreachable, because a demo
 * should not show a stack trace when a terminal was closed. The fallback is
 * never silent: the payload carries `origin`, and the header renders it. A
 * console that implied live data while serving fixtures would undermine the one
 * thing this product is selling.
 *
 * Endpoint mapping:
 *   getConsole()       GET /console
 *   getTrace(reqId)    GET /trace/{reqId}
 *   getPacketChain(id) GET /packets/{id}/chain
 */

import { buildConsole } from "./consoleFixtures";
import { setOrigin } from "./origin";
import type { ConsoleData, WorkPacket } from "./types";

const MODE = import.meta.env.VITE_SPINE_MODE ?? "fixtures";
const BASE = import.meta.env.VITE_SPINE_URL ?? "http://127.0.0.1:8077";

const settle = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 80));

async function fetchJson<T>(path: string, timeoutMs = 15000): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: abort.signal });
    if (!res.ok) throw new Error(`Spine returned ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getConsole(): Promise<ConsoleData> {
  if (MODE !== "live") {
    setOrigin("fixtures");
    return settle({ ...buildConsole(), origin: "fixtures" as const });
  }
  try {
    const data = await fetchJson<ConsoleData>("/console");
    setOrigin("live");
    return { ...data, origin: "live" };
  } catch {
    setOrigin("fixtures-fallback");
    return { ...buildConsole(), origin: "fixtures-fallback" };
  }
}

export interface TraceClosure {
  requirement: string;
  parents: { reqId: string; statement: string; status: string }[];
  children: { reqId: string; statement: string; status: string }[];
  code: {
    unitId: string;
    kind: string;
    name: string;
    path: string;
    startLine: number;
    endLine: number;
  }[];
  tests: { testId: string; title: string; status: string; requirementId: string }[];
  defects: { defectId: string; title: string; severity: string; status: string; requirementId: string }[];
  verified: number;
  testCount: number;
}

/** Traceability closure for one requirement. Only meaningful against the live
 *  graph; fixtures return null so the view can say so rather than invent one. */
export async function getTrace(reqId: string): Promise<TraceClosure | null> {
  if (MODE !== "live") return settle(null);
  try {
    return await fetchJson<TraceClosure>(`/trace/${encodeURIComponent(reqId)}`);
  } catch {
    return null;
  }
}

export async function getPacketChain(packetId: string): Promise<WorkPacket | undefined> {
  if (MODE === "live") {
    try {
      return await fetchJson<WorkPacket>(`/packets/${packetId}/chain`);
    } catch {
      /* fall through to fixtures */
    }
  }
  return settle(buildConsole().packets.find((p) => p.packetId === packetId));
}

export interface CodeGraphUnit {
  unitId: string;
  kind: string;
  name: string;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
  introducedInPr?: number;
  lastChangedPr?: number;
  touchedByPrs?: string;
}

export interface CodeGraphEdge {
  source: string;
  target: string;
  type: "CONTAINS" | "CALLS" | "IMPLEMENTS";
  confidence: number;
}

export interface CodeGraph {
  units: CodeGraphUnit[];
  edges: CodeGraphEdge[];
  requirementLinks: CodeGraphEdge[];
}

/** The whole code graph. Only available live: fixtures have no parsed source. */
export async function getCodeGraph(): Promise<CodeGraph | null> {
  if (MODE !== "live") return settle(null);
  try {
    return await fetchJson<CodeGraph>("/code/graph", 30000);
  } catch {
    return null;
  }
}

/* --- generic graph exploration ------------------------------------------- */

export interface GraphNode {
  /** `Type:naturalKey`. Stable across reprojection, unlike a storage RID. */
  id: string;
  type: string;
  key: string;
  caption: string;
  subtitle: string;
  properties: Record<string, unknown>;
  degree?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphSlice {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSchema {
  types: { type: string; count: number }[];
  edgeTypes: string[];
}

const graphAvailable = () => MODE === "live";

export async function getGraphSchema(): Promise<GraphSchema | null> {
  if (!graphAvailable()) return null;
  try {
    return await fetchJson<GraphSchema>("/graph/schema");
  } catch {
    return null;
  }
}

export async function searchGraph(q: string, limit = 40): Promise<GraphNode[]> {
  if (!graphAvailable() || !q.trim()) return [];
  try {
    const res = await fetchJson<{ nodes: GraphNode[] }>(
      `/graph/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return res.nodes;
  } catch {
    return [];
  }
}

export async function expandNode(id: string, limit = 25): Promise<GraphSlice> {
  if (!graphAvailable()) return { nodes: [], edges: [] };
  try {
    return await fetchJson<GraphSlice>(
      `/graph/expand?id=${encodeURIComponent(id)}&limit=${limit}`,
      25000,
    );
  } catch {
    return { nodes: [], edges: [] };
  }
}

export async function getGraphNode(id: string): Promise<GraphNode | null> {
  if (!graphAvailable()) return null;
  try {
    return await fetchJson<GraphNode>(`/graph/node?id=${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function seedGraph(type = "Requirement", key = ""): Promise<GraphSlice> {
  if (!graphAvailable()) return { nodes: [], edges: [] };
  try {
    return await fetchJson<GraphSlice>(
      `/graph/seed?type=${encodeURIComponent(type)}&key=${encodeURIComponent(key)}`,
      25000,
    );
  } catch {
    return { nodes: [], edges: [] };
  }
}
