FROM node:22.14-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/agent-service/package.json apps/agent-service/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/agent-cursor/package.json packages/agent-cursor/package.json
COPY packages/vault-fs/package.json packages/vault-fs/package.json
COPY packages/markdown/package.json packages/markdown/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
RUN pnpm --filter @nousarium/web build

FROM node:22.14-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
