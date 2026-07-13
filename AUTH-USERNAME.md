# Auth — username only (no email required)

MVP mode: login/register with **username + password**. Email optional later.

## API

### Register
```http
POST /api/auth/register
{
  "username": "amine",
  "name": "Amine",
  "password": "1234",
  "organizationName": "My Shop"
}
```

`email` is **optional** — omit it for now.

### Login
```http
POST /api/auth/login
{
  "username": "amine",
  "password": "1234"
}
```

Response includes `token` — use for Instagram connect etc.

## Frontend changes needed

Replace email field with **username** on login/register forms:

| Before | After |
|--------|-------|
| `email` | `username` (3-32 chars, a-z 0-9 _) |
| required email | email hidden or optional |

Store JWT as before (`localStorage.token`).

## Username rules

- 3–32 characters
- Letters, numbers, underscore only
- Case-insensitive (stored lowercase)
