# SkillHub 内网部署指南

> **推荐部署方式：Kubernetes + 远程 PostgreSQL**（内网已有 K8s 平台时）。
> 应用镜像构建推送一次到内网 registry 后由 Deployment 拉取；PostgreSQL 使用集群外远程实例，
> 不需要在集群内部署数据库、也不需要为数据库打镜像。见第 8 节。

本指南覆盖 SkillHub 在内网环境的完整部署：数据库准备与配置（远程 PostgreSQL）、
直接部署（systemd）、容器化（Docker / docker-compose）、Kubernetes，
以及内网接入（域名/端口/frp/HTTPS 反代）。

---

## 1. 架构与部署形态

SkillHub 是**单进程应用**：NestJS 后端同时提供 API、Claude Code 插件市场（Git Smart HTTP）
与前端静态资源（检测到 `dist/index.html` 时托管 SPA + history fallback）。

```
浏览器 / Claude Code CLI
        │  HTTP / Git Smart HTTP
        ▼
   NestJS 单进程 (:3001)
   ├── /api/v1/*            REST API
   ├── /skillhub.git        Claude Code 插件市场（git-upload-pack）
   ├── /.claude-plugin/*    市场清单
   └── 其余 GET             前端 SPA（dist/）
        │
        ▼
   PostgreSQL(:5432)  +  server/storage/（git-marketplace 工作树）
```

- 对外只需暴露一个端口（默认 `3001`）。
- 数据分两类：**数据库**（PostgreSQL）与 **storage 目录**（Git 市场仓库，启动时自愈重建）。
- 依赖系统 `git` 二进制（Git Smart HTTP 用 `spawn('git', ['upload-pack', ...])`）。

---

## 2. 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 20（实测 22.x） | 后端使用全局 `fetch` |
| pnpm | ≥ 9 | pnpm workspace，勿用 npm/yarn |
| git | 任意近期版本 | 插件市场协议必需 |
| PostgreSQL | 14+（必需） | 唯一数据库，连接见第 5 节 |
| Docker / K8s | 可选 | 按部署方式选择 |

---

## 3. 构建产物

```bash
git clone git@github.com:tutusiji/skillhub.git && cd skillhub
pnpm install
pnpm run build          # 前端 → dist/
pnpm run server:build   # 后端 → server/dist/
```

产物：根目录 `dist/`（前端静态）+ `server/dist/`（后端编译）。后端进程工作目录为 `server/`。

---

## 4. 配置

后端读取 `server/.env`（进程工作目录为 `server/`）。关键变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 服务监听端口 |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL 连接 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `postgres`/`postgres`/`skillhub` | 同上 |
| `DATABASE_URL` | 空 | 设置后优先，自动按 Postgres 连接 |
| `LLM_BASE_URL` / `LLM_MODEL_NAME` / `LLM_API_KEY` | 空 | 语义审核引擎；留空降级本地启发式 |
| `IAM_BASE_URL` / `IAM_API_TOKEN` | 空 | 内部 IAM 单点登录；留空走桩 |
| `JWT_SECRET` | 无 | JWT 签名密钥。**生产环境（`APP_ENV=prod`）必须显式配置且 ≥32 字符，否则服务拒绝启动** |
| `JWT_EXPIRES_IN` | `12h` | 令牌有效期 |
| `CORS_ORIGINS` | 空 | 跨域来源白名单（逗号分隔）。留空时生产仅同源、开发回显来源 |
| `SEED_DEMO_DATA` | 按环境 | 是否播种演示数据。留空时生产关闭、其他环境开启 |

首次启动自动完成：建表（`synchronize: true`）、播种预置账号/规则/演示数据、
初始化 Git 市场仓库。无需手工初始化。

### 4.1 生产上线前的安全检查清单

以下几项在开发环境是便利设计，在生产环境是可被直接利用的漏洞，务必逐条确认：

| 项 | 要求 | 未做到的后果 |
| --- | --- | --- |
| `JWT_SECRET` | `.env.prod` 中设为 ≥32 字符随机值（`openssl rand -hex 32`） | 源码内置默认密钥是公开的，任何人可自签 `role=super_admin` 令牌，等同全站无鉴权。**已加启动期强校验，配置缺失会直接启动失败** |
| `SEED_DEMO_DATA` | 保持关闭（生产默认） | 演示员工账号共用弱口令 `Password123!`，等于一组可直接登录的后门账号 |
| 超管初始密码 | 首次登录后立即修改 `admin` 的初始密码 `skill@2026` | 该初始密码在文档与源码中公开 |
| `CORS_ORIGINS` | 同源部署时留空；确需独立前端域名时逐个列出 | 早期 `origin:'*' + credentials:true` 允许任意外部站点带受害者令牌调内网 API |
| `synchronize` | 表结构变更前先备份，或改用显式迁移 | 自动改表在生产可能造成数据丢失 |
| 反向代理 | 若经 Nginx，需透传 `X-Forwarded-For` | 登录爆破节流与互动计数去重都依赖来源 IP，缺失时按「无来源」宽松处理 |
| LLM 凭据 | 只写在 `.env.prod`，不入库 | `/audit/llm-config` 已做管理员鉴权且只回传掩码，但环境文件仍须妥善保管 |

---

## 5. 数据库

### 5.1 说明

数据库统一使用 **PostgreSQL**。启动时按实体自动建表（`synchronize: true`），无需手工建表；只须先创建数据库与用户。

### 5.2 初始化 PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER skillhub WITH PASSWORD 'your-strong-password';
CREATE DATABASE skillhub OWNER skillhub;
SQL
```

在 `server/.env` 配置：

```bash
DB_TYPE=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=skillhub
DB_PASSWORD=your-strong-password
DB_NAME=skillhub
```

> ⚠️ `synchronize: true` 会按实体自动建表/改表。生产环境的表结构变更请先备份；
> 追求更严格的生产管理可关闭 `synchronize` 改用显式迁移（见 `docs/database-schema.md`）。

### 5.3 多环境数据库配置（内网 dev / test / prod）

内网通常有多套 PostgreSQL。连接配置按 `APP_ENV` 分层加载（文件在 `server/` 下）：

| 文件 | 用途 | 入库？ |
| --- | --- | --- |
| `.env` | 通用默认（开发环境），已提交 | ✅ |
| `.env.local` | 本机覆盖 | ❌ |
| `.env.<APP_ENV>` | 按环境（`.env.test` / `.env.prod`） | ❌（含内网真实地址，勿提交） |

加载顺序（后者覆盖前者）：`.env` → `.env.local` → `.env.<APP_ENV>`。启动时用 `APP_ENV` 选择：

```bash
# 开发
APP_ENV=dev pnpm run server:start

# 测试：连接测试环境 PG（地址写在 server/.env.test）
APP_ENV=test pnpm run server:start

# 生产：连接生产环境 PG（地址写在 server/.env.prod）
APP_ENV=prod pnpm run server:start
```

示例 `server/.env.prod`：

```bash
APP_ENV=prod
DB_HOST=pg-prod.internal.corp
DB_PORT=5432
DB_USER=skillhub
DB_PASSWORD=生产密码仅在此文件
DB_NAME=skillhub
# 或 DATABASE_URL=postgres://skillhub:生产密码@pg-prod.internal.corp:5432/skillhub
```

systemd / Docker / K8s 中同样注入 `APP_ENV` 即可切换（K8s 用 ConfigMap 的 `data` 字段，Secret 管密码）。

---

## 6. 方式 A：直接部署（systemd 用户服务）

适合单机内网（现有 `deploy/skillhub-server.service`）：

```bash
# 构建
cd /home/tutuos/CodeLab/gemini-skillhub
pnpm run build && pnpm run server:build

# 安装用户级服务（已开 linger，重启自拉起）
cp deploy/skillhub-server.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now skillhub-server

# 查看状态与日志
systemctl --user status skillhub-server
journalctl --user -u skillhub-server -f
```

运维：

```bash
systemctl --user restart skillhub-server   # 升级后重启
loginctl show-user "$USER" | grep Linger   # 必须 Linger=yes
```

---

## 7. 方式 B：Docker / docker-compose

### 7.1 Dockerfile

根目录 `Dockerfile`：

```dockerfile
# ---- 构建阶段 ----
FROM node:22-bookworm-slim AS build
# git-market 需要系统 git；pg 原生模块需要编译工具链
RUN apt-get update && apt-get install -y git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm run server:build

# ---- 运行阶段 ----
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y git \
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
```

### 7.2 docker-compose（含 PostgreSQL）

`docker-compose.yml`：

```yaml
services:
  skillhub:
    build: .
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      NODE_ENV: production
      DB_TYPE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: skillhub
      DB_PASSWORD: ${DB_PASSWORD:?请在 .env 中设置}
      DB_NAME: skillhub
      JWT_SECRET: ${JWT_SECRET:?请在 .env 中设置}
      LLM_BASE_URL: ${LLM_BASE_URL:-}
      LLM_MODEL_NAME: ${LLM_MODEL_NAME:-}
      LLM_API_KEY: ${LLM_API_KEY:-}
    volumes:
      - skillhub-storage:/app/server/storage
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: skillhub
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: skillhub
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skillhub"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  skillhub-storage:
  postgres-data:
```

使用：

```bash
cat > .env <<'EOF'
DB_PASSWORD=your-strong-password
JWT_SECRET=replace-with-random-64-hex
LLM_API_KEY=
EOF
docker compose up -d --build
docker compose logs -f skillhub
```

---

## 8. 方式 C：Kubernetes（内网 K8s + 远程 PostgreSQL，推荐）

内网已有 K8s 平台时推荐此方式。**PostgreSQL 使用集群外的远程实例**（远程连接形式），
集群内不部署 postgres，因此**不需要为数据库打镜像**；应用镜像构建推送一次到内网
registry 后由 Deployment 拉取。

### 8.1 镜像

仓库根目录 `Dockerfile` 已就绪（多阶段：构建含 git 与原生模块编译，运行镜像仅含 git）。

```bash
# 构建并推送到内网 registry（如 Harbor）
docker build -t harbor.internal.corp/skillhub/skillhub:latest .
docker push harbor.internal.corp/skillhub/skillhub:latest
```

> 若内网有统一 CI（GitLab CI / 云原生构建管道），接入即可：流水线执行
> `pnpm install && pnpm run build && pnpm run server:build` 后按上述 Dockerfile 出镜像。
> 日常开发迭代不需要每次打镜像——只有服务端代码变化时才需重建推送。

### 8.2 清单

`deploy/k8s/skillhub.yaml` 为**远程 PostgreSQL 版**（可直接 `kubectl apply -f`），内容：

- `Namespace skillhub`
- `Secret skillhub-secrets`：`DB_PASSWORD`（远程 PG 密码）、`JWT_SECRET`、`LLM_API_KEY`
- `ConfigMap skillhub-config`：`APP_ENV`、远程 PG 的 `DB_HOST/DB_PORT/DB_USER/DB_NAME`（或 `DATABASE_URL`）、`LLM_BASE_URL/LLM_MODEL_NAME`
- `Deployment skillhub`：单副本，`image` 指向内网 registry，挂载 `skillhub-storage` PVC（Git 市场工作树）
- `Service skillhub`（3001）+ `Ingress skillhub`（`proxy-body-size: 64m` 供 ZIP 上传）

使用前只需改两处：`image:` 换成你的 registry 地址；`ConfigMap` / `Secret` 填远程 PG 与密钥。

```bash
kubectl apply -f deploy/k8s/skillhub.yaml
kubectl -n skillhub rollout status deployment/skillhub
kubectl -n skillhub get ingress
```

> 多副本注意：`/app/server/storage` 是 Git 市场工作树，多副本需挂共享存储（NFS/RWX），
> 否则各副本的插件市场索引不一致。内网工具型应用单副本足够。

> **Git Smart HTTP 链路的 K8s 专项事项**（ingress body size、streaming 超时、探针选择、
> 备份方案、故障排查命令）见 [`git-smart-http-k8s.md`](./git-smart-http-k8s.md)。

## 9. 内网接入

### 9.1 域名与端口规划

建议按环境区分域名，同一端口：

| 环境 | 示例域名 | 端口 |
| --- | --- | --- |
| 开发 | `tech-dev.com:17200` | 17200 |
| 测试 | `tech-test.com:17200` | 17200 |
| 生产 | `tech.com:17200` | 17200 |

前端所有安装指令的地址**随访问域名动态生成**（`window.location.origin`），
三种环境访问各自域名即可得到对应的 `marketplace add <域名>/skillhub.git`，无需改代码。

### 9.2 frp 映射（无公网/内网穿透）

`/etc/frp/frpc.toml` 指向后端 **3001**（不是 Vite 的 7001）：

```toml
[[proxies]]
name = "skillhub"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3001
remotePort = 17200
```

### 9.3 HTTPS 反向代理（nginx）

```nginx
server {
    listen 443 ssl;
    server_name tech.com;
    # ssl_certificate ...;  # 内网 CA 或自签
    client_max_body_size 64m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 10. 部署后验证

```bash
# 1. 服务健康
curl -s http://127.0.0.1:3001/api/v1/skills | head -c 100
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/          # 期望 200（SPA）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/skillhub.git/info/refs

# 2. 登录与角色
curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"account":"admin","password":"skill@2026"}'

# 3. 回归测试（后端须在运行）
pnpm run test:regression
node scripts/regression-test.mjs https://tech.com:17200   # 打远程隧道/域名

# 4. Claude Code 真实安装验证（本机有 claude CLI 时）
pnpm run test:plugin-e2e
```

---

## 11. 运维

### 备份

```bash
# PostgreSQL
pg_dump -h 127.0.0.1 -U skillhub skillhub -F c -f /backup/skillhub-$(date +%F).dump

# storage（Git 市场仓库）
tar czf /backup/git-marketplace-$(date +%F).tgz server/storage/git-marketplace
```

> `server/storage/` 可整体重建（git-marketplace 启动自愈），
> 数据库才是业务数据权威。

### 升级

```bash
# systemd
git pull && pnpm install && pnpm run build && pnpm run server:build
systemctl --user restart skillhub-server

# docker
git pull && docker compose up -d --build

# k8s
git pull && pnpm run build && pnpm run server:build
docker build -t skillhub:latest . && kubectl -n skillhub rollout restart deployment/skillhub
```

### 日志

```bash
journalctl --user -u skillhub-server -f     # systemd
docker compose logs -f skillhub             # docker
kubectl -n skillhub logs -f deploy/skillhub # k8s
```

---

## 12. 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面能开但数据是假数据、状态点琥珀色 | 后端不可达：`ss -ltnp \| grep 3001` 确认进程，看 `/api/*` 是否 502 |
| `/api/*` 返回 5xx | 几乎总是 NestJS 进程没起（单进程部署无独立前端） |
| 安装插件报市场不存在 | 未先执行 `marketplace add`，或地址端口不对（应为后端 3001/对外 17200） |
| 新插件安装不到 | 客户端未执行 `claude plugin marketplace update skillhub` 同步最新清单 |
| 上传 ZIP 失败（413） | 反向代理/Ingress `client_max_body_size` / `proxy-body-size` 需 ≥ 64m |
| 启动报 `invalid input syntax for type uuid` | 用非法 id 查 uuid 主键，属客户端入参问题（回归组 9 覆盖） |
| 语义引擎结论是 `heuristic` | 未配 LLM 凭据或调用失败，按设计降级；查 `llmVerdict.degradedReason` |
