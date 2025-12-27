# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

RUN npm install

# 👇 Build-time envs (VITE ONLY)
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL


ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL


# Copy source code
COPY . .

# Build the application
RUN npm run build


# ---------- Production stage ----------
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 8083

CMD ["serve", "-s", "dist", "-l", "8083"]
