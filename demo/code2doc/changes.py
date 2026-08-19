"""Fetching code changes and deciding which are worth analysing.

Noise filtering happens here rather than in the prompt, for two reasons. A lock
file diff can be thousands of lines and would dominate the token budget of a
call that was never going to produce a documentation change. And a rule written
in code is one a reviewer can read and argue with, where "the model decided it
was noise" is not.

The bar for `is_noise` is deliberately conservative: it must be *certain* the
change cannot make prose stale. Anything uncertain goes through to the model,
which is allowed to answer "no documentation impact expected".
"""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass, field
from typing import Any

#: Paths that cannot make prose documentation stale, whatever is inside them.
NOISE_PATTERNS = [
    "*.lock", "package-lock.json", "yarn.lock", "poetry.lock", "Cargo.lock",
    "*.min.js", "*.min.css", "*.map",
    "*/target/*", "*/build/*", "*/dist/*", "*/node_modules/*", "*/.venv/*",
    "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.ico", "*.pdf",
    "*.class", "*.jar", "*.pyc",
]

#: Test sources. Changed behaviour shows up in the code under test as well, so
#: a test-only commit is a weak signal -- but it is a real one when tests are
#: the only executable specification, so this is reported, not silently dropped.
TEST_PATTERNS = [
    "*/src/test/*", "*Test.java", "*Tests.java", "test_*.py", "*_test.py",
    "*/tests/*", "*.spec.ts", "*.test.ts",
]


@dataclass
class FileChange:
    path: str
    status: str
    additions: int
    deletions: int
    patch: str = ""

    @property
    def is_noise(self) -> bool:
        return any(fnmatch.fnmatch(self.path, p) for p in NOISE_PATTERNS)

    @property
    def is_test(self) -> bool:
        return any(fnmatch.fnmatch(self.path, p) for p in TEST_PATTERNS)

    @property
    def is_whitespace_only(self) -> bool:
        """True when the added and removed lines differ only in whitespace.

        A reformat touches many lines and changes no behaviour, so it is the
        single most common way to waste an analysis call.
        """
        if not self.patch:
            return False
        added = [l[1:] for l in self.patch.splitlines() if l.startswith("+") and not l.startswith("+++")]
        removed = [l[1:] for l in self.patch.splitlines() if l.startswith("-") and not l.startswith("---")]
        if not added or not removed:
            return False
        squash = lambda lines: sorted(re.sub(r"\s+", "", l) for l in lines)
        return squash(added) == squash(removed)


@dataclass
class Change:
    """One commit, reduced to what the analyser needs."""

    sha: str
    branch: str
    message: str
    author: str
    committed_at: str
    url: str
    files: list[FileChange] = field(default_factory=list)

    @property
    def significant(self) -> list[FileChange]:
        return [f for f in self.files if not f.is_noise and not f.is_whitespace_only]

    @property
    def skipped(self) -> list[FileChange]:
        return [f for f in self.files if f.is_noise or f.is_whitespace_only]

    @property
    def worth_analysing(self) -> bool:
        significant = self.significant
        if not significant:
            return False
        # Test-only commits are let through only if they are all there is; a
        # mixed commit is analysed on its non-test files.
        return True

    @property
    def diff(self) -> str:
        """The unified diff handed to the model: significant files only."""
        parts = []
        for change in self.significant:
            header = f"diff --git a/{change.path} b/{change.path}"
            parts.append(f"{header}\n{change.patch}" if change.patch else header)
        return "\n".join(parts)

    def summary_line(self) -> str:
        return (
            f"{self.sha[:8]} {self.message.splitlines()[0][:60]} "
            f"({len(self.significant)} files, {len(self.skipped)} skipped)"
        )


def from_github_commit(payload: dict[str, Any], branch: str, repo_url: str) -> Change:
    """Build a Change from GET /repos/{repo}/commits/{sha}."""
    detail = payload.get("commit", {}) or {}
    author = (payload.get("author") or {}).get("login") or (detail.get("author") or {}).get("name", "")
    return Change(
        sha=payload.get("sha", ""),
        branch=branch,
        message=detail.get("message", ""),
        author=author or "",
        committed_at=(detail.get("author") or {}).get("date", ""),
        url=payload.get("html_url") or f"{repo_url}/commit/{payload.get('sha', '')}",
        files=[
            FileChange(
                path=f.get("filename", ""),
                status=f.get("status", ""),
                additions=int(f.get("additions", 0)),
                deletions=int(f.get("deletions", 0)),
                patch=f.get("patch", "") or "",
            )
            for f in payload.get("files", []) or []
        ],
    )
