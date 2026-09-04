/**
 * code2doc client.
 *
 * A second service, deliberately separate from the spine. The spine answers
 * "what does the delivery record look like"; code2doc answers "what did this
 * commit just make untrue". They share no storage, so they get no shared
 * client — folding them together would imply a coupling that does not exist.
 *
 *   GET  /runs              recent commits and their analysis
 *   GET  /runs/{id}         one run in full, including proposed edits
 *   GET  /runs/{id}/ci      live GitHub Actions state for that commit
 *   GET  /stream            server-sent events, one per pipeline stage
 */

const BASE = import.meta.env.VITE_CODE2DOC_URL ?? "http://127.0.0.1:8099";

export type RunStatus =
  | "detected"
  | "analysing"
  | "retrieved"
  | "proposed"
  | "no-impact"
  | "published"
  | "failed";

/** The stages a commit passes through, in order. Drives the doc track. */
export const DOC_STAGES = ["detected", "analysing", "retrieving", "retrieved", "proposed"] as const;
export type DocStage = (typeof DOC_STAGES)[number];

export interface RunFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  skipped: boolean;
  reason: string;
}

export interface DocQuery {
  topic: string;
  question: string;
  rationale: string;
}

export interface Analysis {
  summary: string;
  change_kind: string;
  doc_impact_expected: boolean;
  queries: DocQuery[];
}

export interface Proposal {
  page_id: string;
  page_title: string;
  heading_path: string;
  url: string;
  anchor_url: string;
  line_start: number;
  line_end: number;
  vector_score: number;
  rerank_score: number;
  needs_change: boolean;
  existing_text: string;
  proposed_text: string;
  rationale: string;
  code_citation: string;
  confidence: string;
  published: boolean;
}

export interface StageTiming {
  kind: string;
  at: number;
  /** How long this stage took: the gap to the next event. Null on the last. */
  seconds: number | null;
}

export interface Run {
  run_id: string;
  sha: string;
  branch: string;
  message: string;
  author: string;
  committed_at: string;
  detected_at: number;
  url: string;
  status: RunStatus;
  diff: string | null;
  files: RunFile[] | null;
  analysis: Analysis | null;
  proposals: Proposal[] | null;
  error: string | null;
  timeline?: StageTiming[];
  total_seconds?: number | null;
}

export interface Workflow {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | null;
  url: string;
  started_at: string | null;
  updated_at: string | null;
}

export interface StageEvent {
  seq: number;
  run_id: string;
  kind: string;
  at: number;
  [key: string]: unknown;
}

async function get<T>(path: string, timeoutMs = 20000): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, { signal: abort.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getRuns = (limit = 25) =>
  get<{ count: number; watching: string | null; runs: Run[] }>(`/runs?limit=${limit}`);

export const getRun = (runId: string) => get<Run>(`/runs/${runId}`);

export const getRunCi = (runId: string) =>
  get<{ sha: string; configured: boolean; workflows: Workflow[] }>(`/runs/${runId}/ci`);

export interface PublishResult {
  page_id: string;
  title: string;
  current_version: number;
  new_version?: number;
  dry_run: boolean;
  ok: boolean;
  problem: string | null;
  fragments: { old: string; new: string; matches: number }[];
  published: boolean;
}

/**
 * Plan or perform the edit. Dry run returns exactly what would change without
 * touching Confluence — the UI always asks once before it means it.
 */
export async function publishProposal(
  runId: string,
  index: number,
  dryRun: boolean,
): Promise<PublishResult> {
  const response = await fetch(`${BASE}/runs/${runId}/proposals/${index}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dry_run: dryRun }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.detail ?? `${response.status}`);
  return body as PublishResult;
}

export const getHealth = () =>
  get<{ status: string; models_loaded: boolean; device: string }>("/health", 4000);

/**
 * Subscribe to pipeline events.
 *
 * Returns an unsubscribe function. Passing no cursor starts from now, so a
 * dashboard opened mid-demo does not replay the morning's commits.
 *
 * EventSource reconnects on its own, which is the reason for choosing it: a
 * laptop that sleeps mid-demo comes back without anyone touching the page.
 */
export function subscribe(
  onEvent: (event: StageEvent) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const source = new EventSource(`${BASE}/stream`);

  const handle = (raw: MessageEvent) => {
    try {
      onEvent(JSON.parse(raw.data) as StageEvent);
    } catch {
      /* a malformed frame must not kill the stream */
    }
  };

  source.addEventListener("hello", () => onStatus?.(true));
  for (const kind of ["detected", "analysing", "retrieving", "retrieved", "proposed", "no-impact", "failed", "published"]) {
    source.addEventListener(kind, handle as EventListener);
  }
  source.onerror = () => onStatus?.(false);

  return () => source.close();
}
