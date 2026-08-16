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
from ..store.schema import CODE_SUBTYPES, CODE_SUPERTYPE, EDGE_TYPES, VERTEX_TYPES

KEY_BY_TYPE: dict[str, str] = {t: spec["key"] for t, spec in VERTEX_TYPES.items()}
# Code subtypes all key on unit_id and are addressable in their own right.
KEY_BY_TYPE.update({t: "unit_id" for t in CODE_SUBTYPES.values()})
KEY_BY_TYPE[CODE_SUPERTYPE] = "unit_id"

# The reverse map is only used to infer a type from a returned document, and
# unit_id is shared across the Code hierarchy, so those are resolved by `kind`
# instead (see infer_type).
TYPE_BY_KEY: dict[str, str] = {
    spec["key"]: t for t, spec in VERTEX_TYPES.items()
}

assert len(TYPE_BY_KEY) == len(VERTEX_TYPES), "vertex key names must be unique across types"

#: kind -> concrete type, for documents coming back from the Code hierarchy.
_CODE_TYPE_BY_KIND = dict(CODE_SUBTYPES)

#: Property to show as the node's caption, in preference order.
CAPTION_FIELDS: dict[str, tuple[str, ...]] = {
    "Person": ("name",),
    "Requirement": ("req_id",),
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
    **{t: ("name", "unit_id") for t in CODE_SUBTYPES.values()},
    CODE_SUPERTYPE: ("name", "unit_id"),
}

#: Fields worth showing in a node's summary line, beyond the caption.
SUBTITLE_FIELDS: dict[str, str] = {
    "Person": "role",
    "Requirement": "status",
    "WorkPacket": "current_stage",
    "CustodySpan": "person_id",
    "TestCase": "status",
    "Defect": "severity",
    "PullRequest": "state",
    "Deployment": "status",
    "PipelineRun": "conclusion",
    **{t: "path" for t in CODE_SUBTYPES.values()},
    CODE_SUPERTYPE: "path",
}


def node_id(type_name: str, key_value: Any) -> str:
    return f"{type_name}:{key_value}"


def infer_type(row: dict[str, Any]) -> str | None:
    """Concrete vertex type for a returned document.

    Most types are identified by their unique key property. The Code hierarchy
    shares `unit_id` across seven subtypes, so those resolve through `kind` --
    which the parser already records on every node.
    """
    if "unit_id" in row:
        return _CODE_TYPE_BY_KIND.get(str(row.get("kind") or ""), CODE_SUPERTYPE)
    for key, type_name in TYPE_BY_KEY.items():
        if key in row:
            return type_name
    return None


def _coerce(value: Any) -> Any:
    """A Python primitive, or None if the value cannot safely become one.

    Values crossing the JVM boundary are not always what an isinstance check
    says they are: a java.lang.String satisfies isinstance(v, str) yet fails
    JSON serialisation, taking the whole response down with it. Coercing
    explicitly is the only reliable way through.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return bool(value)
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float):
        return float(value)
    if isinstance(value, str):
        # Truncated so a 1000-character requirement statement does not dominate
        # the payload; the detail panel fetches the full record separately.
        return str(value)[:240]
    return None


def _clean_properties(row: dict[str, Any]) -> dict[str, Any]:
    """JSON-safe properties only.

    A Cypher `RETURN n` also leaves the raw vertex handle in the row under its
    alias. Anything that will not coerce to a primitive is dropped rather than
    guessed at.
    """
    out: dict[str, Any] = {}
    for key, value in row.items():
        if key.startswith("@"):
            continue
        coerced = _coerce(value)
        if coerced is not None:
            out[key] = coerced
    return out


def to_node(row: dict[str, Any], type_name: str | None = None) -> dict[str, Any] | None:
    """Build a canvas node.

    `type_name` comes from the record itself wherever possible. The fallback
    infers from key properties, which is only safe for rows that are not
    vertices - see Store.typed_rows for why.
    """
    type_name = str(type_name) if type_name else infer_type(row)
    if type_name is None:
        return None
    if type_name not in KEY_BY_TYPE:
        return None
    key_prop = KEY_BY_TYPE[type_name]
    key_value = _coerce(row.get(key_prop))
    caption = next(
        (str(row[f]) for f in CAPTION_FIELDS.get(type_name, ()) if row.get(f)),
        str(key_value),
    )
    subtitle_field = SUBTITLE_FIELDS.get(type_name)
    return {
        "id": node_id(type_name, key_value),
        "type": str(type_name),
        "key": key_value,
        "caption": caption[:64],
        "subtitle": str(row.get(subtitle_field) or "") if subtitle_field else "",
        "properties": _clean_properties(row),
    }


def split_id(node: str) -> tuple[str, str]:
    type_name, _, key = node.partition(":")
    return type_name, key


class GraphExplorer:
    def __init__(self, store: Store):
        self.store = store
        self._key_cache: dict[str, dict[str, Any] | None] = {}

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
                rows = self.store.typed_rows(
                    f"SELECT FROM {type_name} WHERE {clauses} LIMIT {limit}", *params
                )
            except Exception:
                continue
            for actual_type, row in rows:
                node = to_node(row, actual_type)
                if node:
                    found.append(node)
                if len(found) >= limit:
                    break
        return found

    def sample(self, type_name: str, limit: int = 25) -> list[dict[str, Any]]:
        rows = self.store.typed_rows(f"SELECT FROM {type_name} LIMIT {limit}")
        return [n for n in (to_node(r, t) for t, r in rows) if n]

    # --- node ---------------------------------------------------------------
    def node(self, node: str) -> dict[str, Any] | None:
        type_name, key = split_id(node)
        if type_name not in KEY_BY_TYPE:
            return None
        rows = self.store.typed_rows(
            f"SELECT FROM {type_name} WHERE {KEY_BY_TYPE[type_name]} = ?", key
        )
        return to_node(rows[0][1], rows[0][0]) if rows else None

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
                    rows = self.store.typed_rows(
                        f"SELECT expand({direction}('{edge_type}')) FROM {type_name} "
                        f"WHERE {key_prop} = ? LIMIT {limit_per_edge}",
                        key,
                    )
                except Exception:
                    continue

                for actual_type, row in rows:
                    neighbour = to_node(row, actual_type)
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

    def all_of_type(self, type_name: str, limit: int = 200) -> dict[str, Any]:
        """Every node of one class, with the edges that run between them.

        This is what clicking a class in the legend gives you: the population
        first, and whatever structure that population already has.
        """
        if type_name not in KEY_BY_TYPE:
            return {"nodes": [], "edges": []}
        rows = self.store.typed_rows(f"SELECT FROM {type_name} LIMIT {limit}")
        nodes = [n for n in (to_node(r, t) for t, r in rows) if n]
        return {"nodes": nodes, "edges": self.induced_edges([n["id"] for n in nodes])}

    def induced_edges(self, node_ids: list[str]) -> list[dict[str, Any]]:
        """Edges whose BOTH ends are in the given set.

        Without this a class view is a field of unconnected dots; with it, the
        structure the population already has shows up for free.
        """
        wanted = set(node_ids)
        edges: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()

        for node in node_ids:
            for edge in self.expand(node, limit_per_edge=60)["edges"]:
                if edge["source"] not in wanted or edge["target"] not in wanted:
                    continue
                signature = (edge["source"], edge["type"], edge["target"])
                if signature in seen:
                    continue
                seen.add(signature)
                edges.append(edge)
        return edges

    def resolve_key(self, value: str) -> dict[str, Any] | None:
        """Find a node from a bare key like 'BR-PAY-005' or 'DEF-016'.

        Every key lookup is indexed, so trying each type is cheap. Keys are
        distinctive enough across the schema that a collision is not a practical
        concern.
        """
        if not value or len(value) > 200:
            return None
        if value in self._key_cache:
            return self._key_cache[value]

        found = None
        for type_name, key_prop in KEY_BY_TYPE.items():
            if type_name == CODE_SUPERTYPE:
                continue  # subtypes cover the same rows and carry the real type
            try:
                rows = self.store.typed_rows(
                    f"SELECT FROM {type_name} WHERE {key_prop} = ? LIMIT 1", value
                )
            except Exception:
                continue
            if rows:
                found = to_node(rows[0][1], rows[0][0])
                break

        self._key_cache[value] = found
        return found

    def run_cypher(self, cypher: str, limit: int = 120) -> dict[str, Any]:
        """Run a read-only Cypher query and return it as a subgraph.

        Handles both shapes people actually write: `RETURN n` returns vertex
        handles, which are unwrapped for their properties, and
        `RETURN n.req_id AS id` returns keys, which are resolved by lookup.
        """
        if not is_read_only(cypher):
            raise ValueError("This surface is read-only. Write operations are refused.")

        rows = self.store.cypher_rows(cypher)
        nodes: dict[str, dict[str, Any]] = {}

        for row in rows[:limit]:
            for actual_type, props in row["vertices"]:
                node = to_node(props, actual_type)
                if node:
                    nodes.setdefault(node["id"], node)

            # Queries that return keys rather than whole vertices still draw:
            # any scalar that resolves to a known record becomes a node.
            if not row["vertices"]:
                for value in row["scalars"].values():
                    if isinstance(value, str):
                        node = self.resolve_key(value)
                        if node:
                            nodes.setdefault(node["id"], node)

        return {
            "nodes": list(nodes.values()),
            "edges": self.induced_edges(list(nodes)),
        }

    def type_counts(self) -> list[dict[str, Any]]:
        out = []
        for type_name in KEY_BY_TYPE:
            count = self.store.count(type_name)
            if count:
                out.append({"type": type_name, "count": count})
        return sorted(out, key=lambda r: -r["count"])


# ---------------------------------------------------------------------------
# Saved queries.
#
# Each one answers a question somebody actually asks in a governance review.
# They return whole vertices so the canvas can render them; the induced edges
# between the results are filled in afterwards.
# ---------------------------------------------------------------------------
SAVED_QUERIES: list[dict[str, str]] = [
    {
        "id": "unsatisfied-requirements",
        "label": "Requirements not satisfied",
        "description": "Business and functional requirements the programme records as unmet.",
        "cypher": "MATCH (r:Requirement) WHERE r.status = 'not_satisfied' RETURN r LIMIT 40",
    },
    {
        "id": "requirements-without-tests",
        "label": "Requirements with no test case",
        "description": "An untested requirement is an assertion, not a control.",
        "cypher": (
            "MATCH (r:Requirement) WHERE NOT (r)<-[:VERIFIES]-() "
            "AND r.status <> 'unknown' RETURN r LIMIT 40"
        ),
    },
    {
        "id": "defects-and-requirements",
        "label": "Defects and what they hit",
        "description": "Every open defect with the requirement it was raised against.",
        "cypher": ("MATCH (d:Defect)-[:RAISED_AGAINST]->(r:Requirement) "
                   "RETURN d.defect_id AS defect, r.req_id AS requirement LIMIT 60"),
    },
    {
        "id": "refund-ceiling",
        "label": "BR-PAY-005 full closure",
        "description": "The programme's highest-severity open item, end to end.",
        "cypher": (
            "MATCH (br:Requirement {req_id:'BR-PAY-005'})<-[:DERIVES_FROM]-(fr:Requirement) "
            "OPTIONAL MATCH (fr)-[:IMPLEMENTS]->(c:Code) "
            "OPTIONAL MATCH (t:TestCase)-[:VERIFIES]->(fr) "
            "OPTIONAL MATCH (d:Defect)-[:RAISED_AGAINST]->(fr) "
            "RETURN br.req_id AS br, fr.req_id AS fr, c.unit_id AS code, "
            "t.tc_id AS test, d.defect_id AS defect LIMIT 80"
        ),
    },
    {
        "id": "code-without-requirement",
        "label": "Methods no requirement claims",
        "description": "Code that nothing in the matrix says should exist.",
        "cypher": (
            "MATCH (m:CodeMethod) WHERE NOT (m)<-[:IMPLEMENTS]-() RETURN m LIMIT 40"
        ),
    },
    {
        "id": "custody-chain",
        "label": "Handoff chains",
        "description": "Work packets and the people who held them, in order.",
        "cypher": (
            "MATCH (s:CustodySpan)-[:HELD_BY]->(p:Person) "
            "MATCH (s)-[:IN_PACKET]->(w:WorkPacket) "
            "RETURN s.span_id AS span, p.person_id AS person, w.packet_id AS packet LIMIT 60"
        ),
    },
    {
        "id": "unresolved-identities",
        "label": "Unmapped source accounts",
        "description": "Accounts with no person behind them; every number they touch is unattributed.",
        "cypher": "MATCH (a:SourceAccount) WHERE a.resolved = false RETURN a LIMIT 40",
    },
    {
        "id": "deployments-no-approver",
        "label": "Deployments with no approver",
        "description": "Transitions that happened without a human decision behind them.",
        "cypher": "MATCH (d:Deployment) WHERE d.gate_approved = false RETURN d LIMIT 40",
    },
]

#: Anything that could change the store. This surface is read-only, and a demo
#: console accepting arbitrary Cypher should not be the thing that proves it.
_WRITE_KEYWORDS = (
    "create", "merge", "delete", "detach", "set ", "remove", "drop",
    "insert", "update", "truncate", "alter", "grant", "revoke",
)


def is_read_only(cypher: str) -> bool:
    lowered = " ".join(cypher.lower().split())
    return not any(word in lowered for word in _WRITE_KEYWORDS)
