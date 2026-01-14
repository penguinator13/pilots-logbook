# Helicopter Logbook - Dockerfile
# Production-ready Node.js application

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install --only=production

# Copy application code
COPY src ./src

# Create data directory for SQLite database
RUN mkdir -p /data

# Set environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/logbook.db
ENV SESSION_SECRET=change-this-secret-in-production
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=changeme

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/auth/me', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run as non-root user for security
USER node

# Start the application
CMD ["node", "src/server.js"]
