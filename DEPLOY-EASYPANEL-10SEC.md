# EasyPanel deploy f 10 ثواني — 7l daba

> **Deploy stuck 2 hours w CPU 0%?** → **[DEPLOY-STUCK-2H.md](./DEPLOY-STUCK-2H.md)** ← Kill + dir hadchi

**L'mochkil:** Deploy kaykml f ~10 sec → **restart ghir**, backend ma tbdlch → 502.

**L'hal:** 3 steps f EasyPanel.

---

## Step 1 — Source (أهم حاجة)

EasyPanel → **sass-botflow** → **backend** → **Source**

| Champ | Valeur s7i7a |
|-------|--------------|
| Type | **GitHub** (mash Docker Image wla Compose build!) |
| Repo | `sass-botflow/backend` |
| Branch | `main` |
| Build method | **Dockerfile** |
| Dockerfile | **`/Dockerfile.easypanel`** |
| Port | `8000` |

**⚠️ Docker Compose + `build:`** kayt3laq f VPS (2 hours, CPU 0%) — st3mel GitHub Dockerfile.

**Ghalet:** Docker Image `ghcr.io/...` bla Registry → deploy 10s restart.

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

**⚠️ 3la VPS BotFlow kayt3laq (2h, CPU 0%) — ma tst3melch.** St3mel GitHub + `/Dockerfile.easypanel` (Step 1).

Ila bghiti Compose: **`easypanel.docker-compose.yml`** — walakin GitHub Dockerfile a7san.

GHCR pull sri3: **`easypanel.docker-compose.ghcr.yml`** (ila package public + Registry PAT).

Guide kamla: **DEPLOY-MKHDAMCH.md**
