# Deploy stuck 2 hours? — Kill + dir hadchi (Darija)

**Symptom:** EasyPanel → Deployments → deploy kaybqa **ساعات** w CPU/Memory = **0.0%**.

**Ma3na:** Build **ma kaybda-ch** (zombie job). Ma tssennach — **Kill** daba.

---

## Step 0 — Kill (daba)

1. EasyPanel → **backend** → **Deployments**
2. 3la deploy li kaybqa (2 hours) → **Kill**
3. Ila mazal stuck → **Stop** service → **Start**

---

## Step 1 — Badel Source (Compose build kay3tlaq 3la VPS)

**Ma tst3melch Docker Compose + build** f had VPS — kayt3laq (2h, CPU 0%).

EasyPanel → **backend** → **Source**:

| Champ | Valeur |
|-------|--------|
| Type | **GitHub** |
| Repo | `sass-botflow/backend` |
| Branch | `main` |
| Build | **Dockerfile** (mash Compose!) |
| Dockerfile path | **`/Dockerfile.easypanel`** |
| Port | `8000` |

**Save** Source.

---

## Step 2 — Environment

Copy **`easypanel.env.example`** → Environment → **Save**.

Khass ykon 3ndek:
- `JWT_SECRET`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`

---

## Step 3 — Deploy

1. **Deploy** (bla Deploy Script ila bghiti — optional)
2. Khass **3-8 d9aya max** (tchuf f Logs):
   ```
   ==> [1/3] npm ci...
   ==> [2/3] download runtime-bundle...
   ==> [3/3] validate dist...
   ==> BotFlow API starting
   ```
3. **Ila >15 d9aya w CPU 0%** → **Kill** w 3awd Step 1 (verify Source = GitHub Dockerfile)

---

## Hal sri3 (ila GitHub build kayfail)

GitHub Actions kaybni image ✅ — EasyPanel kaypull ghir:

1. GitHub → org **sass-botflow** → Packages → **backend** → **Public** (once)
   - wla Registry PAT: EasyPanel → backend → Registry → `ghcr.io` + PAT `read:packages`
2. Source → **Docker Image** → `ghcr.io/sass-botflow/backend:latest`
3. Port `8000` → Deploy → **1-2 d9aya**

Wla run: https://github.com/sass-botflow/backend/actions/workflows/deploy-now.yml

---

## Verif

```bash
curl -s https://api.botflow.ink/health
```

Khass **200** (wla degraded mashi 502/522).

---

## 3a9l ma dirch

| ❌ Ghalet | ✅ S7i7 |
|----------|--------|
| Docker Compose + `build:` (kayt3laq 2h) | GitHub + `/Dockerfile.easypanel` |
| Tssenn 2 hours | Kill + redeploy |
| Deploy 8 sec (restart) | Deploy 3-8 min (build) wla 1-2 min (GHCR pull) |
