# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time envs (VITE ONLY)
# We define them here AND in docker-compose for maximum stability
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG VITE_BACKEND_ORIGIN

ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BACKEND_ORIGIN=$VITE_BACKEND_ORIGIN

# Install dependencies first (better caching)
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile || npm install

# Copy source and build
COPY . .
RUN npm run build

# ---------- Production stage ----------
FROM nginx:alpine

# Clean up default nginx assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Security: Set proper permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
