# ============================================================
# OpenAI Image2API - Multi-stage Dockerfile
# ============================================================

# ── Stage 1: Build Frontend ──
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build


# ── Stage 2: Build Backend ──
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./
RUN npm run build


# ── Stage 3: Production Image ──
FROM node:20-alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy backend built files and dependencies
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/package.json ./server/package.json
COPY --from=backend-builder /app/server/package-lock.json ./server/package-lock.json

# Copy frontend built files into server/public so Express can serve them
COPY --from=frontend-builder /app/client/dist ./client/dist

# Install production-only dependencies
WORKDIR /app/server
RUN npm ci --omit=dev

# Create writable directories and set ownership
RUN mkdir -p /app/server/data /app/server/public/generated && \
    chown -R appuser:appgroup /app/server/data /app/server/public/generated

# Switch to non-root user
USER appuser

WORKDIR /app/server

EXPOSE 3001

# Healthcheck: hit the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
