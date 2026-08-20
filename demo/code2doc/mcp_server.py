"""The retrieval pipeline and the Confluence write, exposed over MCP.

This is a facade, not a reimplementation. Every tool below calls the same
function the FastAPI route calls -- `Retriever.search` and `publish_proposal`
-- so there is exactly one implementation of each behaviour and no second copy
to drift. Nothing in the existing pipeline imports this module, which is what
makes it additive: delete this file and `code2doc serve` is unchanged.

Two things are deliberately *not* here.

GitHub is absent because there is nothing to expose. The spine's connector
issues only GET requests; the single write anywhere in this repository is the
Confluence PUT. Adding a GitHub write tool would not be wrapping an existing
capability, it would be granting a new one to a system whose stated design is
that it only reads.

Retrieval is not agentic. The model that generates queries (`analyze.py`) is
still a pure function of the diff, and this server is the thing those queries
are handed to. That keeps the five-stage attribution intact: a bad answer is
still traceable to retrieval or to drafting, rather than to an agent that chose
its own path through the corpus.

    python -m code2doc.mcp_server                  stdio, for Claude Desktop / Code
    python -m code2doc.mcp_server --http --port N  streamable HTTP
"""

from __future__ import annotations

import argparse
from typing import Any

from mcp.server import MCPServer
from mcp.types import ToolAnnotations

from .config import config
from .retrieve import Retriever

server = MCPServer(
    name="code2doc",
    title="code2doc - documentation retrieval and Confluence publishing",
    version="1.0.0",
    instructions=(
        "Tools over a Confluence corpus that has been chunked, embedded and indexed.\n\n"
        "search_documentation runs the same two-stage pipeline the product uses: "
        "vector recall over the whole corpus, then a cross-encoder rerank. Trust the "
        "ranking and the gap between results, never the absolute score -- the same "
        "well-formed query scores differently on different corpora.\n\n"
        "Phrase queries as the SUBJECT MATTER, not as the change. Documentation states "
        "what a system is; it never narrates edits. 'payment amount minimum constraint' "
        "retrieves the right section; 'the minimum was raised to 5.00' does not.\n\n"
        "plan_confluence_edit is safe and writes nothing. publish_confluence_edit "
        "modifies a page other people are reading -- always plan first and show the "
        "result to a human before calling it."
    ),
)

#: Built once, on first use. Loading the embedder and the cross-encoder takes
#: several seconds and ~3.6GB, so doing it at import would make every client
#: that merely lists the tools pay for it.
_retriever: Retriever | None = None


def retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever(config())
    if not _retriever.store.is_built:
        raise RuntimeError(
            "No index. Run `python -m code2doc.cli ingest` then "
            "`python -m code2doc.cli index`."
        )
    return _retriever


@server.tool(
    title="Search the documentation corpus",
    annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False),
)
def search_documentation(
    query: str,
    top_k: int = 5,
    rerank: bool = True,
    min_rerank_score: float | None = None,
) -> dict[str, Any]:
    """Find the documentation sections a topic belongs to.

    Phrase `query` as a topic or noun phrase describing the subject matter --
    "payment amount validation minimum" -- rather than as a statement about a
    change. On this corpus that phrasing difference is worth roughly 5.7 points
    of rerank score, which is the difference between the right section and a
    plausible wrong one.

    Returns each section with its heading path, a citable anchor URL, the exact
    lines it occupies, the text itself, and both scores. `vector_score` is
    recall; `rerank_score` is the cross-encoder's judgement and is the one that
    orders the results. Negative rerank scores are normal and mean "not this
    section" -- they are not errors.

    Set `rerank=False` to see raw vector recall, which is useful for showing why
    the second stage is needed: the embedding scores frequently cannot separate
    the correct section from a neighbouring one.
    """
    response = retriever().search(
        query=query,
        top_k=top_k,
        rerank=rerank,
        min_rerank_score=min_rerank_score,
    )
    return response.to_dict()


@server.tool(
    title="Plan a Confluence edit without writing",
    annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=True),
)
def plan_confluence_edit(page_id: str, existing_text: str, proposed_text: str) -> dict[str, Any]:
    """Check a proposed edit against the live page and report what would change.

    Writes nothing. This is the honest preview: it fetches the page as it is
    right now, locates `existing_text`, and computes the minimal fragments that
    would be replaced. If the page has moved on since the proposal was drafted,
    `ok` is false and `problem` says so -- which is the expected outcome when
    someone else has already published a change to the same text.

    Always call this before publish_confluence_edit, and show the result to a
    human.
    """
    return _edit(page_id, existing_text, proposed_text, message="", dry_run=True)


@server.tool(
    title="Publish an approved edit to Confluence",
    annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=True),
)
def publish_confluence_edit(
    page_id: str,
    existing_text: str,
    proposed_text: str,
    message: str,
) -> dict[str, Any]:
    """Write an edit to a live Confluence page. Requires human approval first.

    This mutates a page other people are reading and creates a new version
    against the caller's account. Call plan_confluence_edit first, show a human
    what would change, and only call this once they have said yes.

    `message` becomes the version comment and should identify what prompted the
    edit -- a commit sha and subject, typically -- so the page history explains
    itself later.
    """
    return _edit(page_id, existing_text, proposed_text, message=message, dry_run=False)


def _edit(page_id: str, existing_text: str, proposed_text: str, message: str, dry_run: bool) -> dict[str, Any]:
    """One code path for both tools, so the plan cannot diverge from the write.

    Mirrors the FastAPI publish route: same client, same `publish_proposal`,
    same close-in-finally.
    """
    cfg = config()
    cfg.require_confluence()

    from .publish import publish_proposal
    from .sources.confluence import ConfluenceClient

    client = ConfluenceClient(cfg.base_url, cfg.email, cfg.api_token, cfg.space_key)
    try:
        return publish_proposal(
            client,
            page_id=page_id,
            existing_text=existing_text,
            proposed_text=proposed_text,
            message=message,
            dry_run=dry_run,
        )
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--http", action="store_true", help="serve streamable HTTP instead of stdio")
    parser.add_argument("--port", type=int, default=8100, help="port for --http (default 8100)")
    args = parser.parse_args()

    if args.http:
        server.run(transport="streamable-http", host="127.0.0.1", port=args.port)
    else:
        server.run(transport="stdio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
