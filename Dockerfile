# Helicopter Logbook - Dockerfile
# Production-ready Node.js application

FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY src ./src

# Data directory for SQLite database (mounted as a volume at runtime)
RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/logbook.db
# SESSION_SECRET / ADMIN_USERNAME / ADMIN_PASSWORD must be supplied at runtime.
# If ADMIN_PASSWORD is not set, a random one is generated and printed in the logs on first start.

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

USER node

CMD ["node", "src/server.js"]
