import { useSyncExternalStore } from "react";
import type { ConsoleData } from "./types";

/**
 * Where the data on screen actually came from.
 *
 * A tiny store rather than context: the header needs it, pages set it, and
 * threading a provider through the whole tree for one string would be worse.
 * It exists so the interface can never imply live data while serving fixtures —
 * in a product whose entire pitch is provenance, that would be the one lie that
 * matters.
 */

type Origin = NonNullable<ConsoleData["origin"]>;

let current: Origin | null = null;
const listeners = new Set<() => void>();

export function setOrigin(origin: Origin | undefined) {
  if (!origin || origin === current) return;
  current = origin;
  listeners.forEach((fn) => fn());
}

export function useOrigin(): Origin | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
}
