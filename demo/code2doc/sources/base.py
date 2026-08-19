"""What a documentation source has to produce.

Every source normalises to Markdown before anything downstream sees it. That
is the whole point of this layer: the chunker, the embedder and the store never
learn whether a page came from Confluence storage format or a file on disk, so
the pipeline can be developed and tested against local files and then pointed
at the live space without changing a line below this module.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class Page:
    """One documentation page, normalised."""

    page_id: str
    title: str
    markdown: str
    url: str
    source: str
    space_key: str = ""
    version: int = 0
    last_updated: str = ""
    #: Everything the source knew that the pipeline does not model. Kept so a
    #: publish can round-trip a page without losing fields it never read.
    extra: dict[str, Any] = field(default_factory=dict)

    def to_meta(self) -> dict[str, Any]:
        return {
            "page_id": self.page_id,
            "title": self.title,
            "url": self.url,
            "source": self.source,
            "space_key": self.space_key,
            "version": self.version,
            "last_updated": self.last_updated,
        }


class Source(Protocol):
    """A place documentation is read from."""

    name: str

    def pages(self) -> list[Page]:
        ...
