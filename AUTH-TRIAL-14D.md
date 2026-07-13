# Start 14-day trial — direct dashboard (no email)

One click → JWT → `/dashboard`. No email, no password.

## API

```http
POST /api/auth/trial
Content-Type: application/json

{}
```

Optional name:
```json
{ "name": "Amine" }
```

### Response
```json
{
  "token": "eyJ...",
  "user": { "id": "...", "username": "trial_...", "name": "BotFlow User", "email": null },
  "organization": { "id": "...", "name": "BotFlow User's Workspace", "slug": "trial-..." },
  "trial": { "days": 14, "endsAt": "2026-07-27T...", "status": "TRIALING" },
  "redirectTo": "/dashboard"
}
```

## Frontend — "Start 14 days" button

```tsx
async function startTrial() {
  const res = await fetch('/api/auth/trial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  localStorage.setItem('token', data.token);
  // or auth_token / botflow_token — match your app
  window.location.href = data.redirectTo ?? '/dashboard';
}
```

Wire landing page CTA **"Start 14 days"** → `startTrial()`.

## Notes

- Each click creates a **new trial account** (random `trial_*` username).
- Subscription: **TRIALING** for 14 days (`currentPeriodEnd`).
- Add email/login later when SaaS onboarding is complete.
