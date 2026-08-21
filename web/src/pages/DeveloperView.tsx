import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../components/common/PageMeta";
import { Ident, Lozenge, PersonChip } from "../components/console/primitives";
import { getConsole } from "../api/client";
import type { ConsoleData, Person } from "../api/types";
import { ago, duration } from "../lib/format";
import DocUpdatesTile from "../components/code2doc/DocUpdatesTile";
import { DOC_UPDATE_FIXTURES } from "../api/docUpdateFixtures";

/**
 * The landing page: what one engineer has to act on, not what the programme
 * looks like in aggregate.
 *
 * The delivery console answers "where is everything and who holds it", which is
 * a manager's question and a dense table. The first thing anyone sees should
 * answer "what is waiting on me", which is a short list. The console did not
 * get simpler -- it moved to /delivery, where that density is what you came
 * for.
 */

type ActionKind = "review" | "defect" | "custody" | "unverified" | "doc";

interface Action {
  kind: ActionKind;
  id: string;
  title: string;
  /** Why this is in front of you, in words, not a status code. */
  because: string;
  waitingSeconds: number;
  urgent: boolean;
  href?: string;
  meta?: string;
}

const KIND_LABEL: Record<ActionKind, string> = {
  review: "Review",
  defect: "Defect",
  custody: "In your custody",
  unverified: "Unverified",
  doc: "Documentation",
};

const KIND_TONE: Record<ActionKind, "brand" | "warn" | "idle"> = {
  review: "brand",
  defect: "warn",
  custody: "brand",
  unverified: "warn",
  doc: "brand",
};

export default function DeveloperView() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [me, setMe] = useState<string>("");
  const [emailToastDismissed, setEmailToastDismissed] = useState(false);
  const now = useMemo(() => new Date(), [data]);

  useEffect(() => {
    getConsole().then((d) => {
      setData(d);
      // p5 is the account the live GitHub history maps to, so it is the only
      // persona whose queue contains real events rather than projected ones.
      setMe(d.people.some((p) => p.personId === "p5") ? "p5" : d.people[0]?.personId ?? "");
    });
  }, []);

  const person = (id?: string | null): Person | undefined =>
    data?.people.find((p) => p.personId === id);

  const actions = useMemo<Action[]>(() => {
    if (!data || !me) return [];
    const out: Action[] = [];

    for (const pr of data.pullRequests) {
      if (pr.state !== "open" || !pr.reviewerIds.includes(me)) continue;
      const waiting = (now.getTime() - new Date(pr.openedAt).getTime()) / 1000;
      out.push({
        kind: "review",
        id: `#${pr.number}`,
        title: pr.title,
        because:
          pr.checks === "failing"
            ? "Checks are failing — review is blocked until they pass"
            : "Waiting for your review before it can merge",
        waitingSeconds: waiting,
        urgent: pr.checks === "failing" || waiting > 172800,
        meta: `+${pr.additions} −${pr.deletions} across ${pr.filesChanged} files`,
      });
    }

    for (const defect of data.defects) {
      if (defect.assigneeId !== me) continue;
      if (defect.status === "resolved" || defect.status === "verified") continue;
      out.push({
        kind: "defect",
        id: defect.defectId,
        title: defect.title,
        because: `${defect.severity} severity, raised against ${defect.environment}`,
        waitingSeconds: defect.ageSeconds,
        urgent: defect.severity === "critical",
        meta: defect.requirementId ?? undefined,
      });
    }

    for (const packet of data.packets) {
      const span = packet.spans[packet.spans.length - 1];
      if (!span || span.personId !== me || !span.isOpen) continue;
      out.push({
        kind: "custody",
        id: packet.issueKey ?? packet.packetId,
        title: packet.title,
        because: span.isOverdue
          ? "Has been in your custody past the expected time for this stage"
          : "Currently in your custody — nobody downstream can start until you hand it on",
        waitingSeconds: span.calendarAdjustedSeconds,
        urgent: span.isOverdue,
        meta: packet.requirementIds[0],
      });
    }

    for (const requirement of data.requirements) {
      if (requirement.ownerId !== me || !requirement.baselined) continue;
      const verified = data.tests.some(
        (t) => t.requirementId === requirement.reqId && t.status === "passed",
      );
      if (verified) continue;
      out.push({
        kind: "unverified",
        id: requirement.reqId,
        title: requirement.title,
        because: "You own this requirement and no test currently passes against it",
        waitingSeconds: 0,
        urgent: requirement.moscow === "MUST",
        meta: requirement.document,
      });
    }

    return out.sort(
      (a, b) => Number(b.urgent) - Number(a.urgent) || b.waitingSeconds - a.waitingSeconds,
    );
  }, [data, me, now]);

  if (!data) return <div className="p-6 text-[12px] text-gray-600">Loading…</div>;

  const urgent = actions.filter((a) => a.urgent).length;
  const latestDocUpdate = DOC_UPDATE_FIXTURES[0];
  const grouped = actions.reduce<Record<string, Action[]>>((acc, action) => {
    (acc[action.kind] ??= []).push(action);
    return acc;
  }, {});

  return (
    <>
      <PageMeta title="My actions · Cognizant SDLC Spine" description="What is waiting on you." />

      {!emailToastDismissed && latestDocUpdate && (
        <div className="flex items-center gap-3 border-b border-state-warn/20 bg-state-warn/[0.05] px-6 py-2.5">
          <span className="text-state-warn">✉</span>
          <span className="text-[12px] text-gray-300">
            <span className="font-medium text-state-warn">Email sent (seeded)</span>
            {" — "}
            <span className="font-mono text-[11px]">{latestDocUpdate.pageTitle}</span>
            {" was updated and ops team was notified "}
            <span className="text-gray-500">({ago(latestDocUpdate.emailSentAt, now)})</span>
          </span>
          <button
            onClick={() => setEmailToastDismissed(true)}
            className="ml-auto text-gray-600 hover:text-gray-400"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-medium text-gray-100">My actions</h1>
            <p className="mt-1 text-[12.5px] text-gray-500">
              {actions.length === 0
                ? "Nothing is waiting on you."
                : `${actions.length} item${actions.length === 1 ? "" : "s"} waiting on you` +
                  (urgent ? ` · ${urgent} need attention now` : "")}
            </p>
          </div>

          <label className="flex items-center gap-2 text-[12px] text-gray-500">
            Viewing as
            <select
              value={me}
              onChange={(e) => setMe(e.target.value)}
              className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12px] text-gray-200 outline-none focus:border-brand-cyan/40"
            >
              {data.people.map((p) => (
                <option key={p.personId} value={p.personId} className="bg-[#0b1020]">
                  {p.name} — {p.role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="px-6 py-5">
        {actions.length === 0 ? (
          <div className="rounded border border-white/5 bg-white/[0.02] px-5 py-10 text-center">
            <p className="text-[13px] text-gray-400">Your queue is clear.</p>
            <p className="mt-1 text-[12px] text-gray-600">
              The whole portfolio is on the{" "}
              <Link to="/delivery" className="text-brand-cyan hover:underline">
                delivery console
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {(Object.keys(KIND_LABEL) as ActionKind[])
              .filter((kind) => grouped[kind]?.length)
              .map((kind) => (
                <section key={kind}>
                  <h2 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    {KIND_LABEL[kind]}
                    <span className="tnum font-mono text-gray-600">{grouped[kind].length}</span>
                  </h2>
                  <ul className="space-y-1.5">
                    {grouped[kind].map((action) => (
                      <li
                        key={`${action.kind}-${action.id}`}
                        className={`rounded border bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04] ${
                          action.urgent ? "border-state-fail/30" : "border-white/5"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Ident>{action.id}</Ident>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-gray-200">
                            {action.title}
                          </span>
                          {action.urgent && <Lozenge tone="warn">needs attention</Lozenge>}
                          {action.waitingSeconds > 0 && (
                            <span className="tnum shrink-0 font-mono text-[11px] text-gray-500">
                              {duration(action.waitingSeconds)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] text-gray-500">{action.because}</p>
                        {action.meta && (
                          <p className="mt-0.5 text-[11px] text-gray-600">
                            <Ident dim>{action.meta}</Ident>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}

        <div className="mt-8">
          <DocUpdatesTile now={now} />
        </div>

        <p className="mt-8 text-[11.5px] text-gray-600">
          Derived from the same event log as the{" "}
          <Link to="/delivery" className="text-brand-cyan hover:underline">
            delivery console
          </Link>
          . Nothing here is entered by hand — an item leaves this list when the event that
          closes it arrives.
        </p>
      </div>
    </>
  );
}
