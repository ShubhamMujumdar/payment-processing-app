/**
 * Spine API client.
 *
 * Today this resolves from seeded fixtures. When the FastAPI service lands,
 * each method becomes a fetch against the matching section 11 endpoint and no
 * component changes - which is the whole point of coding the UI against the
 * contract rather than against whatever shape was convenient.
 *
 * Endpoint mapping:
 *   getPortfolio()     GET /packets + /analytics/stage-aging + /health/data-quality
 *   getPacketChain(id) GET /packets/{id}/chain
 */

import { buildPortfolio } from "./fixtures";
import type { PortfolioSummary, WorkPacket } from "./types";

const MODE = import.meta.env.VITE_SPINE_MODE ?? "fixtures";
const BASE = import.meta.env.VITE_SPINE_URL ?? "http://localhost:8000";

/** Fixtures resolve on a microtask; the delay only exists so loading states are
 *  exercised in development rather than discovered in production. */
const settle = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 120));

export async function getPortfolio(): Promise<PortfolioSummary> {
  if (MODE === "live") {
    const res = await fetch(`${BASE}/packets?include=stage-aging,data-quality`);
    if (!res.ok) throw new Error(`Spine returned ${res.status}`);
    return res.json();
  }
  return settle(buildPortfolio());
}

export async function getPacketChain(packetId: string): Promise<WorkPacket | undefined> {
  if (MODE === "live") {
    const res = await fetch(`${BASE}/packets/${packetId}/chain`);
    if (!res.ok) throw new Error(`Spine returned ${res.status}`);
    return res.json();
  }
  return settle(buildPortfolio().packets.find((p) => p.packetId === packetId));
}
