# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY frontend/package.json frontend/package-lock.json* ./

RUN npm install

# 👇 Build-time envs (VITE ONLY)
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG VITE_BACKEND_ORIGIN


ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BACKEND_ORIGIN=$VITE_BACKEND_ORIGIN


# Copy source code
COPY frontend .

# Build the application
RUN npm run build

# Copy backend assets into dist so /assets paths resolve in the static bundle
COPY backend/assets ./dist/assets


# ---------- Production stage ----------
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 8083

CMD ["serve", "-s", "dist", "-l", "8083"]
