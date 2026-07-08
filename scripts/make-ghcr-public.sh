#!/usr/bin/env bash
# Run ONCE as sass-botflow org owner (human account with package admin).
# Makes ghcr.io/sass-botflow/backend:latest pullable by EasyPanel without Registry PAT.
set -euo pipefail

ORG=sass-botflow
PKG=backend

echo "==> Checking anonymous pull..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" -I \
  "https://ghcr.io/v2/${ORG}/${PKG}/manifests/latest")
echo "HTTP $CODE"

if [ "$CODE" = "200" ]; then
  echo "OK: image already public"
  exit 0
fi

echo "==> Making package public via GitHub CLI..."
if ! command -v gh >/dev/null; then
  echo "Install gh: https://cli.github.com/"
  exit 1
fi

for NAME in "$PKG" "${ORG}%2F${PKG}" "${ORG}/${PKG}"; do
  if gh api -X PUT \
    "/orgs/${ORG}/packages/container/${NAME}/visibility" \
    -f visibility=public 2>/dev/null; then
    echo "OK: package ${NAME} is now public"
    break
  fi
done

CODE=$(curl -s -o /dev/null -w "%{http_code}" -I \
  "https://ghcr.io/v2/${ORG}/${PKG}/manifests/latest")
echo "After fix: HTTP $CODE"
if [ "$CODE" != "200" ]; then
  echo "FAIL: open https://github.com/orgs/${ORG}/packages → backend → Public"
  exit 1
fi
echo "Done. EasyPanel can now pull ghcr.io/${ORG}/${PKG}:latest"
