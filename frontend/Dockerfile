# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time envs (VITE ONLY)
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG VITE_BACKEND_ORIGIN

ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BACKEND_ORIGIN=$VITE_BACKEND_ORIGIN

# Copy dependency files
COPY package.json package-lock.json* ./

RUN npm install

# Copy source code
COPY . .

# Copy .env file for Vite build (if exists)
COPY .env* ./

# Build the application
RUN npm run build


# ---------- Production stage ----------
# ---------- Production stage ----------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
