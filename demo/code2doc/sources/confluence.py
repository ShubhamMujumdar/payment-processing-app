"""Confluence Cloud, read and write, over REST API v2.

Authentication is HTTP Basic with the account email as username and an API
token as password. The token carries the full permissions of the account that
minted it -- Atlassian has no per-token scoping for these -- so `update_page`
refuses to run unless the caller passes ``confirm=True``. An accidental write
into a shared team space is not recoverable by re-running anything.
"""

from __future__ import annotations

import html
import re
from typing import Any, Iterator

import httpx
from bs4 import BeautifulSoup, NavigableString, Tag

from .base import Page


class ConfluenceError(RuntimeError):
    pass


class ConfluenceClient:
    name = "confluence"

    def __init__(self, base_url: str, email: str, api_token: str, space_key: str = "", timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.space_key = space_key
        self._client = httpx.Client(
            base_url=f"{self.base_url}/wiki/api/v2",
            auth=(email, api_token),
            timeout=timeout,
            headers={"Accept": "application/json"},
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "ConfluenceClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # --- transport ---------------------------------------------------------
    def _get(self, path: str, **params: Any) -> dict[str, Any]:
        response = self._client.get(path, params=params)
        if response.status_code == 401:
            raise ConfluenceError(
                "Confluence rejected the credentials (401). Check "
                "CONFLUENCE_EMAIL is the Atlassian account email and that the "
                "API token has not been revoked."
            )
        if response.status_code == 403:
            raise ConfluenceError(
                f"Confluence denied access to {path} (403). The account can "
                "authenticate but cannot see this resource."
            )
        response.raise_for_status()
        return response.json()

    def _paged(self, path: str, **params: Any) -> Iterator[dict[str, Any]]:
        """Follow v2 cursor pagination until the server stops offering a next
        link. v2 signals the end by omitting `_links.next`, not by returning an
        empty page, so testing the result list alone loops forever."""
        params.setdefault("limit", 100)
        while True:
            payload = self._get(path, **params)
            yield from payload.get("results", [])
            nxt = (payload.get("_links") or {}).get("next")
            if not nxt:
                return
            cursor = re.search(r"cursor=([^&]+)", nxt)
            if not cursor:
                return
            params["cursor"] = cursor.group(1)

    # --- read --------------------------------------------------------------
    def space_id(self, key: str | None = None) -> str:
        key = key or self.space_key
        payload = self._get("/spaces", keys=key)
        results = payload.get("results", [])
        if not results:
            raise ConfluenceError(
                f"No space with key {key!r} is visible to this account. "
                "Check CONFLUENCE_SPACE_KEY."
            )
        return str(results[0]["id"])

    def pages(self, space_key: str | None = None) -> list[Page]:
        sid = self.space_id(space_key)
        out: list[Page] = []
        for raw in self._paged(f"/spaces/{sid}/pages", **{"body-format": "storage"}):
            out.append(self._to_page(raw))
        return out

    def page(self, page_id: str) -> Page:
        raw = self._get(f"/pages/{page_id}", **{"body-format": "storage"})
        return self._to_page(raw)

    def storage_html(self, page_id: str) -> tuple[str, int, str]:
        """Raw storage-format body, version number and title.

        The write path edits this, not the Markdown. Round-tripping Markdown
        back into storage format would silently destroy every macro, layout and
        table style on the page.
        """
        raw = self._get(f"/pages/{page_id}", **{"body-format": "storage"})
        body = ((raw.get("body") or {}).get("storage") or {}).get("value", "")
        return body, int((raw.get("version") or {}).get("number", 0)), raw.get("title", "")

    def _to_page(self, raw: dict[str, Any]) -> Page:
        body = ((raw.get("body") or {}).get("storage") or {}).get("value", "")
        webui = ((raw.get("_links") or {}).get("webui")) or ""
        version = raw.get("version") or {}
        return Page(
            page_id=str(raw.get("id")),
            title=raw.get("title", "") or "",
            markdown=storage_to_markdown(body),
            url=f"{self.base_url}/wiki{webui}" if webui else f"{self.base_url}/wiki/pages/{raw.get('id')}",
            source=self.name,
            space_key=self.space_key,
            version=int(version.get("number", 0)),
            last_updated=version.get("createdAt", "") or "",
            extra={"storage": body, "parentId": raw.get("parentId")},
        )

    # --- write -------------------------------------------------------------
    def update_page(
        self,
        page_id: str,
        new_storage_html: str,
        message: str = "Updated by code2doc",
        confirm: bool = False,
    ) -> dict[str, Any]:
        """Publish a new version of a page.

        ``confirm`` is not a formality. Without it this raises, because the
        caller has to have made a deliberate decision to mutate a page in a
        space other people are using.
        """
        if not confirm:
            raise ConfluenceError(
                "update_page requires confirm=True. Nothing was sent to "
                "Confluence. Use dry_run_update() to see the change first."
            )
        current, version, title = self.storage_html(page_id)
        if current == new_storage_html:
            return {"skipped": True, "reason": "content identical", "version": version}

        response = self._client.put(
            f"/pages/{page_id}",
            json={
                "id": page_id,
                "status": "current",
                "title": title,
                "body": {"representation": "storage", "value": new_storage_html},
                # Confluence enforces this optimistically: if someone else saved
                # while we were thinking, the number collides and the write is
                # rejected rather than silently overwriting their edit.
                "version": {"number": version + 1, "message": message},
            },
        )
        if response.status_code == 409:
            raise ConfluenceError(
                f"Page {page_id} changed underneath us (409). Re-read it and retry."
            )
        response.raise_for_status()
        return response.json()

    def title_exists(self, title: str, space_key: str | None = None) -> str | None:
        """The id of a page with this title in the space, or None.

        Confluence rejects a duplicate title in the same space with a 400 that
        does not say so clearly. Checking first turns that into a useful message
        and, more usefully, catches the case where the page we are about to
        create already exists -- which is the likelier failure once a run has
        been approved twice.
        """
        for page in self.pages(space_key):
            if page.title.strip().lower() == title.strip().lower():
                return page.page_id
        return None

    def create_page(
        self,
        title: str,
        storage_html: str,
        parent_id: str | None = None,
        space_key: str | None = None,
        confirm: bool = False,
    ) -> dict[str, Any]:
        """Create a page. Same confirm gate as update_page, for the same reason."""
        if not confirm:
            raise ConfluenceError(
                "create_page requires confirm=True. Nothing was sent to "
                "Confluence. Use dry_run_create() to see what would be made."
            )
        clash = self.title_exists(title, space_key)
        if clash:
            raise ConfluenceError(
                f"A page titled {title!r} already exists in this space (id {clash}). "
                f"Edit that one rather than creating a second."
            )
        body: dict[str, Any] = {
            "spaceId": self.space_id(space_key),
            "status": "current",
            "title": title,
            "body": {"representation": "storage", "value": storage_html},
        }
        if parent_id:
            body["parentId"] = parent_id

        response = self._client.post("/pages", json=body)
        if response.status_code >= 400:
            raise ConfluenceError(
                f"Confluence refused to create {title!r} ({response.status_code}): "
                f"{response.text[:300]}"
            )
        return response.json()

    def dry_run_create(
        self, title: str, storage_html: str, space_key: str | None = None
    ) -> dict[str, Any]:
        """What create_page would do, without doing it."""
        clash = self.title_exists(title, space_key)
        return {
            "title": title,
            "space_key": space_key or self.space_key,
            "would_create": clash is None,
            "problem": None if clash is None
            else f"a page titled {title!r} already exists (id {clash})",
            "existing_page_id": clash,
            "characters": len(storage_html),
        }

    def dry_run_update(self, page_id: str, new_storage_html: str) -> dict[str, Any]:
        """What update_page would do, without doing it."""
        current, version, title = self.storage_html(page_id)
        return {
            "page_id": page_id,
            "title": title,
            "current_version": version,
            "would_become": version + 1,
            "changed": current != new_storage_html,
            "before": current,
            "after": new_storage_html,
        }


# --- storage format -> markdown --------------------------------------------
_BLOCK = {"h1": "#", "h2": "##", "h3": "###", "h4": "####", "h5": "#####", "h6": "######"}


def storage_to_markdown(storage: str) -> str:
    """Confluence storage format (XHTML plus ac: macros) to Markdown.

    Deliberately lossy and deliberately small. Its only job is to produce text
    whose heading structure matches the page, because that structure is what
    the chunker splits on and what a citation points at. Macros that carry no
    prose are dropped rather than rendered as noise the embedder would have to
    ignore.
    """
    if not storage:
        return ""
    soup = BeautifulSoup(storage, "lxml-xml" if storage.lstrip().startswith("<?xml") else "html.parser")

    for macro in soup.find_all(re.compile(r"^ac:")):
        # Defensive on both counts: a regex tag match can return nodes that are
        # not Tags, and a Tag built by the HTML parser from a namespaced element
        # can carry `attrs = None` rather than an empty dict. Either one raises
        # on a plain .get(), which took down the whole ingest.
        if not isinstance(macro, Tag):
            continue
        attrs = macro.attrs or {}
        # Parsers disagree about whether the namespace survives on attributes.
        name = attrs.get("ac:name") or attrs.get("name") or ""
        if name == "code":
            body = macro.find("ac:plain-text-body")
            macro.replace_with(f"\n```\n{body.get_text() if body else ''}\n```\n")
        elif name in {"info", "note", "warning", "tip", "panel", "expand"}:
            macro.replace_with(macro.get_text(" ", strip=True))
        else:
            macro.decompose()

    lines: list[str] = []
    for element in soup.children:
        lines.extend(_render(element))
    text = "\n".join(lines)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _render(node: Any, depth: int = 0) -> list[str]:
    if isinstance(node, NavigableString):
        stripped = str(node).strip()
        return [stripped] if stripped else []
    if not isinstance(node, Tag):
        return []

    tag = node.name.lower()
    if tag in _BLOCK:
        return ["", f"{_BLOCK[tag]} {node.get_text(' ', strip=True)}", ""]
    if tag == "p":
        text = node.get_text(" ", strip=True)
        return ["", text, ""] if text else []
    if tag in {"ul", "ol"}:
        out = [""]
        for index, item in enumerate(node.find_all("li", recursive=False), start=1):
            marker = "-" if tag == "ul" else f"{index}."
            out.append(f"{'  ' * depth}{marker} {item.get_text(' ', strip=True)}")
        out.append("")
        return out
    if tag == "table":
        return _render_table(node)
    if tag in {"br", "hr"}:
        return [""]
    out: list[str] = []
    for child in node.children:
        out.extend(_render(child, depth))
    return out


def _render_table(table: Tag) -> list[str]:
    rows = table.find_all("tr")
    if not rows:
        return []
    out = [""]
    for index, row in enumerate(rows):
        cells = [c.get_text(" ", strip=True).replace("|", "\\|") for c in row.find_all(["th", "td"])]
        if not cells:
            continue
        out.append("| " + " | ".join(cells) + " |")
        if index == 0:
            out.append("|" + "|".join(["---"] * len(cells)) + "|")
    out.append("")
    return out
