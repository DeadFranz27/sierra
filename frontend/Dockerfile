# Multi-stage build: compiles the SPA, then serves it via nginx.
# Works on x86_64 and ARM (Raspberry Pi) because both base images are multi-arch.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
RUN addgroup -g 1000 sierra && adduser -u 1000 -G sierra -D sierra

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

RUN chown -R sierra:sierra /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run

USER sierra
EXPOSE 80 443
