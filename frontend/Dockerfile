# Multi-stage build: compiles the SPA, then serves it via nginx.
# Works on x86_64 and ARM (Raspberry Pi) because both base images are multi-arch.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Run as root *inside the container* (default for the nginx image).
# This is fine: container-root is isolated from host-root, and it lets nginx
# bind 80/443 and write its pid file without fighting the overlayfs.
EXPOSE 80 443
