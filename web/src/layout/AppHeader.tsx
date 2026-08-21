import { useSidebar } from "../context/SidebarContext";
import { useOrigin } from "../api/origin";
import { BRAND } from "../brand";

/**
 * The header carries one thing the rest of the page cannot: how current the data
 * is, and where it came from. In an observability tool that is the first
 * question worth answering, and it is more useful than a search box nobody uses
 * in a demo.
 */



export default function AppHeader() {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
  const origin = useOrigin();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-black/[0.07] bg-ink-950/80 px-4 py-3 backdrop-blur-md md:px-6">
      <button
        onClick={() => {
          if (window.innerWidth >= 1024) toggleSidebar();
          else toggleMobileSidebar();
        }}
        aria-label="Toggle navigation"
        className="rounded-lg border border-black/[0.07] p-2 text-gray-400 transition-colors hover:bg-black/[0.05] hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <span className="text-[14px] font-semibold text-gray-100">{BRAND.portal}</span>

      {/* Search is in the design and has nothing behind it. Shown disabled and
          labelled rather than faked: a box that swallows what you type is worse
          than one that says it is not wired up. */}
      <label className="relative hidden min-w-0 flex-1 items-center md:flex md:max-w-[320px]">
        <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-2.5 size-3.5 text-gray-500" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          disabled
          placeholder="Search Knowledge Base…"
          title="Not built yet — ask the assistant instead"
          className="h-8 w-full cursor-not-allowed rounded-md border border-black/[0.09] bg-ink-800 pl-8 pr-3 text-[12px] text-gray-400 placeholder:text-gray-500"
        />
      </label>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border border-black/[0.09] px-2.5 py-1 font-mono text-[10px] text-gray-400"
          title="Which sources are live in this build"
        >
          <span className="size-1.5 rounded-full bg-state-pass" />
          github · ci · confluence
        </span>

        <span
          className="flex items-center gap-1.5 rounded-full border border-black/[0.09] px-2.5 py-1 font-mono text-[10px] text-gray-500"
          title="Jira and Zephyr have no connector yet; their rows are seeded"
        >
          <span className="size-1.5 rounded-full bg-state-idle" />
          jira · zephyr seeded
        </span>

        {origin === "live" && (
          <span className="rounded-full border border-cgz-cyan/30 bg-cgz-cyan/[0.08] px-2.5 py-1 font-mono text-[10px] text-cgz-cyan">
            live graph
          </span>
        )}
        {origin === "fixtures" && (
          <span className="rounded-full border border-state-warn/25 bg-state-warn/[0.08] px-2.5 py-1 font-mono text-[10px] text-state-warn">
            seeded data
          </span>
        )}
        {origin === "fixtures-fallback" && (
          <span
            className="rounded-full border border-state-fail/30 bg-state-fail/[0.08] px-2.5 py-1 font-mono text-[10px] text-state-fail"
            title="Live mode is configured but the spine did not respond, so this is seeded data"
          >
            spine unreachable — seeded
          </span>
        )}
      </div>
    </header>
  );
}
