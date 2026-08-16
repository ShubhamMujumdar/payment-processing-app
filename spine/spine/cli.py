"""Command line entry points.

    python -m spine.cli ingest      pull live sources into the event log
    python -m spine.cli codegraph   parse the subject repo into CodeUnit vertices
    python -m spine.cli reproject   drop the graph and rebuild it from the log
    python -m spine.cli status      what is in the store
    python -m spine.cli serve       run the read API
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone

from .codegraph.java import JavaGraphBuilder
from .config import config
from .connectors.confluence import ConfluenceConnector
from .connectors.github import GitHubConnector
from .core.identity import ROSTER, IdentityResolver
from .projector.graph import Projector
from .store.arcade import Store


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
        with store.transaction():
            for unit in units:
                store.upsert_vertex("CodeUnit", unit.unit_id, unit.to_props())
        # Containment and calls in a second pass: both ends must exist first.
        with store.transaction():
            by_id = {u.unit_id: u for u in units}
            for unit in units:
                source = store.lookup("CodeUnit", "unit_id", unit.unit_id)
                if source is None:
                    continue
                if unit.parent_id and unit.parent_id in by_id:
                    parent = store.lookup("CodeUnit", "unit_id", unit.parent_id)
                    if parent is not None:
                        store.link(parent, "CONTAINS", source)
                for called in unit.calls:
                    # Name-level resolution only; full resolution needs a type
                    # checker, so these carry low confidence and say so.
                    for candidate_id, candidate in by_id.items():
                        if candidate.kind == "method" and candidate.name == called:
                            target = store.lookup("CodeUnit", "unit_id", candidate_id)
                            if target is not None:
                                store.link(source, "CALLS", target, confidence=0.4,
                                           derived_by="name-match")
                            break

        attributed = sum(1 for u in units if u.touched_by_prs)
        print(f"parsed {len(units)} code units from {cfg.source_dir.name}")
        print(f"  {sum(1 for u in units if u.kind == 'file')} files, "
              f"{sum(1 for u in units if u.kind in ('class', 'interface', 'enum', 'record'))} types, "
              f"{sum(1 for u in units if u.kind == 'method')} methods, "
              f"{sum(1 for u in units if u.kind == 'field')} fields")
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
