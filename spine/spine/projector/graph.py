"""Events into the graph.

A pure function from the event log to the projection: it never calls a source.
That is what makes replay meaningful, golden-snapshot testing possible, and
`spine reproject` safe to run at any time.

Order matters. Vertices first, then stitching, then custody -- custody spans
reference packets and stages that must already exist.
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

from ..core.calendar import PROGRAMME_DEFAULT, cluster_sessions, working_seconds
from ..core.identity import IdentityResolver, SourceAccount
from ..core.vocabulary import Verb, extract_identifiers, identifier_kind
from ..store.arcade import Store

# The stage ladder, read from the programme rather than invented: CODEOWNERS,
# the cd.yml environment gates, and the roster in docs/requirements/index.md.
STAGES: list[tuple[str, str, str, bool]] = [
    ("REQ_DRAFT", "Requirement draft", "Business Analyst", False),
    ("REQ_REVIEW", "Requirement review", "Solution Architect", False),
    ("BASELINED", "Baselined", "Programme Manager", True),
    ("REFINEMENT", "Refinement", "Product Owner", False),
    ("DEVELOPMENT", "Development", "Assignee", False),
    ("CODE_REVIEW", "Code review", "CODEOWNERS reviewer", True),
    ("CI_VERIFY", "CI verify", "Author", False),
    ("MERGED_DEV", "Merged to dev", "Engineering Lead", False),
    ("DEPLOY_DEV", "Deploy dev", "Automated", False),
    ("GATE2_STAGING", "Staging approval", "QA Lead", True),
    ("STAGING_TEST", "Staging test", "QA Lead", False),
    ("GATE3_UAT", "UAT sign-off", "Product Owner", True),
    ("GATE4_CAB", "CAB review", "Delivery + Architect", True),
    ("RELEASE_TAG", "Release tag", "Delivery Manager", False),
    ("GATE5_PROD", "Production approval", "Delivery + Compliance + SRE", True),
    ("PRODUCTION", "Production", "SRE", False),
]

STAGE_POSITION = {stage_id: i for i, (stage_id, *_rest) in enumerate(STAGES)}

#: Which stage a verb opens custody at.
VERB_STAGE = {
    Verb.CODE_COMMITTED: "DEVELOPMENT",
    Verb.PR_OPENED: "DEVELOPMENT",
    Verb.REVIEW_REQUESTED: "CODE_REVIEW",
    Verb.REVIEW_SUBMITTED: "CODE_REVIEW",
    Verb.BUILD_STARTED: "CI_VERIFY",
    Verb.BUILD_COMPLETED: "CI_VERIFY",
    Verb.PR_MERGED: "MERGED_DEV",
    Verb.DEPLOYMENT_CREATED: "DEPLOY_DEV",
    Verb.DEPLOYMENT_SUCCEEDED: "DEPLOY_DEV",
    Verb.DEPLOYMENT_APPROVED: "GATE2_STAGING",
}

ENV_STAGE = {
    "dev": "DEPLOY_DEV",
    "staging": "GATE2_STAGING",
    "uat": "GATE3_UAT",
    "production": "GATE5_PROD",
}


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@dataclass(slots=True)
class ProjectionStats:
    events_read: int = 0
    vertices: int = 0
    edges: int = 0
    packets: int = 0
    spans: int = 0
    unresolved_accounts: int = 0
    orphan_packets: int = 0


class Projector:
    def __init__(self, store: Store, resolver: IdentityResolver):
        self.store = store
        self.resolver = resolver
        self.stats = ProjectionStats()

    # --- entry point --------------------------------------------------------
    def run(self) -> ProjectionStats:
        events = self._load_events()
        self.stats.events_read = len(events)

        self._project_stages()
        self._project_people()
        actors = self._project_actors(events)
        self._project_entities(events)
        packets = self._stitch(events)
        self._project_custody(events, packets, actors)
        return self.stats

    # --- reading the log ----------------------------------------------------
    def _load_events(self) -> list[dict[str, Any]]:
        rows = self.store.query("SELECT FROM Event ORDER BY occurred_at ASC")
        for row in rows:
            for key in ("actor_ref", "subject_ref", "object_refs", "payload", "raw"):
                value = row.get(key)
                if isinstance(value, str):
                    try:
                        row[key] = json.loads(value)
                    except json.JSONDecodeError:
                        row[key] = {}
        return rows

    # --- vertices -----------------------------------------------------------
    def _project_stages(self) -> None:
        with self.store.transaction():
            for stage_id, label, role, is_gate in STAGES:
                self.store.upsert_vertex(
                    "Stage",
                    stage_id,
                    {
                        "label": label,
                        "position": STAGE_POSITION[stage_id],
                        "is_gate": is_gate,
                        "accountable_role": role,
                    },
                )
                self.stats.vertices += 1

    def _project_people(self) -> None:
        with self.store.transaction():
            for person_id in list(self.resolver._people):  # noqa: SLF001 - internal by design
                person = self.resolver.person(person_id)
                if person is None:
                    continue
                self.store.upsert_vertex(
                    "Person",
                    person.person_id,
                    {"handle": person.handle, "name": person.name, "role": person.role},
                )
                self.stats.vertices += 1

    def _project_actors(self, events: Iterable[dict[str, Any]]) -> dict[str, str | None]:
        """SourceAccount vertices, resolved where possible. Unresolved accounts
        are kept and surfaced -- never guessed at, never dropped."""
        seen: dict[str, str | None] = {}
        with self.store.transaction():
            for event in events:
                actor = event.get("actor_ref") or {}
                account_id = actor.get("account_id")
                if not account_id:
                    continue
                account = SourceAccount(
                    source=actor.get("source", event["source"]),
                    account_id=str(account_id),
                    display_name=actor.get("display_name"),
                    email=actor.get("email"),
                )
                if account.key in seen:
                    continue
                person_id = self.resolver.resolve(account)
                seen[account.key] = person_id

                vertex = self.store.upsert_vertex(
                    "SourceAccount",
                    account.key,
                    {
                        "source": account.source,
                        "account_id": account.account_id,
                        "resolved": bool(person_id),
                    },
                )
                self.stats.vertices += 1
                if person_id:
                    person_vertex = self.store.lookup("Person", "person_id", person_id)
                    if person_vertex is not None:
                        self.store.link(vertex, "SAME_AS", person_vertex)
                        self.stats.edges += 1

        self.stats.unresolved_accounts = sum(1 for v in seen.values() if v is None)
        return seen

    def _project_entities(self, events: Iterable[dict[str, Any]]) -> None:
        with self.store.transaction():
            for event in events:
                verb = event["verb"]
                subject = event.get("subject_ref") or {}
                payload = event.get("payload") or {}
                kind, ident = subject.get("kind"), subject.get("id")
                if not kind or not ident:
                    continue

                if kind == "commit":
                    self.store.upsert_vertex(
                        "Commit",
                        ident,
                        {
                            "message": (payload.get("message") or "")[:400],
                            "authored_at": event["occurred_at"],
                        },
                    )
                elif kind == "pull_request":
                    self.store.upsert_vertex(
                        "PullRequest",
                        ident,
                        {
                            "number": int(payload.get("number") or 0),
                            "title": payload.get("title") or "",
                            "state": "merged" if verb == Verb.PR_MERGED else "open",
                            "merged_at": event["occurred_at"] if verb == Verb.PR_MERGED else "",
                        },
                    )
                elif kind == "pipeline_run":
                    self.store.upsert_vertex(
                        "PipelineRun",
                        ident,
                        {
                            "workflow": payload.get("workflow") or "",
                            "conclusion": payload.get("conclusion") or "",
                            "started_at": event["occurred_at"],
                        },
                    )
                elif kind == "deployment":
                    self.store.upsert_vertex(
                        "Deployment",
                        ident,
                        {
                            "environment": payload.get("environment") or "",
                            "status": "succeeded"
                            if verb == Verb.DEPLOYMENT_SUCCEEDED
                            else "failed"
                            if verb == Verb.DEPLOYMENT_FAILED
                            else "pending",
                            "created_at": event["occurred_at"],
                            # An approval only exists where a reviewer was
                            # configured. A recorded transition is not consent.
                            "gate_approved": verb == Verb.DEPLOYMENT_APPROVED,
                        },
                    )
                self.stats.vertices += 1

    # --- stitching ----------------------------------------------------------
    def _stitch(self, events: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
        """Group events into work packets by the identifiers they cite.

        Rules are ordered and explicit, and every packet records which rule
        matched so the UI can answer "why do you think these are related?".
        An event citing nothing becomes an orphan packet, surfaced rather than
        discarded -- an unlinked change is a governance finding.
        """
        packets: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for event in events:
            payload = event.get("payload") or {}
            subject = event.get("subject_ref") or {}
            identifiers = extract_identifiers(
                payload.get("title"),
                payload.get("body"),
                payload.get("message"),
                payload.get("branch"),
                payload.get("head"),
                subject.get("label"),
            )

            requirement_ids = [i for i in identifiers if identifier_kind(i) == "requirement"]
            issue_ids = [i for i in identifiers if identifier_kind(i) == "workitem"]
            defect_ids = [i for i in identifiers if identifier_kind(i) == "defect"]

            if issue_ids:
                key, rule = issue_ids[0], "jira-key-in-text"
            elif defect_ids:
                key, rule = defect_ids[0], "defect-key-in-text"
            elif requirement_ids:
                key, rule = requirement_ids[0], "requirement-id-in-text"
            else:
                # Orphan: keyed on the subject so its events stay together.
                key, rule = f"ORPHAN:{subject.get('kind')}:{subject.get('id')}", "no-rule-matched"

            event["_packet"] = key
            event["_rule"] = rule
            event["_requirements"] = requirement_ids
            packets[key].append(event)

        with self.store.transaction():
            for key, grouped in packets.items():
                is_orphan = key.startswith("ORPHAN:")
                title = ""
                for event in grouped:
                    payload = event.get("payload") or {}
                    title = payload.get("title") or payload.get("message", "").split("\n")[0] or ""
                    if title:
                        break
                packet = self.store.upsert_vertex(
                    "WorkPacket",
                    key,
                    {
                        "title": title[:200],
                        "current_stage": "",
                        "release": "R2",
                        "work_type": "application",
                        "is_orphan": is_orphan,
                    },
                )
                self.stats.packets += 1
                if is_orphan:
                    self.stats.orphan_packets += 1

                for req_id in {r for e in grouped for r in e["_requirements"]}:
                    requirement = self.store.upsert_vertex(
                        "Requirement", req_id, {"title": "", "document": "", "baselined": True}
                    )
                    self.store.link(packet, "IMPLEMENTS", requirement, confidence=0.95,
                                    derived_by=grouped[0]["_rule"])
                    self.stats.edges += 1

        return packets

    # --- custody ------------------------------------------------------------
    def _project_custody(
        self,
        events: list[dict[str, Any]],
        packets: dict[str, list[dict[str, Any]]],
        actors: dict[str, str | None],
    ) -> None:
        """Derive CustodySpans and the HANDED_OFF_TO chain.

        Spans key on (packet, stage, person), so two reviewers on one pull
        request are two parallel spans and the chain fans out and back in
        without a special case.
        """
        now = datetime.now(timezone.utc)

        for packet_key, grouped in packets.items():
            timeline: list[tuple[datetime, str, str | None, dict[str, Any]]] = []
            for event in grouped:
                stage_id = VERB_STAGE.get(event["verb"])
                payload = event.get("payload") or {}
                if event["verb"] in (Verb.DEPLOYMENT_CREATED, Verb.DEPLOYMENT_SUCCEEDED):
                    stage_id = ENV_STAGE.get(payload.get("environment", ""), stage_id)
                if not stage_id:
                    continue
                occurred = _parse(event["occurred_at"])
                if occurred is None:
                    continue
                actor = event.get("actor_ref") or {}
                account_key = f"{actor.get('source', event['source'])}:{actor.get('account_id')}"
                timeline.append((occurred, stage_id, actors.get(account_key), event))

            if not timeline:
                continue
            timeline.sort(key=lambda row: row[0])

            spans: list[dict[str, Any]] = []
            index = 0
            while index < len(timeline):
                entered, stage_id, person_id, event = timeline[index]
                # Custody ends when the packet moves to a different stage.
                exit_at: datetime | None = None
                cursor = index + 1
                while cursor < len(timeline):
                    if timeline[cursor][1] != stage_id:
                        exit_at = timeline[cursor][0]
                        break
                    cursor += 1

                end = exit_at or now
                activity = [row[0] for row in timeline[index:cursor] if row[2] == person_id]
                adjusted = working_seconds(entered, end, PROGRAMME_DEFAULT)

                flags: list[str] = []
                if stage_id in ("GATE2_STAGING", "GATE3_UAT", "GATE5_PROD"):
                    flags.append("simulated_gate")
                if PROGRAMME_DEFAULT.assumed:
                    flags.append("assumed_calendar")
                if person_id is None:
                    flags.append("unresolved_identity")
                if not activity:
                    flags.append("no_activity_signal")

                spans.append(
                    {
                        "span_id": f"{packet_key}|{stage_id}|{person_id or 'unknown'}|{index}",
                        "packet_id": packet_key,
                        "stage_id": stage_id,
                        "person_id": person_id or "",
                        "entered_at": entered.isoformat(),
                        "exited_at": exit_at.isoformat() if exit_at else "",
                        "custody_seconds": int((end - entered).total_seconds()),
                        "calendar_adjusted_seconds": adjusted,
                        "activity_signal_count": len(activity),
                        "active_minutes_estimate": cluster_sessions(activity) if activity else 0,
                        "is_open": exit_at is None,
                        "is_overdue": exit_at is None and adjusted > 16 * 3600,
                        "flags": ",".join(flags),
                    }
                )
                index = cursor

            with self.store.transaction():
                packet_vertex = self.store.lookup("WorkPacket", "packet_id", packet_key)
                previous = None
                for span in spans:
                    vertex = self.store.upsert_vertex("CustodySpan", span["span_id"], span)
                    self.stats.spans += 1

                    if packet_vertex is not None:
                        self.store.link(vertex, "IN_PACKET", packet_vertex)
                        self.stats.edges += 1
                    stage_vertex = self.store.lookup("Stage", "stage_id", span["stage_id"])
                    if stage_vertex is not None:
                        self.store.link(vertex, "AT_STAGE", stage_vertex)
                        self.stats.edges += 1
                    if span["person_id"]:
                        person_vertex = self.store.lookup("Person", "person_id", span["person_id"])
                        if person_vertex is not None:
                            self.store.link(vertex, "HELD_BY", person_vertex)
                            self.stats.edges += 1
                    if previous is not None:
                        self.store.link(previous, "HANDED_OFF_TO", vertex)
                        self.stats.edges += 1
                    previous = vertex

                if packet_vertex is not None and spans:
                    updated = packet_vertex.modify()
                    updated.set("current_stage", spans[-1]["stage_id"])
                    updated.save()
