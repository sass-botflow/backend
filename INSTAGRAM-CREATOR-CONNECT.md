# Instagram Connect — Creator / Personal (Darija)

## Chno kayn daba

**Default = Instagram Login** (`flow=instagram`)
- Khddam m3a **Creator** w **Business** accounts
- **Ma kayhtajch** Facebook Page
- URL: `/api/auth/instagram?token=JWT` (default)

**Facebook Login** (`flow=facebook`)
- Khass Instagram mربوط ب Facebook Page
- URL: `/api/auth/instagram?token=JWT&flow=facebook`

---

## Personal account (عادي) — ماشي ممكن 100%

Meta **ma katسمحش** l-personal Instagram accounts b API رسمي.
Ila 3ndek compte **عادي** (mashi Creator/Business):

### 7ll مجاني (2 دقائق):
1. Instagram app → **Settings**
2. **Account type** → **Switch to professional account**
3. Khtar **Creator** (ma kayhtajch carte commerce)
4. 3awd connect

---

## Meta Developer Console

### Instagram product
Zid product **Instagram** → **Instagram Login** (mashi ghir Facebook Login)

### Redirect URIs (نفس قبل)
```
https://api.botflow.ink/api/auth/instagram/callback
https://www.botflow.ink/api/auth/instagram/callback
```

### Scopes (Instagram Login)
- `instagram_business_basic`
- `instagram_business_manage_messages`

---

## EasyPanel env

```env
INSTAGRAM_OAUTH_FLOW=instagram
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=https://www.botflow.ink/api/auth/instagram/callback
```

Deploy backend → connect.

---

## Connect link

```
https://www.botflow.ink/api/auth/instagram?token=USER_JWT
```

Ma tzid `flow=facebook` ila ma 3ndekch FB Page.
