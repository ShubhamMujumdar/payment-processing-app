"""Resolving source accounts to people.

The same human is ``smujumdar`` on GitHub, an opaque ``557058:...`` account id
in Jira, and ``shubham.mujumdar8@cognizantfs.com`` in Confluence.
app_src/docs/CI-CD.md section 7 already records this as an open programme
problem: the roster handles are not GitHub accounts and must be mapped.

Resolution order is deliberate and short:

1. exact match on a verified email
2. an explicit entry in identity_map.yaml
3. otherwise unresolved

There is no name-similarity fallback, and there never will be. A false merge is
undetectable after the fact and silently corrupts every per-person number
downstream; an unresolved identity is visible, correctable and honest. That
asymmetry decides the rule.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .calendar import PROGRAMME_DEFAULT, WorkCalendar


@dataclass(slots=True)
class Person:
    person_id: str
    handle: str
    name: str
    role: str
    emails: frozenset[str] = frozenset()
    # default_factory, not a bare default: WorkCalendar is a mutable dataclass
    # and sharing one instance across every Person would make a single
    # timezone correction silently apply to the whole roster.
    calendar: WorkCalendar = field(default_factory=lambda: PROGRAMME_DEFAULT)

    @property
    def initials(self) -> str:
        parts = [p for p in self.name.split() if p]
        if len(parts) >= 2 and parts[-1].isdigit():
            return f"{parts[0][0]}{parts[-1]}".upper()
        return "".join(p[0] for p in parts[:2]).upper()


@dataclass(slots=True)
class SourceAccount:
    source: str
    account_id: str
    display_name: str | None = None
    email: str | None = None
    resolved_to: str | None = None

    @property
    def key(self) -> str:
        return f"{self.source}:{self.account_id}"


class IdentityResolver:
    def __init__(self, people: list[Person], overrides: dict[str, str] | None = None):
        self._people = {p.person_id: p for p in people}
        self._by_email = {
            email.lower(): p.person_id for p in people for email in p.emails
        }
        # {"github:ShubhamMujumdar": "p5"} - committed, reviewable, the override
        # of record.
        self._overrides = overrides or {}
        self.unresolved: dict[str, SourceAccount] = {}

    @classmethod
    def from_map_file(cls, people: list[Person], path: Path) -> "IdentityResolver":
        overrides: dict[str, str] = {}
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.split("#", 1)[0].strip()
                if not line or ":" not in line:
                    continue
                key, _, value = line.rpartition(":")
                overrides[key.strip().strip('"')] = value.strip().strip('"')
        return cls(people, overrides)

    def resolve(self, account: SourceAccount) -> str | None:
        if account.email:
            hit = self._by_email.get(account.email.lower())
            if hit:
                account.resolved_to = hit
                return hit

        hit = self._overrides.get(account.key)
        if hit and hit in self._people:
            account.resolved_to = hit
            return hit

        # Deliberately no name matching. Record it so the gap is visible in
        # /health/data-quality instead of being papered over.
        self.unresolved[account.key] = account
        return None

    def person(self, person_id: str) -> Person | None:
        return self._people.get(person_id)

    def unresolved_report(self) -> list[dict[str, Any]]:
        return [
            {"source": a.source, "account_id": a.account_id, "display_name": a.display_name}
            for a in self.unresolved.values()
        ]


# The programme roster, verbatim from docs/requirements/index.md.
ROSTER = [
    Person("p1", "@shubham.mujumdar1", "Shubham Mujumdar 1", "Product Owner / Lead BA"),
    Person("p2", "@shubham.mujumdar2", "Shubham Mujumdar 2", "Business Analyst"),
    Person("p3", "@shubham.mujumdar3", "Shubham Mujumdar 3", "Solution Architect"),
    Person("p4", "@shubham.mujumdar4", "Shubham Mujumdar 4", "Engineering Lead"),
    Person("p5", "@shubham.mujumdar5", "Shubham Mujumdar 5", "Senior Engineer"),
    Person("p6", "@shubham.mujumdar6", "Shubham Mujumdar 6", "QA Lead"),
    Person("p7", "@shubham.mujumdar7", "Shubham Mujumdar 7", "Compliance & FC Risk"),
    Person("p8", "@shubham.mujumdar8", "Shubham Mujumdar 8", "Delivery / Programme Manager"),
    Person("p9", "@shubham.mujumdar9", "Shubham Mujumdar 9", "SRE / Platform"),
    Person("p10", "@shubham.mujumdar10", "Shubham Mujumdar 10", "UX Lead"),
]
