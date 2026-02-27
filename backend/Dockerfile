# --- Builder Stage ---
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL dependencies including Puppeteer's Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
RUN npm install --production=false
COPY . .

# --- Final Production Stage ---
FROM node:20
WORKDIR /app

# Install required shared libraries for Chromium/Puppeteer and mysql client
RUN apt-get update && apt-get install -y \
    default-mysql-client \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# We need the Chromium downloaded in the builder stage
ENV PUPPETEER_EXECUTABLE_PATH=/app/node_modules/puppeteer/.local-chromium/linux-133/chrome-linux/chrome
# OR rely on Puppeteer finding it in cache.
# Actually, let's just copy everything from builder, including node_modules.

COPY --from=builder /app .

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads /app/public/reference_images /app/screenshots && \
    chown -R node:node /app

USER node
EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:7000/health || exit 1

CMD ["node", "server.js"]
