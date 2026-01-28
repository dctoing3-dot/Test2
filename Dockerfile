FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ============================================
FROM node:20-alpine

# Install runtime dependencies only
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    opus \
    libsodium \
    curl \
    && pip3 install --no-cache-dir --break-system-packages edge-tts \
    && rm -rf /root/.cache /tmp/*

# Create non-root user
RUN addgroup -g 1001 botgroup && \
    adduser -D -u 1001 -G botgroup botuser

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source
COPY --chown=botuser:botgroup . .

# Create directories with proper permissions
RUN mkdir -p temp data logs && \
    chown -R botuser:botgroup temp data logs && \
    chmod 755 temp data logs

# Switch to non-root user
USER botuser

# Environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "src/index.js"]
