"""Command line entry points.

    python -m spine.cli ingest      pull live sources into the event log
    python -m spine.cli codegraph   parse the subject repo into Code vertices     
    python -m spine.cli reproject   drop the graph and rebuild it from the log
    python -m spine.cli status      what is in the store
    python -m spine.cli serve       run the read API
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from typing import Any

from .codegraph.java import JavaGraphBuilder
from .config import config
from .connectors.confluence import ConfluenceConnector
from .connectors.github import GitHubConnector
from .core.identity import ROSTER, IdentityResolver
from .projector.graph import Projector
from .store.arcade import Store
from .store.schema import code_type_for


def _resolver() -> IdentityResolver:
    return IdentityResolver.from_map_file(ROSTER, config().identity_map)


def ingest() -> int:
    cfg = config()
    now = datetime.now(timezone.utc).isoformat()
    github: GitHubConnector | None = None

    try:
        with Store(cfg.db_path) as store:
            # Confluence first and unconditionally: it needs no credential, and
            # the requirements it produces are what everything else links to.
            confluence = ConfluenceConnector(cfg.requirements_dir)
            batch = [event.to_row() for event in confluence.fetch()]
            written = store.append_events(batch)
            print(f"confluence: {len(batch)} events, {written} new")
            store.set_watermark("confluence", now, now)

            if cfg.has_github:
                github = GitHubConnector(cfg.github_token, cfg.github_repo)
                batch = [event.to_row() for event in github.fetch()]
                written = store.append_events(batch)
                print(f"github+ci : {len(batch)} events, {written} new")
                store.set_watermark("github", now, now)
            else:
                print("github+ci : skipped, no GITHUB_TOKEN in dashboard/.env")

            print(f"event log now holds {store.count('Event')}")
    finally:
        if github is not None:
            github.close()
    return 0


def codegraph() -> int:
    cfg = config()
    builder = JavaGraphBuilder(cfg.source_dir)
    units = builder.build()

    with Store(cfg.db_path) as store:
        # Clear the previous parse: a unit that was renamed or deleted in source
        # would otherwise linger forever, since nothing else removes it.
        store.drop_code_graph()
        with store.transaction():
            for unit in units:
                store.upsert_vertex(code_type_for(unit.kind), unit.unit_id, unit.to_props())
        # Relationships in a second pass: both ends must exist first.
        by_id = {u.unit_id: u for u in units}
        vertex_cache: dict[str, Any] = {}

        def vertex(unit_id: str):
            """Vertex for a unit id, cached - the same class is referenced from
            dozens of places and each lookup is a round trip."""
            if unit_id in vertex_cache:
                return vertex_cache[unit_id]
            unit = by_id.get(unit_id)
            found = (
                store.lookup(code_type_for(unit.kind), "unit_id", unit_id) if unit else None
            )
            vertex_cache[unit_id] = found
            return found

        # Types declared anywhere in the source, by simple name, so an import or
        # a signature reference can be resolved back to something we parsed.
        types_by_name: dict[str, list[str]] = {}
        for unit in units:
            if unit.kind in ("class", "interface", "enum", "record"):
                types_by_name.setdefault(unit.name, []).append(unit.unit_id)

        # Methods by owning type, so a call resolves within the caller's own
        # class before falling back to anything with a matching name.
        methods_by_owner: dict[str, dict[str, str]] = {}
        for unit in units:
            if unit.kind == "method" and unit.parent_id:
                methods_by_owner.setdefault(unit.parent_id, {})[unit.name] = unit.unit_id

        counts = {"CONTAINS": 0, "CALLS": 0, "IMPORTS": 0, "DEPENDS_ON": 0}
        linked: set[tuple[str, str, str]] = set()

        def link(from_id: str, edge: str, to_id: str, **props: Any) -> None:
            if from_id == to_id or (from_id, edge, to_id) in linked:
                return
            a, b = vertex(from_id), vertex(to_id)
            if a is None or b is None:
                return
            store.link(a, edge, b, **props)
            linked.add((from_id, edge, to_id))
            counts[edge] += 1

        with store.transaction():
            for unit in units:
                # A file contains its types; a type contains its methods and
                # fields. Without the first of those, "what is in this file" has
                # no answer in the graph.
                if unit.parent_id and unit.parent_id in by_id:
                    link(unit.parent_id, "CONTAINS", unit.unit_id)

                # Imports, resolved to types that exist in this repository.
                # An import of a JDK or Spring class resolves to nothing and is
                # left out rather than creating a node for code we cannot see.
                for imported in unit.imports:
                    simple = imported.rstrip(".*").split(".")[-1]
                    for target_id in types_by_name.get(simple, []):
                        link(unit.unit_id, "IMPORTS", target_id,
                             confidence=0.95, derived_by="import-statement")

                # Types named in a signature: field types, parameters, returns.
                # This is what connects a service to the DTOs and entities it
                # actually handles.
                owner = unit.parent_id if unit.kind in ("method", "field") else unit.unit_id
                for referenced in unit.type_refs:
                    for target_id in types_by_name.get(referenced, []):
                        if owner in by_id:
                            link(owner, "DEPENDS_ON", target_id,
                                 confidence=0.8, derived_by="signature-type")

                # Calls, preferring the caller's own class before any match
                # elsewhere. Full resolution needs a type checker, so these stay
                # low confidence and the console says so.
                if unit.kind == "method":
                    own = methods_by_owner.get(unit.parent_id or "", {})
                    for called in unit.calls:
                        target_id = own.get(called)
                        if target_id is None:
                            for owner_methods in methods_by_owner.values():
                                if called in owner_methods:
                                    target_id = owner_methods[called]
                                    break
                        if target_id:
                            link(unit.unit_id, "CALLS", target_id,
                                 confidence=0.4, derived_by="name-match")

        attributed = sum(1 for u in units if u.touched_by_prs)
        print(f"parsed {len(units)} code units from {cfg.source_dir.name}")
        print(f"  {sum(1 for u in units if u.kind == 'file')} files, "
              f"{sum(1 for u in units if u.kind in ('class', 'interface', 'enum', 'record'))} types, "
              f"{sum(1 for u in units if u.kind == 'method')} methods, "
              f"{sum(1 for u in units if u.kind == 'field')} fields")
        print("  edges: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
        print(f"  {attributed} carry pull-request provenance")
    return 0


def reproject() -> int:
    cfg = config()
    with Store(cfg.db_path) as store:
        events = store.count("Event")
        if events == 0:
            print("Event log is empty - run `ingest` first.")
            return 1
        dropped = store.drop_projection()
        print(f"dropped {dropped} projected types; event log intact ({events} events)")
        stats = Projector(store, _resolver()).run()
        print(
            f"projected {stats.events_read} events -> {stats.packets} packets, "
            f"{stats.spans} custody spans, {stats.vertices} vertices, {stats.edges} edges"
        )
        if stats.unresolved_accounts:
            print(f"  {stats.unresolved_accounts} unresolved source accounts (surfaced, not guessed)")
        if stats.orphan_packets:
            print(f"  {stats.orphan_packets} packets cite no work item")
    return 0


def status() -> int:
    cfg = config()
    with Store(cfg.db_path) as store:
        print(f"store: {store.path}")
        for name, count in sorted(store.counts().items(), key=lambda kv: -kv[1]):
            print(f"  {name:16} {count}")
    return 0


def serve() -> int:
    import os

    import uvicorn

    port = int(os.getenv("SPINE_PORT", "8077"))
    cfg = config()
    print(f"read API      http://127.0.0.1:{port}")
    if cfg.studio_enabled:
        print("ArcadeDB Studio http://localhost:2480  (user 'root')")
    else:
        print("ArcadeDB Studio disabled - set ARCADE_ROOT_PASSWORD (8+ chars) in dashboard/.env")
    uvicorn.run("spine.api.server:app", host="127.0.0.1", port=port, reload=False)
    return 0


COMMANDS = {
    "ingest": ingest,
    "codegraph": codegraph,
    "reproject": reproject,
    "status": status,
    "serve": serve,
}


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        return 2
    return COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    raise SystemExit(main())
