"""Normalized vocabulary.

The verb list is what makes cross-tool comparison possible at all: a
``review.submitted`` means the same thing whether it arrived as a GitHub review
or a Jira transition, which is what lets one person's review time be compared
with another's.

Adding a verb is a schema change and requires a matching projector rule. Events
carrying an unknown verb go to the dead-letter collection rather than being
silently dropped.
"""

from __future__ import annotations

import re
from enum import StrEnum


class Source(StrEnum):
    GITHUB = "github"
    CI = "ci"
    JIRA = "jira"
    CONFLUENCE = "confluence"
    ZEPHYR = "zephyr"


class Verb(StrEnum):
    # requirements and documents
    REQUIREMENT_CREATED = "requirement.created"
    REQUIREMENT_REVISED = "requirement.revised"
    REQUIREMENT_REVIEWED = "requirement.reviewed"
    REQUIREMENT_APPROVED = "requirement.approved"
    REQUIREMENT_BASELINED = "requirement.baselined"
    REQUIREMENT_CHANGE_REQUESTED = "requirement.change_requested"
    DOCUMENT_CREATED = "document.created"
    DOCUMENT_REVISED = "document.revised"
    DOCUMENT_PUBLISHED = "document.published"

    # work items
    WORKITEM_CREATED = "workitem.created"
    WORKITEM_ASSIGNED = "workitem.assigned"
    WORKITEM_TRANSITIONED = "workitem.transitioned"
    WORKITEM_COMMENTED = "workitem.commented"
    WORKITEM_LINKED = "workitem.linked"

    # code
    CODE_COMMITTED = "code.committed"
    CODE_PUSHED = "code.pushed"
    CODE_BRANCHED = "code.branched"

    # review
    REVIEW_REQUESTED = "review.requested"
    REVIEW_SUBMITTED = "review.submitted"
    REVIEW_DISMISSED = "review.dismissed"

    # pull requests
    PR_OPENED = "pr.opened"
    PR_UPDATED = "pr.updated"
    PR_MERGED = "pr.merged"
    PR_CLOSED = "pr.closed"

    # pipeline
    BUILD_STARTED = "build.started"
    BUILD_COMPLETED = "build.completed"
    CHECK_COMPLETED = "check.completed"

    # test
    TEST_AUTHORED = "test.authored"
    TEST_EXECUTED = "test.executed"
    COVERAGE_REPORTED = "coverage.reported"

    # defects
    DEFECT_RAISED = "defect.raised"
    DEFECT_TRIAGED = "defect.triaged"
    DEFECT_ASSIGNED = "defect.assigned"
    DEFECT_RESOLVED = "defect.resolved"
    DEFECT_VERIFIED = "defect.verified"

    # deployment and release
    DEPLOYMENT_CREATED = "deployment.created"
    DEPLOYMENT_APPROVED = "deployment.approved"
    DEPLOYMENT_SUCCEEDED = "deployment.succeeded"
    DEPLOYMENT_FAILED = "deployment.failed"
    DEPLOYMENT_ROLLED_BACK = "deployment.rolled_back"
    RELEASE_TAGGED = "release.tagged"
    RELEASE_DEPLOYED = "release.deployed"


# ---------------------------------------------------------------------------
# Identifier patterns.
#
# The first alternation is imported verbatim from the traceability job in
# app_src/.github/workflows/ci.yml. If the build's pattern changes, this one
# changes with it -- the build is the authority. A dashboard that disagreed
# with the gate about what counts as a work item reference would be worse than
# no dashboard.
# ---------------------------------------------------------------------------
CI_PATTERN = r"(PAY-[0-9]+|(?:FR|NFR|BR)-PAY-[0-9]+|DEF-PAY-[0-9]+|CR-PAY-[0-9]+)"

# Remaining conventions from docs/requirements/index.md.
EXTRA_PATTERN = r"(TC-PAY-[0-9]+|BRULE-[0-9]+|RISK-[0-9]+|DEC-[0-9]+)"

IDENTIFIER_RE = re.compile(f"{CI_PATTERN}|{EXTRA_PATTERN}", re.IGNORECASE)

_PREFIX_KIND = {
    "BR": "requirement",
    "FR": "requirement",
    "NFR": "requirement",
    "BRULE": "business_rule",
    "PAY": "workitem",
    "TC": "test_case",
    "DEF": "defect",
    "CR": "change_request",
    "RISK": "risk",
    "DEC": "decision",
}


def extract_identifiers(*texts: str | None) -> list[str]:
    """Every programme identifier mentioned across the given text, deduplicated
    and upper-cased. Order is stable so stitching is deterministic."""
    found: dict[str, None] = {}
    for text in texts:
        if not text:
            continue
        for match in IDENTIFIER_RE.finditer(text):
            found[match.group(0).upper()] = None
    return list(found)


def identifier_kind(identifier: str) -> str:
    """Classify an identifier by prefix: PAY-123 is a work item, FR-PAY-45 a
    requirement, DEF-PAY-77 a defect."""
    head = identifier.upper().split("-")[0]
    return _PREFIX_KIND.get(head, "unknown")
