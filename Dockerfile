# SkillHub 多阶段构建镜像
# 用法见 docs/deployment-guide.md 第 7 节
# 镜像仅运行 NestJS（同时托管 dist/ + API + git-market），由外部 nginx 转发域名到该 Pod。
FROM node:22-bookworm-slim AS build
# git-market 需要系统 git；sqlite3/pg 原生模块需要编译工具链
RUN apt-get update && apt-get install -y git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm run server:build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
ENV NODE_ENV=production PORT=3001
WORKDIR /app/server
EXPOSE 3001
# storage（git-marketplace 工作树）挂载为卷，启动时自动重建
VOLUME /app/server/storage
CMD ["node", "dist/main"]
