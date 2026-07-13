# Auth — email login (restored)

Login and register use **email + password** again.

## Register
```json
POST /api/auth/register
{
  "email": "you@example.com",
  "name": "Amine",
  "password": "yourpassword",
  "organizationName": "My Shop"
}
```

## Login
```json
POST /api/auth/login
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```

## Start 14-day trial (no email)

Still available for quick demo:
```json
POST /api/auth/trial
{}
```

See **AUTH-TRIAL-14D.md**.
