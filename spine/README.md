# SDLC Spine

Ingestion, storage and read API for the delivery console. Implements slice A of
`docs/superpowers/specs/2026-08-15-sdlc-spine-design.md`.

## Running

```bash
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt

./.venv/Scripts/python -m spine.cli ingest      # live GitHub + CI -> event log
./.venv/Scripts/python -m spine.cli reproject   # drop graph, rebuild from log
./.venv/Scripts/python -m spine.cli codegraph   # parse app_src -> CodeUnit vertices
./.venv/Scripts/python -m spine.cli status      # what is in the store
./.venv/Scripts/python -m spine.cli serve       # read API on :8077
```

`ingest` needs `GITHUB_TOKEN` in `dashboard/.env`. Everything else works offline.

## Shape

```
connectors/  source -> Event[].          Never touches the graph.
core/        vocabulary, events, identity, working calendar
store/       ArcadeDB schema and access
projector/   events -> graph.            Never calls a source.
codegraph/   Java source -> CodeUnit, with pull-request provenance
api/         FastAPI read surface
```

Those two boundaries are the design. They are what make `reproject` safe to run
at any time: the projector is a pure function from the event log, so the graph
can be dropped and rebuilt without re-fetching anything.

## Storage

One ArcadeDB instance holds both models. `Event` is an append-only document
type and is the system of record; every vertex and edge is a projection over it
and is disposable. The embedded package bundles its own JRE, so no JDK or Docker
is required.

## Provenance and rollback

Every `CodeUnit` records `introduced_in_pr`, `last_changed_pr` and the full set
of pull requests still live in its line range. `GET /code/pr/{n}` answers what
would back out with a given pull request — separating what it *created* from
what it *changed*, because reverting takes both.

## What is real

Live: GitHub commits, pull requests, reviews, workflow runs, deployments; the
code graph parsed from source.

Not connected yet: Jira, Confluence and Zephyr. Their endpoints return empty
rather than invented rows. The console defaults to seeded fixtures for demos and
can be pointed at this API with `VITE_SPINE_MODE=live`.
