"""Runtime configuration.

Secrets come from dashboard/.env, which is gitignored. .env.example documents
the variables. The spine holds read-only credentials by design; the
Administration:write token needed once for governance bootstrap is separate and
never used here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# spine/spine/config.py -> spine/ -> dashboard/
DASHBOARD_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = DASHBOARD_ROOT.parent

load_dotenv(DASHBOARD_ROOT / ".env")


@dataclass(slots=True, frozen=True)
class Config:
    github_token: str | None
    github_repo: str
    db_path: Path
    #: Confluence-style requirement exports live here and are read directly.
    requirements_dir: Path
    #: The subject codebase parsed into CodeUnit vertices.
    source_dir: Path
    identity_map: Path
    #: Set to also start ArcadeDB Studio alongside the read API.
    arcade_root_password: str | None

    @property
    def has_github(self) -> bool:
        return bool(self.github_token)

    @property
    def studio_enabled(self) -> bool:
        # Studio needs a root password of at least 8 characters; anything
        # shorter is rejected by the server at startup rather than at use.
        return bool(self.arcade_root_password and len(self.arcade_root_password) >= 8)


def _resolve(raw: str | None, default: Path) -> Path:
    """Relative paths resolve against the dashboard root, not the working
    directory - otherwise the database lands somewhere different depending on
    where the command was run from."""
    if not raw:
        return default
    path = Path(raw)
    return path if path.is_absolute() else (DASHBOARD_ROOT / path).resolve()


@lru_cache(maxsize=1)
def config() -> Config:
    return Config(
        github_token=os.getenv("GITHUB_TOKEN") or None,
        github_repo=os.getenv("GITHUB_REPO", "ShubhamMujumdar/payment-processing-app"),
        # ArcadeDB server mode looks for databases under <root>/databases/<name>,
        # so the embedded path follows that convention too. Otherwise the same
        # store cannot be opened both ways, and Studio would need a second copy.
        db_path=_resolve(
            os.getenv("ARCADE_DB_PATH"), DASHBOARD_ROOT / "data" / "databases" / "spine"
        ),
        requirements_dir=REPO_ROOT / "docs" / "requirements",
        source_dir=REPO_ROOT / "app_src",
        identity_map=DASHBOARD_ROOT / "identity_map.yaml",
        arcade_root_password=os.getenv("ARCADE_ROOT_PASSWORD") or None,
    )
