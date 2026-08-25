# SkillHub 内网部署指南

本指南覆盖 SkillHub 在内网环境的完整部署：数据库准备与迁移、直接部署（systemd）、
容器化（Docker / docker-compose）、Kubernetes，以及内网接入（域名/端口/frp/HTTPS 反代）。

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
   PostgreSQL(:5432)  +  server/storage/（git-marketplace 工作树、可选 SQLite）
```

- 对外只需暴露一个端口（默认 `3001`）。
- 数据分两类：**数据库**（PostgreSQL 或 SQLite）与 **storage 目录**（Git 市场仓库，启动时自愈重建）。
- 依赖系统 `git` 二进制（Git Smart HTTP 用 `spawn('git', ['upload-pack', ...])`）。

---

## 2. 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 20（实测 22.x） | 后端使用全局 `fetch` |
| pnpm | ≥ 9 | pnpm workspace，勿用 npm/yarn |
| git | 任意近期版本 | 插件市场协议必需 |
| PostgreSQL | 可选，14+ | 不装则用内置 SQLite（单机演示） |
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
| `DB_TYPE` | `sqlite` | `postgres` 切换 PostgreSQL |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL 连接 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `postgres`/`postgres`/`skillhub` | 同上 |
| `DATABASE_URL` | 空 | 设置后优先，自动按 Postgres 连接 |
| `LLM_BASE_URL` / `LLM_MODEL_NAME` / `LLM_API_KEY` | 空 | 语义审核引擎；留空降级本地启发式 |
| `IAM_BASE_URL` / `IAM_API_TOKEN` | 空 | 内部 IAM 单点登录；留空走桩 |
| `JWT_SECRET` | 内置默认 | **生产务必覆盖为强随机值** |

首次启动自动完成：建表（`synchronize: true`）、播种预置账号/规则/演示数据、
初始化 Git 市场仓库。无需手工初始化。

---

## 5. 数据库

### 5.1 选择

- **SQLite（默认）**：`server/storage/skillhub.sqlite`，零配置。适合单机演示、低并发。
- **PostgreSQL（推荐生产）**：多人并发、行级锁、可用 `pg_dump` 备份。

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

### 5.3 SQLite → PostgreSQL 迁移

已有 SQLite 数据（`server/storage/skillhub.sqlite`）要迁到 PostgreSQL：

```bash
# 1. 停止后端（避免迁移期间写入冲突）
systemctl --user stop skillhub-server    # 或停掉 dev 进程

# 2. 先启动一次后端让 PG 完成建表（synchronize），再停止
PORT=3001 node server/dist/main & sleep 10; kill %1

# 3. 执行一次性迁移脚本（幂等：按主键跳过已存在记录，可重复执行）
node scripts/migrate-sqlite-to-pg.mjs

# 4. 配置 DB_TYPE=postgres 后启动
systemctl --user start skillhub-server
```

脚本覆盖 `users / skills / audit_rules / audit_reports / skill_demands / llm_configs` 六张表，
JSON 列原样透传。

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
# git-market 需要系统 git；sqlite3/pg 原生模块需要编译工具链
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

## 8. 方式 C：Kubernetes

### 8.1 命名空间与配置

`deploy/k8s/skillhub.yaml`（可直接 `kubectl apply -f`）：

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: skillhub
---
apiVersion: v1
kind: Secret
metadata:
  name: skillhub-secrets
  namespace: skillhub
type: Opaque
stringData:
  DB_PASSWORD: "your-strong-password"      # 生产用外部 Secret 管理
  JWT_SECRET: "replace-with-random-64-hex"
  LLM_API_KEY: ""
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: skillhub-config
  namespace: skillhub
data:
  DB_TYPE: "postgres"
  DB_HOST: "skillhub-postgres"
  DB_PORT: "5432"
  DB_USER: "skillhub"
  DB_NAME: "skillhub"
  LLM_BASE_URL: "https://api.deepseek.com/v1"
  LLM_MODEL_NAME: "deepseek-chat"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: skillhub-storage
  namespace: skillhub
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skillhub
  namespace: skillhub
spec:
  replicas: 1            # 单副本即可（内网工具型应用）；多副本需共享 storage/DB
  selector:
    matchLabels:
      app: skillhub
  template:
    metadata:
      labels:
        app: skillhub
    spec:
      containers:
        - name: skillhub
          image: skillhub:latest        # 或 registry 地址
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3001
          envFrom:
            - configMapRef:
                name: skillhub-config
            - secretRef:
                name: skillhub-secrets
          volumeMounts:
            - name: storage
              mountPath: /app/server/storage
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits:   { cpu: "1", memory: 1Gi }
          readinessProbe:
            httpGet: { path: /api/v1/skills, port: 3001 }
            initialDelaySeconds: 15
            periodSeconds: 10
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: skillhub-storage
---
apiVersion: v1
kind: Service
metadata:
  name: skillhub
  namespace: skillhub
spec:
  selector:
    app: skillhub
  ports:
    - port: 3001
      targetPort: 3001
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skillhub-postgres
  namespace: skillhub
spec:
  selector:
    matchLabels:
      app: skillhub-postgres
  template:
    metadata:
      labels:
        app: skillhub-postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - name: POSTGRES_USER
              value: skillhub
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef: { name: skillhub-secrets, key: DB_PASSWORD }
            - name: POSTGRES_DB
              value: skillhub
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: skillhub-postgres-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: skillhub-postgres-data
  namespace: skillhub
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: skillhub
  namespace: skillhub
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "64m"   # 上传 ZIP 需要
spec:
  ingressClassName: nginx
  rules:
    - host: skillhub.corp            # 内网域名，按环境替换
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: skillhub
                port:
                  number: 3001
```

使用：

```bash
kubectl apply -f deploy/k8s/skillhub.yaml
kubectl -n skillhub rollout status deployment/skillhub
kubectl -n skillhub get ingress
```

> 多副本部署注意：`/app/server/storage` 是 Git 市场工作树，多副本需挂共享存储（NFS/RWX），
> 否则各副本的插件市场索引不一致；数据库本身多副本安全。

---

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

> `server/storage/` 可整体重建（git-marketplace 启动自愈；SQLite 文件丢失则需迁移/重新播种），
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
