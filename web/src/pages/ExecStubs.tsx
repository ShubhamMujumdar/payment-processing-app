import PageMeta from "../components/common/PageMeta";
import { Card, MockBanner, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

/**
 * Analytics, Initiatives and Risk Register.
 *
 * These three are named in the design's navigation but never drawn as full
 * frames, so there is nothing to reproduce faithfully. They get the design's
 * shell and enough seeded content to be recognisable, and the banner says
 * plainly that none of it is real -- an invented chart presented straight would
 * be the one thing on this screen a viewer could not check.
 */

export function Analytics() {
  const bars = [42, 55, 48, 66, 61, 74, 80];
  return (
    <>
      <PageMeta title="Analytics · Portfolio" description="Delivery analytics across the portfolio." />
      <MockBanner what="The design names this tab but does not specify it." />
      <PageHead kicker="Portfolio" title="Analytics"
        blurb="Throughput, cycle time and quality trends across every line of business."
        right={<MockButton>↓ Export</MockButton>} />
      <div className="space-y-6 px-6 pb-10 pt-5">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Cycle Time" value="4.2" unit="days" tone="pass" note="↓ 0.6 vs last quarter" />
          <StatCard label="Throughput" value="128" unit="SP/sprint" tone="brand" progress={74} />
          <StatCard label="Change Failure" value="7%" tone="warn" note="Target under 5%" />
          <StatCard label="Escaped Defects" value="3" tone="fail" note="Two in Commercial Payments" />
        </div>
        <Card className="px-6 py-5">
          <SectionTitle aside="Last 7 sprints">Delivered Story Points</SectionTitle>
          <div className="flex h-40 items-end gap-3">
            {bars.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-accent" style={{ height: `${b}%`, opacity: 0.35 + (i / bars.length) * 0.65 }} />
                <span className="font-mono text-[11px] text-gray-500">S{36 + i}</span>
              </div>
            ))}
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
      <PageMeta title="Initiatives · Workspace" description="Active initiatives across the portfolio." />
      <MockBanner what="The design names this tab but does not specify it." />
      <PageHead kicker="Workspace" title="Initiatives" blurb="Everything currently committed, and who owns it."
        right={<MockButton variant="solid">+ New Initiative</MockButton>} />
      <div className="px-6 pb-10 pt-5">
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink-700 bg-ink-800">
                {["Initiative", "Owner", "Progress", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-4">
                    <span className="block text-[14px] font-bold text-gray-100">{r.name}</span>
                    <span className="block font-mono text-[12px] text-gray-500">{r.id}</span>
                  </td>
                  <td className="px-5 py-4 text-[13px] text-gray-400">{r.owner}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Progress value={r.pct} tone={r.tone} className="max-w-[140px]" />
                      <span className="font-mono text-[12.5px] font-bold text-gray-300">{r.pct}%</span>
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
      <PageMeta title="Risk Register · Workspace" description="Open risks and their owners." />
      <MockBanner what="The design names this tab but does not specify it." />
      <PageHead kicker="Workspace" title="Risk Register" blurb="Open risks, their impact, and who is accountable for closing them." />
      <div className="space-y-3 px-6 pb-10 pt-5">
        {risks.map((r) => (
          <Card key={r.id}
            className={`relative overflow-hidden px-6 py-4 before:absolute before:inset-y-0 before:left-0 before:w-[4px] ${
              r.tone === "fail" ? "before:bg-state-fail" : r.tone === "warn" ? "before:bg-state-warn" : "before:bg-ink-600"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[12px] font-bold text-gray-500">{r.id}</span>
              <span className="min-w-0 flex-1 text-[14.5px] font-bold text-gray-100">{r.title}</span>
              <Pill tone={r.tone}>{r.impact} impact</Pill>
              <span className="text-[12.5px] text-gray-500">{r.owner}</span>
            </div>
            <p className="mt-1.5 text-[13px] text-gray-400">{r.note}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
