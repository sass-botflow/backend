# Sass Botflow Backend

REST API backend for the [Sass Botflow](https://github.com/sass-botflow) SaaS platform. Manages users, bots, and automation workflows.

## Stack

- **Node.js** + **TypeScript**
- **Express 5**
- **Prisma** (SQLite by default, PostgreSQL-ready)
- **JWT** authentication

## Quick start

```bash
# Install dependencies
npm install

# Copy environment file and edit secrets
cp .env.example .env

# Create database schema
npm run db:push

# Start dev server (with hot reload)
npm run dev
```

The API runs at `http://localhost:3001`.

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| GET | `/api/bots` | Yes | List your bots |
| POST | `/api/bots` | Yes | Create a bot |
| GET | `/api/bots/:id` | Yes | Get bot details |
| PATCH | `/api/bots/:id` | Yes | Update a bot |
| DELETE | `/api/bots/:id` | Yes | Delete a bot |
| GET | `/api/bots/:botId/workflows` | Yes | List workflows |
| POST | `/api/bots/:botId/workflows` | Yes | Create workflow |
| PATCH | `/api/bots/:botId/workflows/:workflowId` | Yes | Update workflow |
| DELETE | `/api/bots/:botId/workflows/:workflowId` | Yes | Delete workflow |

Protected routes require `Authorization: Bearer <token>`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | — | Prisma connection string |
| `JWT_SECRET` | — | Secret for signing tokens (min 16 chars) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |

For PostgreSQL in production:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sass_botflow"
```

Update `provider` in `prisma/schema.prisma` from `sqlite` to `postgresql`.

## Docker

```bash
docker compose up --build
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run db:push` | Sync schema to database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Related repos

- Frontend: https://github.com/sass-botflow/frontend
