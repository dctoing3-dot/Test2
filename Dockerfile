FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libopus0 \
    libsodium23 \
    && pip3 install --break-system-packages edge-tts \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p temp data && chmod 777 temp data

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
