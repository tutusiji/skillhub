---
name: image-optimization
description: Docker 镜像优化 — 减小镜像体积、加速构建、排查镜像层问题。镜像过大、构建太慢或需要精简镜像时使用。
---

# Docker 镜像优化

## 优化检查清单

| 项目 | 目标 | 方法 |
|------|------|------|
| 基础镜像 | < 200MB | 用 alpine 或 distroless |
| 镜像层数 | < 15 层 | 合并 RUN 指令 |
| 构建时间 | 缓存命中率 > 80% | 优化层顺序 |
| 最终体积 | 越小越好 | 多阶段构建 |
| 安全扫描 | 0 高危 CVE | 用 trivy 扫描 |

## 常用优化手段

### 1. 合并 RUN 指令

```dockerfile
# 不好 — 3 个层
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# 好 — 1 个层
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
```

### 2. 多阶段构建去依赖

构建工具（gcc、make、dev headers）只存在于构建阶段，运行镜像不带。

### 3. .dockerignore

```
node_modules
.git
*.md
test
coverage
.env*
.vscode
```

### 4. 生产依赖

```dockerfile
# 只装生产依赖
RUN npm ci --only=production
```

### 5. 用 distroless

```dockerfile
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=builder /app/dist ./dist
CMD ["dist/index.js"]
```

没有 shell，没有包管理器，体积最小，安全性最高。

## 排查工具

- `docker history <image>` — 查看每层大小
- `docker images` — 对比优化前后体积
- `dive <image>` — 交互式分析每层内容
- `trivy image <image>` — 安全漏洞扫描

## 体积参考

| 基础镜像 | 典型体积 |
|----------|----------|
| node:20 | ~1GB |
| node:20-slim | ~250MB |
| node:20-alpine | ~150MB |
| distroless | ~120MB |
