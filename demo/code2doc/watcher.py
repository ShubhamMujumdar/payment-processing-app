"""Watch a branch, and run the documentation pipeline on every new commit.

Polling, not webhooks. A webhook needs a public HTTPS URL, which on a laptop
means a tunnel, a second moving part and a second thing that can fail in front
mid-demo. Polling needs outbound HTTPS, which every network already
permits. One poll is a single API call against a 5000/hour budget, so a
three-second interval costs about 1200 calls an hour and still leaves headroom.

The pipeline per commit:

    detect -> filter noise -> analyse (Claude) -> retrieve (Chroma + reranker)
           -> propose redlines (Claude) -> store

Every stage writes an event before it starts work, so a dashboard sees
"analysing" while the model is still thinking rather than a gap followed by a
finished result.
"""

from __future__ import annotations

import time
import traceback
from typing import Any, Callable

import httpx

from .analyze import analyse_change, propose_redline
from .changes import Change, from_github_commit
from .config import Config
from .runs import RunStore

API = "https://api.github.com"


class GitHubSource:
    def __init__(self, token: str, repo: str, timeout: float = 20.0):
        self.repo = repo
        self._client = httpx.Client(
            base_url=API,
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    def close(self) -> None:
        self._client.close()

    def head(self, branch: str) -> dict[str, Any] | None:
        """Newest commit on a branch, or None if the branch has none."""
        response = self._client.get(
            f"/repos/{self.repo}/commits", params={"sha": branch, "per_page": 1}
        )
        response.raise_for_status()
        commits = response.json()
        return commits[0] if commits else None

    def commit(self, sha: str) -> dict[str, Any]:
        """Full commit including per-file patches. The list endpoint omits
        `files`, so this second call is what actually yields a diff."""
        response = self._client.get(f"/repos/{self.repo}/commits/{sha}")
        response.raise_for_status()
        return response.json()

    def workflow_runs(self, sha: str) -> list[dict[str, Any]]:
        """Actions runs for one commit.

        Fetched on demand rather than tracked, because CI state is GitHub's to
        own and mirroring it into our store would only create a second version
        that can be wrong. Empty is a real answer: a branch no workflow watches
        has no runs, and the UI should say so rather than invent a pending one.
        """
        response = self._client.get(
            f"/repos/{self.repo}/actions/runs",
            params={"head_sha": sha, "per_page": 20},
        )
        response.raise_for_status()
        return [
            {
                "id": run.get("id"),
                "name": run.get("name"),
                "status": run.get("status"),          # queued | in_progress | completed
                "conclusion": run.get("conclusion"),  # success | failure | cancelled | None
                "url": run.get("html_url"),
                "started_at": run.get("run_started_at"),
                "updated_at": run.get("updated_at"),
            }
            for run in response.json().get("workflow_runs", [])
        ]

    def repo_url(self) -> str:
        return f"https://github.com/{self.repo}"


class Watcher:
    def __init__(self, config: Config, retriever: Any, top_k: int = 3, branch: str | None = None):
        self.config = config
        self.retriever = retriever
        self.top_k = top_k
        self.branch = branch or config.watch_branch
        self.store = RunStore(config.runs_db)
        self.source = GitHubSource(config.github_token, config.github_repo)

    def close(self) -> None:
        self.source.close()

    # --- the loop ----------------------------------------------------------
    def run_forever(self, on_log: Callable[[str], None] = print) -> None:
        branch = self.branch
        on_log(f"watching {self.config.github_repo}@{branch} every {self.config.poll_seconds}s")

        head = self.source.head(branch)
        if head and not self.store.watermark(branch):
            # Start from now. Without this the first run analyses whatever
            # commit happens to be at the tip, which on a demo machine is
            # usually last week's work.
            self.store.set_watermark(branch, head["sha"])
            on_log(f"starting from {head['sha'][:8]} (existing history ignored)")

        while True:
            try:
                self.poll_once(on_log)
            except httpx.HTTPStatusError as exc:
                on_log(f"github error {exc.response.status_code}: {exc.response.text[:160]}")
            except Exception as exc:  # keep watching; a demo must not die on one bad poll
                on_log(f"poll failed: {exc}")
            time.sleep(self.config.poll_seconds)

    def poll_once(self, on_log: Callable[[str], None] = print) -> str | None:
        branch = self.branch
        head = self.source.head(branch)
        if not head:
            return None
        sha = head["sha"]
        if sha == self.store.watermark(branch) or self.store.exists(sha):
            return None

        on_log(f"new commit {sha[:8]}")
        self.store.set_watermark(branch, sha)
        change = from_github_commit(self.source.commit(sha), branch, self.source.repo_url())
        return self.process(change, on_log)

    # --- one commit --------------------------------------------------------
    def process(self, change: Change, on_log: Callable[[str], None] = print) -> str:
        run_id = self.store.create(change)
        on_log(f"  {change.summary_line()}")

        if not change.worth_analysing:
            self.store.update(run_id, status="no-impact")
            self.store.emit(run_id, "no-impact", {"reason": "every changed file was filtered as noise"})
            on_log("  every file filtered as noise; nothing to analyse")
            return run_id

        try:
            self.store.update(run_id, status="analysing")
            self.store.emit(run_id, "analysing", {"files": len(change.significant)})
            analysis = analyse_change(change.diff)
            self.store.update(
                run_id,
                analysis_json={
                    "summary": analysis.summary,
                    "change_kind": analysis.change_kind,
                    "doc_impact_expected": analysis.doc_impact_expected,
                    "queries": [q.model_dump() for q in analysis.queries],
                },
            )
            on_log(f"  {analysis.change_kind}: {analysis.summary}")

            if not analysis.doc_impact_expected:
                self.store.update(run_id, status="no-impact")
                self.store.emit(run_id, "no-impact", {"reason": analysis.summary, "kind": analysis.change_kind})
                return run_id

            self.store.emit(run_id, "retrieving", {"queries": [q.topic for q in analysis.queries]})
            best: dict[str, Any] = {}
            for query in analysis.queries:
                for result in self.retriever.search(query.topic, top_k=self.top_k, candidates=20).results:
                    key = f"{result.page_id}:{result.char_start}"
                    if key not in best or result.rerank_score > best[key].rerank_score:
                        best[key] = result
            ranked = sorted(best.values(), key=lambda r: -(r.rerank_score or 0))[: self.top_k]

            self.store.update(run_id, status="retrieved")
            self.store.emit(run_id, "retrieved", {
                "sections": [
                    {"page": r.page_title, "section": r.heading_path, "score": r.rerank_score}
                    for r in ranked
                ],
            })
            on_log(f"  {len(ranked)} candidate sections")

            proposals = []
            for result in ranked:
                redline = propose_redline(change.diff, result.location, result.text, analysis.summary)
                proposals.append({
                    "page_id": result.page_id,
                    "page_title": result.page_title,
                    "heading_path": result.heading_path,
                    "url": result.url,
                    "anchor_url": result.anchor_url,
                    "line_start": result.line_start,
                    "line_end": result.line_end,
                    "vector_score": result.vector_score,
                    "rerank_score": result.rerank_score,
                    "needs_change": redline.needs_change,
                    "existing_text": redline.existing_text,
                    "proposed_text": redline.proposed_text,
                    "rationale": redline.rationale,
                    "code_citation": redline.code_citation,
                    "confidence": redline.confidence,
                    "published": False,
                })
                on_log(
                    f"    {'EDIT' if redline.needs_change else 'skip'}  "
                    f"{result.page_title} > {result.heading_path[:48]}"
                )

            changed = [p for p in proposals if p["needs_change"]]
            self.store.update(run_id, status="proposed", proposals_json=proposals)
            self.store.emit(run_id, "proposed", {
                "proposed": len(changed),
                "considered": len(proposals),
                "pages": sorted({p["page_title"] for p in changed}),
            })
            return run_id

        except Exception as exc:
            self.store.update(run_id, status="failed", error=f"{exc}\n{traceback.format_exc()[-800:]}")
            self.store.emit(run_id, "failed", {"error": str(exc)})
            on_log(f"  FAILED: {exc}")
            return run_id
