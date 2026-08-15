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
    "Requirement": {"key": "req_id", "properties": {"req_id": "STRING", "title": "STRING", "document": "STRING", "baselined": "BOOLEAN"}},
    "Document": {"key": "doc_key", "properties": {"doc_key": "STRING", "doc_id": "STRING", "version": "INTEGER", "title": "STRING"}},
    "WorkItem": {"key": "issue_key", "properties": {"issue_key": "STRING", "title": "STRING", "status": "STRING"}},
    "Commit": {"key": "sha", "properties": {"sha": "STRING", "message": "STRING", "authored_at": "STRING"}},
    "PullRequest": {"key": "pr_key", "properties": {"pr_key": "STRING", "number": "INTEGER", "title": "STRING", "state": "STRING", "merged_at": "STRING"}},
    "TestCase": {"key": "tc_id", "properties": {"tc_id": "STRING", "title": "STRING", "automated": "BOOLEAN"}},
    "TestRun": {"key": "run_key", "properties": {"run_key": "STRING", "status": "STRING", "executed_at": "STRING"}},
    "Defect": {"key": "defect_id", "properties": {"defect_id": "STRING", "title": "STRING", "severity": "STRING", "status": "STRING"}},
    "PipelineRun": {"key": "run_id", "properties": {"run_id": "STRING", "workflow": "STRING", "conclusion": "STRING", "started_at": "STRING"}},
    "Deployment": {"key": "deployment_id", "properties": {"deployment_id": "STRING", "environment": "STRING", "status": "STRING", "created_at": "STRING", "gate_approved": "BOOLEAN"}},
    "Release": {"key": "tag", "properties": {"tag": "STRING", "released_at": "STRING"}},
    "Stage": {"key": "stage_id", "properties": {"stage_id": "STRING", "label": "STRING", "position": "INTEGER", "is_gate": "BOOLEAN", "accountable_role": "STRING"}},
    # Populated by the code graph builder.
    "CodeUnit": {"key": "unit_id", "properties": {"unit_id": "STRING", "kind": "STRING", "name": "STRING", "path": "STRING", "start_line": "INTEGER", "end_line": "INTEGER", "introduced_in_pr": "INTEGER", "introduced_in_sha": "STRING", "signature": "STRING"}},
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
    "CONTAINS",       # CodeUnit      -> CodeUnit  (class -> method)
    "CALLS",          # CodeUnit      -> CodeUnit
    "DEPENDS_ON",     # CodeUnit      -> CodeUnit
]

#: Everything the projector owns. `spine reproject` drops these and rebuilds.
PROJECTION_TYPES = list(VERTEX_TYPES) + EDGE_TYPES
