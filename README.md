# SDLC Spine

A delivery console for a fintech programme. It reads the tools people already
use — GitHub, CI, Confluence — and answers three questions they cannot answer
individually:

- **Who is accountable for this right now, and who had it before them?**
- **What does this requirement actually depend on, and is it proven?**
- **If we roll back that pull request, what goes with it?**

Nothing writes back to any source system. This is an observability layer.

---

## Quick start

```powershell
.\setup.ps1      # check prerequisites, install, build the graph
.\start.ps1      # run everything and print the URLs
.\stop.ps1       # shut down
```

Both scripts are safe to re-run and check before they act — a second `setup`
finishes in seconds and reports what it found. If you double-click instead of
using a terminal, `setup.cmd` / `start.cmd` / `stop.cmd` do the same thing.

`start.ps1` runs setup automatically if anything is missing, so on a fresh
checkout you can just run `start.ps1`.

### Where things end up

| Surface | URL | What it is |
|---|---|---|
| Delivery console | http://localhost:5174/ | Work packets, requirements, PRs, tests, defects, deployments, people |
| Traceability | http://localhost:5174/traceability | Requirement → code → test → defect closure |
| Graph explorer | http://localhost:5174/graph | Interactive knowledge graph |
| Read API | http://127.0.0.1:8077/health | JSON over the graph |
| ArcadeDB Studio | http://localhost:2480/ | The database's own graph browser (sign in as `root`) |

---

## Prerequisites

- **Python 3.10+**
- **Node 18+**
- **git** — only for pull-request provenance in the code graph; everything else
  works without it

No JDK and no Docker. The ArcadeDB package bundles its own Java runtime, which
is why the first `pip install` takes a minute and downloads ~70MB.

---

## Configuration

Secrets live in `.env`, which is gitignored. `setup.ps1` creates it from
`.env.example` on first run.

| Variable | Effect if unset |
|---|---|
| `GITHUB_TOKEN` | GitHub and CI are skipped during ingest. Confluence still loads, so the console still has data. |
| `GITHUB_REPO` | Defaults to `ShubhamMujumdar/payment-processing-app`. |
| `ARCADE_ROOT_PASSWORD` | ArcadeDB Studio does not start. Needs 8+ characters. |
| `ARCADE_DB_PATH` | Defaults to `./data/databases/spine`. |

The token needs **read** on Contents, Pull requests, Actions, Deployments and
Issues — nothing more. The spine never writes to GitHub.

> A fine-grained token cannot reach a repository owned by *another* user, even
> if you are a collaborator on it, and the failure looks like a 404 rather than
> a permission error. If ingest reports "not found" for a repo you can browse,
> that is why.

---

## How it fits together

```
  GitHub ─┐
  CI     ─┼─▶ connectors ──▶ event log  ──▶ projector ──▶ graph ──▶ read API ──▶ console
  Conf.  ─┘   (emit events   (append-only,  (pure fn)     │          :8077        :5174
               only)          system of                   │
                              record)                     └──▶ ArcadeDB Studio :2480
       app_src ──▶ code graph ────────────────────────────┘
                   (git blame for PR provenance)
```

Two rules hold the design together:

1. **Connectors never touch the graph.** They emit normalized events, nothing else.
2. **The projector never calls a source.** It is a pure function from the event
   log to the graph.

That is what makes `reproject` safe to run whenever you like: drop every derived
vertex and edge, rebuild from the log, no re-fetching. The code graph is the one
exception — it is derived from the source tree rather than from events, so
`reproject` deliberately leaves it alone and `codegraph` refreshes it.

---

## Working with the spine directly

```powershell
cd spine
.\.venv\Scripts\python -m spine.cli ingest      # sources -> event log
.\.venv\Scripts\python -m spine.cli codegraph   # app_src -> CodeUnit vertices
.\.venv\Scripts\python -m spine.cli reproject   # drop the graph, rebuild from the log
.\.venv\Scripts\python -m spine.cli status      # what is in the store
.\.venv\Scripts\python -m spine.cli serve       # read API + Studio
```

**Order matters once:** `codegraph` before `reproject`, because the traceability
matrix links requirements to code units by file path, and those units have to
exist first.

---

## What is real and what is seeded

Stated plainly, because a console that looks authoritative while showing invented
numbers is worse than no console. The header shows which of these is live, and
every simulated custody span carries a flag the UI can filter on.

**Live** — GitHub commits, branches, pull requests, reviews and review
timestamps; CI workflow runs and conclusions; deployments and deployment
statuses; the code graph parsed from source; every requirement, test link and
defect link parsed from the Confluence export.

**Seeded** — Jira issue changelogs and Zephyr executions, which have no
connector yet. Their endpoints return empty against the live API rather than
inventing rows; the console falls back to fixtures for a self-contained demo.

Run `.\start.ps1 -Fixtures` to force the seeded dataset — useful with no network,
or to show the console without the API running.

---

## Troubleshooting

**"Port 8077 is already in use."**
`start.ps1` refuses to reuse a port rather than silently attaching to a stale
server from an earlier session. Run `.\stop.ps1`.

**"Database 'spine' was not closed properly last time."**
Expected after `stop.ps1`, which terminates the process rather than asking it
politely. ArcadeDB replays its write-ahead log and reports recovery completed on
the next line; no data is lost.

**The console says "spine unreachable — seeded".**
Live mode is configured but the API did not answer, so you are looking at
fixtures. That badge exists precisely so this is never mistaken for real data.
Check `logs\spine-api.err.log`.

**Graph explorer is empty.**
It reads the live store, so the spine has to be running. The page prints the
command if it cannot reach it.

**Ingest reports 0 GitHub events.**
Either `GITHUB_TOKEN` is unset, or the token cannot see the repo — see the note
under Configuration.

Logs are in `logs\`, one file per process plus a matching `.err.log`.

---

## Layout

```
dashboard/
  setup.ps1 / start.ps1 / stop.ps1   this tooling
  spine/                             Python: connectors, projector, code graph, API
    spine/connectors/                source -> events
    spine/projector/                 events -> graph
    spine/codegraph/                 Java source -> CodeUnit, with PR provenance
    spine/api/                       FastAPI read surface
  web/                               React console
    src/api/                         the wire contract, and fixtures matching it
    src/components/graph/            the graph canvas
  data/databases/spine/              ArcadeDB store (gitignored, rebuildable)
  docs/
    superpowers/specs/               the design this implements
    OPEN-ACTIONS.md                  what still needs a human
```

`docs/OPEN-ACTIONS.md` is the honest list of what is not done, what needs a
second GitHub account, and which gaps are findings rather than bugs. Read it
before demoing.
