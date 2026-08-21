import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

/**
 * The assistant, as a panel that lives in the corner of every page.
 *
 * It streams. The reply arrives token by token and each tool call is announced
 * as it happens, because the honest latency here is several seconds -- a
 * cross-encoder pass over the corpus is not instant -- and a spinner for that
 * long reads as a hang. Naming the lookup turns dead time into an explanation
 * of what the answer is being built from.
 *
 * The session id is kept in localStorage, so the conversation is still there
 * after a reload. State lives on the server; this only remembers which thread
 * to ask for.
 */

const BASE = import.meta.env.VITE_CODE2DOC_URL ?? "http://127.0.0.1:8099";
const SESSION_KEY = "code2doc.chat.session";

/** What each tool is doing, in the user's terms rather than the function's. */
const TOOL_LABEL: Record<string, string> = {
  search_documentation: "Searching the documentation",
  search_delivery_graph: "Searching the delivery record",
  graph_overview: "Reading the delivery graph",
  recent_commits: "Reading recent commits",
  plan_confluence_edit: "Checking the live page",
};

const SUGGESTIONS = [
  "What is the documented minimum payment amount?",
  "What has changed on the branch recently?",
  "Who is holding DEF-PAY-201?",
];

interface Message {
  role: "user" | "assistant";
  text: string;
  tools?: string[];
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(localStorage.getItem(SESSION_KEY));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The greeting appears once, a beat after the page settles, and never again
  // in this tab. A bubble that reappears on every navigation is an irritant.
  useEffect(() => {
    if (sessionStorage.getItem("code2doc.chat.greeted")) return;
    const timer = setTimeout(() => {
      setGreeted(true);
      sessionStorage.setItem("code2doc.chat.greeted", "1");
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeTool]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Replay the thread on first open, so reopening continues rather than restarts.
  useEffect(() => {
    if (!open || !sessionRef.current || messages.length) return;
    fetch(`${BASE}/chat/${sessionRef.current}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.messages?.length) {
          setMessages(d.messages.map((m: { role: string; text: string }) => ({
            role: m.role === "user" ? "user" : "assistant",
            text: m.text,
          })));
        }
      })
      .catch(() => undefined);
  }, [open, messages.length]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      setError(null);
      setInput("");
      setBusy(true);
      setMessages((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "" }]);

      const calls: string[] = [];
      try {
        const response = await fetch(`${BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, session_id: sessionRef.current }),
        });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line; anything after the last
          // one is a partial frame and has to wait for the next chunk.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const event = /^event: (.+)$/m.exec(frame)?.[1];
            const raw = /^data: (.+)$/m.exec(frame)?.[1];
            if (!event || !raw) continue;
            const data = JSON.parse(raw);

            if (event === "session") {
              sessionRef.current = data.session_id;
              localStorage.setItem(SESSION_KEY, data.session_id);
            } else if (event === "token") {
              setActiveTool(null);
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  text: next[next.length - 1].text + data.text,
                };
                return next;
              });
            } else if (event === "tool") {
              calls.push(data.name);
              setActiveTool(TOOL_LABEL[data.name] ?? data.name);
            } else if (event === "done") {
              setMessages((m) => {
                const next = [...m];
                next[next.length - 1] = { role: "assistant", text: data.text, tools: [...calls] };
                return next;
              });
            } else if (event === "error") {
              setError(data.message);
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
        setActiveTool(null);
      }
    },
    [busy],
  );

  const clear = useCallback(async () => {
    if (sessionRef.current) {
      await fetch(`${BASE}/chat/${sessionRef.current}`, { method: "DELETE" }).catch(() => undefined);
    }
    localStorage.removeItem(SESSION_KEY);
    sessionRef.current = null;
    setMessages([]);
    setError(null);
  }, []);

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999] flex items-end gap-2.5">
        {greeted && (
          <button
            onClick={() => { setOpen(true); setGreeted(false); }}
            className="mb-1 max-w-[220px] rounded-lg rounded-br-sm border border-white/10 bg-ink-900 px-3.5 py-2.5 text-left text-[12.5px] text-gray-300 shadow-xl transition hover:border-cgz-cyan/40"
          >
            <span className="block font-medium text-gray-100">How may I help you?</span>
            <span className="mt-0.5 block text-[11.5px] text-gray-500">
              Ask about the docs, the code, or who holds what.
            </span>
          </button>
        )}
        <button
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="grid h-12 w-12 place-items-center rounded-full bg-cgz-cyan text-ink-950 shadow-lg shadow-cgz-cyan/20 transition hover:scale-105 active:scale-95"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex h-[min(620px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-950 shadow-2xl">
      <header className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-state-pass" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-gray-200">Assistant</p>
          <p className="truncate text-[10.5px] text-gray-600">
            Documentation, delivery record and recent commits
          </p>
        </div>
        <button onClick={clear} disabled={busy || !messages.length}
          className="rounded px-1.5 py-1 text-[11px] text-gray-500 transition hover:text-gray-300 disabled:opacity-30"
          title="Clear this conversation">
          clear
        </button>
        <button onClick={() => setOpen(false)} aria-label="Close assistant"
          className="rounded px-1.5 py-1 text-[15px] leading-none text-gray-500 transition hover:text-gray-300">
          ×
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!messages.length && (
          <div className="pt-2">
            <p className="text-[13px] text-gray-300">How may I help you?</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-gray-600">
              I can search the Confluence corpus, the delivery graph, and the commits
              the pipeline has watched. I cite what I use.
            </p>
            <div className="mt-3 space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="block w-full rounded border border-white/5 bg-white/[0.02] px-3 py-2 text-left text-[11.5px] text-gray-400 transition hover:border-cgz-cyan/30 hover:text-gray-200">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-cgz-cyan/10 px-3 py-2 text-[12.5px] text-gray-200">
                {m.text}
              </p>
            ) : (
              <div className="max-w-full">
                {!!m.tools?.length && (
                  <p className="mb-1.5 text-[10.5px] text-gray-600">
                    {[...new Set(m.tools)].map((t) => TOOL_LABEL[t] ?? t).join(" · ")}
                  </p>
                )}
                <div className="chat-prose text-[12.5px] leading-relaxed text-gray-300">
                  <ReactMarkdown
                    components={{
                      a: ({ ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer"
                           className="text-cgz-cyan underline decoration-cgz-cyan/30 hover:decoration-cgz-cyan" />
                      ),
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                  {busy && i === messages.length - 1 && !m.text && !activeTool && (
                    <span className="inline-block h-3 w-1.5 animate-pulse bg-gray-500 align-middle" />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {activeTool && (
          <p className="flex items-center gap-2 text-[11px] text-cgz-cyan/80">
            <span className="h-1 w-1 animate-ping rounded-full bg-cgz-cyan" />
            {activeTool}…
          </p>
        )}

        {error && (
          <p className="rounded border border-state-fail/20 bg-state-fail/5 px-3 py-2 text-[11.5px] text-state-fail">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-white/5 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about the docs, code or delivery…"
            className="max-h-28 flex-1 resize-none bg-transparent px-1 py-1.5 text-[12.5px] text-gray-200 placeholder:text-gray-600 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="grid h-7 w-7 shrink-0 place-items-center rounded bg-cgz-cyan text-ink-950 transition disabled:opacity-25"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
