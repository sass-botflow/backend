FROM node:22-alpine

WORKDIR /app

COPY server.mjs ./

ENV PORT=8089
ENV EVOLUTION_UPSTREAM=http://sass-botflow_botflow-evolution:8080

EXPOSE 8089

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8089/health || exit 1

CMD ["node", "server.mjs"]
