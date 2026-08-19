"""Check the whole system and say exactly what is wrong.

One implementation, three operating systems. The shell wrappers (`setup.sh`,
`setup.ps1`, `setup.cmd`) do only what a shell must do -- find a Python -- and
then hand over to this, so the checks cannot drift between platforms.

Every check reports one of three things: OK, a fixable problem with the command
that fixes it, or a blocked problem that needs a human decision (a credential, a
3.6GB download). Nothing is silently skipped, because a check that quietly
passes when it should not is worse than no check.

    python scripts/doctor.py            report
    python scripts/doctor.py --fix      install what can be installed
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Windows consoles default to cp1252 and cannot encode the box-drawing
# characters below. A setup script must never fail on its own output.
for _stream in (sys.stdout, sys.stderr):
    _reconfigure = getattr(_stream, "reconfigure", None)
    if _reconfigure is not None:
        _reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "demo"
WEB = ROOT / "web"
SPINE = ROOT / "spine"

GREEN, YELLOW, RED, DIM, RESET = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"
if os.name == "nt" and not os.getenv("WT_SESSION") and not os.getenv("TERM"):
    GREEN = YELLOW = RED = DIM = RESET = ""

MODELS = {
    "bge-large-en-v1.5": ("BAAI/bge-large-en-v1.5", 1.34),
    "bge-reranker-v2-m3": ("BAAI/bge-reranker-v2-m3", 2.29),
}

#: Imported by the demo service. torch and sentence-transformers are excluded
#: on purpose -- they are 2.5GB and their install varies by GPU, so they get
#: their own check and their own message.
PY_PACKAGES = [
    "fastapi", "uvicorn", "pydantic", "dotenv", "httpx", "numpy",
    "bs4", "lxml", "chromadb", "anthropic",
]

results: list[tuple[str, str, str]] = []


def report(state: str, name: str, detail: str = "") -> None:
    results.append((state, name, detail))
    mark = {"ok": f"{GREEN}ok  {RESET}", "warn": f"{YELLOW}warn{RESET}", "fail": f"{RED}fail{RESET}"}[state]
    print(f"  [{mark}] {name}")
    if detail:
        for line in detail.splitlines():
            print(f"         {DIM}{line}{RESET}")


def run(*args: str, cwd: Path | None = None) -> tuple[int, str]:
    try:
        proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=1800)
        return proc.returncode, (proc.stdout or "") + (proc.stderr or "")
    except FileNotFoundError:
        return 127, f"{args[0]} not found"
    except subprocess.TimeoutExpired:
        return 124, "timed out"


# --- checks ----------------------------------------------------------------
def check_python() -> None:
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 10):
        report("fail", f"Python {major}.{minor}", "Python 3.10 or newer is required.")
    else:
        report("ok", f"Python {major}.{minor}", str(Path(sys.executable)))


def check_node() -> None:
    node = shutil.which("node")
    if not node:
        report("fail", "Node.js", "Not on PATH. The dashboard needs Node 18+. https://nodejs.org")
        return
    code, out = run(node, "--version")
    version = out.strip().lstrip("v")
    major = int(version.split(".")[0]) if version and version[0].isdigit() else 0
    if major < 18:
        report("fail", f"Node.js {version}", "Node 18 or newer is required.")
    else:
        report("ok", f"Node.js {version}", node)


def check_torch() -> None:
    if importlib.util.find_spec("torch") is None:
        report(
            "fail", "PyTorch",
            "Not installed. It is ~2.5GB and the right build depends on your GPU:\n"
            "  NVIDIA GPU : pip install torch --index-url https://download.pytorch.org/whl/cu126\n"
            "  CPU / Mac  : pip install torch\n"
            "Then: pip install sentence-transformers transformers",
        )
        return
    import torch  # noqa: PLC0415

    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        report("ok", f"PyTorch {torch.__version__}", f"CUDA on {name} ({gb:.1f} GB)")
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        report("ok", f"PyTorch {torch.__version__}", "Apple Metal (MPS)")
    else:
        report(
            "warn", f"PyTorch {torch.__version__}",
            "CPU only. It works — a query takes roughly 10s instead of 1s.",
        )
    for package in ("sentence_transformers", "transformers"):
        if importlib.util.find_spec(package) is None:
            report("fail", package, "pip install sentence-transformers transformers")


def check_packages(fix: bool) -> None:
    missing = [p for p in PY_PACKAGES if importlib.util.find_spec(p) is None]
    if not missing:
        report("ok", "Python packages", f"{len(PY_PACKAGES)} present")
        return
    if fix:
        print(f"         {DIM}installing {', '.join(missing)}…{RESET}")
        code, out = run(sys.executable, "-m", "pip", "install", "-q", "-r", str(DEMO / "requirements.txt"))
        still = [p for p in missing if importlib.util.find_spec(p) is None]
        if still:
            report("fail", "Python packages", f"still missing: {', '.join(still)}\n{out[-400:]}")
        else:
            report("ok", "Python packages", "installed")
    else:
        report("fail", "Python packages", f"missing: {', '.join(missing)}\nFix: pip install -r demo/requirements.txt")


def model_dir(name: str) -> Path | None:
    for candidate in (
        DEMO / "models" / name,
        ROOT / "models" / name,
        ROOT.parent / "embedding" / name,
        Path.home() / ".cache" / "code2doc" / name,
    ):
        if candidate.is_dir() and any(candidate.glob("*.safetensors")):
            return candidate
    return None


def check_models(fix: bool) -> None:
    missing = {n: r for n, (r, _) in MODELS.items() if model_dir(n) is None}
    for name in MODELS:
        found = model_dir(name)
        if found:
            report("ok", name, str(found))
    if not missing:
        return

    size = sum(gb for n, (_, gb) in MODELS.items() if n in missing)
    if not fix:
        report(
            "fail", "Models",
            f"missing: {', '.join(missing)} ({size:.1f} GB to download)\n"
            "Fix: python scripts/doctor.py --fix",
        )
        return

    if importlib.util.find_spec("huggingface_hub") is None:
        run(sys.executable, "-m", "pip", "install", "-q", "huggingface_hub")
    try:
        from huggingface_hub import snapshot_download  # noqa: PLC0415
    except ImportError:
        report("fail", "Models", "pip install huggingface_hub failed; install it and retry")
        return

    target = DEMO / "models"
    target.mkdir(parents=True, exist_ok=True)
    print(f"         {DIM}downloading {size:.1f} GB into {target}…{RESET}")
    for name, repo in missing.items():
        try:
            snapshot_download(
                repo_id=repo,
                local_dir=str(target / name),
                # Skip the duplicate formats. The reference copy of
                # bge-large-en-v1.5 carries safetensors AND pytorch_model.bin
                # AND an onnx export: 8GB where 1.3GB is needed.
                ignore_patterns=["*.onnx", "*.bin", "*.h5", "*.msgpack", "onnx/*", "*.ot"],
            )
            report("ok", name, str(target / name))
        except Exception as exc:
            report("fail", name, f"download failed: {exc}")


def check_env(fix: bool) -> None:
    env, example = DEMO / ".env", DEMO / ".env.example"
    if not env.exists():
        if fix and example.exists():
            env.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
            report("warn", "demo/.env", "created from .env.example — now fill in the four credentials")
            return
        report("fail", "demo/.env", "missing. Fix: copy demo/.env.example to demo/.env")
        return

    # demo/.env first, then the spine's .env, matching what config.py does at
    # runtime — GITHUB_TOKEN normally lives there and is inherited.
    values: dict[str, str] = {}
    for path in (ROOT / ".env", env):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                if value.strip() or key.strip() not in values:
                    values[key.strip()] = value.strip()

    needed = {
        "CONFLUENCE_EMAIL": "Atlassian account email",
        "CONFLUENCE_API_TOKEN": "https://id.atlassian.com/manage-profile/security/api-tokens",
        "GITHUB_TOKEN": "read-only fine-grained PAT for the watched repository",
        "ANTHROPIC_API_KEY": "https://console.anthropic.com/settings/keys",
    }
    blank = {k: why for k, why in needed.items() if not values.get(k)}
    if blank:
        report(
            "warn", "demo/.env",
            "present, but these are blank — each disables one part of the demo:\n"
            + "\n".join(f"  {k}  {why}" for k, why in blank.items()),
        )
    else:
        report("ok", "demo/.env", f"{len(needed)} credentials set")


def check_index() -> None:
    chroma = DEMO / "data" / "chroma.sqlite3"
    docs = list((DEMO / "docs").glob("*.md"))
    if chroma.exists() and docs:
        report("ok", "Documentation index", f"{len(docs)} pages, {chroma.stat().st_size // 1024} KB index (committed)")
    elif docs:
        report("warn", "Documentation index", "pages present but no index. Fix: python -m code2doc.cli index")
    else:
        report("warn", "Documentation index", "empty. Fix: python -m code2doc.cli ingest && python -m code2doc.cli index")


def check_web(fix: bool) -> None:
    if (WEB / "node_modules").is_dir():
        report("ok", "Dashboard dependencies", "node_modules present")
        return
    if fix:
        print(f"         {DIM}npm install…{RESET}")
        npm = shutil.which("npm")
        if not npm:
            report("fail", "Dashboard dependencies", "npm not on PATH")
            return
        code, out = run(npm, "install", "--no-fund", "--no-audit", cwd=WEB)
        report("ok" if code == 0 else "fail", "Dashboard dependencies",
               "installed" if code == 0 else out[-400:])
    else:
        report("fail", "Dashboard dependencies", "Fix: cd web && npm install")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fix", action="store_true", help="install what can be installed")
    args = parser.parse_args()

    print(f"\n  code2doc — {'setup' if args.fix else 'check'}\n  {'─' * 58}")
    check_python()
    check_node()
    check_torch()
    check_packages(args.fix)
    check_models(args.fix)
    check_env(args.fix)
    check_index()
    check_web(args.fix)

    failures = [r for r in results if r[0] == "fail"]
    warnings = [r for r in results if r[0] == "warn"]
    print(f"  {'─' * 58}")
    if failures:
        print(f"  {RED}{len(failures)} blocking{RESET}, {len(warnings)} warning(s).")
        if not args.fix:
            print(f"  Run {DIM}python scripts/doctor.py --fix{RESET} to install what it can.")
        return 1
    print(f"  {GREEN}Ready.{RESET}" + (f" {len(warnings)} warning(s)." if warnings else ""))
    print(f"  Start everything with {DIM}./start.sh{RESET} (or {DIM}start.cmd{RESET} on Windows).\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
