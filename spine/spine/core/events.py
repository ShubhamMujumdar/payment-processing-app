"""The event record: the system of record.

Append-only. Never updated, never deleted. The graph is a projection over these
and can be dropped and rebuilt at any time, which is what makes it safe to keep
changing the graph's shape during the POC.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from .vocabulary import Source, Verb

SCHEMA_VERSION = 1


def _utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


@dataclass(slots=True)
class EntityRef:
    """A pointer to something in a source system, before resolution."""

    kind: str  # commit | pull_request | issue | page | test_case | deployment ...
    id: str
    label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class Event:
    source: Source
    source_event_id: str
    verb: Verb
    occurred_at: datetime
    actor_ref: dict[str, Any] | None = None
    subject_ref: EntityRef | None = None
    object_refs: list[EntityRef] = field(default_factory=list)
    payload: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)
    ingested_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    schema_version: int = SCHEMA_VERSION

    @property
    def event_id(self) -> str:
        """Deterministic, so re-ingesting the same source object is a no-op at
        the storage layer rather than something connector logic has to guard."""
        digest = hashlib.sha256(
            f"{self.source}|{self.source_event_id}|{self.verb}".encode()
        )
        return digest.hexdigest()

    def to_row(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "source": str(self.source),
            "source_event_id": self.source_event_id,
            "verb": str(self.verb),
            "occurred_at": _utc(self.occurred_at),
            "ingested_at": _utc(self.ingested_at),
            "actor_ref": json.dumps(self.actor_ref or {}),
            "subject_ref": json.dumps(self.subject_ref.to_dict() if self.subject_ref else {}),
            "object_refs": json.dumps([r.to_dict() for r in self.object_refs]),
            "payload": json.dumps(self.payload, default=str),
            # Kept verbatim so a schema change is handled by re-normalising from
            # the log rather than re-hitting the source API. Re-fetching is
            # rate-limited, slow, and for edited or deleted objects impossible.
            "raw": json.dumps(self.raw, default=str),
            "schema_version": self.schema_version,
        }


@dataclass(slots=True)
class Watermark:
    """Per-source ingest position. Advanced only after a batch commits, so a
    failure re-reads rather than skips. Re-reading is safe because event ids are
    deterministic."""

    source: str
    cursor: str | None = None
    last_event_at: str | None = None
    updated_at: str | None = None
