import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import BrandMark from "./BrandMark";

/**
 * Workspace navigation. Data types live in the console's tabs, not here - this
 * rail switches between different ways of looking at the same graph.
 */

interface NavItem {
  label: string;
  path: string;
  ready: boolean;
  icon: string;
}

const NAV: NavItem[] = [
  { label: "Delivery", path: "/", ready: true, icon: "M3 6h14M3 10h14M3 14h9" },
  { label: "Traceability", path: "/traceability", ready: false, icon: "M6 4v4m0 0a2 2 0 1 0 0 4m0-4h8a2 2 0 0 1 2 2v2m-2 4v-4" },
  { label: "Knowledge graph", path: "/graph", ready: false, icon: "M10 3v4m0 6v4M4.5 6.5l3 3m5 5 3 3m0-11-3 3m-5 5-3 3" },
  { label: "Insights", path: "/insights", ready: false, icon: "M4 16V9m4 7V5m4 11v-5m4 5V7" },
  { label: "Data quality", path: "/health", ready: false, icon: "M10 3.5 16.5 6v4c0 3.5-2.6 5.9-6.5 7-3.9-1.1-6.5-3.5-6.5-7V6L10 3.5Z" },
];

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { pathname } = useLocation();
  const open = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r hairline bg-ink-950 transition-all duration-200 ease-out
        ${open ? "w-[218px]" : "w-[60px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      <div className={`flex h-[45px] shrink-0 items-center border-b hairline ${open ? "px-4" : "justify-center"}`}>
        <Link to="/" aria-label="Cognizant SDLC Spine">
          <BrandMark collapsed={!open} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ul>
          {NAV.map((item) => {
            const active = pathname === item.path;
            const inner = (
              <>
                <svg viewBox="0 0 20 20" fill="none" className="size-[17px] shrink-0" aria-hidden="true">
                  <path d={item.icon} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {open && <span className="text-[12.5px]">{item.label}</span>}
                {open && !item.ready && (
                  <span className="ml-auto font-mono text-[9px] uppercase text-gray-700">soon</span>
                )}
              </>
            );

            const shared = `flex items-center gap-2.5 px-4 py-2 ${open ? "" : "justify-center px-0"}`;

            return (
              <li key={item.label} className="relative">
                {item.ready ? (
                  <Link
                    to={item.path}
                    aria-current={active ? "page" : undefined}
                    className={`${shared} transition-colors focus:outline-none focus-visible:bg-white/[0.05] ${
                      active ? "bg-white/[0.05] text-gray-100" : "text-gray-500 hover:text-gray-200"
                    }`}
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-cgz-cyan" />}
                    {inner}
                  </Link>
                ) : (
                  <div className={`${shared} cursor-not-allowed text-gray-700`} title={`${item.label} — not built yet`}>
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {open && (
        <div className="border-t hairline px-4 py-3 font-mono text-[10px] leading-relaxed text-gray-600">
          <span className="text-state-pass">●</span> github · ci live
          <br />
          <span className="text-state-idle">○</span> jira · confluence · zephyr seeded
        </div>
      )}
    </aside>
  );
}
