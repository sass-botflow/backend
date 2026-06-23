FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
# Default port; override with the PORT env var (EasyPanel: set PORT=8000).
ENV PORT=8000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Directory for the SQLite database file (mount a persistent volume here).
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
