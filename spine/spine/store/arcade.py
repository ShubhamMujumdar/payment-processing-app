"""ArcadeDB access.

Chosen for the Apache-2.0 licence and because it is multi-model: the immutable
event log and the graph projection live in one store, so the audit story does
not require running two databases.

The embedded package bundles its own JRE, which is why this needs neither a JDK
nor Docker on the machine.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable, Iterator

import arcadedb_embedded as arcade

from .schema import (
    DOCUMENT_TYPES,
    EDGE_TYPES,
    EVENT_EDGE_TYPES,
    EVENT_VERTEX_TYPES,
    PROJECTION_TYPES,
    VERTEX_TYPES,
)


class Store:
    def __init__(self, path: str | Path):
        self.path = str(Path(path).resolve())
        self._db: Any | None = None

    # --- lifecycle ---------------------------------------------------------
    def open(self) -> "Store":
        if arcade.database_exists(self.path):
            self._db = arcade.open_database(self.path)
        else:
            self._db = arcade.create_database(self.path)
        self.ensure_schema()
        return self

    def close(self) -> None:
        if self._db is not None:
            self._db.close()
            self._db = None

    def __enter__(self) -> "Store":
        return self.open()

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @property
    def db(self) -> Any:
        if self._db is None:
            raise RuntimeError("Store is not open. Call open() or use it as a context manager.")
        return self._db

    # --- schema ------------------------------------------------------------
    def ensure_schema(self) -> None:
        schema = self.db.schema

        for name, spec in DOCUMENT_TYPES.items():
            if not schema.exists_type(name):
                schema.create_document_type(name)
            for prop, kind in spec["properties"].items():
                schema.get_or_create_property(name, prop, kind)
            for props, unique in spec["indexes"]:
                schema.get_or_create_index(name, props, unique=unique)

        for name, spec in VERTEX_TYPES.items():
            if not schema.exists_type(name):
                schema.create_vertex_type(name)
            for prop, kind in spec["properties"].items():
                schema.get_or_create_property(name, prop, kind)
            schema.get_or_create_index(name, [spec["key"]], unique=True)

        for name in EDGE_TYPES:
            if not schema.exists_type(name):
                schema.create_edge_type(name)

    def drop_projection(self) -> int:
        """Drop everything derived from the event log, so it can be rebuilt.

        The code graph is deliberately spared: it is derived from the source
        tree rather than from events, so there would be nothing in the log to
        rebuild it from. `codegraph` refreshes that separately.
        """
        schema = self.db.schema
        dropped = 0
        # Edges first: dropping a vertex type with live edges leaves dangling
        # references behind.
        for name in EVENT_EDGE_TYPES + EVENT_VERTEX_TYPES:
            if schema.exists_type(name):
                schema.drop_type(name)
                dropped += 1
        self.ensure_schema()
        return dropped

    # --- writing -----------------------------------------------------------
    @contextmanager
    def transaction(self) -> Iterator[None]:
        with self.db.transaction():
            yield

    def append_events(self, rows: Iterable[dict[str, Any]]) -> int:
        """Append to the log. Duplicates are rejected by the unique index on
        event_id, which makes re-ingest a no-op rather than something the
        connector has to reason about."""
        written = 0
        for row in rows:
            if self.lookup("Event", "event_id", row["event_id"]) is not None:
                continue
            with self.db.transaction():
                doc = self.db.new_document("Event")
                for key, value in row.items():
                    doc.set(key, value)
                doc.save()
            written += 1
        return written

    def dead_letter(self, source: str, reason: str, body: dict[str, Any], seen_at: str) -> None:
        with self.db.transaction():
            doc = self.db.new_document("DeadLetter")
            doc.set("source", source)
            doc.set("reason", reason)
            doc.set("seen_at", seen_at)
            doc.set("body", json.dumps(body, default=str))
            doc.save()

    def upsert_vertex(self, type_name: str, key_value: str, props: dict[str, Any]) -> Any:
        key = VERTEX_TYPES[type_name]["key"]
        existing = self.lookup(type_name, key, key_value)
        if existing is not None:
            vertex = existing.modify()
            for name, value in props.items():
                vertex.set(name, value)
            vertex.save()
            return vertex
        vertex = self.db.new_vertex(type_name)
        vertex.set(key, key_value)
        for name, value in props.items():
            vertex.set(name, value)
        vertex.save()
        return vertex

    def link(self, from_vertex: Any, edge_type: str, to_vertex: Any, **props: Any) -> None:
        edge = from_vertex.new_edge(edge_type, to_vertex)
        for name, value in props.items():
            edge.set(name, value)
        edge.save()

    # --- reading -----------------------------------------------------------
    def lookup(self, type_name: str, key: str, value: Any) -> Any | None:
        """First record matching a keyed lookup, or None.

        lookup_by_key is inconsistent by design: None on a miss, a bare Document
        on a single hit, an iterable on several. Normalised here so callers can
        just check for None.
        """
        try:
            hits = self.db.lookup_by_key(type_name, [key], [value])
        except Exception:
            return None
        if hits is None:
            return None
        if isinstance(hits, (list, tuple)):
            return hits[0] if hits else None
        if hasattr(hits, "__iter__") and not hasattr(hits, "get"):
            for hit in hits:
                return hit
            return None
        return hits

    def query(self, statement: str, *args: Any, language: str = "sql") -> list[dict[str, Any]]:
        return [row.to_dict() for row in self.db.query(language, statement, *args)]

    def cypher(self, statement: str, *args: Any) -> list[dict[str, Any]]:
        return self.query(statement, *args, language="cypher")

    def count(self, type_name: str) -> int:
        try:
            return self.db.count_type(type_name)
        except Exception:
            return 0

    def counts(self) -> dict[str, int]:
        return {name: self.count(name) for name in ["Event", *PROJECTION_TYPES] if self.count(name)}

    # --- watermarks --------------------------------------------------------
    def get_watermark(self, source: str) -> str | None:
        row = self.lookup("Watermark", "source", source)
        return row.get("cursor") if row else None

    def set_watermark(self, source: str, cursor: str, updated_at: str) -> None:
        existing = self.lookup("Watermark", "source", source)
        with self.db.transaction():
            doc = existing.modify() if existing is not None else self.db.new_document("Watermark")
            doc.set("source", source)
            doc.set("cursor", cursor)
            doc.set("updated_at", updated_at)
            doc.save()
