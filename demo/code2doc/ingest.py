"""Fetch pages from a source and land them in demo/docs as files.

The intermediate on disk is not incidental. It means indexing does not require
network access or credentials, it means a bad chunk can be traced to a page you
can open in an editor, and it means the corpus the demo ran against is a thing
that exists rather than a state the process was in.

Each page becomes two files: `<page_id>.md` (normalised Markdown, what gets
chunked) and `<page_id>.json` (identity, URL, version, timestamp -- and for
Confluence, the original storage-format body, which is what a write-back has to
edit).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .config import Config, DEMO_ROOT, _find_dir
from .sources.base import Page
from .sources.confluence import ConfluenceClient
from .sources.local import LocalSource

#: Confluence-format requirement documents that ship with the workspace. Only
#: used by `--source local`, the credential-free fallback; the real corpus comes
#: from Confluence and is committed under demo/docs.
LOCAL_DOCS = _find_dir(
    "../../docs/requirements",
    "../docs/requirements",
    "./docs/requirements",
)


def build_source(config: Config, kind: str) -> Any:
    if kind == "confluence":
        config.require_confluence()
        return ConfluenceClient(
            base_url=config.base_url,
            email=config.email,
            api_token=config.api_token,
            space_key=config.space_key,
        )
    if kind == "local":
        return LocalSource(LOCAL_DOCS)
    raise ValueError(f"Unknown source {kind!r}. Use 'confluence' or 'local'.")


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:80]


def ingest(config: Config, kind: str, clear: bool = True) -> list[Page]:
    source = build_source(config, kind)
    try:
        pages = source.pages()
    finally:
        close = getattr(source, "close", None)
        if callable(close):
            close()

    docs = config.docs_dir
    if clear:
        for stale in list(docs.glob("*.md")) + list(docs.glob("*.json")):
            stale.unlink()

    for page in pages:
        stem = _safe(f"{page.source}-{page.page_id}")
        (docs / f"{stem}.md").write_text(page.markdown, encoding="utf-8")
        (docs / f"{stem}.json").write_text(
            json.dumps({**page.to_meta(), "extra": page.extra}, indent=2),
            encoding="utf-8",
        )
    return pages


def load_pages(config: Config) -> list[Page]:
    """Read back what `ingest` wrote, so indexing never needs the network."""
    pages: list[Page] = []
    for meta_path in sorted(config.docs_dir.glob("*.json")):
        markdown_path = meta_path.with_suffix(".md")
        if not markdown_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        pages.append(
            Page(
                page_id=meta["page_id"],
                title=meta["title"],
                markdown=markdown_path.read_text(encoding="utf-8"),
                url=meta["url"],
                source=meta["source"],
                space_key=meta.get("space_key", ""),
                version=meta.get("version", 0),
                last_updated=meta.get("last_updated", ""),
                extra=meta.get("extra", {}),
            )
        )
    return pages
