# AGENTS.md

## Cursor Cloud specific instructions

### Repo layout / state caveats
- This workspace has two repos: `backend` (this repo) and `frontend` (https://github.com/sass-botflow/frontend).
- The **frontend repo currently has no application code** — only a placeholder `README.md` on every branch. There is nothing to install, build, or run there yet. The backend is the only runnable service.
- The backend application code currently lives on the branch `cursor/setup-saas-backend-6f18` (and branches off it). The `main` branch only has a placeholder `README.md`. If a fresh checkout of `main` looks empty, that is expected — switch to the branch that contains the code.

### Backend service (Express 5 + Prisma/SQLite, port 3001)
- Standard commands are documented in `README.md` (`npm run dev`, `npm run build`, `npm run db:push`, etc.). Dev server uses `tsx watch` with hot reload.
- **First-run setup beyond `npm install`:** you must (1) create `.env` (`cp .env.example .env`) and (2) run `npm run db:push` to create the local SQLite DB before the server will work. The dev DB is `prisma/dev.db` (gitignored).
- **`JWT_SECRET` must be at least 16 characters**, otherwise the server throws on startup (`Invalid environment configuration`). This is enforced by Zod in `src/config/env.ts`. The placeholder value in `.env.example` already satisfies this.
- There are **no `lint` or `test` scripts**. Use `npm run build` (`tsc`) as the typecheck/CI gate.
- The default DB is embedded SQLite — no separate database service is needed. PostgreSQL is optional (change `provider` in `prisma/schema.prisma` and `DATABASE_URL`).

### API testing gotchas
- `POST` create endpoints wrap the resource under a key: `POST /api/bots` returns `{"bot": {...}}` and `POST /api/bots/:botId/workflows` returns `{"workflow": {...}}`. List endpoints return `{"bots": [...]}` / `{"workflows": [...]}`. Auth endpoints return `{"user": {...}, "token": "..."}`.
- `POST /api/bots` ignores a passed `status` and always creates a bot as `DRAFT`; change it afterward via `PATCH /api/bots/:id`.
- Protected routes require an `Authorization: Bearer <token>` header obtained from `/api/auth/register` or `/api/auth/login`.
