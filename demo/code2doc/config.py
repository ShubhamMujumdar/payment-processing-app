"""Configuration, resolved once from demo/.env.

Paths are resolved against the demo directory rather than the process working
directory, so the CLI and the API behave identically no matter where they are
launched from.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

DEMO_ROOT = Path(__file__).resolve().parent.parent


def _resolve(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else (DEMO_ROOT / path).resolve()


#: Where model directories are looked for, in order, when the environment does
#: not name one that exists. Searched rather than assumed: this runs on three
#: operating systems with different checkout layouts, and a hardcoded relative
#: path is the first thing to break on someone else's machine.
MODEL_SEARCH_PATHS = [
    "./models/{name}",          # inside demo/ — where setup puts them
    "../models/{name}",
    "../../embedding/{name}",   # the original workspace layout
    "../embedding/{name}",
    "~/.cache/code2doc/{name}",
]


def _find_model(env_value: str, name: str) -> Path:
    """First candidate that exists; otherwise the first, for the error message."""
    candidates = ([env_value] if env_value else []) + [
        p.format(name=name) for p in MODEL_SEARCH_PATHS
    ]
    for candidate in candidates:
        if _resolve(candidate).is_dir():
            return _resolve(candidate)
    return _resolve(candidates[0])


def _find_file(*candidates: str) -> Path | None:
    for candidate in candidates:
        path = _resolve(candidate)
        if path.is_file():
            return path
    return None


def _find_dir(*candidates: str) -> Path | None:
    for candidate in candidates:
        path = _resolve(candidate)
        if path.is_dir():
            return path
    return None


@dataclass(frozen=True)
class Config:
    base_url: str
    email: str
    api_token: str
    space_key: str
    embedding_model: Path
    reranker_model: Path
    device: str
    api_port: int

    github_token: str
    github_repo: str
    watch_branch: str
    poll_seconds: float

    docs_dir: Path
    data_dir: Path

    @property
    def runs_db(self) -> Path:
        return self.data_dir / "runs.sqlite"

    @property
    def has_github(self) -> bool:
        return bool(self.github_token and self.github_repo)

    @property
    def has_confluence(self) -> bool:
        return bool(self.base_url and self.email and self.api_token)

    def require_confluence(self) -> None:
        if not self.has_confluence:
            raise RuntimeError(
                "Confluence credentials missing. Copy demo/.env.example to "
                "demo/.env and fill in CONFLUENCE_EMAIL and "
                "CONFLUENCE_API_TOKEN. Until then, use `--source local` to "
                "index the checked-in requirement documents instead."
            )

    def resolved_device(self) -> str:
        if self.device != "auto":
            return self.device
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"


@lru_cache(maxsize=1)
def config() -> Config:
    load_dotenv(DEMO_ROOT / ".env")
    # The spine already holds a read-only GitHub token; fall back to it rather
    # than making the same credential exist in two files that can drift apart.
    spine_env = _find_file("../.env", "../dashboard/.env", "../../dashboard/.env")
    if spine_env:
        load_dotenv(spine_env, override=False)
    docs = DEMO_ROOT / "docs"
    data = DEMO_ROOT / "data"
    docs.mkdir(exist_ok=True)
    data.mkdir(exist_ok=True)
    return Config(
        base_url=os.getenv("CONFLUENCE_BASE_URL", "").rstrip("/"),
        email=os.getenv("CONFLUENCE_EMAIL", ""),
        api_token=os.getenv("CONFLUENCE_API_TOKEN", ""),
        space_key=os.getenv("CONFLUENCE_SPACE_KEY", ""),
        embedding_model=_find_model(os.getenv("EMBEDDING_MODEL_PATH", ""), "bge-large-en-v1.5"),
        reranker_model=_find_model(os.getenv("RERANKER_MODEL_PATH", ""), "bge-reranker-v2-m3"),
        device=os.getenv("DEVICE", "auto"),
        api_port=int(os.getenv("API_PORT", "8099")),
        github_token=os.getenv("GITHUB_TOKEN", ""),
        github_repo=os.getenv("GITHUB_REPO", ""),
        watch_branch=os.getenv("WATCH_BRANCH", "development"),
        # Fast by default: this exists to make a commit visible on a dashboard
        # while someone is watching, not to be polite to the rate limiter. One
        # poll is a single API call against 5000/hour.
        poll_seconds=float(os.getenv("POLL_SECONDS", "3")),
        docs_dir=docs,
        data_dir=data,
    )
