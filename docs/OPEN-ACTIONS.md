# Open Actions & Known Limitations

Running list of things that need a human, a second account, a credential, or a decision.
Nothing here blocks POC development. Items are grouped by what is actually stopping them.

Last updated: 15 Aug 2026

---

## 1. Needs more than one person

These cannot be solved by any amount of code. GitHub enforces them structurally.

| # | Item | Why it needs a second person | Impact if not done |
|---|---|---|---|
| 1.1 | **Add a second GitHub account as a collaborator** on `ShubhamMujumdar/payment-processing-app` | **You cannot review or approve your own pull request.** GitHub blocks it outright. | `review.requested → review.submitted` custody spans stay empty. This is the single strongest accountability signal in the whole system, and the demo has none of it without this. |
| 1.2 | Have that collaborator approve at least 2–3 PRs | Same reason | Gate 1 (code review) produces no real custody data |
| 1.3 | Ideally a **third** account for segregation of duties | `prevent_self_review: true` on the `production` environment means whoever pushes the tag cannot approve the release | Gate 5 cannot be demonstrated end-to-end with a real approver |
| 1.4 | ~~Map roster handles in `identity_map.yaml`~~ **Done 16 Aug 2026** | — | Unresolved accounts went 9 → 1, and `HELD_BY` edges 0 → 31, so custody is now attributed to named people. One assumption to confirm: `github:ShubhamMujumdar` is mapped to **p5 (Senior Engineer)**, which puts a real account onto a synthetic persona. `dev@poc.local` is deliberately left unmapped — it is a placeholder, not a person. |

**Minimum viable:** one extra collaborator unlocks 1.1 and 1.2. Two extra unlocks 1.3.

---

## 2. Needs a credential or tool you have to create

| # | Item | Detail |
|---|---|---|
| 2.1 | **Rotate the disclosed PAT** | A token was pasted into a chat transcript on 15 Aug 2026. It cannot reach the demo repo, but it *does* have access to 11 other repositories, 4 of them private. Revoke it. |
| 2.2 | Short-lived `Administration: write` + `Contents: write` token | Required once by `scripts/bootstrap-governance.sh`. Must **not** be the token the spine uses — the spine is read-only by design. Delete after use. |
| 2.3 | Install the `gh` CLI | `bootstrap-governance.sh` depends on it. Not installed on this machine. |
| 2.4 | Vector (SVG) logo asset | The current mark was regenerated from a PNG. A proper vector, dark-theme variant, would render cleanly at any size. |
| 2.5 | Atlassian Cloud sandbox *(optional)* | Only if you ever want Jira/Confluence to be live rather than fixture-backed. Not required for the POC. |

---

## 3. Configuration not yet applied

| # | Item | Detail |
|---|---|---|
| 3.1 | Run `scripts/bootstrap-governance.sh` | Creates the four environments, their reviewers, the 10-minute production wait timer, and branch protection on `development` and `main`. **Until this runs, gates 1–5 do not stop anything.** |
| 3.2 | Replace the `@org/payments-*` team handles in CODEOWNERS | GitHub **silently ignores** CODEOWNERS entries naming teams that do not exist. The file stays "valid" and Gate 1 simply never fires. Personal accounts have no teams — use the script's `REVIEWER_USERS` fallback. |
| 3.3 | Branch protection on `development` and `main` | Currently absent. PR #1 was merged 10 seconds after opening, with no review and before CI finished. |

> **Now unblocked:** the repository is **public**, so environment protection rules are available on
> GitHub Free. Gates 2, 3 and 5 can be made genuinely blocking. This was impossible while the
> repo was private on a free plan.

---

## 4. Gaps inherited from the application pipeline

From `app_src/docs/CI-CD.md` §9, plus what we have since observed. These are the client's own
honest list; several are good demo material rather than problems to hide.

| # | Gap | Status |
|---|---|---|
| 4.1 | No real deploy target — deployment steps print what they would run | By design for the POC |
| 4.2 | No integration test suite | `-Pintegration-test` against a deployed URL not yet written |
| 4.3 | No health endpoint (Actuator absent) | Deploy jobs cannot do a real readiness check |
| 4.4 | SpotBugs non-blocking | 5 pre-existing `EI_EXPOSE_REP` findings on Lombok accessors |
| 4.5 | Coverage floor 45% vs 47.49% measured | Ratchet may only ever go up |
| 4.6 | **Actions pinned by tag, not SHA** | **Confirmed live on 15 Aug 2026.** `setup-trivy@v0.2.1` and `@v0.2.2` were deleted upstream, permanently breaking `trivy-action` v0.28.0–v0.30.0. Cost two PRs to diagnose. Pinning our own actions by SHA is the durable fix. |
| 4.7 | No SBOM, no image signing | Syft/Cosign at the package stage |
| 4.8 | `release.yml` never exercised | Only triggers on a `v*` tag; no release has been cut |

### 4.9 Dependency CVEs — 30 findings, gate is red and correct

Once `trivy-action` was fixed (DEF-PAY-201, DEF-PAY-202) the dependency scan ran properly and
reported **30 vulnerabilities: 26 HIGH, 4 CRITICAL**. Sample: `CVE-2024-50379`,
`CVE-2024-56337`, `CVE-2025-24813` (embedded Tomcat, RCE class), `CVE-2024-38816`,
`CVE-2024-38819` (Spring path traversal).

The scan runs with `ignore-unfixed: true`, so **every finding has an available fix** — this is
a Spring Boot 3.3.2 stack roughly two years behind. A framework bump would clear most of them.

Not actioned: this is a potentially breaking upgrade to the application, outside the
dashboard's scope, and belongs to the Engineering Lead at Defect Triage. **The Security gate
is red for the correct reason** and should stay red until the dependencies are addressed —
lowering the gate to get a green tick is the exact anti-pattern `docs/CI-CD.md` warns about
for the coverage ratchet.

Good demo material: a real security gate catching real CVEs in a payments service, traceable
from defect to dependency to the NFR it violates.

### 4.10 Governance finding — CD does not observe CI

`cd.yml` triggers on push to `development` independently of `ci.yml` and re-runs Maven itself,
so it never reads CI's conclusion. On 15 Aug 2026 CD **published an image and deployed through
dev, staging and UAT while CI was failing**.

Not a bug in the sense of broken code, and deliberately left alone — but on a real payments
pipeline promotion should be gated on the CI conclusion. Worth writing up: it is
exactly the kind of accountability gap the dashboard is built to surface.

---

## 5. Demo-day risks

| # | Risk | Mitigation |
|---|---|---|
| 5.1 | Repo is **public** | Never commit anything real to it. It holds a mock-gateway POC with an in-memory H2 database and no real data — keep it that way. |
| 5.2 | Simulated vs real data confusion | Every simulated custody span carries a flag and the UI must be able to filter on it. If a client asks "which of these numbers are real?", the system answers, not the presenter. |
| 5.3 | Gates that do not gate | Until §3.1 runs, a live demo of "approval required" would be misleading. Either bootstrap it or say plainly that it is configuration-pending. |
| 5.4 | Fixture window is narrow | 6 Jul – 21 Aug 2026, three sprints. Enough for trends, thin for per-person averages. Widen if per-person analytics look noisy. |

---

## 6. Deferred to later slices

| Item | Slice |
|---|---|
| AST-level parse of `app_src` into `CodeUnit` vertices | C |
| Write-back of impact assessments as `CR-PAY-###` change requests | D |
| Commit-time impact reports in the CI pipeline | E |
| Vector logo swap-in | F |
