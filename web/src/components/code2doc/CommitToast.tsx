import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { subscribe, type StageEvent } from "../../api/code2doc";

/**
 * The interruption.
 *
 * Mounted in the layout rather than on a page, because the point is that it
 * finds you: a commit lands while someone is looking at the delivery console,
 * and the console tells them. Clicking it goes to the live pipeline.
 *
 * It follows the run through its stages instead of firing once and vanishing,
 * so the thirty seconds between "a commit happened" and "here is what it made
 * stale" are visible rather than dead.
 */

const STAGE_TEXT: Record<string, string> = {
  detected: "reading the change…",
  analysing: "working out what it does…",
  retrieving: "searching Confluence…",
  retrieved: "ranking sections…",
  proposed: "documentation updates ready",
  "no-impact": "no documentation impact",
  failed: "analysis failed",
};

const TERMINAL = new Set(["proposed", "no-impact", "failed"]);

interface Toast {
  runId: string;
  message: string;
  author: string;
  sha: string;
  kind: string;
  proposed?: number;
}

export default function CommitToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    return subscribe((event: StageEvent) => {
      setToast((current) => {
        if (event.kind === "detected") {
          return {
            runId: event.run_id,
            message: String(event.message ?? "new commit"),
            author: String(event.author ?? ""),
            sha: String(event.sha ?? "").slice(0, 8),
            kind: event.kind,
          };
        }
        if (!current || current.runId !== event.run_id) return current;
        return {
          ...current,
          kind: event.kind,
          proposed: typeof event.proposed === "number" ? event.proposed : current.proposed,
        };
      });
    });
  }, []);

  // Auto-clear once it has finished and been seen for a while. A toast that
  // never leaves stops being an alert and becomes furniture.
  useEffect(() => {
    if (!toast || !TERMINAL.has(toast.kind)) return;
    const timer = setTimeout(() => setToast(null), 45000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast || dismissed === toast.runId) return null;
  // Already looking at it.
  if (pathname === "/live") return null;

  const done = TERMINAL.has(toast.kind);
  const failed = toast.kind === "failed";
  const hasEdits = toast.kind === "proposed" && (toast.proposed ?? 0) > 0;

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-[340px] animate-[slideIn_.25s_ease-out]">
      <div
        className={`rounded-lg border bg-ink-900/95 shadow-2xl backdrop-blur ${
          failed ? "border-state-fail/40" : hasEdits ? "border-brand-600/60" : "border-white/10"
        }`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="relative mt-0.5 flex h-2 w-2 shrink-0">
            {!done && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-70" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                failed ? "bg-state-fail" : done ? "bg-state-pass" : "bg-brand-500"
              }`}
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-brand-400">
              Commit {toast.sha}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] text-gray-200">{toast.message}</p>
            <p className="mt-1 text-[11.5px] text-gray-500">
              {hasEdits
                ? `${toast.proposed} documentation update${toast.proposed === 1 ? "" : "s"} ready`
                : STAGE_TEXT[toast.kind] ?? toast.kind}
            </p>
          </div>

          <button
            onClick={() => setDismissed(toast.runId)}
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-gray-600 hover:text-gray-300"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        <button
          onClick={() => {
            setDismissed(toast.runId);
            navigate("/live");
          }}
          className="w-full rounded-b-lg border-t border-white/[0.07] bg-white/[0.02] px-4 py-2 text-left text-[12px] text-brand-400 hover:bg-white/[0.05]"
        >
          Open live pipeline →
        </button>
      </div>
    </div>
  );
}
