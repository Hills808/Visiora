FROM node:24.22.1-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24.22.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
CMD ["node", "server/gateway.mjs"]
