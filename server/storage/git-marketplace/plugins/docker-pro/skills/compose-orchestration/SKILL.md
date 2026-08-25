---
name: compose-orchestration
description: Docker Compose 编排 — 编写和优化 docker-compose.yml，管理多容器服务编排。搭建本地开发环境或编排多服务部署时使用。
---

# Docker Compose 编排

## 基本结构

```yaml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:5432/myapp
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  db-data:
```

## 编排规范

1. **服务命名** — 用角色名（web/api/db/redis），不用容器名
2. **网络隔离** — 前端服务和数据库分属不同网络
3. **依赖顺序** — 用 `depends_on` + `condition: service_healthy`
4. **健康检查** — 每个服务都要配 `healthcheck`
5. **资源限制** — 生产环境加 `deploy.resources.limits`

## 环境变量管理

- 用 `.env` 文件管理环境变量，不硬编码到 yml
- `.env` 加入 `.gitignore`，提供 `.env.example`
- 敏感变量用 `${VAR}` 引用，值从环境注入

## 开发 vs 生产

| 维度 | 开发环境 | 生产环境 |
|------|----------|----------|
| 源码 | volume 挂载，热重载 | 构建到镜像内 |
| 数据库 | 本地 volume | 外部托管数据库 |
| 网络 | 端口映射到宿主机 | 内部网络，不暴露端口 |
| 日志 | 控制台输出 | 日志驱动到集中收集 |
| 重启 | 不设或 no | `unless-stopped` 或 `always` |

## 常见问题

- `depends_on` 不等健康检查就启动 — 加 `condition: service_healthy`
- 端口冲突 — 多个项目用同一端口
- volume 路径用绝对路径 — 用命名 volume 更可移植
- 忘记给数据库加 volume — 容器重启数据丢失
