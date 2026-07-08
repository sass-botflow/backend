# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **Sass Botflow backend**: a headless Node.js + TypeScript (Express 5) REST API using Prisma with a local **SQLite** database (`prisma/dev.db`). There is no frontend, no GUI, and no external database/service to run — testing is terminal/HTTP driven (e.g. `curl`).

Standard commands live in `README.md` and `package.json` scripts (`dev`, `build`, `start`, `db:push`, `db:migrate`, `db:studio`). Notes below are only the non-obvious bits.

### Running / caveats

- **`.env` is required and git-ignored.** The server refuses to start without valid env vars (`DATABASE_URL`, and `JWT_SECRET` must be ≥16 chars) — see `src/config/env.ts`. If `.env` is missing, recreate it with `cp .env.example .env` (the example values work as-is for local dev).
- **Create the DB schema before first run:** `npm run db:push`. This creates/syncs `prisma/dev.db` (idempotent). It is intentionally NOT in the startup update script because it writes to the local DB.
- **Start dev server:** `npm run dev` (tsx watch, hot reload) on `http://localhost:8000`. Health check: `GET /health`.
- **Prisma client** is generated automatically via the `postinstall` hook, and again by `db:push` — no separate `db:generate` needed after install.
- No lint config and no test suite exist in this repo; `npm run build` (`tsc`) is the available static check.

### Quick smoke test (auth-gated API)

Protected routes need `Authorization: Bearer <token>` from register/login:

```bash
curl -s -X POST localhost:8000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","name":"Demo","password":"password123"}'
# use the returned token as Bearer to hit /api/bots, /api/bots/:botId/workflows, etc.
```
