"""Split pages into retrievable sections.

Two decisions shape everything downstream.

*Split on headings, not on a sliding window.* A window of N characters cuts
mid-sentence and produces a citation that points at nothing a human recognises.
A heading is a boundary the author chose, it has a name, and it is what a
reviewer expects to be shown when told "this section is stale".

*Carry the position, not just the text.* Every chunk records its heading path,
its character range and its line range in the source Markdown. That is what
makes the answer to "what part of the document" a location rather than a guess,
and it is what a later redline needs in order to replace the right region.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Iterator

from .sources.base import Page

#: bge-large-en-v1.5 truncates at 512 tokens, and truncation is silent: the
#: chunk goes into the index under an embedding of its first half, and nothing
#: downstream can tell. So the budget is counted in tokens, not characters.
#:
#: Estimating tokens from characters does not work here. These documents are
#: dense with tables and identifiers like `FR-PAY-043`, which tokenise at
#: roughly 2.1 characters per token rather than the ~4 typical of prose -- a
#: character budget tuned on prose truncated 22% of the corpus.
MAX_TOKENS = 448  # 512 less headroom for the heading path prepended at embed time
TARGET_TOKENS = 320
#: Used only when no tokeniser is supplied. Deliberately pessimistic.
CHARS_PER_TOKEN = 2.1
#: Sections shorter than this are folded into the following one rather than
#: indexed alone. A lone heading embeds to noise and pollutes the ranking.
MIN_CHARS = 80

_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*$")
_FENCE = re.compile(r"^\s*```")


@dataclass
class Chunk:
    chunk_id: str
    page_id: str
    page_title: str
    url: str
    anchor_url: str
    source: str
    space_key: str
    page_version: int
    page_last_updated: str

    heading: str
    heading_path: list[str]
    level: int
    ordinal: int

    text: str
    char_start: int
    char_end: int
    line_start: int
    line_end: int

    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def location(self) -> str:
        """Human-readable position, for a reviewer rather than a machine."""
        trail = " > ".join(self.heading_path) if self.heading_path else "(top of page)"
        return f"{self.page_title} :: {trail} (lines {self.line_start}-{self.line_end})"

    def embed_text(self) -> str:
        """What actually gets embedded.

        The heading path is prepended because a section body frequently omits
        the noun it is about -- a chunk under "Refunds > Partial refunds" may
        never repeat the word "refund" -- and without it the vector drifts away
        from exactly the queries that should match.
        """
        trail = " > ".join([self.page_title, *self.heading_path])
        return f"{trail}\n\n{self.text}"

    def to_row(self) -> dict[str, Any]:
        row = asdict(self)
        row["heading_path"] = " > ".join(self.heading_path)
        row["extra"] = ""
        return row


@dataclass
class _Section:
    heading: str
    path: list[str]
    level: int
    lines: list[str]
    char_start: int
    line_start: int


TokenCounter = Callable[[str], int]


def _fallback_counter(text: str) -> int:
    return int(len(text) / CHARS_PER_TOKEN) + 1


def chunk_page(
    page: Page,
    target_tokens: int = TARGET_TOKENS,
    max_tokens: int = MAX_TOKENS,
    token_counter: TokenCounter | None = None,
) -> list[Chunk]:
    count = token_counter or _fallback_counter
    sections = _merge_runts(list(_sections(page.markdown)))

    chunks: list[Chunk] = []
    for section in sections:
        body = "\n".join(section.lines).strip()
        if not body:
            continue
        for piece, offset in _split(body, target_tokens, max_tokens, count):
            char_start = section.char_start + offset
            line_start = section.line_start + body[:offset].count("\n")
            chunks.append(
                _make(page, section, piece, char_start, line_start, len(chunks))
            )
    return chunks


def _make(page: Page, section: _Section, text: str, char_start: int, line_start: int, ordinal: int) -> Chunk:
    digest = hashlib.sha1(
        f"{page.source}:{page.page_id}:{char_start}:{text[:120]}".encode("utf-8")
    ).hexdigest()[:16]
    # The document's H1 is normally the page title. Keeping both turns every
    # breadcrumb into "Title :: Title > Section" and wastes tokens the embedder
    # could spend on the section itself.
    path = list(section.path)
    if path and path[0].strip() == page.title.strip():
        path = path[1:]
    return Chunk(
        chunk_id=digest,
        page_id=page.page_id,
        page_title=page.title,
        url=page.url,
        anchor_url=f"{page.url}{anchor_for(section.heading)}" if section.heading else page.url,
        source=page.source,
        space_key=page.space_key,
        page_version=page.version,
        page_last_updated=page.last_updated,
        heading=section.heading,
        heading_path=path,
        level=section.level,
        ordinal=ordinal,
        text=text,
        char_start=char_start,
        char_end=char_start + len(text),
        line_start=line_start,
        line_end=line_start + text.count("\n"),
    )


def _sections(markdown: str) -> Iterator[_Section]:
    """Walk the document, tracking the heading stack.

    Fenced code blocks are tracked because a comment line starting with ``#``
    inside one is not a heading, and treating it as a section boundary shreds
    the document exactly where the technical content is densest.
    """
    lines = markdown.splitlines()
    stack: list[tuple[int, str]] = []
    current = _Section(heading="", path=[], level=0, lines=[], char_start=0, line_start=1)
    offset = 0
    in_fence = False

    for index, line in enumerate(lines, start=1):
        if _FENCE.match(line):
            in_fence = not in_fence
        match = None if in_fence else _HEADING.match(line)
        if match:
            if current.lines:
                yield current
            level = len(match.group(1))
            title = match.group(2).strip()
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, title))
            offset_here = offset + len(line) + 1
            current = _Section(
                heading=title,
                path=[t for _, t in stack],
                level=level,
                lines=[],
                char_start=offset_here,
                line_start=index + 1,
            )
        else:
            current.lines.append(line)
        offset += len(line) + 1

    if current.lines:
        yield current


def _merge_runts(sections: list[_Section]) -> list[_Section]:
    """Fold a section too small to stand on its own into the next one."""
    out: list[_Section] = []
    carry: _Section | None = None
    for section in sections:
        if carry is not None:
            section = _Section(
                heading=carry.heading or section.heading,
                path=carry.path or section.path,
                level=carry.level or section.level,
                lines=[*carry.lines, "", f"{'#' * section.level} {section.heading}", *section.lines],
                char_start=carry.char_start,
                line_start=carry.line_start,
            )
            carry = None
        if len("\n".join(section.lines).strip()) < MIN_CHARS:
            carry = section
            continue
        out.append(section)
    if carry is not None:
        if out:
            out[-1].lines.extend(["", f"{'#' * carry.level} {carry.heading}", *carry.lines])
        else:
            out.append(carry)
    return out


def _split(body: str, target: int, max_tokens: int, count: TokenCounter) -> list[tuple[str, int]]:
    """One section into pieces that fit the token budget.

    Splits only at boundaries the document already has -- blank lines first,
    then single lines for a paragraph that is itself too long (a wide table is
    the usual culprit). Every piece is returned with its exact character offset
    inside the section, which is what makes the citation a real location.

    Consecutive pieces overlap by one whole paragraph rather than by a fixed
    character count. That keeps a concept spanning a boundary present in both
    pieces without the offset arithmetic that a mid-paragraph overlap requires,
    and offsets that are exact matter more here than overlap that is precise.
    """
    if count(body) <= max_tokens:
        return [(body, 0)]

    units = [(m.group(0), m.start()) for m in re.finditer(r"[^\n]+(?:\n(?!\n)[^\n]+)*", body)]
    units = _explode_oversized(units, max_tokens, count)

    pieces: list[tuple[str, int]] = []
    buffer: list[tuple[str, int]] = []

    def flush() -> None:
        if buffer:
            pieces.append(("\n\n".join(t for t, _ in buffer), buffer[0][1]))

    for unit in units:
        candidate = buffer + [unit]
        if buffer and count("\n\n".join(t for t, _ in candidate)) > target:
            flush()
            buffer = [buffer[-1], unit] if count(buffer[-1][0] + unit[0]) <= target else [unit]
        else:
            buffer = candidate
    flush()
    return pieces or [(body, 0)]


def _explode_oversized(
    units: list[tuple[str, int]], max_tokens: int, count: TokenCounter
) -> list[tuple[str, int]]:
    """Break any single paragraph that cannot fit, line by line."""
    out: list[tuple[str, int]] = []
    for text, offset in units:
        if count(text) <= max_tokens:
            out.append((text, offset))
            continue
        cursor = offset
        buffer: list[str] = []
        start = cursor
        for line in text.splitlines(keepends=True):
            if buffer and count("".join(buffer) + line) > max_tokens:
                out.append(("".join(buffer).rstrip("\n"), start))
                buffer, start = [], cursor
            if not buffer:
                start = cursor
            buffer.append(line)
            cursor += len(line)
        if buffer:
            out.append(("".join(buffer).rstrip("\n"), start))
    return out


def anchor_for(heading: str) -> str:
    """Best-effort Confluence Cloud heading anchor.

    Confluence generates these client-side and the exact rule has changed
    between editors, so this is a convenience for the reviewer rather than a
    guarantee. It cannot be validated over HTTP either: a URL fragment is never
    sent to the server, so no request can tell you whether it resolves. The
    page URL is always correct; the anchor may need a scroll.
    """
    slug = re.sub(r"[^A-Za-z0-9]+", "", heading)
    return f"#{slug}" if slug else ""


def chunk_pages(pages: list[Page], **kwargs: Any) -> list[Chunk]:
    out: list[Chunk] = []
    for page in pages:
        out.extend(chunk_page(page, **kwargs))
    return out
