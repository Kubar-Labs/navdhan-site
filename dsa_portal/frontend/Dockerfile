# Build the Vite SPA, then serve it from nginx with /api proxy to backend.

# ── Build stage ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve stage ──
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Cloud Run injects PORT=8080. BACKEND_URL is set at deploy time.
ENV PORT=8080
EXPOSE 8080
