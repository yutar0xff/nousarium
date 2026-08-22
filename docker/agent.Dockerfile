FROM node:22.14-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/agent-service/package.json apps/agent-service/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/agent-cursor/package.json packages/agent-cursor/package.json
COPY packages/vault-fs/package.json packages/vault-fs/package.json
COPY packages/markdown/package.json packages/markdown/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile || pnpm install
COPY packages packages
COPY apps/agent-service apps/agent-service
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "apps/agent-service/node_modules/tsx/dist/cli.mjs", "apps/agent-service/src/server.ts"]
