# Instagram OAuth — 7l "URL bloquée" (Meta)

F screenshot dyalek, Facebook kaygoul:
- **URL bloquée** — `redirect_uri` ma mregisterach
- **Domaine non inscrit** — `botflow.ink` ma f App Domains

`redirect_uri` li kayban: `https://www.botflow.ink/api/auth/instagram/callback`

---

## 1. Meta Developer Console

دخل: https://developers.facebook.com/apps → **app dyalek** (ID: `1811541566932500`)

### A) Settings → Basic

| Champ | Value |
|-------|-------|
| **App Domains** | `botflow.ink` |

Save.

### B) Use cases / Products → Facebook Login → Settings  
(ou **Facebook Login for Business** → Settings)

| Champ | Value |
|-------|-------|
| **Client OAuth Login** | Yes ✅ |
| **Web OAuth Login** | Yes ✅ |
| **Valid OAuth Redirect URIs** | زيد **الاثنين** (سطر بسطر): |

```
https://api.botflow.ink/api/auth/instagram/callback
https://www.botflow.ink/api/auth/instagram/callback
```

> **مهم:** نفس URL بالضبط — https, بلا `/` فالآخر, نفس subdomain.

Save Changes.

### C) Instagram product

تأكد **Instagram API** / **Instagram Basic Display** أو **Instagram Messaging** مفعّل حسب use case ديالك.

---

## 2. EasyPanel → backend → Environment

خاص `META_REDIRECT_URI` **يطابق** واحد من URIs فوق:

**Option A — API (مفضل):**
```env
BACKEND_URL=https://api.botflow.ink
META_REDIRECT_URI=https://api.botflow.ink/api/auth/instagram/callback
```

**Option B — Frontend proxy (ila frontend كيوجه /api ل backend):**
```env
META_REDIRECT_URI=https://www.botflow.ink/api/auth/instagram/callback
```

```env
META_APP_ID=1811541566932500
META_APP_SECRET=your_secret_here
META_GRAPH_API_VERSION=v21.0
```

Save → **Deploy** backend.

---

## 3. Frontend — link Instagram

**مفضل (API direct):**
```
https://api.botflow.ink/api/auth/instagram?token=USER_JWT
```

**ila كتستعمل www:**
```
https://www.botflow.ink/api/auth/instagram?token=USER_JWT
```

`token` = JWT ديال user logged in (نفس `JWT_SECRET` f backend w frontend).

---

## 4. Meta Business — Instagram Business

Account خاصو يكون **Instagram Business** مربوط ب **Facebook Page**:
- Meta Business Suite → Pages → Link Instagram

---

## 5. Verif

```bash
curl -s https://api.botflow.ink/health | grep -o '"oauth":[^,]*'
# "oauth":true
```

Connect → Facebook login → redirect `/dashboard/workflows` ✅

---

## Checklist سريع

- [ ] App Domains = `botflow.ink`
- [ ] Valid OAuth Redirect URIs = api + www callback
- [ ] Client OAuth Login = ON
- [ ] Web OAuth Login = ON
- [ ] `META_REDIRECT_URI` = نفس URI li ف Meta
- [ ] Backend deployed بعد تغيير env
- [ ] Instagram = Business account
