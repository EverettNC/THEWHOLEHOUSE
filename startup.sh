#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
# Grok preview pipe. The house itself is 9785. 8080 is the lab.
node scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port 8080 >>/tmp/app-startup.log 2>&1 &
