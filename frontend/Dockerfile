# syntax=docker/dockerfile:1
# Local-dev image: hot reload via bind mount (see docker-compose.yml).
FROM node:20-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY --chown=node:node . .
RUN mkdir -p /app/.next

EXPOSE 3000
CMD ["npm", "run", "dev"]
