# CI/CD Pipeline — Payments Platform

How code gets from a developer's branch to production, who has to agree along
the way, and what stops it if they don't.

> **Scope note.** The application is a proof of concept (see the programme
> `SPEC.md`). The pipeline is deliberately production-shaped anyway: the gates,
> roles and promotion rules are the parts worth getting right early, because
> retrofitting governance onto a system that already ships is far harder than
> starting with it. Deployment *targets* are simulated — see
> [What is real and what is simulated](#what-is-real-and-what-is-simulated).

---

## 1. The pipeline at a glance

```
  feature branch
        │
        │  open PR → development
        ▼
  ┌───────────────────────────────────────────────┐
  │ CI  (ci.yml)                                  │
  │   traceability · build · test · coverage      │
  │   SpotBugs · image builds                     │
  │ Security  (security.yml)                      │
  │   CodeQL · dependency CVEs · secrets · image  │
  └───────────────────────────────────────────────┘
        │
        ▼   ◄── GATE 1  Code review (CODEOWNERS)
  merge to development
        │
        ▼
  ┌───────────────────────────────────────────────┐
  │ CD  (cd.yml)                                  │
  │   package → publish image to GHCR             │
  └───────────────────────────────────────────────┘
        │
        ▼
    deploy dev ............................. no gate
        │
        ▼   ◄── GATE 2  QA Lead
    deploy staging → smoke tests
        │
        ▼   ◄── GATE 3  Product Owner
    UAT sign-off
        │
        │  open release PR → main
        ▼   ◄── GATE 4  CAB (2 approvals, admins bound)
    merge to main → tag vX.Y.Z
        │
        ▼
  ┌───────────────────────────────────────────────┐
  │ Release  (release.yml)                        │
  │   verify tag is on main · re-test             │
  └───────────────────────────────────────────────┘
        │
        ▼   ◄── GATE 5  Delivery Manager + Compliance + SRE
    deploy production → verify → rollback on failure
```

---

## 2. The five gates

| # | Gate | Where it lives | Approver | Role accountability |
|---|---|---|---|---|
| 1 | Code review | `.github/CODEOWNERS` + branch protection on `development` | Engineering Lead, plus Architect / Compliance / QA by path | "Code review standards" |
| 2 | Staging release | `staging` environment reviewers | QA Lead — `@shubham.mujumdar6` | "Test strategy, coverage reporting" |
| 3 | UAT sign-off | `uat` environment reviewers | Product Owner — `@shubham.mujumdar1` | "UAT sign-off" |
| 4 | Release PR | Branch protection on `main` (2 approvals, `enforce_admins`) | Delivery Manager + Solution Architect | "Release gates" / CAB chair |
| 5 | Production | `production` environment reviewers + 10-minute wait timer | Delivery Manager + Compliance + SRE | "Release go/no-go", "control attestation", "deployment" |

Roles are taken from the programme roster in the `PAY` Confluence space.

### Why gates 2, 3 and 5 use Environments

A GitHub Actions job that declares `environment: staging` **suspends before its
first step** if that environment has required reviewers. The run shows as
"Waiting", the named approvers are notified, and the job resumes only when one
of them approves. It is the only native mechanism that pauses a *running*
pipeline on a human — everything else gates a merge, not a deployment.

Three properties make it the right tool here:

- **Bound to an artifact.** The approval is recorded against a specific run and
  a specific image digest, not against a date or a document version.
- **Segregation of duties.** `prevent_self_review` stops whoever pushed the tag
  from approving their own release. This is the control an auditor asks about
  first, and it exists only in repository settings.
- **Deployment branch policies.** `production` accepts deployments only from
  `main`, so a tag on a feature branch cannot reach it even if someone edits the
  workflow.

### Why gate 1 is CODEOWNERS and not an environment

Gate 1 must block a *merge*, which happens before any workflow deploys anything.
Environments cannot express that; branch protection can. CODEOWNERS additionally
routes by path, so the Solution Architect is pulled in on a change to the gateway
seam but not on a README fix.

---

## 3. Branch model

| Branch | Purpose | Protection |
|---|---|---|
| `feature/*`, `fix/*` | Working branches | None |
| `development` | Integration branch. Everything lands here first. | 1 approval, code owner review, CI + Security gates required |
| `main` | Release branch. Only ever receives release PRs from `development`. | 2 approvals, code owner review, `enforce_admins: true` |

Tags `vX.Y.Z` on `main` trigger production releases.

`enforce_admins` is on for `main` and off for `development` deliberately: an
administrator who can bypass the release gate means there is no release gate,
whereas an emergency override on the integration branch is a reasonable escape
hatch that leaves an audit trail.

---

## 4. Build once, promote the same artifact

`cd.yml` builds and pushes the image exactly once, tagged `sha-<commit>`. Every
environment afterwards deploys **that digest**. `release.yml` never runs
`docker build` — it re-tags the digest that was already approved.

This matters more than it looks. Rebuilding from the same source can still
produce a different image: a base image tag moves, a dependency re-resolves, a
transitive version drifts. If production is rebuilt rather than promoted, the
artifact running in production is not the artifact anyone signed off, and the
UAT approval in Gate 3 refers to something that no longer exists.

`release.yml` enforces this by failing if the expected digest is absent from the
registry — if CD never published that commit, there is nothing to promote and
the release stops rather than quietly building something new.

---

## 5. Quality gates

| Gate | Tool | Blocking? | Notes |
|---|---|---|---|
| Unit tests | Surefire | Yes | 18 tests |
| Line coverage | JaCoCo | Yes | Floor 45%, measured 47.49% |
| Static analysis | SpotBugs | **No** | Reports only — see below |
| Semantic analysis | CodeQL | Yes | `security-and-quality` suite |
| Dependency CVEs | Trivy | Yes for CRITICAL/HIGH | MEDIUM goes to Defect Triage |
| Secrets | Gitleaks | Yes | Full history scanned |
| Image CVEs | Trivy | Reports to Security tab | Base-image OS packages |
| Traceability | `ci.yml` | Yes | PR must cite a work item |

### Coverage ratchet

`jacoco.line.coverage.minimum` in `pom.xml` is **45%**, set just under the 47.49%
the suite actually measures.

The rule: **this number may only ever go up.** Lowering it to make a red build
green converts the gate into a formality. If a change genuinely cannot maintain
coverage, that is a conversation at Defect Triage, not a one-line edit to the
POM — which is why `pom.xml` is owned by the Architect in CODEOWNERS.

### Why SpotBugs does not block yet

SpotBugs currently reports five MEDIUM `EI_EXPOSE_REP` findings, all of them
Lombok-generated accessors on DTOs returning mutable collections. Turning on
`failOnError` today would block every PR on pre-existing noise, and the reliable
result of that is people learning to bypass the gate.

It runs, it reports, and the findings are uploaded as an artifact. Flip
`<failOnError>` to `true` in the `quality` profile once the existing findings are
either fixed or explicitly excluded.

### Traceability check

CI fails a PR whose title and body cite no work item, matching `PAY-###`,
`FR-PAY-###`, `NFR-PAY-###`, `BR-PAY-###`, `DEF-PAY-###` or `CR-PAY-###`. This
encodes the programme's own rule: *if it is not in the RTM, it is not a
requirement — it is an idea, and it belongs in a comment.*

---

## 6. What is real and what is simulated

Being precise about this matters, because a pipeline that *looks* green while
deploying nothing is worse than no pipeline.

**Real** — runs, and fails the build when it should:

- Maven compile, test, JaCoCo coverage gate, SpotBugs
- Docker image build (on PRs too, so a broken Dockerfile is caught before merge)
- Image publish to GHCR, tagged and labelled by commit
- CodeQL, Trivy, Gitleaks
- The traceability check
- Every approval gate, once `scripts/bootstrap-governance.sh` has been run

**Simulated** — logs what it would do:

- The deployment steps themselves. There is no Kubernetes cluster, ECS service
  or VM to deploy to. Each step prints the real command it would run.
- Staging smoke tests and production verification. No integration suite exists
  yet; the application had no tests at all before this branch.
- The registry digest lookup in `release.yml`.

Replacing the simulated parts means editing the marked steps and adding the
relevant credentials as environment secrets. The gate structure does not change.

---

## 7. Setting it up

The workflows are inert as gates until repository settings match them.

```bash
gh auth login                                  # must be a repo admin
./scripts/bootstrap-governance.sh --dry-run    # inspect
./scripts/bootstrap-governance.sh              # apply
```

This creates the four environments with their reviewers, wait timer and branch
policies, and applies branch protection to `development` and `main`.

### Prerequisites that will bite

- **Teams must exist.** CODEOWNERS references `@cognizantfs/payments-*` teams.
  GitHub **silently ignores** an entry naming a team that does not exist or
  lacks write access — the file stays valid and Gate 1 never fires. Check
  Settings → Branches for CODEOWNERS errors.
- **Teams need an organisation.** On a personal repository there are no teams.
  The script detects this and falls back to individual user reviewers via
  `REVIEWER_USERS`.
- **Private repositories need a paid plan.** Environment protection rules are
  unavailable on private Free repositories; the environments are created but
  the reviewer requirement is dropped, and gates 2, 3 and 5 stop nothing.
- **The roster handles are not GitHub accounts.** `@shubham.mujumdar1` … `10`
  are Confluence handles. They must be mapped to real GitHub accounts.

### Verify before trusting

Push a commit to `development` and confirm the **Deploy to staging** job reports
*Waiting for approval* rather than running through. That single check is the
only thing that proves any of the above actually took effect.

---

## 8. Everyday use

**Shipping a change**

```bash
git checkout development && git pull
git checkout -b feature/PAY-123-refund-locking
# ... work, with tests ...
git push -u origin feature/PAY-123-refund-locking
gh pr create --base development --title "PAY-123: pessimistic lock on refund ceiling"
```

CI and Security run; CODEOWNERS adds reviewers by path. On merge, CD publishes
an image and deploys to dev, then waits for the QA Lead.

**Cutting a release**

```bash
gh pr create --base main --head development --title "Release R2-S4 (PAY-456)"
# → Gate 4: two approvals, admins included
git checkout main && git pull
git tag -a v1.1.0 -m "R2-S4" && git push origin v1.1.0
# → Gate 5: Delivery Manager + Compliance + SRE, after a 10-minute wait timer
```

**When production verification fails.** The deploy job rolls back automatically
and fails. The previous revision keeps serving. Raise a `DEF-PAY-###` and take it
to Defect Triage (daily, 09:30 IST).

---

## 9. Known gaps

Honest list of what this pipeline does not yet do.

| Gap | Why | Fix |
|---|---|---|
| No real deploy target | No infrastructure exists for this POC | Provision, then replace the marked steps |
| No integration test suite | The repository had zero tests before this branch | Add `-Pintegration-test` running against a deployed URL |
| No health endpoint | Actuator is absent (`SPEC.md` §5.1) | Add `spring-boot-starter-actuator`; then add `HEALTHCHECK` to the Dockerfile and a real readiness check to the deploy jobs |
| SpotBugs non-blocking | Five pre-existing findings | Fix or exclude, then set `failOnError` |
| Coverage floor is modest | 47.49% reflects a first suite, not a target | Raise the ratchet as tests land |
| Actions pinned by tag, not SHA | Readability while the pipeline is being reviewed | Pin third-party actions to full commit SHAs before this handles anything real |
| No SBOM, no image signing | Out of scope for a first pipeline | Add Syft/Cosign at the package stage |
| No performance or DR testing | No NFR verification environment | Owned by SRE under R2 |

None of these are blockers for the pipeline's purpose. All of them are things a
reviewer should know before assuming a green build means more than it does.
