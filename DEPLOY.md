# Deploy backend f main — guide sari3 (EasyPanel)

Production daba kayخدم **image qdima** (`buildCommit: v1.0.0-mr84xgy9`).  
Hadi **machi** code jdid. Khassk tbeddel **source** f EasyPanel.

## 3 mochkil li kaybloquiw deploy

| Mochkil | 3lach | Fix |
|---------|-------|-----|
| Deploy kaykhlas f **5 secondes** | EasyPanel kay-restart container bla ma ybni/pull image jdida | Switch l **Docker Compose** (ta7t) |
| GHCR image **private** (401) | EasyPanel ma y9drch ypull `ghcr.io/sass-botflow/backend` | Dir package **Public** (marra wahda) |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` ma kaynach | Image jdid ghadi ycrash f start | Zid env var f EasyPanel **9bel** deploy |

---

## Step 1 — GitHub Actions (automatic)

Kol push l `main` kaybni image f GitHub Actions → **Build and Push Backend Image**.

1. GitHub → `sass-botflow/backend` → **Actions**
2. Tssena workflow **ykoun green** 3la `main`
3. Image: `ghcr.io/sass-botflow/backend:latest`

---

## Step 2 — GHCR Public (marra wahda)

1. https://github.com/orgs/sass-botflow/packages
2. Click **backend** (container package)
3. **Package settings** → **Change visibility** → **Public**

Ila ma l9itch package: tssena Actions ykoun green, w 3awd.

**Alternative (ila bghiti private):**  
EasyPanel → Project → **Registry** → ghcr.io + GitHub PAT (`read:packages`)

---

## Step 3 — EasyPanel: beddel source (MOHIM)

### ❌ Ma tst3mlch: GitHub source + Dockerfile

Deploy kaykhlas f 5s = **ma kaybnych image jdida**.

### ✅ St3mel: Docker Compose

1. EasyPanel → http://187.124.12.89:3000 → project **sass-botflow**
2. **Delete** service `backend` l9dim (ila kayn) — wla stop
3. **+ Service** → **Docker Compose**
4. Copy **kolchi** mn file `easypanel.docker-compose.yml` f repo
5. Domain: `api.botflow.ink` → port **8000**

---

## Step 4 — Environment variables (EasyPanel)

F **Environment** → Save **9bel** Deploy:

```env
JWT_SECRET=<32+ chars random>
META_APP_SECRET=<mn Meta Developer Console>
TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32>
META_EMBEDDED_SIGNUP_CONFIG_ID=1353028573456188
```

Kolchi khur kayn deja f compose file.

---

## Step 5 — Deploy

1. Click **Deploy**
2. Tssena **1–2 minutes** (pull image) — **machi 5 seconds**
3. Logs:

```
==> Build Commit: 4727499...  (machi v1.0.0-mr84xgy9)
==> META_EMBEDDED_SIGNUP_CONFIG_ID exists: true
```

---

## Step 6 — Verify

```bash
curl -s https://api.botflow.ink/health | python3 -m json.tool
```

| Field | Khass ykon |
|-------|------------|
| `buildCommit` | **machi** `v1.0.0-mr84xgy9` |
| `embeddedSignupConfigId` | `true` |
| `whatsappReady` | `true` |
| `config.evolution` | **ma kaynach** |

```bash
curl -s -X POST https://api.botflow.ink/api/channels/whatsapp/complete \
  -H "Content-Type: application/json" \
  -d '{"code":"test","state":"test"}'
```

Khass: `Invalid or expired OAuth state` — **machi** `business_id should not be empty`

Jdid code kayrje3 aydaan:
- `{ "status": "needs_waba", "action": "CREATE_WABA" }` — user ma kamelch WABA f Meta popup
- `{ "status": "needs_phone", "action": "ADD_PHONE_NUMBER" }` — WABA kayn, phone mazal
- `{ "status": "connected", "connected": true, ... }` — kolchi mzyan

Wla run:

```bash
bash scripts/verify-whatsapp-stack.sh
```

---

## Auto-deploy (optional)

1. EasyPanel → backend → Deploy → copy **Deploy Webhook URL**
2. GitHub → repo → Settings → Secrets → Actions
3. Add: `EASYPANEL_BACKEND_DEPLOY_WEBHOOK` = URL
4. Kol push `main` → auto redeploy

---

## Ila mazal ma khdemch

1. Actions green 3la main?
2. GHCR package Public?
3. EasyPanel source = **Docker Compose** (machi GitHub)?
4. Deploy = 1–2 min (machi 5s)?
5. `META_EMBEDDED_SIGNUP_CONFIG_ID` set?
6. Logs → `ERROR:` lines?
