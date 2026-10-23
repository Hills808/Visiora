FROM node:24.22.1-bookworm-slim AS builder
WORKDIR /app
# tools/build.mjs generates a ZIP via the Python standard library.
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/local/bin/python
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24.22.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/schemas ./schemas
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
CMD ["node", "server/gateway.mjs"]
