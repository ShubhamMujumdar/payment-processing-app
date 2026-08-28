import { useLocation, useNavigate } from "react-router";
import { useSidebar } from "../context/SidebarContext";

/**
 * The top bar, built to the design's measurements rather than approximated:
 * 76px tall, a 39px search field at radius 10, and three 38x38 controls at the
 * same radius -- bell, settings, avatar. The avatar is a rounded square in the
 * design, not a circle, which is easy to get wrong by eye.
 *
 * The data-origin chips that used to live here are gone. They are not in the
 * design, and they were duplicating what the navigation rail already says at
 * its foot, which is now the single place this build admits which sources are
 * real.
 *
 * The search field and the two icon buttons have nothing behind them. They are
 * rendered disabled and titled, because a control that looks live and does
 * nothing is worse than one that says so.
 */

/** The design titles the bar per persona; the executive frames carry no title,
 *  because the page beneath already opens with a large one. */
const TITLES: Record<string, string> = {
  "/tasks": "My Tasks",
  "/delivery": "Project Health",
  "/live": "Code Review",
  "/traceability": "Traceability",
};

export default function AppHeader() {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = TITLES[pathname];

  function handleLogout() {
    localStorage.removeItem("demo_role");
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 flex h-[76px] items-center gap-4 border-b border-ink-700 bg-nav-top px-6">
      <button
        onClick={() => {
          if (window.innerWidth >= 1024) toggleSidebar();
          else toggleMobileSidebar();
        }}
        aria-label="Toggle navigation"
        className="grid size-9 shrink-0 place-items-center rounded-[10px] text-gray-400 transition-colors hover:bg-ink-800 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 lg:hidden"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {title && (
        <h2 className="shrink-0 text-[17px] font-bold tracking-[-0.01em] text-gray-100">{title}</h2>
      )}

      <label className="relative flex min-w-0 max-w-[420px] flex-1 items-center">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"
             className="pointer-events-none absolute left-4 size-4 text-gray-500">
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          disabled
          placeholder="Search Knowledge Base…"
          title="Not built yet — ask the assistant in the corner instead"
          className="h-[39px] w-full cursor-not-allowed rounded-[10px] border border-ink-700 bg-ink-800 pl-11 pr-3 text-[13.5px] text-gray-400 placeholder:text-gray-500"
        />
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <button type="button" aria-label="Notifications" title="Not built yet"
          className="relative grid size-[38px] cursor-not-allowed place-items-center rounded-[10px] text-gray-400">
          <svg viewBox="0 0 20 20" fill="none" className="size-[19px]" aria-hidden="true">
            <path d="M6 8a4 4 0 1 1 8 0c0 3 1 4 1 4H5s1-1 1-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8.5 15a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-state-fail" />
        </button>

        <button type="button" aria-label="Settings" title="Not built yet"
          className="grid size-[38px] cursor-not-allowed place-items-center rounded-[10px] text-gray-400">
          <svg viewBox="0 0 20 20" fill="none" className="size-[19px]" aria-hidden="true">
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 3v2m0 10v2m7-7h-2M5 10H3m11.9-4.9-1.4 1.4M6.5 13.5l-1.4 1.4m9.8 0-1.4-1.4M6.5 6.5 5.1 5.1"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <button type="button" onClick={handleLogout} aria-label="Sign out"
          className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-ink-700 bg-ink-800 px-3 text-[12.5px] font-semibold text-gray-300 transition-colors hover:border-gray-400 hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          style={{ height: 38, fontFamily: "Inter, sans-serif" }}>
          <svg viewBox="0 0 20 20" fill="none" className="size-[15px] shrink-0" aria-hidden="true">
            <path d="M13 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M9 13l4-3-4-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 10H4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
