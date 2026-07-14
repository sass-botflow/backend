# DEPLOY DABA — 3 dakika (ila Deploy ma khdamch)

**Daba:** backend **DOWN** (port 8000 ma kaynach f VPS). GHCR **private** → Docker Image ma katjibch.

---

## ✅ الحل — Dockerfile.easypanel (bla compile f VPS)

GitHub Actions كيبني l-code. VPS كيجيب ghir bundle — **ma kaycrashch b RAM**.

### EasyPanel (copy-paste)

1. http://187.124.12.89:3000 → **sass-botflow** → **backend**

2. **Source:**
   - Type = **GitHub**
   - Repo = `sass-botflow/backend`
   - Branch = **`main`**
   - Dockerfile = **`/Dockerfile.easypanel`** ← مهم!
   - Port = **8000**

3. **Environment** — paste mn `easypanel.env.example` → **Save**

4. **Deploy** → استنى **2-3 دقائق** (ماشي 5 ثواني!)

5. Logs → `BotFlow API starting`

### Verif

```bash
curl -s https://api.botflow.ink/health
```

---

## Ila mazal ma khdemch

### A — Force Rebuild
EasyPanel → backend → Deploy → **Rebuild** (ماشي restart)

### B — SSH emergency (ila 3ndek accès VPS)

```bash
export JWT_SECRET='BotflowJwtSecret2026Min32CharsLong!!'
export EVOLUTION_API_KEY='BotflowEvolution2026SecureKey!'
curl -fsSL https://raw.githubusercontent.com/sass-botflow/backend/main/scripts/vps-emergency-backend.sh | sudo bash
```

### C — GHCR Registry PAT
Ila Source = Docker Image:
1. GitHub PAT → scope `read:packages`
2. EasyPanel → Registry → `ghcr.io` + username + PAT
3. Image = `ghcr.io/sass-botflow/backend:latest`

---

## Auto-deploy (مرة واحدة)

1. EasyPanel → backend → **Deployments** → copier **Deployment Trigger** URL
2. GitHub → https://github.com/sass-botflow/backend/settings/secrets/actions
3. New secret: `EASYPANEL_BACKEND_DEPLOY_WEBHOOK` = URL li copiti
4. Kol push l `main` → auto deploy

---

شوف كامل: `DEPLOY-MKHDAMCH.md`
