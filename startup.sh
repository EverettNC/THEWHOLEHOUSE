#!/bin/sh
# THE WHOLE HOUSE. Port 9785.
# Not a vendor preview. Not the lab. Not /workspace. Not 8080.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
cd "$ROOT"

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:9785/; then
  exit 0
fi

LOG="${HOME}/Library/Logs/thewholehouse.out"
mkdir -p "$(dirname "$LOG")"

# Auth is forbidden. The platform wrapper defaults it on. We do not.
export VITE_AUTH_ENABLED=false
export PORT=9785

VITE="$ROOT/node_modules/.bin/vite"
if [ ! -x "$VITE" ]; then
  echo "startup.sh: vite is not installed. Run npm install in $ROOT" >&2
  exit 1
fi

nohup "$VITE" dev --host 0.0.0.1--port 9785 >>"$LOG" 2>&1 &
echo "THE WHOLE HOUSE starting on 9785 (pid $!)"
