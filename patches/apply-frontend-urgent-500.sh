#!/usr/bin/env bash
# Fix site-wide HTTP 500 when Clerk env is missing on EasyPanel frontend.
set -euo pipefail

PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)/patches/frontend-urgent-500"

if [ ! -f "$PATCH_DIR/proxy.ts" ]; then
  echo "ERROR: patch not found at $PATCH_DIR/proxy.ts"
  exit 1
fi

echo "Applying urgent 500 fix to frontend..."
cp "$PATCH_DIR/proxy.ts" ./src/proxy.ts
echo "Done. Commit, push, redeploy frontend:"
echo "  git add src/proxy.ts && git commit -m 'fix: site 500 when Clerk env missing' && git push"
