"""Start and stop the three services.

    python scripts/run.py start     spine :8077 · code2doc :8099 · dashboard :5173
    python scripts/run.py stop
    python scripts/run.py status

One implementation for Windows, macOS and Linux. Process handling is the part
that differs most between them, so it lives here once rather than three times in
shell.

Services are started detached with their output to `logs/`, and their PIDs
written to `logs/*.pid`. That is deliberately simple: no supervisor, no
container, nothing to install. `stop` reads the pid files, and also checks the
ports, because a process killed by hand leaves a stale pid file behind and the
next `start` should not be blocked by it.

The web/dashboard service is launched in *live* mode pointed at the spine
(VITE_SPINE_MODE=live, VITE_SPINE_URL=http://127.0.0.1:8077) so the graph,
delivery and traceability views traverse the real record rather than the stub
fallback. Override either value in the environment before calling `start` if you
need stub mode or a different spine URL.
"""
from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    _reconfigure = getattr(_stream, "reconfigure", None)
    if _reconfigure is not None:
        _reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "logs"
WINDOWS = os.name == "nt"

DIM, GREEN, RED, RESET = "\033[2m", "\033[32m", "\033[31m", "\033[0m"

# The spine's read API. The dashboard is pointed here in live mode so the
# graph/delivery/traceability views traverse the real record.
SPINE_PORT = 8077
SPINE_URL = f"http://127.0.0.1:{SPINE_PORT}"


class Service:
    def __init__(self, name: str, port: int, cwd: Path, args: list[str], why: str,
                 env: dict[str, str] | None = None):
        self.name, self.port, self.cwd, self.args, self.why = name, port, cwd, args, why
        # Per-service environment overrides, merged on top of the process env at
        # launch. Used to force the dashboard into live mode without touching the
        # committed .env files.
        self.env = env or {}

    @property
    def pid_file(self) -> Path:
        return LOGS / f"{self.name}.pid"

    @property
    def log_file(self) -> Path:
        return LOGS / f"{self.name}.log"


def python_for(service_dir: Path) -> str:
    """A service's own virtualenv if it has one, else the interpreter running us.

    The spine keeps its dependencies (ArcadeDB, tree-sitter) in `spine/.venv`,
    while code2doc uses whichever interpreter has torch. Assuming one Python for
    both is how the spine ends up failing on `tree_sitter_java` at startup.
    """
    candidate = service_dir / ".venv" / ("Scripts" if WINDOWS else "bin") / ("python.exe" if WINDOWS else "python")
    return str(candidate) if candidate.exists() else sys.executable


def services(watch: bool, branch: str | None) -> list[Service]:
    code2doc = [python_for(ROOT / "demo"), "-u", "-m", "code2doc.cli", "serve"]
    if watch:
        code2doc.append("--watch")
    return [
        Service("spine", SPINE_PORT, ROOT / "spine",
                [python_for(ROOT / "spine"), "-u", "-m", "spine.cli", "serve"],
                "the delivery record: work packets, custody, traceability"),
        Service("code2doc", 8099, ROOT / "demo", code2doc,
                "documentation impact: watches commits, drafts redlines"),
        Service("web", 5173, ROOT / "web",
                ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
                "the dashboard",
                env={
                    # Force live traversal against the spine. Only set as a
                    # default -- if the caller already exported these, respect
                    # their choice (see merge in start()).
                    "VITE_SPINE_MODE": "live",
                    "VITE_SPINE_URL": SPINE_URL,
                }),
    ]


def port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def read_pid(service: Service) -> int | None:
    if not service.pid_file.exists():
        return None
    try:
        pid = int(service.pid_file.read_text().strip())
    except ValueError:
        return None
    return pid if alive(pid) else None


def alive(pid: int) -> bool:
    if WINDOWS:
        out = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
            capture_output=True, text=True,
        ).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists, owned by someone else


REBUILD_STEPS = [
    (ROOT / "spine", ["-m", "spine.cli", "ingest"], "pull live sources into the event log"),
    (ROOT / "spine", ["-m", "spine.cli", "codegraph"], "parse the subject repository"),
    (ROOT / "spine", ["-m", "spine.cli", "reproject"], "rebuild the graph from the log"),
    (ROOT / "demo", ["-m", "code2doc.cli", "ingest", "--source", "confluence"], "pull Confluence pages"),
    (ROOT / "demo", ["-m", "code2doc.cli", "index"], "chunk, embed and store"),
]


def rebuild() -> int:
    """Re-derive everything from its sources.

    The documentation index is committed, so retrieval works on a fresh clone
    with no credentials. The ArcadeDB graph is not -- it is a live database
    directory, so `data/` stays ignored -- which means a fresh clone must run
    this once, with a GITHUB_TOKEN that can read the subject repository, before
    the delivery and traceability views have anything to show.
    """
    for cwd, args, why in REBUILD_STEPS:
        print(f"  {DIM}{why}…{RESET}")
        done = subprocess.run(
            [python_for(cwd), *args], cwd=cwd, capture_output=True, text=True,
        )
        if done.returncode != 0:
            tail = (done.stdout or "")[-500:] + (done.stderr or "")[-500:]
            print(f"  {RED}✗{RESET} {' '.join(args)}")
            print(tail)
            return 1
        lines = [l for l in (done.stdout or "").strip().splitlines() if l.strip()]
        print(f"    {DIM}{lines[-1][:90] if lines else 'done'}{RESET}")
    return 0


def start(watch: bool, branch: str | None) -> int:
    LOGS.mkdir(exist_ok=True)
    base_env = dict(os.environ)
    if branch:
        base_env["WATCH_BRANCH"] = branch
    for service in services(watch, branch):
        if port_busy(service.port):
            print(f"  {DIM}·{RESET} {service.name:9} already running on :{service.port}")
            continue
        if not service.cwd.is_dir():
            print(f"  {RED}✗{RESET} {service.name:9} missing directory {service.cwd}")
            continue
        # Merge per-service env on top of the process env. Values the caller
        # already exported win, so `set VITE_SPINE_MODE=stub` still takes effect.
        env = dict(base_env)
        for key, value in service.env.items():
            env.setdefault(key, value)
        with open(service.log_file, "w", encoding="utf-8") as log:
            kwargs: dict = {"cwd": service.cwd, "stdout": log, "stderr": subprocess.STDOUT, "env": env}
            if WINDOWS:
                # Detach so closing this terminal does not take the service with
                # it, and so Ctrl-C here does not reach it.
                kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | 0x00000008
            else:
                kwargs["start_new_session"] = True
            # npm is a shell script on Windows; shell=True would be needed, so
            # resolve it properly instead of guessing.
            args = list(service.args)
            if args[0] == "npm":
                import shutil
                npm = shutil.which("npm")
                if not npm:
                    print(f"  {RED}✗{RESET} {service.name:9} npm not on PATH")
                    continue
                args[0] = npm
            process = subprocess.Popen(args, **kwargs)
        service.pid_file.write_text(str(process.pid))
        extra = ""
        if service.name == "web":
            extra = f"  {DIM}→ live @ {SPINE_URL}{RESET}"
        print(f"  {GREEN}▸{RESET} {service.name:9} :{service.port}  {DIM}{service.why}{RESET}{extra}")

    print(f"\n  waiting for services{DIM}…{RESET}")
    deadline = time.time() + 90
    pending = {s.name: s for s in services(watch, branch)}
    while pending and time.time() < deadline:
        for name, service in list(pending.items()):
            if port_busy(service.port):
                print(f"  {GREEN}✓{RESET} {name:9} http://127.0.0.1:{service.port}")
                del pending[name]
        time.sleep(1)
    for name, service in pending.items():
        print(f"  {RED}✗{RESET} {name:9} did not come up — see {service.log_file}")
    if not pending:
        print(f"\n  Dashboard   {GREEN}http://127.0.0.1:5173{RESET}  {DIM}(live){RESET}")
        print(f"  Spine API   {DIM}{SPINE_URL}{RESET}")
        print(f"  code2doc    {DIM}http://127.0.0.1:8099/docs{RESET}")
        env_file = ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("ARCADE_ROOT_PASSWORD=") and len(line.split("=", 1)[1].strip()) >= 8:
                    print(f"  ArcadeDB    {DIM}http://localhost:2480  (user 'root'){RESET}")
                    break
        print(f"  {DIM}Logs in {LOGS}{RESET}\n")
    return 1 if pending else 0


def _pid_on_port(port: int) -> int | None:
    """Return the PID of whatever process is listening on *port*, or None."""
    if WINDOWS:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True,
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                try:
                    return int(parts[-1])
                except (ValueError, IndexError):
                    pass
        return None
    # macOS / Linux
    result = subprocess.run(
        ["lsof", "-ti", f"tcp:{port}"],
        capture_output=True, text=True,
    )
    try:
        return int(result.stdout.strip().splitlines()[0])
    except (ValueError, IndexError):
        return None


def stop(watch: bool = False) -> int:
    stopped = 0
    for service in services(watch, None):
        pid = read_pid(service)
        if pid:
            try:
                if WINDOWS:
                    subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
                else:
                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                print(f"  {GREEN}■{RESET} {service.name:9} stopped (pid {pid})")
                stopped += 1
            except Exception as exc:
                print(f"  {RED}✗{RESET} {service.name:9} {exc}")
        elif port_busy(service.port):
            stale_pid = _pid_on_port(service.port)
            if stale_pid:
                try:
                    if WINDOWS:
                        subprocess.run(["taskkill", "/PID", str(stale_pid), "/T", "/F"], capture_output=True)
                    else:
                        os.kill(stale_pid, signal.SIGTERM)
                    print(f"  {GREEN}■{RESET} {service.name:9} stopped stale pid {stale_pid} on :{service.port}")
                    stopped += 1
                except Exception as exc:
                    print(f"  {RED}✗{RESET} {service.name:9} could not kill stale pid {stale_pid}: {exc}")
            else:
                print(f"  {DIM}·{RESET} {service.name:9} port :{service.port} busy but pid unknown — left alone")
        service.pid_file.unlink(missing_ok=True)
    if not stopped:
        print(f"  {DIM}nothing was running{RESET}")
    return 0


def status(watch: bool = False) -> int:
    print()
    for service in services(watch, None):
        up = port_busy(service.port)
        mark = f"{GREEN}up  {RESET}" if up else f"{DIM}down{RESET}"
        print(f"  [{mark}] {service.name:9} :{service.port}  {DIM}{service.why}{RESET}")
    print()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["start", "stop", "restart", "status"])
    parser.add_argument("--no-watch", action="store_true", help="do not watch the git branch")
    parser.add_argument("--branch", help="branch to watch (default: WATCH_BRANCH in .env)")
    parser.add_argument("--rebuild", action="store_true",
                        help="re-ingest and re-index before starting (slow; both are committed)")
    args = parser.parse_args()

    watch = not args.no_watch

    if args.command == "status":
        return status()
    if args.command == "stop":
        return stop()
    if args.command == "restart":
        stop()
        time.sleep(1.5)
    if args.rebuild and rebuild() != 0:
        return 1
    return start(watch, args.branch)


if __name__ == "__main__":
    raise SystemExit(main())
