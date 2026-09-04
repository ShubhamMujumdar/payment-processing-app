"""Turn an approved Markdown redline into an edit to a Confluence page.

The problem this solves. The redline is expressed in Markdown, because Markdown
is what the chunker produced and what the model was shown. The page is stored in
Confluence storage format -- XHTML with macros, layouts and table markup. The
two do not correspond line for line, so the approved text cannot simply be
written over the page body.

Converting the whole section back to storage format is the obvious approach and
the wrong one: it would rewrite markup nobody proposed changing, destroying
macros, column widths and formatting that never appeared in the diff.

So instead this narrows the edit to the smallest text that actually changed --
usually a single table cell -- locates that exact string in the page's text
nodes, and replaces only it. Everything else in the page is left byte-identical.

Three refusals, all deliberate:

* If a fragment cannot be found, the page has moved on since the proposal was
  drafted. Refuse, rather than write a partial edit.
* If a fragment appears more than once, the target is ambiguous. Refuse, rather
  than guess which occurrence was meant.
* If the model's ``existing_text`` does not appear in the page at all, the
  proposal was drafted against a stale copy of the corpus. Refuse.

A refusal is recoverable -- re-index and re-run. A wrong edit to a shared
documentation space is not.
"""

from __future__ import annotations

import re
from html import escape
from dataclasses import dataclass, field
from typing import Any

from bs4 import BeautifulSoup, NavigableString


@dataclass
class Fragment:
    """One minimal text change, and how many places it could apply."""

    old: str
    new: str
    matches: int = 0
    #: True when `old` is a markup block rather than prose. The text-node half of
    #: plan_edit's double check cannot see markup -- it would count zero, disagree
    #: with the raw count and report a unique fragment as ambiguous.
    structural: bool = False

    @property
    def ok(self) -> bool:
        return self.matches == 1


@dataclass
class EditPlan:
    fragments: list[Fragment] = field(default_factory=list)
    before: str = ""
    after: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.fragments) and all(f.ok for f in self.fragments)

    @property
    def problem(self) -> str | None:
        if not self.fragments:
            return "The proposed text is identical to the current text."
        missing = [f for f in self.fragments if f.matches == 0]
        if missing:
            shown = "; ".join(repr(f.old) for f in missing[:3])
            # The indexed corpus is Markdown; the live page is storage format.
            # A fragment still carrying a list marker was never going to match,
            # and saying "the page changed" would send the reader hunting for a
            # change that did not happen.
            if any(LIST_MARKER.match(f.old) for f in missing):
                return (
                    "Could not place this edit: " + shown + ". The text is a list "
                    "item, and the page stores lists as markup rather than as the "
                    "Markdown the proposal was drafted in, so there is nothing to "
                    "match on. Edit this section by hand."
                )
            return (
                "Could not find this text on the page: " + shown
                + ". The page has probably changed since this was drafted — "
                "re-run ingest and index, then re-analyse the commit."
            )
        ambiguous = [f for f in self.fragments if f.matches > 1]
        if ambiguous:
            return (
                "This text appears more than once on the page, so the target is "
                "ambiguous: " + "; ".join(f"{f.old!r} ×{f.matches}" for f in ambiguous[:3])
            )
        return None

    def summary(self) -> list[dict[str, Any]]:
        return [{"old": f.old, "new": f.new, "matches": f.matches} for f in self.fragments]


def _unescape(cell: str) -> str:
    """Undo the pipe escaping the Markdown table renderer applied."""
    return cell.replace("\\|", "|").strip()


def minimal_fragments(existing: str, proposed: str) -> list[Fragment]:
    """The smallest set of (old, new) pairs describing the change.

    Table rows are compared cell by cell, which matters for precision: replacing
    the cell ``Minimum 0.01`` is far more likely to be unique on a page than
    replacing the bare token ``0.01``, which could appear in half a dozen
    unrelated places.
    """
    old_lines = existing.strip().splitlines()
    new_lines = proposed.strip().splitlines()

    # A change in line count means whole lines were added or removed; there is
    # no safe cell-level narrowing, so fall back to the whole block.
    if len(old_lines) != len(new_lines):
        return [Fragment(existing.strip(), proposed.strip())]

    fragments: list[Fragment] = []
    for old_line, new_line in zip(old_lines, new_lines):
        if old_line == new_line:
            continue
        old_cells, new_cells = old_line.split("|"), new_line.split("|")
        if len(old_cells) > 2 and len(old_cells) == len(new_cells):
            for old_cell, new_cell in zip(old_cells, new_cells):
                old_text, new_text = _unescape(old_cell), _unescape(new_cell)
                if old_text != new_text and old_text:
                    fragments.append(Fragment(old_text, new_text))
        else:
            fragments.append(Fragment(old_line.strip(), new_line.strip()))
    return fragments


def _text_nodes(soup: BeautifulSoup) -> list[NavigableString]:
    return [node for node in soup.find_all(string=True) if str(node).strip()]


LIST_MARKER = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")


def _strip_marker(line: str) -> str:
    """The prose of a markdown list item, without its bullet."""
    return LIST_MARKER.sub("", line).strip()


def list_append_fragment(storage_html: str, existing: str, proposed: str) -> Fragment | None:
    """Handle "keep these bullets and add more", which is not a text edit.

    The index holds the corpus as markdown; the page is storage format. A table
    cell survives that round trip byte-identical, which is why cell edits have
    always worked. A list item does not: `- Duplicate payment reference...` on
    one side is `<li><p>Duplicate payment reference...</p></li>` on the other.
    Matching the markdown against the page fails, and even a successful match
    would insert a literal hyphen instead of a list item.

    So this rewrites the anchor's own <li> element into itself plus the new
    ones. Returns None when the change is not an append, leaving every other
    case to the existing text path.
    """
    old_lines = [l for l in existing.strip().splitlines() if l.strip()]
    new_lines = [l for l in proposed.strip().splitlines() if l.strip()]
    if len(new_lines) <= len(old_lines) or not old_lines:
        return None
    if new_lines[: len(old_lines)] != old_lines:
        return None                      # not a pure append
    added = [_strip_marker(l) for l in new_lines[len(old_lines):]]
    if not all(LIST_MARKER.match(l) for l in new_lines[len(old_lines):]):
        return None                      # the additions are not list items

    anchor = _strip_marker(old_lines[-1])
    if not anchor:
        return None

    # The <li> that contains the anchor, taken from the raw string so the rest of
    # the document stays byte-identical.
    match = re.search(
        r"<li\b[^>]*>(?:(?!</li>).)*?" + re.escape(escape(anchor)) + r"(?:(?!</li>).)*?</li>",
        storage_html, re.S,
    )
    if not match:
        return None

    block = match.group(0)
    additions = "".join(f"<li><p>{escape(text)}</p></li>" for text in added)
    return Fragment(block, block + additions, structural=True)


def plan_edit(storage_html: str, existing_text: str, proposed_text: str) -> EditPlan:
    """Work out exactly what would change, without changing anything.

    The fragment must be unique **twice over**: once among the document's text
    nodes, and once in the raw storage string. The first check proves we are
    editing prose rather than markup; the second proves the raw replacement that
    actually performs the edit cannot land somewhere unintended. If the two
    counts disagree, the string also occurs inside a tag or attribute, and the
    edit is refused.
    """
    appended = list_append_fragment(storage_html, existing_text, proposed_text)
    plan = EditPlan(
        fragments=[appended] if appended else minimal_fragments(existing_text, proposed_text)
    )
    if not plan.fragments:
        return plan

    nodes = _text_nodes(BeautifulSoup(storage_html, "html.parser"))
    for fragment in plan.fragments:
        in_raw = storage_html.count(fragment.old)
        if fragment.structural:
            # Deliberately markup, so only the raw count means anything. It is
            # still required to be unique; what is dropped is the prose check,
            # which would count zero and condemn every structural edit.
            fragment.matches = in_raw
            continue
        in_text = sum(1 for node in nodes if fragment.old in str(node))
        # Disagreement means the string also appears in markup. Reporting the
        # larger count makes the plan fail as ambiguous rather than proceed.
        fragment.matches = in_text if in_text == in_raw else max(in_text, in_raw, 2)

    if plan.ok:
        plan.before = storage_html
        plan.after = apply_edit(storage_html, plan.fragments)
    return plan


def apply_edit(storage_html: str, fragments: list[Fragment]) -> str:
    """Replace each fragment in the raw storage string.

    Deliberately *not* done by editing a parsed tree and serialising it back.
    Measured on this space, a BeautifulSoup round trip of untouched storage
    format is not lossless: `html.parser` reorders attributes, drops whitespace
    and rewrites `<p />` as `<p></p>`, while `lxml-xml` collapses a 9,307
    character page to 147 because storage format uses undeclared namespaces.
    Either would rewrite markup nobody proposed changing.

    Editing the raw string keeps the document byte-identical apart from the
    fragment itself. Safe only because `plan_edit` has already established that
    each fragment occurs exactly once, in a text node.
    """
    for fragment in fragments:
        storage_html = storage_html.replace(fragment.old, fragment.new, 1)
    return storage_html


def publish_proposal(
    client: Any,
    page_id: str,
    existing_text: str,
    proposed_text: str,
    message: str,
    dry_run: bool = True,
) -> dict[str, Any]:
    """Plan the edit, and publish it only if `dry_run` is False.

    Dry run is the default. Publishing edits a page other people are using, and
    a default that mutates shared state on a mistyped flag is the wrong default.
    """
    storage, version, title = client.storage_html(page_id)
    plan = plan_edit(storage, existing_text, proposed_text)

    result: dict[str, Any] = {
        "page_id": page_id,
        "title": title,
        "current_version": version,
        "dry_run": dry_run,
        "ok": plan.ok,
        "problem": plan.problem,
        "fragments": plan.summary(),
        "published": False,
    }
    if not plan.ok or dry_run:
        return result

    response = client.update_page(
        page_id, plan.after, message=message, confirm=True
    )
    result["published"] = not response.get("skipped")
    result["new_version"] = (response.get("version") or {}).get("number", version + 1)
    return result


def find_changed_value(existing: str, proposed: str) -> str:
    """Human-readable one-liner for a log or an event payload."""
    fragments = minimal_fragments(existing, proposed)
    if not fragments:
        return "no change"
    return " · ".join(f"{f.old} → {f.new}" for f in fragments[:2])


#: Confluence rejects a version comment beyond this; ours are short but the
#: commit subject they embed is not always.
MAX_MESSAGE = 240


def version_message(sha: str, subject: str) -> str:
    text = f"code2doc: {sha[:8]} {subject.splitlines()[0]}"
    return text[:MAX_MESSAGE]


_WS = re.compile(r"\s+")


def looks_published(storage_html: str, proposed_text: str) -> bool:
    """Cheap idempotence check: is the proposed text already on the page?"""
    body = _WS.sub(" ", BeautifulSoup(storage_html, "html.parser").get_text(" "))
    for fragment in proposed_text.split("|"):
        fragment = fragment.strip()
        if len(fragment) > 4 and fragment not in body:
            return False
    return True
