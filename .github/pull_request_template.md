<!--
  The CI "Requirement traceability" job reads the title and body of this PR and
  fails if neither cites a work item. Fill in the Traceability section below —
  it is not decoration, it is the check.
-->

## What changed

<!-- One paragraph. What does this PR do, and why now? -->

## Traceability

<!--
  At least one identifier is REQUIRED. Every identifier must resolve to a row in
  RTM-30; if it does not resolve, it is an idea, not a requirement.
-->

| Field | Value |
| --- | --- |
| Jira issue | `PAY-` |
| Requirement(s) | `FR-PAY-` / `NFR-PAY-` / `BR-PAY-` |
| Defect (if applicable) | `DEF-PAY-` |
| Change request (if baselined) | `CR-PAY-` |

## Type of change

- [ ] Feature (new functional requirement)
- [ ] Defect fix (`DEF-PAY-###`)
- [ ] Refactor (no behavioural change)
- [ ] Pipeline / tooling
- [ ] Documentation

## Testing

<!-- What did you add or run? "Existing tests pass" is not sufficient for a
     behavioural change. -->

- [ ] Unit tests added or updated
- [ ] Coverage floor still met (the build enforces this)
- [ ] Verified manually — describe how:

## Review checklist

Author confirms:

- [ ] No secret, credential, key or real cardholder data is in the diff
- [ ] No new endpoint left unauthenticated beyond what SPEC.md section 5.1 already records
- [ ] Audit trail behaviour is unchanged, or the change is called out below
- [ ] Any new `SHOULD` deviation from FSD-20 is logged as a `DEC-###`

## Reviewer routing

CODEOWNERS assigns reviewers automatically by path. Expect the following:

| If you touched | Reviewer added |
| --- | --- |
| Anything | Engineering Lead |
| `gateway/`, `service/`, `entity/`, `pom.xml` | + Solution Architect (Design Authority) |
| `exception/`, `PaymentAuditService`, `resources/` | + Compliance |
| `src/test/` | + QA Lead |
| `.github/workflows/`, `Dockerfile`, `scripts/` | SRE |

## Risk & rollback

<!-- For anything touching money movement, refunds or the audit trail, state the
     blast radius and how it would be backed out. -->
