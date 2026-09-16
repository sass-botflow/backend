# EasyPanel deploy f 10 ثواني — 7l daba

**L'mochkil:** Deploy kaykml f ~10 sec → **restart ghir**, backend ma tbdlch → 502.

**L'hal:** 3 steps f EasyPanel.

---

## Step 1 — Source (أهم حاجة)

EasyPanel → **sass-botflow** → **backend** → **Source**

| Champ | Valeur s7i7a |
|-------|--------------|
| Type | **GitHub** (ماشي Docker Image!) |
| Repo | `sass-botflow/backend` |
| Branch | `main` |
| Dockerfile | **`/Dockerfile.easypanel`** |
| Port | `8000` |

**غلط:** Docker Image `ghcr.io/...` → deploy sri3 (10s) walakin image 9dima/crash.

---

## Step 2 — Deploy Script (force rebuild)

EasyPanel → **backend** → **Deployments** → **Deploy Script**

Paste kolchi mn **`deploy/easypanel-pre-deploy.sh`**:

```bash
export CACHEBUST="$(date +%s)"
export EASYPANEL_DEPLOY="rebuild"
echo "CACHEBUST=$CACHEBUST"
```

---

## Step 3 — Environment + Deploy

1. Copy **`easypanel.env.example`** → Environment → **Save**
2. **Deploy** → khass **2-5 d9aya** (mash 10 sec)
3. Logs khass ybanu:
   ```
   easypanel build CACHEBUST=...
   runtime bundle OK: dist/modules/instagram/...
   ==> BotFlow API starting
   ==> Starting server on port 8000...
   ```

---

## Verif

```bash
curl -s https://api.botflow.ink/health
```

Khass `HTTP 200` w `buildCommit` mashi `v1.0.0-mr84xgy9`.

---

## Alternative — Docker Compose build

Source → **Docker Compose** → paste **`easypanel.docker-compose.yml`** (fih `build:` section).

GHCR pull sri3: **`easypanel.docker-compose.ghcr.yml`** (ila package public).

Guide kamla: **DEPLOY-MKHDAMCH.md**
