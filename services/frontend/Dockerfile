# syntax=docker/dockerfile:1

# Stage 1: dependencies 
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: runtime 
FROM node:20-alpine AS runtime
# Create a non-root user (security best practice: never run containers as root)
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
WORKDIR /app

# Copy deps and app code
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

USER appuser
EXPOSE 22137

# Health-check for Docker (Kubernetes uses its own probes, but this helps locally)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:22137/health || exit 1

CMD ["node", "fe-server.js"]