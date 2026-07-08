#!/usr/bin/env bash
# Apply WhatsApp QR fixes to sass-botflow/frontend (run from frontend repo root)
set -euo pipefail

PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)/patches/frontend-whatsapp"

if [ ! -d "$PATCH_DIR/src" ]; then
  echo "ERROR: patches not found at $PATCH_DIR"
  exit 1
fi

echo "Applying WhatsApp QR patches from backend repo..."
cp -R "$PATCH_DIR/src/"* ./src/
echo "Done. Commit and deploy frontend:"
echo "  git add -A && git commit -m 'Fix WhatsApp QR flow (Qunvert-style)' && git push"
