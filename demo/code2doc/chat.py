"""A stateful, agentic assistant whose tools are the MCP server's tools.

There is no second tool registry here. The chat asks the MCP server what it can
do (`list_tools`) and dispatches through it (`call_tool`), so a tool added to
`mcp_server.py` appears in this window with no change to this file, and the
retrieval a user sees is the retrieval the pipeline runs.

The server object is used in-process rather than over a socket. Same registry,
same dispatch, same annotations -- but no second process loading a second copy
of a 3.6GB model onto a 6GB card. It is simultaneously exposable over stdio or
HTTP to Claude Desktop and any other client; that is the same `server` object.

**Destructive tools are filtered out, by annotation rather than by name.**
`publish_confluence_edit` is marked `destructiveHint: true`, so it never reaches
this loop. A chat window that can silently edit a page other people are reading
is not a feature. The two-step human gate stays where it is.

State lives in sqlite beside the run history, so a conversation survives a
restart and "clear" means cleared rather than "until you reload".

    POST   /chat                    stream a reply     (server-sent events)
    GET    /chat/{session}/history  replay a session
    DELETE /chat/{session}          forget it
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, AsyncIterator

MODEL = "claude-opus-5"
MAX_TOKENS = 8000

#: Turns replayed to the model. A cost and latency guard, not a correctness one:
#: the full transcript stays in sqlite and is what /history returns.
HISTORY_TURNS = 24

SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_messages (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    at         REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_session ON chat_messages(session_id, seq);
"""

SYSTEM = """You are the assistant inside a delivery dashboard, and you can see this
programme's actual data through your tools. That is the whole of your value: a
confident guess about payment systems in general is worse than useless here,
because it looks exactly like a grounded answer.

So: answer from tool results, and when the tools do not support an answer, say
so plainly and say which tool you tried.

Two bodies of data are available. The documentation corpus is a Confluence space
describing a payment processing service -- APIs, entity model, validation rules,
traceability. The delivery record is an event-sourced graph of the programme --
requirements, work packets, custody, commits, pull requests, pipeline runs,
deployments, defects, and the people holding them. Recent commit activity covers
what the documentation pipeline has watched and concluded.

Searching the documentation well matters. It is embedding recall followed by a
cross-encoder rerank, and it responds to phrasing: query the SUBJECT MATTER as a
topic or noun phrase -- "payment amount minimum validation" -- never as a
statement about a change. Read the scores you get back. Ranking and the gap
between results carry information; absolute values do not, and a negative rerank
score means "not this section" rather than a failure.

Cite your sources every time. Tool results carry `url`, `anchor_url` or
`source_url` -- give the reader the link and the name, as a markdown link, so
they can check you. For documentation say which page and heading; for a commit
give the sha and its GitHub link; for a graph node give its id.

Keep replies short enough to read in a side panel. A few sentences and a tight
list beats an essay. Use markdown."""


class ChatStore:
    """Transcripts, in the same database the run history uses."""

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def append(self, session_id: str, role: str, content: Any) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO chat_messages (session_id, role, content, at) VALUES (?,?,?,?)",
                (session_id, role, json.dumps(content), time.time()),
            )

    def history(self, session_id: str, limit: int | None = None) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = list(conn.execute(
                "SELECT role, content, at FROM chat_messages WHERE session_id = ? ORDER BY seq",
                (session_id,),
            ))
        turns = [{"role": r["role"], "content": json.loads(r["content"]), "at": r["at"]} for r in rows]
        return turns[-limit:] if limit else turns

    def clear(self, session_id: str) -> int:
        with self._connect() as conn:
            return conn.execute(
                "DELETE FROM chat_messages WHERE session_id = ?", (session_id,)
            ).rowcount


async def available_tools() -> list[dict[str, Any]]:
    """The MCP server's non-destructive tools, as Anthropic tool definitions.

    Selection is by annotation, not by a hardcoded allowlist, so a new
    destructive tool is excluded the day it is written rather than the day
    somebody remembers this file exists.
    """
    from .mcp_server import server  # noqa: PLC0415

    tools = []
    for tool in await server.list_tools():
        annotations = tool.annotations
        if annotations is not None and annotations.destructive_hint:
            continue
        tools.append({
            "name": tool.name,
            "description": tool.description or tool.title or tool.name,
            "input_schema": tool.input_schema,
        })
    return tools


async def call_tool(name: str, arguments: dict[str, Any]) -> str:
    """Dispatch through the MCP server and flatten the result to text."""
    from .mcp_server import server  # noqa: PLC0415

    result = await server.call_tool(name, arguments)
    content = getattr(result, "content", None)
    if content:
        parts = [getattr(block, "text", "") for block in content]
        joined = "\n".join(p for p in parts if p)
        if joined:
            return joined[:20000]
    structured = getattr(result, "structured_content", None)
    return json.dumps(structured)[:20000] if structured is not None else "{}"


def _client() -> Any:
    import anthropic  # noqa: PLC0415

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY is not set. Add it to demo/.env.")
    return anthropic.AsyncAnthropic()


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def converse(store: ChatStore, session_id: str, message: str) -> AsyncIterator[str]:
    """One user turn in, server-sent events out.

    Text streams as it arrives and every tool call is announced, because ten
    silent seconds while the cross-encoder runs reads as a hang. The transcript
    is written as each turn completes, so a dropped connection costs the
    rendering rather than the conversation.
    """
    store.append(session_id, "user", message)
    history = store.history(session_id, limit=HISTORY_TURNS)
    messages: list[dict[str, Any]] = [{"role": t["role"], "content": t["content"]} for t in history]

    try:
        client = _client()
        tools = await available_tools()
    except Exception as exc:
        yield _sse("error", {"message": str(exc)})
        return

    try:
        while True:
            async with client.messages.stream(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM,
                thinking={"type": "adaptive"},
                tools=tools,
                messages=messages,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta" and event.delta.type == "text_delta":
                        yield _sse("token", {"text": event.delta.text})
                reply = await stream.get_final_message()

            calls = [b for b in reply.content if b.type == "tool_use"]
            messages.append({"role": "assistant", "content": reply.content})

            if reply.stop_reason != "tool_use" or not calls:
                text = "".join(b.text for b in reply.content if b.type == "text")
                store.append(session_id, "assistant", text)
                yield _sse("done", {"text": text})
                return

            results = []
            for call in calls:
                yield _sse("tool", {"name": call.name, "input": call.input})
                try:
                    output = await call_tool(call.name, dict(call.input))
                except Exception as exc:
                    output = json.dumps({"error": f"{call.name} failed: {exc}"})
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": output,
                })
            messages.append({"role": "user", "content": results})

    except Exception as exc:
        yield _sse("error", {"message": f"{exc.__class__.__name__}: {exc}"})


def new_session_id() -> str:
    return f"chat-{uuid.uuid4().hex[:12]}"
