#!/usr/bin/env bash
# Install everything the demo needs, checking before it acts.
# macOS and Linux. Finds a Python 3.10+ and hands over to scripts/doctor.py.
set -euo pipefail
cd "$(dirname "$0")"

PY=""
for candidate in python3.14 python3.13 python3.12 python3.11 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
      PY="$candidate"; break
    fi
  fi
done

if [ -z "$PY" ]; then
  echo "No Python 3.10 or newer found on PATH." >&2
  echo "  macOS : brew install python@3.12" >&2
  echo "  Ubuntu: sudo apt install python3.12 python3.12-venv" >&2
  exit 1
fi

exec "$PY" scripts/doctor.py --fix "$@"
