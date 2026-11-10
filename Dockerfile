# Native dependencies are built on the same Debian/Node ABI as the runtime.
# The compiler toolchain stays in the builder stage, never the final image.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# CI builds this target before publishing: exercise real HTTP APIs on a temp DB.
FROM dependencies AS test
COPY src ./src
COPY test ./test
RUN npm test

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY src ./src
RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/logbook.db
# Supply SESSION_SECRET at runtime. ADMIN_* is used only for a fresh database.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"
USER node
CMD ["node", "src/server.js"]
