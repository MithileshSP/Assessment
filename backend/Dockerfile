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

# We skip apt-get entirely to avoid repository issues.
# node:20 (full) usually has enough libraries for Chromium.
# If not, we might need to revert or use a different base.

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
