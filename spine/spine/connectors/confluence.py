"""Confluence connector.

Reads the exported PAY space in visa_platform/docs/requirements. Fixture-backed
because there is no Atlassian tenant, but nothing here is invented: these are
the programme's own tables and the connector parses them.

Three documents, three table shapes, three jobs:

  PRD-10   business requirements     BR-PAY-###, owner, child FRs, satisfaction
  FSD-20   functional requirements   FR-PAY-### / NFR-PAY-###, parent BR, Jira
  FSD-21   functional requirements   the merchant-platform range
  RTM-30   the traceability matrix   FR -> BR -> Jira -> PR -> code -> reviewer
                                     -> test -> result -> release -> defect

RTM-30 is the valuable one. It is a hand-maintained chain today, which is
precisely the work this system exists to derive instead -- so it is ingested as
curated links, and every edge records that it came from the RTM rather than
from observation.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from ..core.events import EntityRef, Event
from ..core.vocabulary import Source, Verb

# --- row shapes -------------------------------------------------------------
# PRD-10: | ID | Requirement | Priority | Rationale | Owner | Child FRs | Rel | Status |
PRD_ROW = re.compile(
    r"^\|\s*`(?P<id>BR-PAY-\d+)`\s*\|(?P<statement>[^|\n]+)\|(?P<priority>[^|\n]*)\|"
    r"(?P<rationale>[^|\n]*)\|(?P<owner>[^|\n]*)\|(?P<children>[^|\n]*)\|"
    r"(?P<release>[^|\n]*)\|(?P<status>[^|\n]*)\|",
    re.MULTILINE,
)

# FSD-20 / FSD-21: | ID | Requirement | Pri | Src | Rel | Status | Jira |
FSD_ROW = re.compile(
    r"^\|\s*`(?P<id>(?:FR|NFR)-PAY-\d+)`\s*\|(?P<statement>[^|\n]+)\|(?P<priority>[^|\n]*)\|"
    r"(?P<source>[^|\n]*)\|(?P<release>[^|\n]*)\|(?P<status>[^|\n]*)\|(?P<jira>[^|\n]*)\|",
    re.MULTILINE,
)

# RTM-30: | FR | Requirement | BR | Pri | Jira | PR | Code | Reviewed by | Test |
#         | Result | Rel | Defect | Status |
RTM_ROW = re.compile(
    r"^\|\s*`(?P<id>(?:FR|NFR)-PAY-\d+)`\s*\|(?P<summary>[^|\n]+)\|(?P<br>[^|\n]*)\|"
    r"(?P<priority>[^|\n]*)\|(?P<jira>[^|\n]*)\|(?P<pr>[^|\n]*)\|(?P<code>[^|\n]*)\|"
    r"(?P<reviewer>[^|\n]*)\|(?P<test>[^|\n]*)\|(?P<result>[^|\n]*)\|(?P<release>[^|\n]*)\|"
    r"(?P<defect>[^|\n]*)\|(?P<status>[^|\n]*)\|",
    re.MULTILINE,
)

RANGE = re.compile(r"(FR|NFR)-PAY-(\d+)\.\.(\d+)")
OWNER = re.compile(r"SM-(\d+)")
IDENT = re.compile(r"(?:BR|FR|NFR|TC|DEF|PAY|CR)-(?:PAY-)?\d+")
PR_NUM = re.compile(r"#(\d+)")
CODE_REF = re.compile(r"([\w./]+\.java)(?::(\d+)-(\d+))?")

# Longest first: "PARTIALLY SATISFIED" and "NOT SATISFIED" both contain
# "SATISFIED", so a first-match scan over the short key mislabels them.
STATUS_RULES: list[tuple[str, str]] = [
    ("NOT SATISFIED", "not_satisfied"),
    ("PARTIALLY SATISFIED", "partial"),
    ("PARTIALLY DELIVERED", "partial"),
    ("NOT DELIVERED", "not_satisfied"),
    ("NOT STARTED", "not_started"),
    # Delivered but carrying an open defect, or delivered with no passing test,
    # are both "shipped and not trustworthy" - kept distinct from satisfied,
    # because the difference is the entire point of a traceability matrix.
    ("DELIVERED (DEFECT)", "delivered_with_defect"),
    ("DELIVERED (UNVERIFIED)", "delivered_unverified"),
    ("IN PROGRESS", "in_progress"),
    ("IN DEV", "in_progress"),
    ("DEFERRED", "deferred"),
    ("APPROVED", "approved"),
    ("SATISFIED", "satisfied"),
    ("DELIVERED", "satisfied"),
]


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().strip("`").strip()


def _status(cell: str) -> str:
    upper = _clean(cell).upper()
    for needle, value in STATUS_RULES:
        if needle in upper:
            return value
    if "✅" in cell:
        return "satisfied"
    if "🔴" in cell:
        return "not_satisfied"
    if "⚠" in cell:
        return "partial"
    return "unknown"


def _obligation(statement: str) -> str:
    lowered = statement.lower()
    if "shall not" in lowered:
        return "shall not"
    if "shall" in lowered:
        return "shall"
    if "should" in lowered:
        return "should"
    return "may"


def _expand(cell: str) -> list[str]:
    """FR-PAY-043..046 becomes four identifiers; the document uses ranges for
    readability but the graph needs the members."""
    out: list[str] = []
    for prefix, start, end in RANGE.findall(cell):
        width = len(start)
        out.extend(f"{prefix}-PAY-{n:0{width}d}" for n in range(int(start), int(end) + 1))
    for single in re.findall(r"(?:FR|NFR)-PAY-\d+(?!\.\.)", cell):
        if single not in out:
            out.append(single)
    return out


def _idents(cell: str) -> list[str]:
    return [m.group(0) for m in IDENT.finditer(cell)]


class ConfluenceConnector:
    source = Source.CONFLUENCE

    def __init__(self, requirements_dir: Path):
        self.dir = requirements_dir

    def fetch(self, since: str | None = None) -> Iterator[Event]:
        if not self.dir.exists():
            return
        for path in sorted(self.dir.glob("*.md")):
            text = path.read_text(encoding="utf-8", errors="replace")
            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
            doc_id = path.stem.split("-")[1] if "-" in path.stem else path.stem

            yield self._page_event(path, doc_id, modified, len(text))

            if "PAY-10" in path.stem:
                yield from self._business_requirements(text, doc_id, modified)
            elif "fsd" in path.stem:
                yield from self._functional_requirements(text, doc_id, modified)
            elif "traceability" in path.stem:
                yield from self._traceability(text, doc_id, modified)

    def _page_event(self, path: Path, doc_id: str, modified: datetime, size: int) -> Event:
        return Event(
            source=self.source,
            source_event_id=f"page-{path.stem}",
            verb=Verb.DOCUMENT_PUBLISHED,
            occurred_at=modified,
            actor_ref={"source": "confluence", "account_id": "shubham.mujumdar8"},
            subject_ref=EntityRef("page", path.stem, path.name),
            payload={"document": doc_id, "path": path.name, "bytes": size},
            raw={},
        )

    def _business_requirements(self, text: str, doc_id: str, when: datetime) -> Iterator[Event]:
        for row in PRD_ROW.finditer(text):
            req_id = row.group("id")
            owner = OWNER.search(row.group("owner"))
            yield Event(
                source=self.source,
                source_event_id=f"req-{req_id}",
                verb=Verb.REQUIREMENT_BASELINED,
                occurred_at=when,
                actor_ref=(
                    {"source": "confluence", "account_id": f"shubham.mujumdar{owner.group(1)}"}
                    if owner
                    else None
                ),
                subject_ref=EntityRef("requirement", req_id, _clean(row.group("statement"))[:120]),
                payload={
                    "requirement_id": req_id,
                    "statement": _clean(row.group("statement")),
                    "priority": _clean(row.group("priority")),
                    "rationale": _clean(row.group("rationale")),
                    "release": _clean(row.group("release")),
                    "status": _status(row.group("status")),
                    "obligation": _obligation(row.group("statement")),
                    "children": _expand(row.group("children")),
                    "document": doc_id,
                    "baselined": True,
                },
                raw={},
            )

    def _functional_requirements(self, text: str, doc_id: str, when: datetime) -> Iterator[Event]:
        for row in FSD_ROW.finditer(text):
            req_id = row.group("id")
            yield Event(
                source=self.source,
                source_event_id=f"req-{req_id}",
                verb=Verb.REQUIREMENT_BASELINED,
                occurred_at=when,
                actor_ref={"source": "confluence", "account_id": "shubham.mujumdar2"},
                subject_ref=EntityRef("requirement", req_id, _clean(row.group("statement"))[:120]),
                payload={
                    "requirement_id": req_id,
                    "statement": _clean(row.group("statement")),
                    "priority": _clean(row.group("priority")),
                    "release": _clean(row.group("release")),
                    "status": _status(row.group("status")),
                    "obligation": _obligation(row.group("statement")),
                    "parents": _idents(row.group("source")),
                    "issue_keys": _idents(row.group("jira")),
                    "document": doc_id,
                    # FSD-21 is deliberately held at DRAFT, so its requirements
                    # are not under change control yet.
                    "baselined": "21" not in doc_id,
                },
                raw={},
            )

    def _traceability(self, text: str, doc_id: str, when: datetime) -> Iterator[Event]:
        """RTM-30 rows as curated links.

        Every edge derived here is marked as coming from the matrix rather than
        from observation, so the console can distinguish "someone wrote this
        down" from "we watched it happen".
        """
        for row in RTM_ROW.finditer(text):
            req_id = row.group("id")
            code_refs = [
                {"path": m.group(1), "start": int(m.group(2) or 0), "end": int(m.group(3) or 0)}
                for m in CODE_REF.finditer(row.group("code"))
            ]
            reviewer = OWNER.search(row.group("reviewer"))
            yield Event(
                source=self.source,
                source_event_id=f"rtm-{req_id}",
                verb=Verb.WORKITEM_LINKED,
                occurred_at=when,
                actor_ref={"source": "confluence", "account_id": "shubham.mujumdar6"},
                subject_ref=EntityRef("requirement", req_id, _clean(row.group("summary"))[:120]),
                payload={
                    "requirement_id": req_id,
                    "summary": _clean(row.group("summary")),
                    "parents": _idents(row.group("br")),
                    "issue_keys": _idents(row.group("jira")),
                    "pr_numbers": [int(n) for n in PR_NUM.findall(row.group("pr"))],
                    "code_refs": code_refs,
                    "reviewer": f"shubham.mujumdar{reviewer.group(1)}" if reviewer else None,
                    "test_ids": _idents(row.group("test")),
                    "test_result": _status(row.group("result")),
                    "release": _clean(row.group("release")),
                    "defect_ids": _idents(row.group("defect")),
                    "status": _status(row.group("status")),
                    "document": doc_id,
                    "derived_by": "rtm-30",
                },
                raw={},
            )
