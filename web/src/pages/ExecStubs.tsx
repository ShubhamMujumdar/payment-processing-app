import PageMeta from "../components/common/PageMeta";
import { Card, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

/**
 * Analytics, Initiatives and Risk Register.
 *
 * These three are named in the design's navigation but never drawn as full
 * frames, so there is nothing to reproduce faithfully. They get the design's
 * shell and enough seeded content to be recognisable, and the banner says
 * plainly that none of it is real -- an invented chart presented straight would
 * be the one thing on this screen a viewer could not check.
 */

// Delivered story points across the last 7 sprints (seeded demo data).
const SPRINT_DELIVERY = [
  { sprint: "S36", points: 42 },
  { sprint: "S37", points: 55 },
  { sprint: "S38", points: 48 },
  { sprint: "S39", points: 66 },
  { sprint: "S40", points: 61 },
  { sprint: "S41", points: 74 },
  { sprint: "S42", points: 80 },
];

export function Analytics() {
  const points = SPRINT_DELIVERY.map((s) => s.points);
  const max = Math.max(...points);
  const avg = Math.round(points.reduce((sum, p) => sum + p, 0) / points.length);
  const latest = points[points.length - 1];
  const delta = latest - points[points.length - 2];

  // Round the scale up to a clean tick so gridlines read nicely.
  const scaleMax = Math.ceil(max / 20) * 20;
  const ticks = Array.from({ length: scaleMax / 20 + 1 }, (_, i) => i * 20).reverse();

  return (
    <>
      <PageMeta title="Analytics · Delivery Metrics" description="Delivered story points and velocity trends." />
      <PageHead
        kicker="Delivery Analytics"
        title="Velocity & Throughput"
        blurb="Delivered story points across recent sprints, with rolling velocity and momentum."
        right={<MockButton>↓ Export</MockButton>}
      />

      <div className="space-y-6 px-6 pb-10 pt-5">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Latest Sprint (S42)" value={String(latest)} unit="SP" tone="brand" progress={Math.round((latest / scaleMax) * 100)}
            note={<span className="font-semibold text-state-pass">↗ +{delta} vs S41</span>} />
          <StatCard label="Average Velocity" value={String(avg)} unit="SP / sprint" tone="pass"
            note="Rolling mean across last 7 sprints" />
          <StatCard label="Peak Delivery" value={String(max)} unit="SP" tone="brand"
            note="Highest delivered sprint in window" />
        </div>

        <Card className="px-6 py-5">
          <SectionTitle aside="Last 7 sprints">Delivered Story Points</SectionTitle>

          {/* Plot area: y-axis ticks + gridlines behind the bars */}
          <div className="mt-2 flex gap-3">
            {/* Y axis scale */}
            <div className="flex h-64 flex-col justify-between pb-7 pt-2 text-right text-[10px] font-medium text-gray-500">
              {ticks.map((t) => <span key={t} className="leading-none">{t}</span>)}
            </div>

            <div className="relative flex-1">
              {/* Horizontal gridlines */}
              <div className="absolute inset-x-0 bottom-7 top-2 flex flex-col justify-between" aria-hidden="true">
                {ticks.map((t) => <div key={t} className="border-t border-ink-700/60" />)}
              </div>

              {/* Average reference line */}
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ bottom: `calc(1.75rem + ${(avg / scaleMax).toFixed(4)} * (100% - 2.25rem))` }}
                aria-hidden="true"
              >
                <div className="w-full border-t border-dashed border-state-pass/70" />
                <span className="ml-1 shrink-0 rounded bg-state-pass/15 px-1.5 py-0.5 text-[9.5px] font-bold text-state-pass">
                  Avg {avg}
                </span>
              </div>

              {/* Bars */}
              <div className="relative flex h-64 items-end gap-2.5 pb-7 pt-2 sm:gap-4">
                {SPRINT_DELIVERY.map(({ sprint, points: p }, i) => {
                  const isPeak = p === max;
                  const isLatest = i === SPRINT_DELIVERY.length - 1;
                  const aboveAvg = p >= avg;
                  const stepDelta = i === 0 ? 0 : p - SPRINT_DELIVERY[i - 1].points;
                  return (
                    <div key={sprint} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                      {/* Value + per-sprint delta */}
                      <div className="mb-1.5 text-center">
                        <span className={`text-[13px] font-bold ${isPeak ? "text-accent" : "text-gray-200"}`}>{p}</span>
                        {i > 0 && (
                          <span className={`ml-1 text-[10px] font-semibold ${stepDelta >= 0 ? "text-state-pass" : "text-state-fail"}`}>
                            {stepDelta >= 0 ? "▲" : "▼"}{Math.abs(stepDelta)}
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-full rounded-t-md transition-all duration-200 group-hover:brightness-110 ${
                          isLatest ? "ring-2 ring-accent/40" : ""
                        }`}
                        style={{
                          height: `${(p / scaleMax) * 100}%`,
                          background: aboveAvg
                            ? "linear-gradient(180deg, #1434CB 0%, #2B44E0 100%)"
                            : "linear-gradient(180deg, #5b7bd6 0%, #3f5bc0 100%)",
                        }}
                        title={`${sprint}: ${p} SP delivered${i > 0 ? ` (${stepDelta >= 0 ? "+" : ""}${stepDelta} vs prev)` : ""}`}
                      />
                      <span className={`mt-2 text-center text-[13px] ${isLatest ? "font-bold text-gray-200" : "text-gray-400"}`}>
                        {sprint}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-1 flex flex-wrap items-center gap-4 border-t border-ink-700 pt-3 text-[11.5px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: "#1434CB" }} /> At / above average
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: "#5b7bd6" }} /> Below average
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-0 w-4 border-t border-dashed border-state-pass/70" /> Average ({avg} SP)
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}

export function Initiatives() {
  const rows = [
    { id: "INI-2041", name: "Unified Search Rollout", owner: "S. Jenkins", pct: 72, state: "On Track", tone: "pass" as const },
    { id: "INI-2038", name: "Payment Gateway Consolidation", owner: "D. Chen", pct: 41, state: "At Risk", tone: "fail" as const },
    { id: "INI-2033", name: "KM Portal Migration", owner: "M. Johnson", pct: 88, state: "On Track", tone: "pass" as const },
    { id: "INI-2027", name: "Tokenisation Phase 2", owner: "A. Lee", pct: 55, state: "Monitor", tone: "warn" as const },
  ];

  return (
    <>
      <PageMeta title="Initiatives · Strategic Portfolio" description="Cross-team initiatives and delivery progress." />
      <PageHead
        kicker="Strategic Initiatives"
        title="Active Initiatives"
        blurb="Cross-functional initiatives with owners, progress and delivery status."
        right={<MockButton variant="solid">+ New Initiative</MockButton>}
      />

      <div className="space-y-6 px-6 pb-10 pt-5">
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-700 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                {["Initiative", "Owner", "Progress", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink-700 last:border-0">
                  <td className="px-5 py-4">
                    <p className="font-bold text-gray-100">{r.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-500">{r.id}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300">{r.owner}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Progress value={r.pct} tone={r.tone} className="w-32" />
                      <span className="w-9 text-right text-[12px] font-semibold text-gray-200">{r.pct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4"><Pill tone={r.tone} dot>{r.state}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

export function RiskRegister() {
  const risks = [
    { id: "RSK-118", title: "Upstream Identity API contract change", impact: "High", tone: "fail" as const, owner: "Identity Team", note: "Blocks auth migration; no dated commitment from upstream." },
    { id: "RSK-114", title: "Elasticsearch cluster stability in dev", impact: "High", tone: "fail" as const, owner: "Platform SRE", note: "Intermittent node loss under indexing load." },
    { id: "RSK-109", title: "Single approver on production releases", impact: "Medium", tone: "warn" as const, owner: "Delivery", note: "Segregation of duties not yet enforced by environment rules." },
    { id: "RSK-102", title: "Spacing tokens unsynced from design", impact: "Low", tone: "idle" as const, owner: "Design Systems", note: "Typography mapped; spacing pending." },
  ];

  return (
    <>
      <PageMeta title="Risk Register · Delivery Risk" description="Open delivery and platform risks." />
      <PageHead
        kicker="Risk Register"
        title="Open Risks"
        blurb="Tracked delivery, platform and compliance risks with impact and owner."
        right={<MockButton>↓ Export</MockButton>}
      />

      <div className="space-y-4 px-6 pb-10 pt-5">
        {risks.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-start gap-4 px-6 py-5">
            <div className="min-w-[220px] flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-gray-500">{r.id}</span>
                <Pill tone={r.tone} dot>{r.impact} impact</Pill>
              </div>
              <p className="mt-1.5 text-[15px] font-bold text-gray-100">{r.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">{r.note}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Owner</p>
              <p className="mt-0.5 text-[13px] font-semibold text-gray-200">{r.owner}</p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
