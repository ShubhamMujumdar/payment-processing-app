import { useSidebar } from "../context/SidebarContext";

/**
 * The header carries one thing the rest of the page cannot: how current the data
 * is, and where it came from. In an observability tool that is the first
 * question worth answering, and it is more useful than a search box nobody uses
 * in a demo.
 */

const MODE = import.meta.env.VITE_SPINE_MODE ?? "fixtures";

export default function AppHeader() {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 py-3 backdrop-blur-md md:px-6">
      <button
        onClick={() => {
          if (window.innerWidth >= 1024) toggleSidebar();
          else toggleMobileSidebar();
        }}
        aria-label="Toggle navigation"
        className="rounded-lg border border-white/[0.06] p-2 text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 font-mono text-[10px] text-gray-400"
          title="Which sources are live in this build"
        >
          <span className="size-1.5 rounded-full bg-state-pass" />
          github · ci live
        </span>

        <span
          className="flex items-center gap-1.5 rounded-full border border-white/[0.07] px-2.5 py-1 font-mono text-[10px] text-gray-500"
          title="Jira, Confluence and test management are seeded fixtures in this build"
        >
          <span className="size-1.5 rounded-full bg-state-idle" />
          3 sources seeded
        </span>

        {MODE !== "live" && (
          <span className="rounded-full border border-state-warn/25 bg-state-warn/[0.08] px-2.5 py-1 font-mono text-[10px] text-state-warn">
            fixture mode
          </span>
        )}
      </div>
    </header>
  );
}
