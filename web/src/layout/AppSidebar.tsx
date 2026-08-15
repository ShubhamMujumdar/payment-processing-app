import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import BrandMark from "./BrandMark";

/**
 * Navigation mirrors the six slices of the design, so the sidebar doubles as a
 * statement of what the product is. Routes that are not built yet say so rather
 * than 404 - an honest disabled item beats a broken link in a client demo.
 */

interface NavItem {
  label: string;
  path: string;
  hint: string;
  ready: boolean;
  icon: React.ReactNode;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" fill="none" className="size-[18px] shrink-0" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV: NavItem[] = [
  {
    label: "Overview",
    path: "/",
    hint: "Where everything is",
    ready: true,
    icon: <Icon d="M3 10.5 10 4l7 6.5M5 9v7h10V9" />,
  },
  {
    label: "Work packets",
    path: "/packets",
    hint: "Custody chains",
    ready: false,
    icon: <Icon d="M3 6h14M3 10h14M3 14h9" />,
  },
  {
    label: "People",
    path: "/people",
    hint: "Time and workload",
    ready: false,
    icon: <Icon d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 16a6 6 0 0 1 12 0" />,
  },
  {
    label: "Traceability",
    path: "/traceability",
    hint: "Requirement to release",
    ready: false,
    icon: <Icon d="M6 4v4m0 0a2 2 0 1 0 0 4m0-4h8a2 2 0 0 1 2 2v2m-2 4v-4" />,
  },
  {
    label: "Knowledge graph",
    path: "/graph",
    hint: "Code, mapped",
    ready: false,
    icon: <Icon d="M10 3v4m0 6v4M4.5 6.5l3 3m5 5 3 3m0-11-3 3m-5 5-3 3" />,
  },
  {
    label: "Data quality",
    path: "/health",
    hint: "What we don't know",
    ready: false,
    icon: <Icon d="M10 3.5 16.5 6v4c0 3.5-2.6 5.9-6.5 7-3.9-1.1-6.5-3.5-6.5-7V6L10 3.5Z" />,
  },
];

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { pathname } = useLocation();
  const open = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/[0.06] bg-ink-900 px-4 py-5 transition-all duration-300 ease-in-out
        ${open ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      <div className={`mb-8 flex ${open ? "justify-start" : "justify-center"}`}>
        <Link to="/" aria-label="SDLC Spine home">
          <BrandMark collapsed={!open} />
        </Link>
      </div>

      <nav className="flex-1">
        {open && <p className="eyebrow mb-3 px-2">Views</p>}

        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.path;

            if (!item.ready) {
              return (
                <li key={item.label}>
                  <div
                    className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 ${
                      open ? "" : "justify-center"
                    }`}
                    title={`${item.label} — not built yet`}
                  >
                    {item.icon}
                    {open && (
                      <>
                        <span className="text-[13px]">{item.label}</span>
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-gray-700">
                          soon
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            }

            return (
              <li key={item.label}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                    ${open ? "" : "justify-center"}
                    ${
                      active
                        ? "bg-brand-500/[0.12] text-brand-300"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                    }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon}
                  {open && (
                    <span className="flex flex-col leading-tight">
                      <span className="text-[13px] font-medium">{item.label}</span>
                      <span className="text-[10px] text-gray-600">{item.hint}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {open && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="eyebrow mb-1.5">Source</p>
          <p className="font-mono text-[10px] leading-relaxed text-gray-500">
            payment-processing-app
            <br />
            <span className="text-brand-500">●</span> github, ci live
            <br />
            <span className="text-state-idle">○</span> jira, confluence seeded
          </p>
        </div>
      )}
    </aside>
  );
}
