# 502 FIX — 3 CLICKS (copy exact)

Ma tssennch. Dir ghir had 3 hajjat f EasyPanel:

---

## CLICK 1 — Kill
**backend** → **Deployments** → **Kill** (kolchi running)

---

## CLICK 2 — Source
**backend** → **Source** → badel l:

```
GitHub
Repo: sass-botflow/backend
Branch: main
Dockerfile: /Dockerfile.easypanel
Port: 8000
```

**SAVE**

---

## CLICK 3 — Environment + Deploy

**Environment** → delete kolchi → paste:

```
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
EVOLUTION_API_URL=http://sass-botflow_botflow-evolution:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
BACKEND_URL=https://api.botflow.ink
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

**SAVE** → **DEPLOY** → wait **2 min**

Test: https://api.botflow.ink/health

---

## Ila bghiti ana ndeploy lik (Cursor agent)

Sift li **Deployment Trigger URL** mn:
EasyPanel → backend → Deployments → copy link

Format: `http://187.124.12.89:3000/api/deploy/XXXXXXXX`

Ana ndir deploy mn hna b curl.
