"""GitHub and CI connector.

Emits normalized events and nothing else -- it never touches the graph. That
boundary is what makes the projector a pure function over the log, and therefore
replayable and golden-testable.

Live against api.github.com with a read-only PAT. Covered: commits, pull
requests, review requests, reviews, workflow runs, and deployments with their
statuses.

Two truths this connector must not paper over:

* The repository has no second collaborator, so pull requests genuinely have no
  reviewer and no ``review.submitted`` event. GitHub does not permit
  self-review. Empty is the honest answer.
* Environments have no configured reviewers, so a deployment records a real
  transition with a real actor and timestamp but no human approval. Emitted as
  ``deployment.created``/``succeeded``, never ``deployment.approved``.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Iterator

import httpx

from ..core.events import EntityRef, Event
from ..core.vocabulary import Source, Verb

API = "https://api.github.com"


def _ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _actor(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if not user:
        return None
    return {"source": "github", "account_id": user.get("login"), "id": user.get("id")}


class GitHubConnector:
    source = Source.GITHUB

    def __init__(self, token: str, repo: str, timeout: float = 30.0):
        self.repo = repo
        self._client = httpx.Client(
            base_url=API,
            timeout=timeout,
            verify=False,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )

    def close(self) -> None:
        self._client.close()

    # --- transport ---------------------------------------------------------
    def _get(self, path: str, tolerate_missing: bool = False, **params: Any) -> Any:
        """One GET, with retries.

        ``tolerate_missing`` turns a 404 into an empty result instead of an
        error. GitHub answers 404 for sub-resources that exist but are empty --
        a pull request with no reviews returns 404 carrying a body of ``[]`` --
        and treating that as fatal aborted the entire ingest over a pull request
        that simply had not been reviewed. Which, on this repository, is all of
        them: GitHub does not permit reviewing your own.
        """
        for attempt in range(4):
            response = self._client.get(path, params=params)
            if response.status_code == 403 and "rate limit" in response.text.lower():
                # Honour the reset rather than hammering; unauthenticated is 60/hr
                # which is why the token matters.
                reset = int(response.headers.get("X-RateLimit-Reset", "0"))
                wait = max(1, reset - int(time.time()))
                time.sleep(min(wait, 60))
                continue
            if response.status_code >= 500:
                time.sleep(2**attempt)
                continue
            if response.status_code == 404 and tolerate_missing:
                return []
            response.raise_for_status()
            return response.json()
        raise RuntimeError(f"GitHub did not respond successfully for {path}")

    def _paged(self, path: str, limit: int = 200, **params: Any) -> Iterator[dict[str, Any]]:
        page, seen = 1, 0
        while seen < limit:
            batch = self._get(path, per_page=100, page=page, **params)
            if not batch:
                return
            for item in batch:
                yield item
                seen += 1
                if seen >= limit:
                    return
            page += 1

    # --- events ------------------------------------------------------------
    def fetch(self, since: str | None = None) -> Iterator[Event]:
        yield from self._commits(since)
        yield from self._pull_requests()
        yield from self._workflow_runs()
        yield from self._deployments()

    def _commits(self, since: str | None) -> Iterator[Event]:
        params: dict[str, Any] = {}
        if since:
            params["since"] = since
        for branch in ("main", "development"):
            for commit in self._paged(f"/repos/{self.repo}/commits", limit=150, sha=branch, **params):
                sha = commit["sha"]
                detail = commit.get("commit", {})
                yield Event(
                    source=self.source,
                    source_event_id=sha,
                    verb=Verb.CODE_COMMITTED,
                    occurred_at=_ts(detail.get("author", {}).get("date")) or datetime.now(),
                    actor_ref=_actor(commit.get("author"))
                    or {"source": "github", "account_id": detail.get("author", {}).get("email")},
                    subject_ref=EntityRef("commit", sha, detail.get("message", "").split("\n")[0]),
                    payload={
                        "message": detail.get("message", ""),
                        "branch": branch,
                        "author_email": detail.get("author", {}).get("email"),
                    },
                    raw=commit,
                )

    def _pull_requests(self) -> Iterator[Event]:
        for pr in self._paged(f"/repos/{self.repo}/pulls", limit=100, state="all"):
            number = pr["number"]
            base = {
                "number": number,
                "title": pr.get("title"),
                "body": pr.get("body"),
                "base": pr.get("base", {}).get("ref"),
                "head": pr.get("head", {}).get("ref"),
                "additions": pr.get("additions"),
                "deletions": pr.get("deletions"),
                "changed_files": pr.get("changed_files"),
            }
            ref = EntityRef("pull_request", f"{self.repo}#{number}", pr.get("title"))

            yield Event(
                source=self.source,
                source_event_id=f"pr-{number}-opened",
                verb=Verb.PR_OPENED,
                occurred_at=_ts(pr["created_at"]),
                actor_ref=_actor(pr.get("user")),
                subject_ref=ref,
                payload=base,
                raw=pr,
            )

            if pr.get("merged_at"):
                yield Event(
                    source=self.source,
                    source_event_id=f"pr-{number}-merged",
                    verb=Verb.PR_MERGED,
                    occurred_at=_ts(pr["merged_at"]),
                    actor_ref=_actor(pr.get("merged_by")),
                    subject_ref=ref,
                    payload=base,
                    raw=pr,
                )

            for requested in pr.get("requested_reviewers") or []:
                yield Event(
                    source=self.source,
                    source_event_id=f"pr-{number}-review-req-{requested.get('login')}",
                    verb=Verb.REVIEW_REQUESTED,
                    occurred_at=_ts(pr["updated_at"]),
                    actor_ref=_actor(requested),
                    subject_ref=ref,
                    payload=base,
                    raw=requested,
                )

            # Empty on this repository today: a single account cannot review its
            # own pull request.
            for review in self._get(f"/repos/{self.repo}/pulls/{number}/reviews", tolerate_missing=True) or []:
                yield Event(
                    source=self.source,
                    source_event_id=f"review-{review['id']}",
                    verb=Verb.REVIEW_SUBMITTED,
                    occurred_at=_ts(review.get("submitted_at")) or _ts(pr["updated_at"]),
                    actor_ref=_actor(review.get("user")),
                    subject_ref=ref,
                    payload={**base, "state": review.get("state")},
                    raw=review,
                )

    def _workflow_runs(self) -> Iterator[Event]:
        # Actions runs are wrapped in an object rather than returned as a bare
        # array, so the generic pager does not apply.
        response = self._get(f"/repos/{self.repo}/actions/runs", per_page=100)
        for run in response.get("workflow_runs", []):
            ref = EntityRef("pipeline_run", str(run["id"]), run.get("name"))
            payload = {
                "workflow": run.get("name"),
                "branch": run.get("head_branch"),
                "sha": run.get("head_sha"),
                "conclusion": run.get("conclusion"),
                "event": run.get("event"),
            }
            yield Event(
                source=Source.CI,
                source_event_id=f"run-{run['id']}-started",
                verb=Verb.BUILD_STARTED,
                occurred_at=_ts(run["created_at"]),
                actor_ref=_actor(run.get("actor")),
                subject_ref=ref,
                payload=payload,
                raw=run,
            )
            if run.get("status") == "completed":
                yield Event(
                    source=Source.CI,
                    source_event_id=f"run-{run['id']}-completed",
                    verb=Verb.BUILD_COMPLETED,
                    occurred_at=_ts(run.get("updated_at")) or _ts(run["created_at"]),
                    actor_ref=_actor(run.get("actor")),
                    subject_ref=ref,
                    payload=payload,
                    raw=run,
                )

    def _deployments(self) -> Iterator[Event]:
        for deployment in self._paged(f"/repos/{self.repo}/deployments", limit=100):
            dep_id = str(deployment["id"])
            ref = EntityRef("deployment", dep_id, deployment.get("environment"))
            payload = {
                "environment": deployment.get("environment"),
                "sha": deployment.get("sha"),
                "ref": deployment.get("ref"),
            }
            yield Event(
                source=self.source,
                source_event_id=f"deploy-{dep_id}",
                verb=Verb.DEPLOYMENT_CREATED,
                occurred_at=_ts(deployment["created_at"]),
                actor_ref=_actor(deployment.get("creator")),
                subject_ref=ref,
                payload=payload,
                raw=deployment,
            )

            for status in self._get(f"/repos/{self.repo}/deployments/{dep_id}/statuses", tolerate_missing=True) or []:
                state = status.get("state")
                verb = {
                    "success": Verb.DEPLOYMENT_SUCCEEDED,
                    "failure": Verb.DEPLOYMENT_FAILED,
                    "error": Verb.DEPLOYMENT_FAILED,
                }.get(state)
                if verb is None:
                    continue
                yield Event(
                    source=self.source,
                    source_event_id=f"deploy-status-{status['id']}",
                    verb=verb,
                    occurred_at=_ts(status["created_at"]),
                    actor_ref=_actor(status.get("creator")),
                    subject_ref=ref,
                    payload={**payload, "state": state},
                    raw=status,
                )
