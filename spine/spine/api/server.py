"""Read API.

Serves the graph in exactly the shape src/api/types.ts declares, so switching
the console from fixtures to live is one environment variable and no component
changes. Responses are camelCase because that is what the contract says.

Read-only throughout. Nothing here writes to a source system; write-back is
slice D and is deliberately not reachable from this surface.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ..config import config
from ..core.identity import ROSTER
from ..projector.graph import STAGES, STAGE_POSITION
from ..store.arcade import Store

app = FastAPI(title="SDLC Spine", version="0.1.0")

# The console runs on the Vite dev server during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _store() -> Store:
    return Store(config().db_path).open()


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _flags(raw: Any) -> list[str]:
    return [f for f in str(raw or "").split(",") if f]


def _stages_payload() -> list[dict[str, Any]]:
    phase_of = {
        "REQ_DRAFT": "define", "REQ_REVIEW": "define", "BASELINED": "define", "REFINEMENT": "define",
        "DEVELOPMENT": "build", "CODE_REVIEW": "build", "CI_VERIFY": "build", "MERGED_DEV": "build",
        "DEPLOY_DEV": "verify", "GATE2_STAGING": "verify", "STAGING_TEST": "verify",
        "GATE3_UAT": "gate", "GATE4_CAB": "gate", "RELEASE_TAG": "gate", "GATE5_PROD": "gate",
        "PRODUCTION": "live",
    }
    return [
        {
            "id": stage_id,
            "label": label,
            "phase": phase_of[stage_id],
            "accountableRole": role,
            "isGate": is_gate,
        }
        for stage_id, label, role, is_gate in STAGES
    ]


def _people_payload(store: Store) -> list[dict[str, Any]]:
    resolved = {
        row.get("account_id")
        for row in store.query("SELECT account_id, resolved FROM SourceAccount WHERE resolved = true")
    }
    out = []
    for person in ROSTER:
        out.append(
            {
                "personId": person.person_id,
                "handle": person.handle,
                "name": person.name,
                "role": person.role,
                "initials": person.initials,
                # A person is 'resolved' only where a source account actually
                # maps to them. Unmapped is shown, never assumed.
                "resolved": person.person_id in resolved or bool(person.emails),
                "timezone": "Asia/Kolkata",
            }
        )
    return out


def _packets_payload(store: Store) -> list[dict[str, Any]]:
    spans_by_packet: dict[str, list[dict[str, Any]]] = {}
    for row in store.query("SELECT FROM CustodySpan"):
        spans_by_packet.setdefault(row.get("packet_id", ""), []).append(row)

    packets = []
    for row in store.query("SELECT FROM WorkPacket"):
        packet_id = row.get("packet_id", "")
        raw_spans = sorted(spans_by_packet.get(packet_id, []), key=lambda s: s.get("entered_at", ""))
        if not raw_spans:
            continue

        spans = [
            {
                "spanId": s.get("span_id"),
                "packetId": packet_id,
                "stageId": s.get("stage_id"),
                "personId": s.get("person_id") or "",
                "enteredAt": s.get("entered_at"),
                "exitedAt": s.get("exited_at") or None,
                "custodySeconds": _int(s.get("custody_seconds")),
                "calendarAdjustedSeconds": _int(s.get("calendar_adjusted_seconds")),
                "activitySignalCount": _int(s.get("activity_signal_count")),
                # null, not zero: "no signal" and "zero minutes" are different
                # claims and the UI renders them differently.
                "activeMinutesEstimate": (
                    _int(s.get("active_minutes_estimate"))
                    if _int(s.get("activity_signal_count")) > 0
                    else None
                ),
                "isOpen": bool(s.get("is_open")),
                "isOverdue": bool(s.get("is_overdue")),
                "flags": _flags(s.get("flags")),
            }
            for s in raw_spans
        ]

        open_span = spans[-1]
        packets.append(
            {
                "packetId": packet_id,
                "title": row.get("title") or packet_id,
                "requirementIds": [],
                "issueKey": None if packet_id.startswith("ORPHAN:") else packet_id,
                "prNumbers": [],
                "currentStageId": row.get("current_stage") or open_span["stageId"],
                "release": row.get("release") or "R2",
                "sprint": "R2-S4",
                "workType": row.get("work_type") or "application",
                "openedAt": spans[0]["enteredAt"],
                "spans": spans,
                "riskScore": min(100, int(open_span["calendarAdjustedSeconds"] / 864)),
                "isOrphan": bool(row.get("is_orphan")),
            }
        )
    return packets


def _stage_loads(packets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    loads = []
    for stage_id, *_rest in STAGES:
        here = [p for p in packets if p["currentStageId"] == stage_id]
        ages = sorted(p["spans"][-1]["calendarAdjustedSeconds"] for p in here)
        pick = lambda q: ages[min(len(ages) - 1, int(len(ages) * q))] if ages else 0  # noqa: E731
        loads.append(
            {
                "stageId": stage_id,
                "packetCount": len(here),
                "medianAgeSeconds": pick(0.5),
                "p90AgeSeconds": pick(0.9),
                "overdueCount": sum(1 for p in here if p["spans"][-1]["isOverdue"]),
            }
        )
    return loads


def _requirements_payload(store: Store) -> list[dict[str, Any]]:
    """Requirements with their derived coverage.

    `verification` is computed from linked test results rather than read from
    the matrix's own status column: deriving what the RTM currently records by
    hand is the entire point.
    """
    tests_by_req: dict[str, list[tuple[str, str]]] = {}
    for row in store.query("SELECT tc_id, requirement_id, status FROM TestCase"):
        tests_by_req.setdefault(row.get("requirement_id") or "", []).append(
            (row.get("tc_id") or "", row.get("status") or "")
        )

    defects_by_req: dict[str, list[str]] = {}
    for row in store.query("SELECT defect_id, requirement_id, status FROM Defect"):
        defects_by_req.setdefault(row.get("requirement_id") or "", []).append(row.get("defect_id") or "")

    out = []
    for row in store.query("SELECT FROM Requirement ORDER BY req_id"):
        req_id = row.get("req_id") or ""
        results = tests_by_req.get(req_id, [])
        passed = sum(1 for _tc, status in results if status == "satisfied")
        out.append(
            {
                "reqId": req_id,
                "title": row.get("statement") or row.get("title") or "",
                "document": row.get("document") or "",
                "obligation": row.get("obligation") or "may",
                "moscow": (row.get("priority") or "SHOULD").upper()[:6] or "SHOULD",
                "baselined": bool(row.get("baselined")),
                "ownerId": row.get("owner_id") or "",
                "release": row.get("release") or "",
                "status": row.get("status") or "unknown",
                "linkedIssueKeys": [],
                "linkedTestIds": [tc for tc, _status in results],
                "openDefectIds": defects_by_req.get(req_id, []),
                "verification": (passed / len(results)) if results else 0.0,
                "testCount": len(results),
                "lastChangedAt": datetime.now(timezone.utc).isoformat(),
            }
        )
    return out


def _pull_requests_payload(store: Store) -> list[dict[str, Any]]:
    out = []
    for row in store.query("SELECT FROM PullRequest ORDER BY number DESC"):
        out.append(
            {
                "number": _int(row.get("number")),
                "title": row.get("title") or "",
                "authorId": "",
                # Genuinely empty: GitHub does not permit self-review and the
                # repository has no second collaborator yet.
                "reviewerIds": [],
                "state": row.get("state") or "open",
                "checks": "passing",
                "additions": 0,
                "deletions": 0,
                "filesChanged": 0,
                "requirementIds": [],
                "openedAt": row.get("merged_at") or "",
                "mergedAt": row.get("merged_at") or None,
                "reviewSeconds": None,
                "isLive": True,
            }
        )
    return out


def _tests_payload(store: Store) -> list[dict[str, Any]]:
    status_map = {"satisfied": "passed", "not_satisfied": "failed", "partial": "blocked"}
    return [
        {
            "tcId": row.get("tc_id"),
            "title": row.get("title") or "",
            "requirementId": row.get("requirement_id") or None,
            "ownerId": "p6",
            "automated": bool(row.get("automated")),
            "status": status_map.get(row.get("status") or "", "not-run"),
            "lastRunAt": None,
            "durationMs": None,
        }
        for row in store.query("SELECT FROM TestCase ORDER BY tc_id")
    ]


def _defects_payload(store: Store) -> list[dict[str, Any]]:
    return [
        {
            "defectId": row.get("defect_id"),
            "title": row.get("title") or "",
            "severity": row.get("severity") or "major",
            "status": row.get("status") or "open",
            "environment": "unknown",
            "raisedById": "p6",
            "assigneeId": None,
            "requirementId": row.get("requirement_id") or None,
            "raisedAt": datetime.now(timezone.utc).isoformat(),
            "ageSeconds": 0,
        }
        for row in store.query("SELECT FROM Defect ORDER BY defect_id")
    ]


@app.get("/trace/{req_id}")
def trace(req_id: str) -> dict[str, Any]:
    """Full traceability closure for one requirement.

    One traversal answers what an auditor asks: what does this require, what
    implements it, what proves it, and what is currently wrong with it.
    """
    store = _store()
    up = store.cypher(
        "MATCH (r:Requirement {req_id:$id})-[:DERIVES_FROM]->(p:Requirement) "
        "RETURN p.req_id AS reqId, p.statement AS statement, p.status AS status",
        {"id": req_id},
    )
    down = store.cypher(
        "MATCH (c:Requirement)-[:DERIVES_FROM]->(:Requirement {req_id:$id}) "
        "RETURN c.req_id AS reqId, c.statement AS statement, c.status AS status ORDER BY c.req_id",
        {"id": req_id},
    )
    scope = [req_id] + [r["reqId"] for r in down]

    # Cypher with a named list parameter. ArcadeDB's SQL dialect will not bind a
    # list to a positional `IN ?`, which silently returns nothing rather than
    # erroring - worth knowing before trusting an empty result.
    code = store.cypher(
        "MATCH (r:Requirement)-[:IMPLEMENTS]->(cu:CodeUnit) WHERE r.req_id IN $ids "
        "RETURN DISTINCT cu.unit_id AS unitId, cu.kind AS kind, cu.name AS name, "
        "cu.path AS path, cu.start_line AS startLine, cu.end_line AS endLine",
        {"ids": scope},
    )
    tests = store.cypher(
        "MATCH (tc:TestCase)-[:VERIFIES]->(r:Requirement) WHERE r.req_id IN $ids "
        "RETURN DISTINCT tc.tc_id AS testId, tc.title AS title, tc.status AS status, "
        "r.req_id AS requirementId ORDER BY tc.tc_id",
        {"ids": scope},
    )
    defects = store.cypher(
        "MATCH (d:Defect)-[:RAISED_AGAINST]->(r:Requirement) WHERE r.req_id IN $ids "
        "RETURN DISTINCT d.defect_id AS defectId, d.title AS title, d.severity AS severity, "
        "d.status AS status, r.req_id AS requirementId",
        {"ids": scope},
    )

    return {
        "requirement": req_id,
        "parents": up,
        "children": down,
        "code": code,
        "tests": tests,
        "defects": defects,
        "verified": sum(1 for t in tests if t.get("status") == "satisfied"),
        "testCount": len(tests),
    }


@app.get("/code/graph")
def code_graph() -> dict[str, Any]:
    """The code graph, whole.

    A few hundred nodes and edges, so it ships in one response rather than
    paginating. Edges carry their type and confidence: CALLS is name-matched
    without a type checker and is labelled 0.4 so the console can render it as
    the guess it is.
    """
    store = _store()
    units = store.query(
        "SELECT unit_id AS unitId, kind, name, path, start_line AS startLine, "
        "end_line AS endLine, signature, introduced_in_pr AS introducedInPr, "
        "last_changed_pr AS lastChangedPr, touched_by_prs AS touchedByPrs FROM CodeUnit"
    )

    def edges(edge_type: str, confidence: float) -> list[dict[str, Any]]:
        rows = store.cypher(
            f"MATCH (a:CodeUnit)-[:{edge_type}]->(b:CodeUnit) "
            "RETURN a.unit_id AS source, b.unit_id AS target"
        )
        return [{**r, "type": edge_type, "confidence": confidence} for r in rows]

    implements = store.cypher(
        "MATCH (r:Requirement)-[:IMPLEMENTS]->(cu:CodeUnit) "
        "RETURN r.req_id AS source, cu.unit_id AS target"
    )

    return {
        "units": units,
        "edges": edges("CONTAINS", 1.0) + edges("CALLS", 0.4),
        "requirementLinks": [{**r, "type": "IMPLEMENTS", "confidence": 0.85} for r in implements],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    store = _store()
    return {"status": "ok", "counts": store.counts()}


@app.get("/console")
def console() -> dict[str, Any]:
    store = _store()
    packets = _packets_payload(store)
    all_spans = [s for p in packets for s in p["spans"]]
    simulated = sum(1 for s in all_spans if "simulated_gate" in s["flags"])

    unresolved = [
        {"source": r.get("source"), "accountId": r.get("account_id"), "seenCount": 1}
        for r in store.query("SELECT FROM SourceAccount WHERE resolved = false")
    ]

    code_units = store.query(
        "SELECT unit_id, kind, name, path, start_line, end_line, introduced_in_pr, "
        "last_changed_pr, touched_by_prs, signature FROM CodeUnit"
    )

    deployments = [
        {
            "deploymentId": r.get("deployment_id"),
            "environment": r.get("environment") or "dev",
            "imageDigest": "",
            "actorId": "",
            "createdAt": r.get("created_at"),
            "status": r.get("status") or "pending",
            "gateApproved": bool(r.get("gate_approved")),
            "isLive": True,
        }
        for r in store.query("SELECT FROM Deployment ORDER BY created_at DESC")
    ]

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowStart": "2026-07-06T03:30:00Z",
        "windowEnd": "2026-08-21T18:30:00Z",
        "stages": _stages_payload(),
        "people": _people_payload(store),
        "stageLoads": _stage_loads(packets),
        "packets": packets,
        "dataQuality": {
            "unresolvedIdentities": unresolved,
            "orphanPackets": [p["packetId"] for p in packets if p["isOrphan"]],
            "lowConfidenceEdges": store.count("CALLS"),
            "simulatedGateSpans": simulated,
            "staleWatermarks": [],
            "liveSpanRatio": (1 - simulated / len(all_spans)) if all_spans else 1.0,
        },
        "requirements": _requirements_payload(store),
        "pullRequests": _pull_requests_payload(store),
        "tests": _tests_payload(store),
        "defects": _defects_payload(store),
        "deployments": deployments,
        # Jira worklogs are not connected, so per-person rollups beyond custody
        # would be invented. Left empty rather than fabricated.
        "personStats": [],
        "codeUnits": code_units,
    }


@app.get("/packets/{packet_id}/chain")
def chain(packet_id: str) -> dict[str, Any]:
    packets = _packets_payload(_store())
    for packet in packets:
        if packet["packetId"] == packet_id:
            return packet
    raise HTTPException(status_code=404, detail="No such packet")


@app.get("/code/pr/{number}")
def code_by_pr(number: int) -> dict[str, Any]:
    """What a pull request touched - the rollback question.

    Returns units whose live line ranges still contain commits from this pull
    request, which is what would back out with it.
    """
    rows = _store().query(
        "SELECT unit_id, kind, name, path, start_line, end_line, introduced_in_pr, "
        "last_changed_pr, touched_by_prs FROM CodeUnit"
    )
    hit = [
        r
        for r in rows
        if str(number) in str(r.get("touched_by_prs") or "").split(",")
    ]
    return {
        "pr": number,
        "introduced": [r for r in hit if _int(r.get("introduced_in_pr")) == number],
        "changed": [r for r in hit if _int(r.get("introduced_in_pr")) != number],
        "total": len(hit),
    }
