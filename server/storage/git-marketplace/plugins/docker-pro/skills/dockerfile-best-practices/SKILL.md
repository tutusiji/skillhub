---
name: dockerfile-best-practices
description: Dockerfile 编写规范 — 指导编写安全、高效、可缓存的 Dockerfile。编写或审查 Dockerfile 时使用。
---

# Dockerfile 编写规范

## 基础镜像选择

- 优先用官方镜像，不用第三方来源
- 优先用 Alpine 或 distroless 减小体积
- 明确指定版本标签，不用 `latest`
- 生产环境用 `-slim` 或 `-alpine` 变体

```dockerfile
# 推荐
FROM node:20-alpine

# 不推荐
FROM node:latest
FROM ubuntu:22.04  # 太大，除非确实需要
```

## 多阶段构建

用多阶段构建分离编译环境和运行环境，最终镜像只包含产物：

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
CMD ["node", "dist/index.js"]
```

## 层缓存优化

把变化频率低的操作放前面，充分利用缓存：

1. `COPY package*.json` 在 `RUN npm install` 之前
2. 源码 `COPY . .` 放最后
3. 用 `.dockerignore` 排除 `node_modules`、`.git`、测试文件

## 安全规范

| 规范 | 说明 |
|------|------|
| 非 root 运行 | 添加 `USER node` 或创建专用用户 |
| 不内嵌密钥 | 环境变量在运行时注入，不写进镜像 |
| 最小权限 | 只安装必要依赖，不加 sudo |
| 健康检查 | 添加 `HEALTHCHECK` 指令 |
| 只读文件系统 | `docker run --read-only` 配合 `--tmpfs` |

## 常见错误

- 把 `.env` 文件 COPY 进镜像
- `COPY . .` 不加 `.dockerignore`
- 用 `apt-get install` 不清理缓存
- 一个 `RUN` 写太多操作，无法利用缓存
- 忘记设置 `WORKDIR`，文件散落在根目录
