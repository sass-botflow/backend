#!/usr/bin/env bash
# Apply Instagram channel UI patches to sass-botflow/frontend
set -euo pipefail

FRONTEND_DIR="${1:-../frontend}"
PATCH_DIR="$(cd "$(dirname "$0")/frontend-instagram" && pwd)"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Usage: $0 /path/to/frontend"
  exit 1
fi

cp "$PATCH_DIR/src/components/channels/instagram-channels-section.tsx" \
  "$FRONTEND_DIR/src/components/channels/instagram-channels-section.tsx"

echo "Applied Instagram UI patch."
echo ""
echo "Add to channels page (e.g. channels-dashboard.tsx):"
echo '  import { InstagramChannelsSection } from "@/components/channels/instagram-channels-section";'
echo '  <InstagramChannelsSection />'
echo ""
echo "Ensure /api/channels/instagram proxies to backend."
