# ============================================================
#         ARIA DISCORD AI BOT v3.0 - DOCKERFILE
#         Complete Edition with Voice, Search, File, Image
# ============================================================

FROM node:20-bullseye-slim

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    gcc \
    build-essential \
    pkg-config \
    ffmpeg \
    libopus0 \
    libopus-dev \
    libsodium23 \
    libsodium-dev \
    curl \
    ca-certificates \
    && pip3 install --no-cache-dir edge-tts \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /root/.cache

# Set working directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./

# Install node dependencies
RUN npm install --omit=dev \
    && npm cache clean --force

# Copy source files
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p temp data logs modules \
    && chmod 755 temp data logs modules

# Environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Expose port
EXPOSE 3000

# Run the bot
CMD ["node", "src/index.js"]
