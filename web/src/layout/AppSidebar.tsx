import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { BRAND } from "../brand";
import { useOrigin } from "../api/origin";

/**
 * The navigation rail.
 *
 * The console went light, and the navy went here. That is deliberate: on a
 * light field the rail is the one element that should carry the brand, and
 * anchoring it stops the rest of the page needing decoration to feel owned.
 *
 * Four of these routes are the demo and are real. Settings and Support are
 * declared `ready: false` and render as inert, labelled stubs rather than links
 * to a blank page -- a nav item that navigates to nothing is worse than one
 * that says it is not built.
 */

interface NavItem {
  label: string;
  path: string;
  ready: boolean;
  icon: string;
}

const NAV: NavItem[] = [
  { label: "Portfolio", path: "/portfolio", ready: true, icon: "M3 6h14v9H3zM3 9h14" },
  { label: "Strategy", path: "/strategy", ready: true, icon: "M3 14l4-5 3 3 4-6 3 3" },
  { label: "Analytics", path: "/analytics", ready: true, icon: "M4 16V9m4 7V5m4 11v-5m4 5V7" },
];

const WORKSPACE_NAV: NavItem[] = [
  { label: "Initiatives", path: "/initiatives", ready: true, icon: "M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" },
  { label: "Risk Register", path: "/risk", ready: true, icon: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-9v4m0 2v.01" },
];

/** The part of this build that is real. */
const DELIVERY_NAV: NavItem[] = [
  { label: "My Tasks", path: "/", ready: true, icon: "M4 10.5 8 14l8-8" },
  { label: "Project Health", path: "/delivery", ready: true, icon: "M3 6h14M3 10h14M3 14h9" },
  { label: "Code Review", path: "/live", ready: true, icon: "M3 10h3l2-5 3 10 2-5h4" },
  { label: "Knowledge Base", path: "/graph", ready: true, icon: "M10 3v4m0 6v4M4.5 6.5l3 3m5 5 3 3m0-11-3 3m-5 5-3 3" },
  { label: "Traceability", path: "/traceability", ready: true, icon: "M6 4v4m0 0a2 2 0 1 0 0 4m0-4h8a2 2 0 0 1 2 2v2m-2 4v-4" },
];

const FOOTER_NAV: NavItem[] = [
  { label: "Settings", path: "/settings", ready: false, icon: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6.5-2.5-1.6 1a5.6 5.6 0 0 1-.5 1.2l.5 1.8-1.8 1.8-1.8-.5a5.6 5.6 0 0 1-1.2.5l-1 1.6h-2.2l-1-1.6a5.6 5.6 0 0 1-1.2-.5l-1.8.5-1.8-1.8.5-1.8a5.6 5.6 0 0 1-.5-1.2l-1.6-1V8.9l1.6-1" },
  { label: "Support", path: "/support", ready: false, icon: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-3v.01M10 11c0-1.5 2-1.6 2-3a2 2 0 1 0-4 0" },
];

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { pathname } = useLocation();
  const origin = useOrigin();
  const open = isExpanded || isHovered || isMobileOpen;

  const render = (item: NavItem) => {
    const active = pathname === item.path;
    const inner = (
      <>
        <svg viewBox="0 0 20 20" fill="none" className="size-[17px] shrink-0" aria-hidden="true">
          <path d={item.icon} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {open && <span className="text-[12.5px]">{item.label}</span>}
        {open && !item.ready && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-white/35">soon</span>
        )}
      </>
    );

    const shared = `relative flex items-center gap-2.5 rounded-[10px] px-3 py-[7px] ${open ? "" : "justify-center px-0"}`;

    return (
      <li key={item.label}>
        {item.ready ? (
          <Link
            to={item.path}
            aria-current={active ? "page" : undefined}
            className={`${shared} transition-colors focus:outline-none focus-visible:bg-white/15 ${
              active ? "bg-white/[0.14] text-white" : "text-white/65 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-white" />}
            {inner}
          </Link>
        ) : (
          <div className={`${shared} cursor-not-allowed text-white/35`} title={`${item.label} — not built yet`}>
            {inner}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-gradient-to-b from-nav-top to-nav-bottom transition-all duration-200 ease-out
        ${open ? "w-[218px]" : "w-[60px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      <div className={`flex shrink-0 flex-col gap-2.5 px-4 pb-3 pt-4 ${open ? "" : "items-center px-0"}`}>
        <Link to="/" aria-label={`${BRAND.name} — ${BRAND.product}`} className="block">
          {open ? (
            <>
              <span className="block text-[20px] font-bold italic leading-none tracking-tight text-white">
                {BRAND.name}
              </span>
              <span className="mt-1 block text-[10.5px] font-medium leading-none text-white/60">
                {BRAND.product}
              </span>
            </>
          ) : (
            <span className="block text-[15px] font-bold italic leading-none text-white">
              {BRAND.name.slice(0, 1)}
            </span>
          )}
        </Link>

        <button
          type="button"
          title="Not built yet"
          className={`flex cursor-not-allowed items-center justify-center gap-1.5 rounded-[10px] bg-accent py-2 text-[12px] font-medium text-white/90 shadow-sm ${open ? "w-full" : "w-9"}`}
        >
          <span className="text-[13px] leading-none">+</span>
          {open && <span>New Insight</span>}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-0.5">{NAV.map(render)}</ul>
        {open && <p className="px-3 pb-1 pt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Workspace</p>}
        <ul className={`space-y-0.5 ${open ? "" : "mt-4"}`}>{WORKSPACE_NAV.map(render)}</ul>
        {open && <p className="px-3 pb-1 pt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Delivery · live</p>}
        <ul className={`space-y-0.5 ${open ? "" : "mt-4 border-t border-white/10 pt-4"}`}>{DELIVERY_NAV.map(render)}</ul>
      </nav>

      <div className="shrink-0 border-t border-white/10 px-2 pb-3 pt-2">
        <ul className="space-y-0.5">{FOOTER_NAV.map(render)}</ul>
        {open && (
          <div className="px-3 pb-2 pt-2 font-mono text-[9.5px] leading-relaxed text-white/40">
            <span className="text-state-pass">●</span> github · ci · confluence
            <br />
            <span className="text-white/30">○</span> jira · zephyr seeded
            <br />
            <span title="Whether the delivery graph is being read live or served from fixtures">
              {origin === "live" && <><span className="text-state-pass">●</span> graph live</>}
              {origin === "fixtures" && <><span className="text-state-warn">●</span> graph seeded</>}
              {origin === "fixtures-fallback" && <><span className="text-state-fail">●</span> spine unreachable</>}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
