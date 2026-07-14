# Deploy 2 thaniya? — HADI MA KHDAMCH (Darija)

**Ila Deploy khda 2-10 ثواني** = **restart فقط** — ma تبناش image جديدة → `api.botflow.ink` يبقى **502**.

---

## 3lach kaytra

| Deploy khda | المعنى |
|-------------|--------|
| **2-10 ثواني** | ❌ Restart — **ماشي build** |
| **2-5 دقائق** | ✅ Build حقيقي |

**السبب:** Source = **Docker Image** (GHCR private 401) **ولا** Deploy بدون Rebuild.

---

## ✅ HAL 1 — Docker Compose (الأضمن)

### 1. EasyPanel → **backend** → **Source**

بدّل Type l:

| Champ | Valeur |
|-------|--------|
| Type | **Docker Compose** |
| Repo | `sass-botflow/backend` |
| Branch | `main` |
| Compose file | `deploy/easypanel-backend.compose.yml` |

### 2. Environment (Save قبل Deploy)

```env
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
CACHEBUST=20260714
```

> Kol deploy: بدّل `CACHEBUST` لرقم جديد (مثلاً `20260715`) باش EasyPanel يبني من جديد.

### 3. Port + Domain

- Port: **8000**
- Domain: `api.botflow.ink` → 8000

### 4. Deploy

- استنى **2-5 دقائق**
- Logs → `==> BotFlow API starting`

---

## ✅ HAL 2 — GitHub App + Dockerfile.easypanel

Ila bghiti **App** (mashi Compose):

1. Source → **GitHub** (mashi Docker Image!)
2. Repo: `sass-botflow/backend` | Branch: `main`
3. Dockerfile: **`/Dockerfile.easypanel`**
4. Build args: `CACHEBUST=20260714` (بدّلو kol mara)
5. Port: **8000**
6. Environment: نفس JWT + EVOLUTION
7. كليكي **Rebuild** (mashi Deploy ghir) — استنى 2-5 د9ayeq

---

## ✅ HAL 3 — Terminal VPS (ila EasyPanel ma khdemch)

EasyPanel → **Server** → Terminal (wla SSH):

```bash
export JWT_SECRET='BotflowJwtSecret2026Min32CharsLong!!'
export EVOLUTION_API_KEY='BotflowEvolution2026SecureKey!'
export EVOLUTION_API_URL='http://sass-botflow_botflow-evolution:8080'
curl -fsSL https://raw.githubusercontent.com/sass-botflow/backend/main/scripts/vps-emergency-backend.sh | sudo bash
```

---

## Verif

```bash
curl -s https://api.botflow.ink/health
```

Khass JSON (mashi `502`).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401
```

---

## ❌ MA TDIRCH

| غلط | لي كيوقع |
|-----|----------|
| Source = **Docker Image** `ghcr.io/...` | Pull 401 → 2 thaniya → ma kaytbdl waloo |
| Deploy bla **Rebuild** | Image 9dima |
| Dockerfile = `/Dockerfile` | OOM/Killed f VPS |
| Deploy **botflow-evolution** | Evolution OK — **backend** howa li DOWN |

---

## Checklist

- [ ] Service = **backend** (mashi botflow-evolution)
- [ ] Source = **Compose** wla **GitHub + Dockerfile.easypanel**
- [ ] `CACHEBUST` value tbdlat
- [ ] Deploy khda **2+ دقائق**
- [ ] Logs: `BotFlow API starting`

Sift screenshot: **backend → Source** + **Logs** ila mazal 2 thaniya.
