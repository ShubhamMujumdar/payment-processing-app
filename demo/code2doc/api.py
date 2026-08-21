"""Read API over the index.

    POST /impact    text in, impacted documentation sections out
    GET  /pages     what is indexed
    GET  /stats     index and model state
    GET  /health    liveness, and whether the models actually loaded

Models load once at startup rather than per request: ~21s of loading against
~40ms of query. The first request after `serve` prints is therefore fast, and a
failure to load surfaces at boot instead of on the first demo query.
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import config
from .chat import ChatStore, _sse, converse, new_session_id
from .retrieve import DEFAULT_CANDIDATES, DEFAULT_TOP_K, Retriever
from .runs import RunStore

_state: dict[str, Any] = {"retriever": None, "error": None, "runs": None, "watcher": None}

#: Stages the pipeline itself runs. `published` is excluded: it is a human
#: decision taken later, not part of how long the analysis took.
PIPELINE_KINDS = {
    "detected", "analysing", "retrieving", "retrieved", "proposed",
    "no-impact", "failed",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = config()
    _state["runs"] = RunStore(cfg.runs_db)
    try:
        _state["retriever"] = Retriever(cfg, load_reranker=True)
        print(f"models loaded on {cfg.resolved_device()}")
        print(f"index: {_state['retriever'].store.stats()}")
    except Exception as exc:  # surfaced by /health rather than killing the process
        _state["error"] = str(exc)
        print(f"startup failed: {exc}")

    # The chat drives the MCP server's tools in this process. Hand it the
    # retriever we just loaded rather than letting it build a second one -- same
    # reason the watcher runs here: two copies of the models do not fit.
    _state["chat"] = ChatStore(cfg.runs_db)
    if _state["retriever"] is not None:
        from .mcp_server import use_retriever

        use_retriever(_state["retriever"])

    # The watcher runs in this process rather than beside it, so the models are
    # loaded once instead of twice -- two copies would be ~5GB on a 6GB card.
    if os.getenv("WATCH_ON_SERVE") == "1" and _state["retriever"] and cfg.has_github:
        from .watcher import Watcher

        watcher = Watcher(cfg, _state["retriever"])
        _state["watcher"] = watcher
        threading.Thread(
            target=watcher.run_forever, kwargs={"on_log": lambda m: print(f"[watch] {m}")},
            daemon=True, name="code2doc-watcher",
        ).start()
        print(f"watching {cfg.github_repo}@{watcher.branch}")

    yield


app = FastAPI(
    title="code2doc retrieval",
    description="Given text describing a change, return the documentation sections it impacts.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:5174",
        "http://127.0.0.1:5173", "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImpactRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Change description, commit message, or diff.")
    top_k: int = Field(DEFAULT_TOP_K, ge=1, le=50)
    candidates: int = Field(DEFAULT_CANDIDATES, ge=1, le=200, description="Width of the vector stage before reranking.")
    rerank: bool = Field(True, description="Set false to see the raw bi-encoder ordering.")
    min_rerank_score: float | None = Field(
        None,
        description="Drop results below this rerank logit. Omit to always return top_k.",
    )


def _retriever() -> Retriever:
    if _state["retriever"] is None:
        raise HTTPException(status_code=503, detail=f"Models not loaded: {_state['error']}")
    return _state["retriever"]


@app.get("/health")
def health() -> dict[str, Any]:
    cfg = config()
    ready = _state["retriever"] is not None
    return {
        "status": "ok" if ready else "degraded",
        "models_loaded": ready,
        "error": _state["error"],
        "device": cfg.resolved_device(),
        "confluence_configured": cfg.has_confluence,
    }


@app.get("/stats")
def stats() -> dict[str, Any]:
    retriever = _retriever()
    return {
        "index": retriever.store.stats(),
        "embedding_model": retriever.config.embedding_model.name,
        "reranker_model": retriever.config.reranker_model.name,
        "device": retriever.device,
        "dimension": retriever.embedder.dimension,
        "max_seq_length": retriever.embedder.max_seq_length,
    }


@app.get("/pages")
def pages() -> dict[str, Any]:
    retriever = _retriever()
    listing = retriever.store.pages()
    return {"count": len(listing), "pages": listing}


def _runs() -> RunStore:
    if _state["runs"] is None:
        raise HTTPException(status_code=503, detail="Run store not ready")
    return _state["runs"]


@app.get("/runs")
def runs(limit: int = 25) -> dict[str, Any]:
    """Newest first. The dashboard's list view."""
    listing = _runs().list(limit=limit)
    return {
        "count": len(listing),
        "watching": _state["watcher"].branch if _state["watcher"] else None,
        "runs": listing,
    }


@app.get("/runs/{run_id}")
def run_detail(run_id: str) -> dict[str, Any]:
    run = _runs().get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"No run {run_id}")

    # Elapsed time per stage, derived rather than stored: the gap between one
    # event and the next is exactly how long that stage took.
    #
    # Publishing is excluded from both the per-stage gaps and the total. It is a
    # human decision that happens whenever someone gets round to it -- on one run
    # here, twenty minutes later -- and folding that wait into "how long the
    # pipeline took" turned 32 seconds into 1996.
    events = _runs().events_for(run_id)
    pipeline = [e for e in events if e["kind"] in PIPELINE_KINDS]

    timeline = []
    for index, event in enumerate(pipeline):
        nxt = pipeline[index + 1]["at"] if index + 1 < len(pipeline) else None
        timeline.append({
            "kind": event["kind"],
            "at": event["at"],
            "seconds": round(nxt - event["at"], 1) if nxt else None,
        })
    run["timeline"] = timeline
    run["total_seconds"] = (
        round(pipeline[-1]["at"] - pipeline[0]["at"], 1) if len(pipeline) > 1 else None
    )
    run["published_at"] = next(
        (e["at"] for e in events if e["kind"] == "published"), None
    )
    return run


@app.get("/runs/{run_id}/ci")
def run_ci(run_id: str) -> dict[str, Any]:
    """Live GitHub Actions state for a run's commit.

    Read straight from GitHub on each call. CI state belongs to GitHub; copying
    it into our store would only create a second version of the truth that can
    disagree with the tab someone is about to open.
    """
    run = _runs().get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"No run {run_id}")

    cfg = config()
    if not cfg.has_github:
        return {"sha": run["sha"], "configured": False, "workflows": []}

    from .watcher import GitHubSource

    source = GitHubSource(cfg.github_token, cfg.github_repo)
    try:
        workflows = source.workflow_runs(run["sha"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GitHub: {exc}")
    finally:
        source.close()
    return {"sha": run["sha"], "configured": True, "workflows": workflows}


class PublishRequest(BaseModel):
    dry_run: bool = Field(
        True,
        description="True plans the edit and returns it without touching Confluence.",
    )


@app.post("/runs/{run_id}/proposals/{index}/publish")
def publish(run_id: str, index: int, request: PublishRequest) -> dict[str, Any]:
    """Publish one approved proposal to Confluence.

    Dry run by default. The caller has to ask twice — once to see what would
    change, once to mean it — because this writes to a space other people use.
    """
    run = _runs().get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"No run {run_id}")
    proposals = run.get("proposals") or []
    if index < 0 or index >= len(proposals):
        raise HTTPException(status_code=404, detail=f"Run has no proposal {index}")

    proposal = proposals[index]
    if not proposal.get("needs_change"):
        raise HTTPException(status_code=400, detail="That proposal is a decision not to change anything.")
    if proposal.get("published") and not request.dry_run:
        return {**proposal, "ok": True, "published": True, "problem": "Already published."}

    cfg = config()
    cfg.require_confluence()

    from .publish import publish_proposal, version_message
    from .sources.confluence import ConfluenceClient, ConfluenceError

    client = ConfluenceClient(cfg.base_url, cfg.email, cfg.api_token, cfg.space_key)
    try:
        result = publish_proposal(
            client,
            page_id=proposal["page_id"],
            existing_text=proposal["existing_text"],
            proposed_text=proposal["proposed_text"],
            message=version_message(run["sha"], run["message"]),
            dry_run=request.dry_run,
        )
    except ConfluenceError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    finally:
        client.close()

    if result.get("published"):
        proposals[index] = {**proposal, "published": True}
        _runs().update(run_id, proposals_json=proposals)
        _runs().emit(run_id, "published", {
            "page_title": proposal["page_title"],
            "heading_path": proposal["heading_path"],
            "url": proposal["anchor_url"],
            "version": result.get("new_version"),
        })
    return result


@app.get("/events")
def events(cursor: int = 0, limit: int = 100) -> dict[str, Any]:
    """Poll fallback for clients that cannot hold an SSE connection open."""
    batch = _runs().events_since(cursor, limit=limit)
    return {
        "cursor": batch[-1]["seq"] if batch else cursor,
        "latest": _runs().latest_seq(),
        "events": batch,
    }


@app.get("/stream")
async def stream(cursor: int | None = None) -> StreamingResponse:
    """Server-sent events, one per pipeline stage.

    This is what makes a commit appear on screen without anyone refreshing.
    SSE rather than websockets: the traffic is one-directional, it reconnects by
    itself, and it is a plain GET that needs no protocol upgrade through
    whatever network a demo is standing on.

    Passing no cursor starts from *now* -- a dashboard opened mid-demo should
    not replay the morning's commits. Pass cursor=0 to replay everything.
    """
    store = _runs()
    start = store.latest_seq() if cursor is None else cursor

    async def generate() -> Any:
        seen = start
        yield f"event: hello\ndata: {json.dumps({'cursor': seen})}\n\n"
        idle = 0
        while True:
            batch = await asyncio.to_thread(store.events_since, seen, 50)
            for event in batch:
                seen = event["seq"]
                yield f"event: {event['kind']}\ndata: {json.dumps(event)}\n\n"
            # A comment line is a valid SSE frame that clients ignore. Without
            # one, an idle connection is indistinguishable from a dead one and
            # intermediaries close it.
            idle = 0 if batch else idle + 1
            if idle >= 15:
                yield ": keepalive\n\n"
                idle = 0
            await asyncio.sleep(1)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/impact")
def impact(request: ImpactRequest) -> dict[str, Any]:
    retriever = _retriever()
    if not retriever.store.is_built:
        raise HTTPException(
            status_code=409,
            detail="No index. Run `python -m code2doc.cli ingest` then `index`.",
        )
    response = retriever.search(
        query=request.text,
        top_k=request.top_k,
        candidates=request.candidates,
        rerank=request.rerank,
        min_rerank_score=request.min_rerank_score,
    )
    return response.to_dict()


# --- chat ------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: str | None = None


def _chat() -> ChatStore:
    store = _state.get("chat")
    if store is None:
        raise HTTPException(status_code=503, detail="Chat store not ready.")
    return store


@app.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """Stream one assistant turn as server-sent events.

    Events are `token` (text as it arrives), `tool` (a tool call, so the UI can
    show what is being looked up rather than a spinner), `done`, and `error`.
    """
    session_id = request.session_id or new_session_id()
    stream = converse(_chat(), session_id, request.message)

    async def body():
        yield _sse("session", {"session_id": session_id})
        async for chunk in stream:
            yield chunk

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.get("/chat/{session_id}/history")
def chat_history(session_id: str) -> dict[str, Any]:
    """Replay a session. Tool-call turns are dropped: they are how the answer
    was reached, not the conversation, and the UI renders the conversation."""
    turns = [
        {"role": t["role"], "text": t["content"], "at": t["at"]}
        for t in _chat().history(session_id)
        if isinstance(t["content"], str)
    ]
    return {"session_id": session_id, "messages": turns}


@app.delete("/chat/{session_id}")
def chat_clear(session_id: str) -> dict[str, Any]:
    return {"session_id": session_id, "deleted": _chat().clear(session_id)}
