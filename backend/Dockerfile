# --- Builder Stage ---
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .

# --- Final Production Stage ---
FROM node:20-slim
WORKDIR /app

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy only needed files from builder
COPY --from=builder /app .
RUN npm prune --production \
    && mkdir -p /app/uploads \
    && chown -R node:node /app

EXPOSE 7000

# Security: Run as non-root user
USER node

CMD ["node", "server.js"]
