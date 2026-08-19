"""What the watcher saw and what it did about it.

One SQLite file holding two tables: `runs` (a commit and its analysis, updated
in place as the pipeline progresses) and `events` (an append-only log of stage
transitions).

The events table exists so the dashboard can be told what happened without
polling for differences. A run row answers "what is the state now"; an event row
answers "what just changed", which is what drives a popup. Keeping both is
cheaper than deriving the second from the first.

Statuses, in order:

    detected -> analysing -> retrieved -> proposed -> published
                                      \\-> no-impact
                                       \\-> failed
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .changes import Change

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id        TEXT PRIMARY KEY,
    sha           TEXT NOT NULL,
    branch        TEXT NOT NULL,
    message       TEXT,
    author        TEXT,
    committed_at  TEXT,
    detected_at   REAL,
    url           TEXT,
    status        TEXT NOT NULL,
    diff          TEXT,
    files_json    TEXT,
    analysis_json TEXT,
    proposals_json TEXT,
    error         TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_sha ON runs(sha);
CREATE INDEX IF NOT EXISTS idx_runs_detected ON runs(detected_at DESC);

CREATE TABLE IF NOT EXISTS events (
    seq     INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id  TEXT NOT NULL,
    kind    TEXT NOT NULL,
    payload TEXT,
    at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS watermarks (
    branch TEXT PRIMARY KEY,
    sha    TEXT NOT NULL,
    at     REAL NOT NULL
);
"""


class RunStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        # The watcher writes while the API reads; WAL lets those overlap rather
        # than the reader blocking on every analysis.
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    # --- runs --------------------------------------------------------------
    def create(self, change: Change) -> str:
        run_id = f"run-{change.sha[:12]}"
        with self._connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO runs (run_id, sha, branch, message, author, "
                "committed_at, detected_at, url, status, diff, files_json) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    run_id, change.sha, change.branch, change.message, change.author,
                    change.committed_at, time.time(), change.url, "detected",
                    change.diff,
                    json.dumps([
                        {
                            "path": f.path, "status": f.status,
                            "additions": f.additions, "deletions": f.deletions,
                            "skipped": f.is_noise or f.is_whitespace_only,
                            "reason": "generated or binary" if f.is_noise
                                      else "formatting only" if f.is_whitespace_only else "",
                        }
                        for f in change.files
                    ]),
                ),
            )
        self.emit(run_id, "detected", {
            "sha": change.sha, "message": change.message.splitlines()[0][:120],
            "author": change.author, "branch": change.branch,
            "files": len(change.significant), "skipped": len(change.skipped),
        })
        return run_id

    def update(self, run_id: str, status: str | None = None, **fields: Any) -> None:
        sets, values = [], []
        if status:
            sets.append("status = ?")
            values.append(status)
        for key, value in fields.items():
            sets.append(f"{key} = ?")
            values.append(json.dumps(value) if key.endswith("_json") else value)
        if not sets:
            return
        values.append(run_id)
        with self._connect() as conn:
            conn.execute(f"UPDATE runs SET {', '.join(sets)} WHERE run_id = ?", values)

    def get(self, run_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        return _row_to_run(row) if row else None

    def list(self, limit: int = 25) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM runs ORDER BY detected_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [_row_to_run(r) for r in rows]

    def exists(self, sha: str) -> bool:
        with self._connect() as conn:
            return conn.execute("SELECT 1 FROM runs WHERE sha = ?", (sha,)).fetchone() is not None

    # --- events ------------------------------------------------------------
    def emit(self, run_id: str, kind: str, payload: dict[str, Any] | None = None) -> int:
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO events (run_id, kind, payload, at) VALUES (?,?,?,?)",
                (run_id, kind, json.dumps(payload or {}), time.time()),
            )
            return int(cursor.lastrowid or 0)

    def events_since(self, cursor: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events WHERE seq > ? ORDER BY seq LIMIT ?", (cursor, limit)
            ).fetchall()
        return [
            {
                "seq": r["seq"], "run_id": r["run_id"], "kind": r["kind"],
                "at": r["at"], **json.loads(r["payload"] or "{}"),
            }
            for r in rows
        ]

    def events_for(self, run_id: str) -> list[dict[str, Any]]:
        """Every stage transition for one run, oldest first.

        The UI shows how long each stage took. That is worth surfacing rather
        than hiding: "thirty seconds" is an abstraction, but "8s understanding
        the change, 4s searching, 15s drafting" is evidence that real work
        happened, and it is where a slow demo would show its cause.
        """
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events WHERE run_id = ? ORDER BY seq", (run_id,)
            ).fetchall()
        return [
            {
                "seq": r["seq"], "kind": r["kind"], "at": r["at"],
                **json.loads(r["payload"] or "{}"),
            }
            for r in rows
        ]

    def latest_seq(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT MAX(seq) AS s FROM events").fetchone()
        return int(row["s"] or 0)

    # --- watermarks --------------------------------------------------------
    def watermark(self, branch: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute("SELECT sha FROM watermarks WHERE branch = ?", (branch,)).fetchone()
        return row["sha"] if row else None

    def set_watermark(self, branch: str, sha: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO watermarks (branch, sha, at) VALUES (?,?,?) "
                "ON CONFLICT(branch) DO UPDATE SET sha=excluded.sha, at=excluded.at",
                (branch, sha, time.time()),
            )


def _row_to_run(row: sqlite3.Row) -> dict[str, Any]:
    run = dict(row)
    for key in ("files_json", "analysis_json", "proposals_json"):
        raw = run.pop(key)
        run[key.removesuffix("_json")] = json.loads(raw) if raw else None
    return run
