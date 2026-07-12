FROM node:22-slim AS base
LABEL org.opencontainers.image.source=https://github.com/sass-botflow/backend
LABEL org.opencontainers.image.description="BotFlow API backend"
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Full deps for compile (includes @nestjs/cli, typescript, @swc/*)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Production deps only for runtime image (smaller, faster copy)
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

FROM base AS build
ARG BUILD_COMMIT=unknown
ARG CACHEBUST=unknown
ENV BUILD_COMMIT=$BUILD_COMMIT
# EasyPanel VPS builds often OOM during tsc — SWC + memory cap avoids "Killed"
ENV NODE_OPTIONS=--max-old-space-size=512
ENV npm_config_jobs=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# CACHEBUST forces EasyPanel/Docker to re-run compile when redeploying (set in Deploy hook).
RUN echo "build cachebust=${CACHEBUST} commit=${BUILD_COMMIT} at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN npm run build
RUN node -e "const v=require('./package.json').version; const id=process.env.BUILD_COMMIT!=='unknown'?process.env.BUILD_COMMIT:'v'+v+'-'+Date.now().toString(36); require('fs').writeFileSync('build-id.txt', id)"

FROM base AS runner
ARG BUILD_COMMIT=unknown
ENV NODE_ENV=production
ENV BUILD_COMMIT=$BUILD_COMMIT
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/build-id.txt ./build-id.txt
COPY --from=build /app/prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
