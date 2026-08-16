"""ArcadeDB schema.

One store, two models. The event log is a document type; everything else is a
graph projection over it. Dropping every GRAPH_* type and re-running the
projector must reproduce an identical graph -- that guarantee is what makes it
safe to keep changing the shape here.
"""

from __future__ import annotations

from typing import Any

# --- the system of record --------------------------------------------------
DOCUMENT_TYPES: dict[str, dict[str, Any]] = {
    "Event": {
        "properties": {
            "event_id": "STRING",
            "source": "STRING",
            "source_event_id": "STRING",
            "verb": "STRING",
            "occurred_at": "STRING",
            "ingested_at": "STRING",
            "schema_version": "INTEGER",
        },
        # Unique index makes re-ingest idempotent at the storage layer rather
        # than in connector logic.
        "indexes": [(["event_id"], True), (["source"], False), (["verb"], False)],
    },
    "Watermark": {
        "properties": {"source": "STRING", "cursor": "STRING", "updated_at": "STRING"},
        "indexes": [(["source"], True)],
    },
    "DeadLetter": {
        "properties": {"source": "STRING", "reason": "STRING", "seen_at": "STRING"},
        "indexes": [],
    },
}

# --- the projection --------------------------------------------------------
VERTEX_TYPES: dict[str, dict[str, Any]] = {
    "Person": {"key": "person_id", "properties": {"person_id": "STRING", "handle": "STRING", "name": "STRING", "role": "STRING"}},
    "SourceAccount": {"key": "account_key", "properties": {"account_key": "STRING", "source": "STRING", "account_id": "STRING", "resolved": "BOOLEAN"}},
    "WorkPacket": {"key": "packet_id", "properties": {"packet_id": "STRING", "title": "STRING", "current_stage": "STRING", "release": "STRING", "work_type": "STRING", "is_orphan": "BOOLEAN"}},
    "Requirement": {"key": "req_id", "properties": {"req_id": "STRING", "title": "STRING", "document": "STRING", "baselined": "BOOLEAN", "statement": "STRING", "obligation": "STRING", "priority": "STRING", "release": "STRING", "status": "STRING", "owner_id": "STRING"}},
    "Document": {"key": "doc_key", "properties": {"doc_key": "STRING", "doc_id": "STRING", "version": "INTEGER", "title": "STRING"}},
    "WorkItem": {"key": "issue_key", "properties": {"issue_key": "STRING", "title": "STRING", "status": "STRING"}},
    "Commit": {"key": "sha", "properties": {"sha": "STRING", "message": "STRING", "authored_at": "STRING"}},
    "PullRequest": {"key": "pr_key", "properties": {"pr_key": "STRING", "number": "INTEGER", "title": "STRING", "state": "STRING", "merged_at": "STRING"}},
    "TestCase": {"key": "tc_id", "properties": {"tc_id": "STRING", "title": "STRING", "automated": "BOOLEAN", "status": "STRING", "requirement_id": "STRING"}},
    "TestRun": {"key": "run_key", "properties": {"run_key": "STRING", "status": "STRING", "executed_at": "STRING"}},
    "Defect": {"key": "defect_id", "properties": {"defect_id": "STRING", "title": "STRING", "severity": "STRING", "status": "STRING", "requirement_id": "STRING"}},
    "PipelineRun": {"key": "run_id", "properties": {"run_id": "STRING", "workflow": "STRING", "conclusion": "STRING", "started_at": "STRING"}},
    "Deployment": {"key": "deployment_id", "properties": {"deployment_id": "STRING", "environment": "STRING", "status": "STRING", "created_at": "STRING", "gate_approved": "BOOLEAN"}},
    "Release": {"key": "tag", "properties": {"tag": "STRING", "released_at": "STRING"}},
    "Stage": {"key": "stage_id", "properties": {"stage_id": "STRING", "label": "STRING", "position": "INTEGER", "is_gate": "BOOLEAN", "accountable_role": "STRING"}},
    # `Code` is the supertype every parsed unit shares. Concrete subtypes are
    # declared below and created with EXTENDS, so a node is both `Code` and the
    # thing it actually is: MATCH (c:Code) spans the codebase, MATCH
    # (m:CodeMethod) narrows to methods. "CodeUnit" said nothing about what a
    # node was when we have real classes, methods and fields to name.
    "Code": {"key": "unit_id", "properties": {"unit_id": "STRING", "kind": "STRING", "name": "STRING", "path": "STRING", "start_line": "INTEGER", "end_line": "INTEGER", "introduced_in_pr": "INTEGER", "introduced_in_sha": "STRING", "last_changed_pr": "INTEGER", "last_changed_sha": "STRING", "touched_by_prs": "STRING", "signature": "STRING"}},
    "CustodySpan": {"key": "span_id", "properties": {"span_id": "STRING", "packet_id": "STRING", "stage_id": "STRING", "person_id": "STRING", "entered_at": "STRING", "exited_at": "STRING", "custody_seconds": "INTEGER", "calendar_adjusted_seconds": "INTEGER", "activity_signal_count": "INTEGER", "active_minutes_estimate": "INTEGER", "is_open": "BOOLEAN", "is_overdue": "BOOLEAN", "flags": "STRING"}},
}

EDGE_TYPES = [
    "SAME_AS",        # SourceAccount -> Person
    "HELD_BY",        # CustodySpan   -> Person
    "IN_PACKET",      # CustodySpan   -> WorkPacket
    "AT_STAGE",       # CustodySpan   -> Stage
    "HANDED_OFF_TO",  # CustodySpan   -> CustodySpan   (the accountability chain)
    "DERIVES_FROM",   # Requirement   -> Requirement
    "DOCUMENTS",      # Document      -> Requirement
    "ADDRESSES",      # WorkItem      -> Requirement
    "IMPLEMENTS",     # Commit/PR     -> Requirement
    "PART_OF",        # Commit        -> PullRequest
    "VERIFIES",       # TestCase      -> Requirement
    "COVERS",         # TestCase      -> CodeUnit
    "EXECUTED",       # TestRun       -> TestCase
    "RAISED_AGAINST", # Defect        -> Requirement / CodeUnit / TestRun
    "FIXES",          # PullRequest   -> Defect
    "PRODUCED",       # PipelineRun   -> Deployment
    "DEPLOYED_IN",    # PullRequest   -> Release
    "TOUCHES",        # PullRequest   -> CodeUnit
    "IMPORTS",        # Code          -> Code      (file -> type it imports)
    "CONTAINS",       # Code          -> Code      (file -> type, type -> member)
    "CALLS",          # CodeUnit      -> CodeUnit
    "DEPENDS_ON",     # CodeUnit      -> CodeUnit
]

#: Concrete code types, each EXTENDS Code. The parser's `kind` maps to these,
#: so a method lands in CodeMethod and is still reachable as Code.
CODE_SUBTYPES: dict[str, str] = {
    "file": "CodeFile",
    "class": "CodeClass",
    "interface": "CodeInterface",
    "enum": "CodeEnum",
    "record": "CodeRecord",
    "method": "CodeMethod",
    "field": "CodeField",
}

CODE_SUPERTYPE = "Code"


def code_type_for(kind: str) -> str:
    """Concrete vertex type for a parsed unit, falling back to the supertype so
    an unrecognised kind is still stored rather than dropped."""
    return CODE_SUBTYPES.get(kind, CODE_SUPERTYPE)


#: Everything projected, for reporting.
PROJECTION_TYPES = list(VERTEX_TYPES) + list(CODE_SUBTYPES.values()) + EDGE_TYPES

#: The code graph is derived from the SOURCE TREE, not from the event log, so
#: `reproject` must not drop it -- there would be nothing in the log to rebuild
#: it from. It is refreshed by `codegraph` instead, and traceability links from
#: the RTM attach to it, which is why codegraph runs first.
CODE_TYPES = [CODE_SUPERTYPE, *CODE_SUBTYPES.values()]
CODE_EDGE_TYPES = ["CONTAINS", "CALLS", "DEPENDS_ON", "IMPORTS", "TOUCHES"]

#: What `reproject` owns: everything derivable from the event log.
EVENT_VERTEX_TYPES = [t for t in VERTEX_TYPES if t not in CODE_TYPES]
EVENT_EDGE_TYPES = [t for t in EDGE_TYPES if t not in CODE_EDGE_TYPES]
