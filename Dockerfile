# ---- Builder: native Module (better-sqlite3) bauen ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Build-Tools nur als Fallback, falls kein vorgebautes Binary verfügbar ist
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# ---- Runtime: schlankes Image ohne Build-Tools ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/app/data/dreicount.db
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY server.js db.js package.json ./
COPY public ./public
COPY scripts ./scripts

# Datenverzeichnis anlegen und dem unprivilegierten node-User geben
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
