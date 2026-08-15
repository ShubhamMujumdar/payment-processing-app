# SDLC Data Spine — Design

**Status:** Approved for implementation planning
**Date:** 15 Aug 2026
**Slice:** A of six (see [§15](#15-relationship-to-the-other-slices))
**Programme context:** Payments Platform (`PAY`) — Cognizant Financial Services

---

## 1. Purpose and scope

The spine is the ingestion and storage layer beneath a centralised SDLC observability
dashboard. Its single job is to turn activity scattered across GitHub, CI, Jira, Confluence
and test management into one queryable model of **who is accountable for what, at which
stage, for how long, and how it traces back to a requirement**.

It is an observability layer. It reads from the tools people already use and changes nobody's
workflow. It writes nothing back to any source system — write-back and cascading updates are
slice D and are explicitly out of scope here.

### 1.1 What this slice delivers

- A normalized event log, append-only, as the system of record.
- A graph projection rebuildable from that log at any time.
- Custody chains: who held each piece of work, at which stage, for how long.
- Traceability closure: requirement ↔ code ↔ test ↔ defect ↔ release.
- A read API that slices B–F consume.
- A seeded fixture generator for the sources we cannot reach live.

### 1.2 What this slice does not deliver

- No UI. The dashboard shell is slice F.
- No AST-level code graph. `CodeUnit` exists as a vertex type with an identity and nothing
  else; populating it is slice C.
- No agents, no impact analysis, no document updates. Slice D.
- No write-back to GitHub, Jira or Confluence in any form.

---

## 2. Decisions taken

| # | Decision | Rationale |
|---|---|---|
| D1 | Event-sourced: immutable log is the system of record, graph is a derived projection | The graph shape will change repeatedly during the POC; replay makes that free. In an audit conversation, "events are immutable, the graph is derived" is the defensible answer. |
| D2 | ArcadeDB via `arcadedb-embedded` 26.8.1 | Apache 2.0 — no procurement conversation. Multi-model, so the event log and the graph live in one store. Bundled JRE removes the JDK and Docker prerequisites. Verified by spike, [§14](#14-spike-evidence). |
| D3 | Python 3.14 backend | Matches the installed runtime, the ArcadeDB binding, and the tooling slices C and D will need (tree-sitter, Anthropic SDK). |
| D4 | Custody time as the durable measure; activity signal as a labelled overlay | Git and Jira record events, not effort. Conflating elapsed time with effort produces numbers that do not survive scrutiny from an engineering manager. |
| D5 | Work Packet is synthetic, spanning requirement → issue → PR → test → defect | Matches how work actually flows. A Jira issue alone fragments work that spans tickets; a requirement alone accumulates unbounded chains across releases. |
| D6 | GitHub and CI live via read-only PAT; Jira, Confluence and Zephyr from fixtures | No Atlassian tenant is available. GitHub access was secured by taking ownership of the repository, [§9.1](#91-github-access). See also [§10](#10-fixture-generator). |
| D7 | Team-aggregate analytics by default; individual drill-down is permissioned | Per-person timing data is workforce monitoring. A team-level default is both the safer control posture and the better story in an RFP defence. |
| D8 | Identity resolution never merges on name similarity | A false merge silently corrupts every downstream number and is undetectable once it has happened. |

---

## 3. Architecture

```
                 ┌──────────────┐
  GitHub  ──────▶│              │
  CI      ──────▶│  connectors  │──▶  Event[]  ──▶ ┌─────────────┐
  Jira*   ──────▶│              │                  │  event log  │  ← system of record
  Conf.*  ──────▶│  source →    │                  │  (append)   │     append-only
  Zephyr* ──────▶│  Event only  │                  └──────┬──────┘
                 └──────────────┘                         │
                                                          │ pure function
                    * fixture-backed                       ▼
                                                   ┌─────────────┐
     read API  ◀────────────────────────────────── │    graph    │  ← droppable
     (slices B–F)                                  │ (projection)│     rebuildable
                                                   └─────────────┘
```

Two invariants carry the design:

1. **Connectors never write to the graph.** They emit events. Nothing else.
2. **The projector never calls a source.** It is a pure function from the event log to the
   graph, which is what makes replay meaningful and golden-snapshot testing possible.

Violating either collapses the audit story and the test strategy at the same time.

### 3.1 Module layout

```
dashboard/
  spine/
    connectors/
      base.py            Connector protocol, watermark handling, retry/backoff
      github.py          live: commits, PRs, reviews, deployments
      ci.py              live: workflow runs, jobs, JaCoCo/Surefire artifacts
      confluence.py      fixture: docs/requirements/*.md + version history
      jira.py            fixture: issues + changelog
      zephyr.py          fixture: test cases, executions, defect links
    core/
      vocabulary.py      verbs, entity-ref types, identifier patterns
      events.py          Event schema, deterministic IDs, validation
      identity.py        SourceAccount → Person resolution
      calendar.py        WorkCalendar, working-hours arithmetic
    store/
      arcade.py          connection, schema DDL, transactions
      eventlog.py        append, watermarks, dead-letter
      graphstore.py      vertex/edge upsert, drop-and-rebuild
    projector/
      graph.py           events → vertices and edges
      stitch.py          Work Packet assembly rules
      custody.py         CustodySpan derivation and handoff chain
      activity.py        activity-signal overlay
    api/
      server.py          FastAPI application
      routes/            packets, people, analytics, requirements, health
    fixtures/
      generator.py       seeded synthetic streams
      roster.py          the ten-person programme roster
  tests/
    unit/  contract/  golden/  property/
  identity_map.yaml      SourceAccount → Person overrides (committed)
  .env.example           documents required secrets; .env is gitignored
  pyproject.toml
```

---

## 4. Event model

The event log is an ArcadeDB **document** type. Append-only. Never updated, never deleted.

```python
Event(
    event_id: str,           # sha256(source | source_event_id | verb) — idempotency key
    source: str,             # github | ci | jira | confluence | zephyr
    source_event_id: str,    # native identifier in the source system
    verb: str,               # normalized vocabulary, §4.1
    occurred_at: datetime,   # UTC, taken from the source — never ingest time
    ingested_at: datetime,   # UTC, when we saw it
    actor_ref: dict,         # raw source identity, deliberately unresolved
    subject_ref: dict,       # primary entity the event happened to
    object_refs: list[dict], # secondary entities
    payload: dict,           # normalized, source-specific extras
    raw: dict,               # verbatim source body
    schema_version: int,
)
```

A unique index on `event_id` makes re-ingestion idempotent at the storage layer rather than
in connector logic — verified in the spike.

Retaining `raw` is deliberate: a schema change is handled by re-normalizing from the log, not
by re-hitting the GitHub API. Re-fetching is rate-limited, slow, and for deleted or edited
source objects, impossible.

### 4.1 Verb vocabulary

The vocabulary is what makes cross-tool comparison possible at all. `review.submitted` means
the same thing whether it originated as a GitHub review or a Jira transition, and that is
precisely what allows one person's review time to be compared with another's.

| Domain | Verbs |
|---|---|
| Requirement | `requirement.created` `requirement.revised` `requirement.reviewed` `requirement.approved` `requirement.baselined` `requirement.change_requested` |
| Document | `document.created` `document.revised` `document.published` |
| Work item | `workitem.created` `workitem.assigned` `workitem.transitioned` `workitem.commented` `workitem.linked` `workitem.estimated` |
| Code | `code.committed` `code.pushed` `code.branched` |
| Review | `review.requested` `review.submitted` `review.dismissed` |
| Pull request | `pr.opened` `pr.updated` `pr.merged` `pr.closed` |
| Pipeline | `build.started` `build.completed` `check.completed` |
| Test | `test.authored` `test.executed` `coverage.reported` |
| Defect | `defect.raised` `defect.triaged` `defect.assigned` `defect.resolved` `defect.verified` |
| Deployment | `deployment.created` `deployment.approved` `deployment.succeeded` `deployment.failed` `deployment.rolled_back` |
| Release | `release.tagged` `release.deployed` |

Adding a verb is a schema change and requires a corresponding projector rule. An event whose
verb is unrecognised goes to the dead-letter collection rather than being silently dropped.

### 4.2 Identifier patterns

Imported verbatim from `app_src/.github/workflows/ci.yml` so the stitcher and the CI
traceability gate can never disagree:

```
PAY-[0-9]+ | (FR|NFR|BR)-PAY-[0-9]+ | DEF-PAY-[0-9]+ | CR-PAY-[0-9]+
```

Extended with the remaining conventions from `docs/requirements/index.md`:

```
TC-PAY-[0-9]+ | BRULE-[0-9]+ | RISK-[0-9]+ | DEC-[0-9]+
```

If the CI pattern changes, the spine's pattern changes with it. The build is the authority.

---

## 5. Graph model

### 5.1 Vertex types

| Vertex | Key | Notes |
|---|---|---|
| `Person` | `person_id` | Resolved human. Carries role and `WorkCalendar`. |
| `SourceAccount` | `(source, account_id)` | Unresolved source identity. `resolved: bool`. |
| `WorkPacket` | `packet_id` | The spine unit, §5.3. |
| `Requirement` | `req_id` | `BR-` / `FR-` / `NFR-` / `BRULE-`. Carries `baselined`, `obligation`, `moscow`. |
| `Document` | `(doc_id, version)` | Confluence page version. |
| `WorkItem` | `issue_key` | Jira issue. |
| `Commit` | `sha` | |
| `PullRequest` | `(repo, number)` | |
| `TestCase` | `tc_id` | |
| `TestRun` | `run_id` | |
| `Defect` | `defect_id` | |
| `PipelineRun` | `run_id` | GitHub Actions run. |
| `Deployment` | `deployment_id` | Carries `environment`, `image_digest`. |
| `Release` | `tag` | |
| `Stage` | `stage_id` | Lifecycle stage definition, §6. |
| `CodeUnit` | `unit_id` | Identity only in this slice. Populated by slice C. |
| `CustodySpan` | `span_id` | Derived. The load-bearing vertex, §7. |

### 5.2 Edge types

| Edge | From → To | Meaning |
|---|---|---|
| `SAME_AS` | SourceAccount → Person | Identity resolution, §8 |
| `HELD_BY` | CustodySpan → Person | Who was accountable |
| `IN_PACKET` | CustodySpan → WorkPacket | |
| `AT_STAGE` | CustodySpan → Stage | |
| `HANDED_OFF_TO` | CustodySpan → CustodySpan | **The accountability chain** |
| `DERIVES_FROM` | Requirement → Requirement | FR → BR |
| `DOCUMENTS` | Document → Requirement | |
| `ADDRESSES` | WorkItem → Requirement | |
| `IMPLEMENTS` | Commit/PullRequest → Requirement | |
| `PART_OF` | Commit → PullRequest | |
| `VERIFIES` | TestCase → Requirement | |
| `COVERS` | TestCase → CodeUnit | Slice C |
| `EXECUTED` | TestRun → TestCase | |
| `RAISED_AGAINST` | Defect → Requirement/TestRun/CodeUnit | |
| `FIXES` | PullRequest → Defect | |
| `PRODUCED` | PipelineRun → Deployment | |
| `DEPLOYED_IN` | PullRequest → Release | |

Every stitched edge carries `confidence: float` and `derived_by: str` naming the rule that
created it, so the UI can answer "why do you think these two things are related?" — the
question a sceptical evaluator asks early.

### 5.3 The Work Packet

A Work Packet is derived, not sourced. It is the transitive closure of work that carries one
coherent change from requirement to production. Assembly rules, applied in order, highest
confidence first:

| # | Rule | Confidence |
|---|---|---|
| 1 | Requirement id (`FR-PAY-045`) in PR title, body or commit message | 0.95 |
| 2 | Jira key (`PAY-123`) in branch name, commit message or PR title | 0.95 |
| 3 | PR template Traceability table parsed from PR body | 0.95 |
| 4 | RTM-30 requirement ↔ issue row | 0.90 |
| 5 | Zephyr test case ↔ requirement link | 0.90 |
| 6 | `Fixes DEF-PAY-77` / GitHub closing keyword | 0.90 |
| 7 | Changed-file overlap between a PR and a test file | 0.40, flagged |

Rule 7 never creates a packet on its own; it can only add to one created by rules 1–6. A PR
matching no rule becomes an **orphan packet**, surfaced in `/health/data-quality` rather than
discarded — an unlinked change is a governance finding, not an ingestion error.

---

## 6. Stage ladder and accountability

The ladder is read from the programme, not invented. Sources: `docs/CI-CD.md`,
`.github/CODEOWNERS`, `scripts/bootstrap-governance.sh`, and the roster in
`docs/requirements/index.md`.

| Stage | Opens on | Closes on | Accountable | Source of truth |
|---|---|---|---|---|
| `REQ_DRAFT` | `document.created` | `requirement.reviewed` | Page owner | Confluence page owner |
| `REQ_REVIEW` | `requirement.reviewed` | `requirement.approved` | Reviewers listed in Document Control | PRD/FSD reviewer table |
| `BASELINED` | `requirement.baselined` | — | Programme Manager (`@shubham.mujumdar8`) | CAB |
| `REFINEMENT` | `workitem.created` | `workitem.assigned` | Product Owner (`@shubham.mujumdar1`) | Backlog Refinement, Fri 15:00 IST |
| `DEVELOPMENT` | `workitem.assigned` | `review.requested` | Issue assignee | Jira assignee |
| `CODE_REVIEW` | `review.requested` | `review.submitted` | CODEOWNERS reviewers for changed paths | `.github/CODEOWNERS` |
| `CI_VERIFY` | `build.started` | `check.completed` | Author | `ci.yml` |
| `MERGED_DEV` | `pr.merged` | `deployment.created` | Engineering Lead (`@shubham.mujumdar4`) | Gate 1 |
| `DEPLOY_DEV` | `deployment.created` (dev) | `deployment.succeeded` | — no gate | `cd.yml` |
| `GATE2_STAGING` | `deployment.created` (staging) | `deployment.approved` | QA Lead (`@shubham.mujumdar6`) | `staging` env reviewers |
| `STAGING_TEST` | `deployment.succeeded` (staging) | `test.executed` | QA Lead | Gate 2 |
| `GATE3_UAT` | `deployment.created` (uat) | `deployment.approved` | Product Owner (`@shubham.mujumdar1`) | `uat` env reviewers |
| `GATE4_CAB` | `pr.opened` (base `main`) | `pr.merged` | Delivery Manager + Solution Architect, 2 approvals | `main` branch protection |
| `RELEASE_TAG` | `release.tagged` | `deployment.created` (production) | Delivery Manager (`@shubham.mujumdar8`) | `release.yml` |
| `GATE5_PROD` | `deployment.created` (production) | `deployment.approved` | Delivery + Compliance + SRE, 10-minute timer | `production` env reviewers |
| `PRODUCTION` | `deployment.succeeded` (production) | — | SRE (`@shubham.mujumdar9`) | — |

### 6.1 CODEOWNERS as a function

CODEOWNERS maps changed paths to accountable reviewers. The spine evaluates it directly,
last-match-wins, giving two capabilities:

- **Expected custody** can be computed before a review happens, so the dashboard shows
  *overdue* custody, not merely elapsed custody.
- **Work-type classification** comes free, since the same path partition already expresses
  what kind of change a diff is:

| Work type | Paths |
|---|---|
| `test-authoring` | `/src/test/` |
| `architectural-seam` | `gateway/`, `service/`, `entity/`, `/pom.xml` |
| `compliance-surface` | `exception/`, `PaymentAuditService.java`, `/src/main/resources/` |
| `pipeline` | `/.github/workflows/`, `/Dockerfile`, `/scripts/` |
| `application` | everything else under `/src/main/` |
| `documentation` | `/docs/`, `*.md` |

This is what makes "how long did person 1 versus person 2 take writing a unit test" a
defensible bucket rather than a guess: it is the same partition the review routing already uses.

### 6.2 Programme roster

Ten people, from `docs/requirements/index.md`. All times `Asia/Kolkata`.

| Handle | Role | Accountable for |
|---|---|---|
| `@shubham.mujumdar1` | Product Owner / Lead BA | PRD-10, UAT sign-off, backlog priority |
| `@shubham.mujumdar2` | Business Analyst | FSD-20, FSD-21, acceptance criteria |
| `@shubham.mujumdar3` | Solution Architect | DA chair, NFRs, decision log |
| `@shubham.mujumdar4` | Engineering Lead | Sprint commitment, defect triage, review standards |
| `@shubham.mujumdar5` | Senior Engineer | Implementation, defect resolution, unit tests |
| `@shubham.mujumdar6` | QA Lead | RTM-30, test strategy, defect raising |
| `@shubham.mujumdar7` | Compliance & FC Risk | Regulatory requirements, control attestation |
| `@shubham.mujumdar8` | Delivery / Programme Manager | Release gates, RAID log |
| `@shubham.mujumdar9` | SRE / Platform | NFR verification, deployment, observability |
| `@shubham.mujumdar10` | UX Lead | Merchant requirements, portal design |

Governance forums, which give the fixture generator real clock structure: Design Authority
weekly Tue 14:00; Change Advisory Board fortnightly Thu 11:00; Defect Triage daily 09:30;
Compliance Review monthly first Wed; Backlog Refinement weekly Fri 15:00.

---

## 7. Custody, calendar and activity

### 7.1 CustodySpan

One vertex per *(packet, stage, person)*:

```python
CustodySpan(
    span_id, packet_id, stage_id, person_id,
    entered_at, exited_at,             # exited_at is null while open
    custody_seconds,                   # raw wall-clock
    calendar_adjusted_seconds,         # working hours only
    activity_signal_count,             # attributable events in window
    active_minutes_estimate,           # null when signal count is 0
    is_open, is_overdue, flags,
)
```

Because spans key on *(packet, stage, person)*, two reviewers on one PR are simply two
parallel spans and `HANDED_OFF_TO` fans out and back in. No special case is required.

### 7.2 Calendar adjustment

Each `Person` carries a `WorkCalendar`: timezone, working days, working hours, holidays.
`calendar_adjusted_seconds` is the intersection of the span with working windows.

This removes the distortion that otherwise dominates every number: a span from Friday 18:00
to Monday 10:00 is 64 hours raw and roughly 8 working hours adjusted. Programme default is
`Asia/Kolkata`, Mon–Fri, 09:30–18:30. A person whose timezone is unknown uses the default and
the span is flagged `assumed_calendar`.

### 7.3 Activity overlay

Within a span, timestamps attributable to that person — commits, pushes, review comments,
issue comments, page edits — are clustered into sessions with a 30-minute idle gap and a
15-minute floor per session. `active_minutes_estimate` is the sum.

It is always rendered with its provenance: *"~45 min estimated engagement, from 6 signals."*
When there are no signals it renders **"no activity signal"** and never `0 min`. Those are
different facts, and only one of them means the person did nothing.

The custody number never depends on the overlay. If the inference is challenged, the
underlying measurement still stands.

---

## 8. Identity resolution

The same human is `smujumdar` on GitHub, an opaque `557058:...` account id in Jira, and
`shubham.mujumdar8@cognizantfs.com` in Confluence. `docs/CI-CD.md` §7 already records this as
an open programme problem: *"The roster handles are not GitHub accounts… they must be mapped
to real GitHub accounts."* The spine closes a gap the delivery team has already logged.

Resolution order:

1. Exact match on verified email.
2. Explicit entry in `identity_map.yaml` (committed, reviewable, the override of record).
3. Otherwise **unresolved**.

An unresolved `SourceAccount` becomes a vertex with `resolved: false`, participates in the
graph, and surfaces in `/health/data-quality`. It is never merged into a `Person` on name
similarity, and never dropped.

A false merge is undetectable after the fact and silently corrupts every per-person number in
slice B. Leaving an identity unresolved is visible, correctable, and honest. That asymmetry
decides the rule.

---

## 9. Connectors

```python
class Connector(Protocol):
    source: str
    def fetch(self, since: Watermark) -> Iterator[Event]: ...
```

Resumable via per-source watermarks, advanced only after a batch commits. Batches are atomic.
Failures leave the watermark untouched so the next run re-reads rather than skips —
re-reading is safe because `event_id` is deterministic.

| Connector | Mode | Ingests |
|---|---|---|
| `github` | live (PAT) | commits, branches, PRs, review requests, reviews, comments, deployments, deployment statuses |
| `ci` | live (PAT) | workflow runs, jobs, conclusions, check runs, Surefire and JaCoCo artifacts |
| `confluence` | fixture | `docs/requirements/*.md`, page versions, owners, approvals |
| `jira` | fixture | issues, changelog, assignee history, links |
| `zephyr` | fixture | test cases, executions, defect links |

### 9.1 GitHub access

**Repository of record:** `ShubhamMujumdar/payment-processing-app` — **public**, admin held by
the programme. Created 15 Aug 2026 as a standalone copy of
`vrkaushiklakkaraj/payment-processing-app`, preserving both branches at their original SHAs
(`main` `e97d909`, `development` `6030b80`). The original is retained as the `upstream` remote.

A standalone copy rather than a GitHub fork, for two reasons: forks have GitHub Actions
disabled by default, and admin on the repository is required for
`scripts/bootstrap-governance.sh` to create environments and branch protection at all.

Access is a read-only PAT with Contents, Pull requests, Actions, Deployments and Issues, read
from a gitignored `.env`; `.env.example` documents the variables. Verified 200 across every
endpoint the connectors use. Absent a token the connector runs in replay mode against recorded
cassettes, with an identical API surface.

> **Token note.** Fine-grained PATs are scoped to a resource owner and **cannot** reach
> repositories owned by another user, even for a collaborator with full access — the failure
> presents as a 404 indistinguishable from an unauthenticated one. Owning the repository is
> what makes a fine-grained, least-privilege, read-only token viable here. The spine holds
> read access only; the `Administration: write` token needed once for governance bootstrap is
> separate, short-lived, and never used by the spine.

Two conditions to state plainly rather than discover during a demo:

- Until `bootstrap-governance.sh` runs, the environments have no reviewers, so gates 2, 3 and
  5 do not pause and carry no approver. Deployments and deployment statuses are still recorded
  with actor and timestamp, so the *transition* is real even where the *approval* is not.
  Spans derived without a real approval carry the flag `simulated_gate`. Because the repository
  is public, environment protection rules **are** available on GitHub Free — so this is a
  configuration step, not a plan limitation.
- As of 15 Aug 2026 `development` contains three commits pushed directly to the branch. There
  are no pull requests and therefore no review events. Until real PRs exist, review custody
  comes from fixtures. Pushing two or three genuine PRs through the gates converts the single
  strongest signal in the system from synthetic to real, and is recommended before the demo.
- CODEOWNERS references `@cognizantfs/payments-*` teams, which do not exist on a personal
  account. GitHub silently ignores such entries, so Gate 1 will not fire until they are
  replaced with real accounts via the script's `REVIEWER_USERS` fallback.

---

## 10. Fixture generator

Not a throwaway. It is the source of every stage that GitHub cannot supply, and it is seeded
so a demo reruns byte-identically.

**Window:** 6 Jul – 21 Aug 2026 — sprints R2-S2, R2-S3 and R2-S4 of the in-flight R2 release,
ending at the 15 Aug export date recorded in `docs/requirements/index.md`. Two-week cadence,
Monday start.

It produces:

- Jira issues against `FR-PAY-` and `NFR-PAY-` requirements, with changelogs containing
  realistic transition sequences, assignee changes, reviewer round-trips and weekend gaps.
- Zephyr test cases (`TC-PAY-`) and executions linked to requirements.
- Defects (`DEF-PAY-`) raised from failed executions, triaged at the daily 09:30 forum.
- Deliberate pathologies so the analytics have something to find: one ticket parked three
  weeks in review, one requirement with no test coverage, one PR with no requirement
  reference, one identity that fails to resolve.
- The three Confluence pages `index.md` references but that do not exist: **FSD-20**
  (`FR-PAY-001`–`110`, `NFR-PAY-001`–`030`), **FSD-21** (`FR-PAY-111`–`178`), and **RTM-30**,
  the traceability matrix. RTM-30 is both demo content and a stitching input, so it is
  generated first and everything else is made consistent with it.

The generator *code* lives in `spine/fixtures/`; its *output* is written to
`dashboard/data/fixtures/`, which is gitignored and reproducible from the seed. Nothing is
ever written into `app_src` or `visa_platform/docs` — source material stays untouched, which
is also what keeps the "we change nobody's workflow" claim literally true.

---

## 11. Read API

FastAPI. Consumed by slices B–F. All timestamps UTC in the payload; presentation timezone is
the client's concern.

```
GET  /packets                      filter: requirement, release, sprint, stage, person, work_type
GET  /packets/{id}                 packet with current stage and open spans
GET  /packets/{id}/chain           ordered custody spans plus handoffs
GET  /packets/{id}/trace           requirement ↔ code ↔ test ↔ defect ↔ release closure
GET  /people                       roster with resolution status
GET  /people/{id}/timeline         time attribution across activities, date-ranged
GET  /analytics/stage-aging        percentiles by stage, grouped by team or work type
GET  /analytics/compare            person-versus-person on like work
GET  /analytics/handoffs           bottlenecks and review round-trips
GET  /requirements/{id}/coverage   live RTM-30 equivalent
GET  /health/data-quality          unresolved identities, low-confidence edges, orphan
                                   packets, stale watermarks, simulated-gate spans
POST /admin/reproject              drop the graph and rebuild from the event log
```

Per D7, `/analytics/*` returns team aggregates by default. Individual-level responses require
the `analytics:individual` scope, and the API records who requested them.

`/health/data-quality` is a demo asset, not just an operational endpoint. Showing a client the
numbers you do not yet trust is what makes them believe the ones you do.

---

## 12. Testing

Test-driven throughout.

| Layer | Approach |
|---|---|
| Connectors | Recorded cassettes of real GitHub payload shapes. Contract tests assert the emitted `Event` conforms to schema and vocabulary. |
| Projector | Golden snapshots: a fixed event log must produce a fixed graph. Plus an idempotency test — **projecting twice equals projecting once**. |
| Custody | Property tests: spans for one *(packet, stage, person)* never overlap; adjusted seconds never exceed raw; chains stay connected; open spans never report a duration as final. |
| Calendar | Table-driven, including Friday 18:00 → Monday 10:00, holidays, and unknown-timezone fallback. IST has no DST, which removes the worst class of case. |
| Identity | Explicit **must-not-merge** cases: two distinct people with identical display names must remain distinct. |
| Stitching | Each rule tested in isolation with its confidence; orphan packets asserted to surface rather than vanish. |
| API | Response schema snapshots; scope enforcement on individual-level analytics. |

The replay guarantee is the single most valuable test in the suite: drop the graph, reproject,
assert an identical fingerprint. It was verified in the spike before this design was accepted.

---

## 13. Failure modes and data quality

| Condition | Behaviour |
|---|---|
| Source unreachable | Watermark unchanged, batch abandoned, error surfaced. Never a partial commit. |
| Unparseable payload | Dead-letter collection with the raw body. Never silently dropped. |
| Unknown verb | Dead-letter. Adding a verb requires a projector rule. |
| Unknown actor | `SourceAccount` with `resolved: false`, surfaced as a warning. |
| Low-confidence edge | Retained, flagged, never silently promoted. |
| Clock skew, negative duration | Clamped to zero and flagged, not hidden. |
| Missing exit event | Span stays open; renders as "in custody for 6 days", not as a completed span. |
| Schema change | Re-normalize from stored `raw`; no source re-fetch. |
| Rate limiting | Exponential backoff honouring `X-RateLimit-Reset`. Unauthenticated limit is 60/hour, which is why the PAT matters. |

### 13.1 What is real and what is simulated

Stated in the same terms as `app_src/docs/CI-CD.md` §6, because a dashboard that looks
authoritative while displaying invented numbers is worse than no dashboard.

**Real:** GitHub commits, branches, PRs, reviews and review timestamps; CI workflow runs and
conclusions; deployments and deployment statuses; test counts and coverage from build
artifacts; every custody span derived from those.

**Simulated:** Jira issues and changelogs; Confluence page versions beyond what is on disk;
Zephyr test cases and executions; gate approvals where environment protection is unavailable.

Every simulated span carries a flag, and the UI must be able to filter on it. A client asking
"which of these numbers are real?" gets an answer from the system, not from the presenter.

---

## 14. Spike evidence

Run 15 Aug 2026 against `arcadedb-embedded` 26.8.1 on Python 3.14, Windows 11.

| Probe | Result |
|---|---|
| Bundled JRE starts; native `cp314-win_amd64` wheel; no JDK, no Docker | PASS |
| Document type with unique index gives idempotent append; duplicate rejected | PASS |
| Vertex and edge types model the custody chain | PASS |
| Cypher returns custody neighbours in one traversal | PASS — `came_before: sm5`, `came_after: sm6` |
| Drop all graph types, reproject from log, identical fingerprint, log intact | PASS |
| SQL and Cypher over the same data | PASS |
| Server mode and Studio UI on `:2480`, clean shutdown | PASS |

Scale was 4 events and 3 spans: this validates API and semantics, not performance.
Re-measure once the fixture generator produces the full six-week window.

Studio at `localhost:2480` is available during a demo for the inevitable question of whether
the knowledge graph is a real graph.

---

## 15. Relationship to the other slices

| Slice | Depends on this spine for |
|---|---|
| B — Accountability analytics | `CustodySpan`, `HANDED_OFF_TO`, work-type taxonomy, the analytics endpoints |
| C — Code knowledge graph | `CodeUnit` vertex identity, `COVERS`/`IMPLEMENTS` edges, commit and PR vertices |
| D — Cascade agents | Traceability closure for blast radius; writes results into `change_request.yml` as a `CR-PAY-###` |
| E — Commit-time reporting | Event log for the diff, trace closure for the impact report |
| F — Dashboard shell | Every read endpoint |

Two constraints on later slices, set here because they are cheaper to honour from the start:
slice D **proposes and never auto-commits** — `PRD-10` puts `BR-PAY-001`–`030` under change
control requiring CAB-approved `CR-PAY-###`, so an agent editing a baselined requirement
directly is a compliance failure, and generating the CR is both correct and the better demo.
And per D7, individual-level analytics stay permissioned.

---

## 16. Open dependencies

| # | Dependency | Owner | Status |
|---|---|---|---|
| 1 | Fine-grained read-only GitHub PAT | Shubham | **Done** 15 Aug 2026 — verified 200 across all connector endpoints |
| 2 | Repository under programme ownership with admin | Shubham | **Done** 15 Aug 2026 — `ShubhamMujumdar/payment-processing-app`, public |
| 3 | Short-lived `Administration: write` token for governance bootstrap | Shubham | Open — needed to make gates 1–5 real; not needed to build |
| 4 | `gh` CLI installed (required by `bootstrap-governance.sh`) | — | Open — not installed; resolve at governance setup |
| 5 | Two or three real PRs merged through the gates | Shubham | Open — improves realism, not correctness |
| 6 | `identity_map.yaml` mapping roster handles to GitHub logins | Shubham | Open — per-person analytics stay unresolved without it |

None blocks the start of implementation.

## 17. Success criteria

1. `python -m spine.ingest` populates the event log from GitHub, CI and fixtures.
2. `POST /admin/reproject` rebuilds the graph and produces an identical fingerprint.
3. `GET /packets/{id}/chain` returns an ordered custody chain with named people, raw and
   calendar-adjusted durations, and the activity overlay where signals exist.
4. `GET /analytics/compare` returns a defensible comparison of two people on `test-authoring`.
5. `GET /requirements/{id}/coverage` reproduces an RTM-30 row from the graph rather than the
   document.
6. `GET /health/data-quality` reports every unresolved identity, orphan packet and
   simulated-gate span present in the data.
7. The full test suite passes, including replay idempotency and must-not-merge identity cases.
