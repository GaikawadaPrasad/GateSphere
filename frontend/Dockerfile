# syntax=docker/dockerfile:1
# Local-dev image: hot reload via bind mount (see docker-compose.yml).
FROM node:20-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# node:20-slim ships a pre-created `node` user (uid/gid 1000) for exactly this.
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["npm", "run", "dev"]
