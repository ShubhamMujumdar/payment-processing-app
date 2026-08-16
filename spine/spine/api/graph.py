"""Generic graph exploration.

Node identity is ``Type:naturalKey``, not the storage RID. RIDs are reassigned
every time the projection is rebuilt, so a saved or shared view keyed on them
would silently point at the wrong thing after a reproject. Natural keys survive
that, and they are readable in a URL.

Type is inferred from which key property a returned document carries. Every
vertex type in the schema declares a distinct key name, so the mapping is
unambiguous - asserted at import rather than assumed.
"""

from __future__ import annotations

from typing import Any, Iterable

from ..store.arcade import Store
from ..store.schema import EDGE_TYPES, VERTEX_TYPES

KEY_BY_TYPE: dict[str, str] = {t: spec["key"] for t, spec in VERTEX_TYPES.items()}
TYPE_BY_KEY: dict[str, str] = {key: t for t, key in KEY_BY_TYPE.items()}

assert len(TYPE_BY_KEY) == len(KEY_BY_TYPE), "vertex key names must be unique across types"

#: Property to show as the node's caption, in preference order.
CAPTION_FIELDS: dict[str, tuple[str, ...]] = {
    "Person": ("name",),
    "Requirement": ("req_id",),
    "CodeUnit": ("name", "unit_id"),
    "WorkPacket": ("packet_id",),
    "CustodySpan": ("stage_id",),
    "TestCase": ("tc_id",),
    "Defect": ("defect_id",),
    "WorkItem": ("issue_key",),
    "PullRequest": ("pr_key",),
    "Commit": ("sha",),
    "PipelineRun": ("workflow", "run_id"),
    "Deployment": ("environment", "deployment_id"),
    "Stage": ("label", "stage_id"),
    "SourceAccount": ("account_id",),
    "Document": ("doc_id",),
    "Release": ("tag",),
    "TestRun": ("run_key",),
}

#: Fields worth showing in a node's summary line, beyond the caption.
SUBTITLE_FIELDS: dict[str, str] = {
    "Person": "role",
    "Requirement": "status",
    "CodeUnit": "kind",
    "WorkPacket": "current_stage",
    "CustodySpan": "person_id",
    "TestCase": "status",
    "Defect": "severity",
    "PullRequest": "state",
    "Deployment": "status",
    "PipelineRun": "conclusion",
}


def node_id(type_name: str, key_value: Any) -> str:
    return f"{type_name}:{key_value}"


def infer_type(row: dict[str, Any]) -> str | None:
    for key, type_name in TYPE_BY_KEY.items():
        if key in row:
            return type_name
    return None


def to_node(row: dict[str, Any]) -> dict[str, Any] | None:
    type_name = infer_type(row)
    if type_name is None:
        return None
    key_prop = KEY_BY_TYPE[type_name]
    key_value = row.get(key_prop)
    caption = next(
        (str(row[f]) for f in CAPTION_FIELDS.get(type_name, ()) if row.get(f)),
        str(key_value),
    )
    subtitle_field = SUBTITLE_FIELDS.get(type_name)
    return {
        "id": node_id(type_name, key_value),
        "type": type_name,
        "key": key_value,
        "caption": caption[:64],
        "subtitle": str(row.get(subtitle_field) or "") if subtitle_field else "",
        # Truncated so a 1000-character requirement statement does not dominate
        # the payload; the detail panel fetches the full record separately.
        "properties": {
            k: (v[:240] if isinstance(v, str) else v)
            for k, v in row.items()
            if not k.startswith("@")
        },
    }


def split_id(node: str) -> tuple[str, str]:
    type_name, _, key = node.partition(":")
    return type_name, key


class GraphExplorer:
    def __init__(self, store: Store):
        self.store = store

    # --- search -------------------------------------------------------------
    def search(self, query: str, limit: int = 40) -> list[dict[str, Any]]:
        """Match a query against every type's key and caption fields."""
        found: list[dict[str, Any]] = []
        needle = query.strip().lower()

        for type_name, key_prop in KEY_BY_TYPE.items():
            if len(found) >= limit:
                break
            fields = {key_prop, *CAPTION_FIELDS.get(type_name, ())}
            clauses = " OR ".join(f"{f}.toLowerCase() LIKE ?" for f in fields)
            params = [f"%{needle}%"] * len(fields)
            try:
                rows = self.store.query(
                    f"SELECT FROM {type_name} WHERE {clauses} LIMIT {limit}", *params
                )
            except Exception:
                continue
            for row in rows:
                node = to_node(row)
                if node:
                    found.append(node)
                if len(found) >= limit:
                    break
        return found

    def sample(self, type_name: str, limit: int = 25) -> list[dict[str, Any]]:
        rows = self.store.query(f"SELECT FROM {type_name} LIMIT {limit}")
        return [n for n in (to_node(r) for r in rows) if n]

    # --- node ---------------------------------------------------------------
    def node(self, node: str) -> dict[str, Any] | None:
        type_name, key = split_id(node)
        if type_name not in KEY_BY_TYPE:
            return None
        rows = self.store.query(
            f"SELECT FROM {type_name} WHERE {KEY_BY_TYPE[type_name]} = ?", key
        )
        return to_node(rows[0]) if rows else None

    # --- expansion ----------------------------------------------------------
    def degree(self, node: str) -> int:
        type_name, key = split_id(node)
        if type_name not in KEY_BY_TYPE:
            return 0
        rows = self.store.query(
            f"SELECT bothE().size() AS d FROM {type_name} "
            f"WHERE {KEY_BY_TYPE[type_name]} = ?",
            key,
        )
        try:
            return int(rows[0]["d"]) if rows else 0
        except (KeyError, TypeError, ValueError):
            return 0

    def expand(self, node: str, limit_per_edge: int = 25) -> dict[str, Any]:
        """Immediate neighbourhood of one node, with relationship types.

        Each edge type is queried in both directions rather than using bothE(),
        because the edge's own type name is not recoverable from an expanded
        vertex - and the relationship label is the most useful thing on screen.
        """
        type_name, key = split_id(node)
        if type_name not in KEY_BY_TYPE:
            return {"nodes": [], "edges": []}

        key_prop = KEY_BY_TYPE[type_name]
        nodes: dict[str, dict[str, Any]] = {}
        edges: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()

        for edge_type in EDGE_TYPES:
            for direction in ("out", "in"):
                try:
                    rows = self.store.query(
                        f"SELECT expand({direction}('{edge_type}')) FROM {type_name} "
                        f"WHERE {key_prop} = ? LIMIT {limit_per_edge}",
                        key,
                    )
                except Exception:
                    continue

                for row in rows:
                    neighbour = to_node(row)
                    if neighbour is None:
                        continue
                    nodes[neighbour["id"]] = neighbour
                    source, target = (
                        (node, neighbour["id"]) if direction == "out" else (neighbour["id"], node)
                    )
                    signature = (source, edge_type, target)
                    if signature in seen:
                        continue
                    seen.add(signature)
                    edges.append({"source": source, "target": target, "type": edge_type})

        return {"nodes": list(nodes.values()), "edges": edges}

    def subgraph(self, seeds: Iterable[str], limit_per_edge: int = 25) -> dict[str, Any]:
        nodes: dict[str, dict[str, Any]] = {}
        edges: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()

        for seed in seeds:
            origin = self.node(seed)
            if origin:
                nodes[origin["id"]] = origin
            result = self.expand(seed, limit_per_edge)
            for n in result["nodes"]:
                nodes.setdefault(n["id"], n)
            for e in result["edges"]:
                signature = (e["source"], e["type"], e["target"])
                if signature not in seen:
                    seen.add(signature)
                    edges.append(e)

        return {"nodes": list(nodes.values()), "edges": edges}

    def most_connected(self, type_name: str) -> str | None:
        """Highest-degree node of a type, computed in the database.

        Sampling a page of rows and measuring each in Python picks whichever
        happens to be stored first, which on this data was an FSD-21 requirement
        with a single edge — the canvas opened on almost nothing.
        """
        if type_name not in KEY_BY_TYPE:
            return None
        key_prop = KEY_BY_TYPE[type_name]
        try:
            rows = self.store.query(
                f"SELECT {key_prop} AS k, bothE().size() AS d FROM {type_name} "
                "ORDER BY d DESC LIMIT 1"
            )
        except Exception:
            return None
        if not rows or not rows[0].get("k"):
            return None
        return node_id(type_name, rows[0]["k"])

    def type_counts(self) -> list[dict[str, Any]]:
        out = []
        for type_name in KEY_BY_TYPE:
            count = self.store.count(type_name)
            if count:
                out.append({"type": type_name, "count": count})
        return sorted(out, key=lambda r: -r["count"])
