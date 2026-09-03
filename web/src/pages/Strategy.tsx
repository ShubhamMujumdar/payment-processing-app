import { useState } from "react";
import { Link } from "react-router";
import PageMeta from "../components/common/PageMeta";
import { Card, InsightCard, MockButton, PageHead, Pill, Progress, SectionTitle, StatCard } from "../components/visa/kit";

type ProjectId = "PRJ-009A" | "PRJ-009B" | "PRJ-009C";

interface TeamMember { name: string; role: string; cap: string; tone: "brand" | "warn" | "fail" }
interface HandoffItem { label: string; value: string; pct: number; tone: "brand" | "pass" | "warn"; note: string }

interface Project {
  name: string;
  statusTone: "pass" | "warn" | "brand";
  healthState: string;
  completion: number;
  health: number;
  healthTone: "brand" | "pass" | "warn";
  healthNote: string;
  alignment: string;
  alignmentTone: "brand" | "warn";
  alignmentNote: string;
  insight: { title: string; body: string };
  team: TeamMember[];
  designNote: string;
  qaNote: string;
  handoff: HandoffItem[];
  sprintCommitment: number;
  sprintProgress: number;
  backlogSP: number;
  sprintsRemaining: string;
  readinessLevel: string;
  readinessNote: string;
}

const PROJECTS: Record<ProjectId, Project> = {
  "PRJ-009A": {
    name: "Project Apollo",
    statusTone: "pass",
    healthState: "On Track",
    completion: 68,
    health: 94,
    healthTone: "brand",
    healthNote: "+2 pts vs last sprint",
    alignment: "High",
    alignmentTone: "brand",
    alignmentNote: "Direct tie to Q3 OKR #2",
    insight: {
      title: "Predicted bottleneck ahead",
      body: "Predicted bottleneck in the upcoming API integration phase. Recommend reallocating 1 backend developer from Project Gemini for Sprint 14 to optimize handoff workflow and maintain velocity.",
    },
    team: [
      { name: "Sarah Jenkins", role: "Lead Engineer", cap: "95% Cap",       tone: "brand" },
      { name: "David Chen",    role: "Backend Dev",   cap: "100% Cap",      tone: "warn"  },
      { name: "Marcus Johnson",role: "Frontend Dev",  cap: "110% Cap (Over)",tone: "fail" },
    ],
    designNote: "Both at 80% Cap",
    qaNote: "Available for Sprint 14",
    handoff: [
      { label: "Spec Completion", value: "92%",  pct: 92,  tone: "brand", note: "Core flows documented. Edge cases pending review." },
      { label: "Asset Export",    value: "100%", pct: 100, tone: "pass",  note: "All SVG/PNG assets synced to repository." },
      { label: "Token Alignment", value: "88%",  pct: 88,  tone: "warn",  note: "Typography tokens mapped. Spacing tokens require sync." },
    ],
    sprintCommitment: 85,
    sprintProgress: 72,
    backlogSP: 450,
    sprintsRemaining: "5.2",
    readinessLevel: "High",
    readinessNote: "Based on capacity heatmaps, the team has sufficient bandwidth to absorb the upcoming backlog, barring the highlighted API integration phase.",
  },
  "PRJ-009B": {
    name: "Project Nexus",
    statusTone: "warn",
    healthState: "At Risk",
    completion: 45,
    health: 76,
    healthTone: "warn",
    healthNote: "Declining — down 6 pts vs last sprint",
    alignment: "Medium",
    alignmentTone: "warn",
    alignmentNote: "Partial alignment to Q3 OKR #4",
    insight: {
      title: "Velocity declining — action required",
      body: "Sprint velocity has dropped 18% over the last three cycles. Scope creep in the data migration layer is the primary driver. Recommend a scope review and dependency freeze for Sprint 11.",
    },
    team: [
      { name: "Alice Park",  role: "Lead Engineer", cap: "90% Cap",        tone: "brand" },
      { name: "Bob Torres",  role: "Backend Dev",   cap: "105% Cap (Over)",tone: "fail"  },
      { name: "Nina Zhang",  role: "Frontend Dev",  cap: "80% Cap",        tone: "brand" },
    ],
    designNote: "One at 95% Cap",
    qaNote: "Partially engaged — Sprint 11",
    handoff: [
      { label: "Spec Completion", value: "65%", pct: 65, tone: "warn", note: "Critical flows incomplete. UX review blocked on API contracts." },
      { label: "Asset Export",    value: "78%", pct: 78, tone: "warn", note: "Mobile assets pending. Web assets 100% done." },
      { label: "Token Alignment", value: "40%", pct: 40, tone: "warn", note: "Design system sync not started. Estimated 3 sprints." },
    ],
    sprintCommitment: 65,
    sprintProgress: 48,
    backlogSP: 620,
    sprintsRemaining: "8.1",
    readinessLevel: "Medium",
    readinessNote: "Capacity constraints in the backend track are limiting throughput. A resource rebalancing review is recommended before Sprint 12 planning.",
  },
  "PRJ-009C": {
    name: "Project Titan",
    statusTone: "pass",
    healthState: "On Track",
    completion: 82,
    health: 88,
    healthTone: "pass",
    healthNote: "+4 pts vs last sprint",
    alignment: "High",
    alignmentTone: "brand",
    alignmentNote: "Lead initiative for Q3 OKR #1",
    insight: {
      title: "Strong delivery momentum",
      body: "Project Titan is tracking ahead of the Q3 milestone. Design-to-dev handoff is near-complete. Recommend initiating QA pre-flight two sprints early to capture edge cases before release.",
    },
    team: [
      { name: "James O'Brien", role: "Lead Engineer", cap: "85% Cap", tone: "brand" },
      { name: "Rita Mehta",    role: "Backend Dev",   cap: "90% Cap", tone: "brand" },
      { name: "Liam Foster",   role: "Frontend Dev",  cap: "75% Cap", tone: "brand" },
    ],
    designNote: "Both at 70% Cap",
    qaNote: "Pre-flight begins Sprint 13",
    handoff: [
      { label: "Spec Completion", value: "95%",  pct: 95,  tone: "pass", note: "All flows signed off. Accessibility pass in progress." },
      { label: "Asset Export",    value: "100%", pct: 100, tone: "pass", note: "All assets exported and versioned in repository." },
      { label: "Token Alignment", value: "85%",  pct: 85,  tone: "brand",note: "Design tokens fully aligned with component library." },
    ],
    sprintCommitment: 92,
    sprintProgress: 85,
    backlogSP: 180,
    sprintsRemaining: "2.1",
    readinessLevel: "High",
    readinessNote: "Team is well within capacity for the remaining sprint window. QA integration is ahead of schedule and pre-flight is set to begin early.",
  },
};

export default function Strategy() {
  const [projectId, setProjectId] = useState<ProjectId>("PRJ-009A");
  const p = PROJECTS[projectId];

  return (
    <>
      <PageMeta title={`Strategy · ${p.name}`} description="Detailed health and execution." />
      <PageHead
        breadcrumb={[
          <Link key="strategy" to="/portfolio" className="hover:text-gray-200 transition-colors">Strategy</Link>,
          "Active Projects",
          `ID: ${projectId}`,
        ]}
        title={`${p.name}: Detailed Health & Execution`}
        right={<Link to="/initiatives" className="inline-flex items-center gap-1.5 rounded-[10px] border border-ink-700 bg-white px-3.5 py-2 text-[13px] font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100">← Back to LOB Initiatives</Link>}
      />

      <div className="space-y-6 px-6 pb-10 pt-5">

        {/* ── Project selector ── */}
        <div className="flex items-center gap-3">
          <label htmlFor="project-select" className="text-[13px] font-semibold text-gray-400">
            Project ID
          </label>
          <select
            id="project-select"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value as ProjectId)}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-[13px] font-semibold text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {(Object.keys(PROJECTS) as ProjectId[]).map((id) => (
              <option key={id} value={id}>{id} — {PROJECTS[id].name}</option>
            ))}
          </select>
          <Pill tone={p.statusTone} dot>{p.healthState}</Pill>
        </div>

        {/* ── Top stat row ── */}
        <div className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,0.72fr))_1.4fr]">
          <StatCard
            label="Overall Completion"
            value={String(p.completion)}
            unit="%"
            tone="brand"
            progress={p.completion}
          />
          <StatCard
            label="Health Score"
            value={String(p.health)}
            unit="/100"
            tone={p.healthTone}
            note={<span className={`font-semibold ${p.healthTone === "warn" ? "text-state-warn" : "text-state-pass"}`}>{p.healthNote}</span>}
          />
          <StatCard
            label="Strategic Alignment"
            value={p.alignment}
            tone={p.alignmentTone}
            note={p.alignmentNote}
          />
          <InsightCard
            kicker="Executive Insight"
            title={p.insight.title}
            body={p.insight.body}
            action="Review Allocation Proposal"
          />
        </div>

        {/* ── Team + Readiness / Velocity ── */}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="px-6 py-5">
            <div className="flex items-baseline justify-between">
              <p className="text-[19px] font-bold text-gray-100">Team Composition</p>
              <span className="text-[12.5px] text-gray-500">7 Active Members</span>
            </div>

            <p className="mt-4 font-mono text-[11.5px] font-bold uppercase tracking-wider text-gray-500">Development (3)</p>
            <ul className="mt-2 divide-y divide-ink-700">
              {p.team.map((m) => (
                <li key={m.name} className="flex items-center gap-3 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">
                    {m.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-gray-100">{m.name}</span>
                    <span className="block text-[12.5px] text-gray-500">{m.role}</span>
                  </span>
                  <Pill tone={m.tone}>{m.cap}</Pill>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-gray-500">Design (2)</p>
                <p className="mt-2 text-[12.5px] text-gray-500">{p.designNote}</p>
              </div>
              <div>
                <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-gray-500">QA / Test (2)</p>
                <p className="mt-2 text-[12.5px] text-gray-500">{p.qaNote}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="px-5 py-5">
              <p className="text-[19px] font-bold text-gray-100">Team Readiness</p>
              <div className="mt-3 flex items-center gap-4">
                <span className={`grid size-[76px] shrink-0 place-items-center rounded-full border-[3px] text-[15px] font-bold ${
                  p.readinessLevel === "High" ? "border-accent text-accent" : "border-state-warn text-state-warn"
                }`}>
                  {p.readinessLevel}
                </span>
                <p className="text-[13px] leading-relaxed text-gray-400">{p.readinessNote}</p>
              </div>
            </Card>

            <Card className="px-5 py-5">
              <p className="text-[19px] font-bold text-gray-100">Velocity &amp; Scope Tracker</p>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-gray-200">Current Sprint Commitment</span>
                  <span className="font-mono text-[13px] font-bold text-accent">{p.sprintCommitment} SP</span>
                </div>
                <Progress value={p.sprintProgress} className="mt-2" />
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-gray-200">Future Backlog (Unscheduled)</span>
                  <span className="font-mono text-[13px] font-bold text-gray-400">{p.backlogSP} SP</span>
                </div>
                <Progress value={38} tone="idle" className="mt-2" />
                <p className="mt-2 text-right text-[12px] text-gray-500">~{p.sprintsRemaining} Sprints Remaining</p>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Design-to-Dev Handoff ── */}
        <section>
          <Card className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Design-to-Dev Handoff Status</SectionTitle>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {p.handoff.map((h) => (
                <Card key={h.label} className="px-5 py-4">
                  <p className="text-[13.5px] font-semibold text-gray-300">{h.label}</p>
                  <p className={`mt-1 text-[28px] font-bold leading-none ${
                    h.tone === "pass" ? "text-state-pass" : h.tone === "warn" ? "text-state-warn" : "text-accent"
                  }`}>
                    {h.value}
                  </p>
                  <Progress value={h.pct} tone={h.tone} className="mt-3" />
                  <p className="mt-2 text-[12.5px] leading-snug text-gray-500">{h.note}</p>
                </Card>
              ))}
            </div>
          </Card>
        </section>

      </div>
    </>
  );
}
