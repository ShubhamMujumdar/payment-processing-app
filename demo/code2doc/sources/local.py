"""Markdown files on disk, shaped like Confluence pages.

This exists so the retrieval pipeline can be built, indexed and measured before
anyone holds an API token, and so it stays testable afterwards without hitting
the network. The repository already carries four Confluence-format documents
(PRD, two FSDs and the RTM) written to match the real space's conventions,
which makes them a legitimate stand-in rather than a toy fixture.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from .base import Page

#: Documents that ship with the repository, relative to its root.
DEFAULT_DIR = Path("docs/requirements")


class LocalSource:
    name = "local"

    def __init__(self, directory: Path, base_url: str = "", space_key: str = "LOCAL"):
        self.directory = Path(directory)
        self.base_url = base_url.rstrip("/")
        self.space_key = space_key

    def pages(self) -> list[Page]:
        if not self.directory.is_dir():
            raise FileNotFoundError(f"No such directory: {self.directory}")
        out: list[Page] = []
        for path in sorted(self.directory.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            out.append(
                Page(
                    page_id=path.stem,
                    title=_title_of(text, path),
                    markdown=text,
                    # A file:// URL is honest: it resolves, and it makes the
                    # provenance of a local-mode result unmistakable in the API
                    # response rather than looking like a real Confluence link.
                    url=path.resolve().as_uri(),
                    source=self.name,
                    space_key=self.space_key,
                    version=1,
                    last_updated=datetime.fromtimestamp(
                        path.stat().st_mtime, tz=timezone.utc
                    ).isoformat(),
                    extra={"path": str(path)},
                )
            )
        return out


def _title_of(text: str, path: Path) -> str:
    match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else path.stem
