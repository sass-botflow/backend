#!/usr/bin/env bash
# Minimal WhatsApp QR fix for sass-botflow/frontend main (keeps diagnostics route).
# Run from frontend repo root: bash /path/to/backend/patches/apply-frontend-minimal-fix.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f src/lib/whatsapp/evolution-server.ts ]; then
  echo "ERROR: run from sass-botflow/frontend repo root"
  exit 1
fi

cp "$ROOT/patches/frontend-whatsapp/src/lib/whatsapp/whatsapp-bff.ts" \
  src/lib/whatsapp/whatsapp-bff.ts

# URL candidates only — do not overwrite testEvolutionConnectivity / diagnostics
python3 - <<'PY'
from pathlib import Path

path = Path("src/lib/whatsapp/evolution-server.ts")
text = path.read_text()

old = '''function getEvolutionBaseUrlCandidates(): string[] {
  const envUrl =
    process.env.EVOLUTION_API_URL?.trim() ||
    process.env.EVOLUTION_API_BASE_URL?.trim();

  const candidates = [
    "https://evolution.api.botflow.ink",
    envUrl,
    "http://sass-botflow_evolution-api:8080",
    "http://sass-botflow_botflow-evolution:8080",
  ].filter((value): value is string => Boolean(value));'''

new = '''function getEvolutionBaseUrlCandidates(): string[] {
  const candidates = [
    process.env.EVOLUTION_API_URL?.trim(),
    process.env.EVOLUTION_API_BASE_URL?.trim(),
    "http://sass-botflow_evolution-api:8080",
  ].filter((value): value is string => Boolean(value));'''

if old not in text:
    if new.split("const candidates")[1][:80] in text:
        print("evolution-server.ts already patched")
    else:
        raise SystemExit("evolution-server.ts layout changed — apply whatsapp-bff.ts manually")
else:
    path.write_text(text.replace(old, new, 1))
    print("patched evolution-server.ts URL candidates")
PY

for f in easypanel.env.example EASYPANEL.txt; do
  if [ -f "$f" ]; then
    sed -i 's|EVOLUTION_API_URL=https://evolution.api.botflow.ink|EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080|g' "$f"
  fi
done

echo "Done. Commit, push, redeploy frontend:"
echo "  git add -A && git commit -m 'fix: WhatsApp QR backend-first + internal Evolution URL' && git push"
