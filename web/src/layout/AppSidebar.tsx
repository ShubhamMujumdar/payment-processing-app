import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { BRAND } from "../brand";
import { useOrigin } from "../api/origin";

interface NavItem {
  label: string;
  path: string;
  ready: boolean;
  icon: string;
}


const DELIVERY_NAV: NavItem[] = [
  { label: "My Tasks", path: "/tasks", ready: true, icon: "M4 10.5 8 14l8-8" },
  { label: "Project Health", path: "/delivery", ready: true, icon: "M3 6h14M3 10h14M3 14h9" },
  { label: "Code Review", path: "/live", ready: true, icon: "M3 10h3l2-5 3 10 2-5h4" },
  { label: "Knowledge Base", path: "/graph", ready: true, icon: "M10 3v4m0 6v4M4.5 6.5l3 3m5 5 3 3m0-11-3 3m-5 5-3 3" },
  { label: "Traceability", path: "/traceability", ready: true, icon: "M6 4v4m0 0a2 2 0 1 0 0 4m0-4h8a2 2 0 0 1 2 2v2m-2 4v-4" },
];

const FOOTER_NAV: NavItem[] = [
  { label: "Settings", path: "/settings", ready: false, icon: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6.5-2.5-1.6 1a5.6 5.6 0 0 1-.5 1.2l.5 1.8-1.8 1.8-1.8-.5a5.6 5.6 0 0 1-1.2.5l-1 1.6h-2.2l-1-1.6a5.6 5.6 0 0 1-1.2-.5l-1.8.5-1.8-1.8.5-1.8a5.6 5.6 0 0 1-.5-1.2l-1.6-1V8.9l1.6-1" },
  { label: "Support", path: "/support", ready: false, icon: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-3v.01M10 11c0-1.5 2-1.6 2-3a2 2 0 1 0-4 0" },
];

const WFM_CHILDREN: NavItem[] = [
  { label: "Portfolio", path: "/portfolio", ready: true, icon: "M3 6h14v9H3zM3 9h14" },
  { label: "Strategy", path: "/strategy", ready: true, icon: "M3 14l4-5 3 3 4-6 3 3" },
  { label: "Analytics", path: "/analytics", ready: true, icon: "M4 16V9m4 7V5m4 11v-5m4 5V7" },
  { label: "Initiatives", path: "/initiatives", ready: true, icon: "M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" },
  { label: "Risk Register", path: "/risk", ready: true, icon: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-9v4m0 2v.01" },
];

const KNOWLEDGE_MGMT: NavItem = {
  label: "Knowledge Management",
  path: "/knowledge-management",
  ready: true,
  icon: "M10 3v4m0 6v4M4.5 6.5l3 3m5 5 3 3m0-11-3 3m-5 5-3 3",
};

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { pathname } = useLocation();
  const origin = useOrigin();
  const open = isExpanded || isHovered || isMobileOpen;
  const isExecutive = localStorage.getItem("demo_role") === "user_executive";
  const [wfmExpanded, setWfmExpanded] = useState(true);

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
            className={`${shared} transition-colors focus:outline-none focus-visible:bg-white/10 ${
              active
                ? "bg-white text-[#0A1F5F]"
                : "text-white/80 hover:bg-white/[0.09] hover:text-white"
            }`}
          >
            {inner}
          </Link>
        ) : (
          <div className={`${shared} cursor-not-allowed text-white/30`} title={`${item.label} — not built yet`}>
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
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-[#0A1F5F] transition-all duration-200 ease-out
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

      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        {isExecutive ? (
          <>
            {/* Workforce Management collapsible group */}
            <div className="mb-1">
              {open && (
                <button
                  onClick={() => setWfmExpanded((v) => !v)}
                  className="flex w-full items-center justify-between rounded-[10px] px-3 py-[7px] text-white/80 transition-colors hover:bg-white/[0.09] hover:text-white"
                >
                  <span className="text-[12.5px]">Workforce Management</span>
                  <svg viewBox="0 0 20 20" fill="none" className={`size-3.5 shrink-0 transition-transform duration-150 ${wfmExpanded ? "rotate-180" : ""}`} aria-hidden="true">
                    <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {(wfmExpanded || !open) && (
                <ul className={`space-y-0.5 ${open ? "pl-2" : ""}`}>
                  {WFM_CHILDREN.map(render)}
                </ul>
              )}
            </div>
            {/* Knowledge Management — top-level link, no icon, same level as WFM header */}
            {open && (
              <Link
                to={KNOWLEDGE_MGMT.path}
                aria-current={pathname === KNOWLEDGE_MGMT.path ? "page" : undefined}
                className={`relative flex w-full items-center rounded-[10px] px-3 py-[7px] text-[12.5px] transition-colors focus:outline-none focus-visible:bg-white/10 ${
                  pathname === KNOWLEDGE_MGMT.path
                    ? "bg-white text-[#0A1F5F]"
                    : "text-white/80 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                {KNOWLEDGE_MGMT.label}
              </Link>
            )}
          </>
        ) : (
          <>
            {open && (
              <Link
                to="/knowledge-management"
                aria-current={pathname === "/knowledge-management" ? "page" : undefined}
                className={`mb-1 flex w-full items-center rounded-[10px] px-3 py-[7px] text-[12.5px] transition-colors focus:outline-none focus-visible:bg-white/10 ${
                  pathname === "/knowledge-management"
                    ? "bg-white text-[#0A1F5F]"
                    : "text-white/80 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                Knowledge Management
              </Link>
            )}
            {open && <p className="px-3 pb-1 pt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">Delivery</p>}
            <ul className={`space-y-0.5 ${open ? "" : "mt-4 border-t border-white/10 pt-4"}`}>{DELIVERY_NAV.map(render)}</ul>
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-2 pb-3 pt-2">
        <ul className="space-y-0.5">{FOOTER_NAV.map(render)}</ul>
        {open && (
          <div className="px-3 pb-2 pt-2 font-mono text-[9.5px] leading-relaxed text-white/35">
            <span className="text-state-pass">●</span> github · ci · confluence
            <br />
            <span className="text-white/20">○</span> jira · zephyr seeded
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
