# Git Smart HTTP 在 Kubernetes 上的部署注意事项

> 适用范围：内网 K8s 集群部署 SkillHub（含 `skillhub.git`、`market.git`、
> `.claude-plugin/marketplace.json` 三条 Claude Code 协议端点）。
>
> 完整部署流程（镜像构建 / 远程 PG / Secret / Ingress）见
> [`deployment-guide.md`](./deployment-guide.md) 第 8 节，本文只覆盖
> **Git Smart HTTP 这一条链路**在 K8s 下的特殊处理与陷阱。

## 1. TL;DR

`git-market.controller.ts` 把 Smart HTTP 端点（`info/refs` / `git-upload-pack`）实现为
**HTTP 壳 + 子进程** 模式：

- `GET skillhub.git/info/refs` → `spawn('git', ['upload-pack', '--stateless-rpc', '--advertise-refs', ...])`，子进程 stdout 直接 `pipe(res)`
- `POST skillhub.git/git-upload-pack` → 同上，但子进程 stdin 灌入 `req.body`（pkt-line 二进制流）

仓库本体在 `server/storage/git-marketplace/`，**不是内存对象**，是真实 `.git/` 目录。
写端用纯 JS（`isomorphic-git` + `jszip`），不开放 `git-receive-pack` HTTP 端点。

这件事落到 K8s 上就是五个硬约束：

| 约束 | 原因 | 失败时的现象 |
|---|---|---|
| 镜像必须含 `git` CLI | `spawn('git', …)` 走系统二进制 | `ENOENT` / 502 / `advertise-refs` 空响应 |
| `server/storage` 必须持久化 | 这是真仓库，pod 重建会丢 commits | 下架/重挂载后市场索引对不上 |
| **单副本**（默认）/ 共享存储 | 写端无分布式锁，多副本会分裂 | 不同 pod 看到的 `marketplace.json` 不一致 |
| Ingress body size ≥ 256m | packfile 比单包 ZIP 大得多 | `git-upload-pack` POST 在 ingress 层被截断 |
| Ingress streaming 超时需放宽 | 拉大包耗时以分钟计 | 连接被 RST，client 报 `RPC failed` |

`Dockerfile`（运行镜像 `FROM node:22-bookworm-slim` + `apt-get install -y git`）和
`deploy/k8s/skillhub.yaml`（`replicas: 1` + RWO PVC + `proxy-body-size: 64m`）已经覆盖了
前三条。后两条与运行细节（健康探针、备份、non-root）属于本文要补的。

## 2. 协议路由与 content-type 的耦合

`server/src/main.ts:25-33` 用 `express.raw()` 单独接管两种 content-type：

```ts
app.use(raw({
  type: [
    'application/x-git-upload-pack-request',
    'application/x-git-receive-pack-request',
  ],
  limit: '100mb',
}));
```

`POST /skillhub.git/git-upload-pack` 的请求体**必须**带
`Content-Type: application/x-git-upload-pack-request`，否则会落到默认的 `json()` /
`urlencoded()` 解析器，要么被 JSON.parse 报错、要么以对象形式出现在 `req.body` 而非
Buffer。客户端（Claude Code / 真实 `git` CLI）都按协议发这个 content-type，所以正常情况
无感；**K8s 侧如果挂了改写 content-type 的 Sidecar/Istio 规则**，所有 `git-upload-pack`
POST 会无声失败 —— 排查时第一件事是 `kubectl exec` 进 pod `tcpdump` 抓一下真实上行头。

`info/refs` 端走 GET，没有 body 解析问题，但返回 content-type 必须是
`application/x-git-upload-pack-advertisement`（`controller.ts:51`），否则客户端不解码。

## 3. 容器内运行细节

### 3.1 `git` 二进制

`Dockerfile:15` 显式 `apt-get install -y git`，并在 build 阶段（`Dockerfile:5`）也装了
—— 避免 `pnpm install` 时 isomorphic-git 的某些代码路径意外要求 git。**不要**为了瘦身
改成 `node:22-alpine` 后忘记 `apk add git`，`spawn('git', …)` 会直接 ENOENT。

### 3.2 `process.cwd()`

- `server/src/main.ts` 的静态托管路径是 `path.resolve(process.cwd(), '..', 'dist')`，
  假设启动时 cwd 是 `/app/server`。
- `GitMarketService.repoDir` 是 `path.resolve(process.cwd(), 'storage/git-marketplace')`，
  即 `/app/server/storage/git-marketplace`。
- `Dockerfile:23-27` 用 `WORKDIR /app/server` + `CMD ["node", "dist/main"]` 显式
  保证 cwd 正确。**改用 Kustomize 覆盖 args / 改 Helm chart 启动命令时**，必须保留
  `cwd=/app/server`（`--chdir` 或在启动脚本里 `cd /app/server` 二选一），否则
  `../dist` 找不到、`storage/` 落进错误目录。

### 3.3 用户与文件权限

- `node:22-bookworm-slim` 默认以 `root` 启动；`git upload-pack` 读取 `.git/objects`、
  `isomorphic-git.commit` 写入 `.git/objects` / `.git/refs`，二者都需要写权限。
- 如果集群启用了 `PodSecurityStandard: restricted`（或你显式加了 `runAsNonRoot: true`），
  必须在 `securityContext` 里给 `fsGroup: 1000`（与镜像内 `node` 用户 uid 对齐），
  否则 RWO PVC 在第一个 pod 调度上去之后写不进去，`syncApprovedSkillToGit` 抛 `EROFS`。
- 不要给容器 `privileged: true` / `hostPath` —— 仓库用纯 `fs` 模块操作就够。

### 3.4 临时目录与 HOME

- `git upload-pack` 偶发会读 `$HOME/.gitconfig`（`init.defaultBranch` / `safe.directory`）。
  容器内 `HOME` 默认是 `/root`，`.gitconfig` 不存在，行为无副作用，但 `git status` 日志
  里会偶现 `warning: unable to access '/root/.gitconfig'`。如果想消音，挂一个 emptyDir 到
  `/root` 或在启动脚本 `git config --global --add safe.directory '*'`。

## 4. 必须满足的硬性约束

### 4.1 持久化与副本数

- `server/storage/git-marketplace/` 是**唯一真实数据源**（DB 里的 `skill_categories`、
  `expert_domains`、`audit_rules` 等通过 `pg` 走远程 PG，与这个目录无关）。
- `git-market.service.ts:69` 把路径硬编码为 `process.cwd()/storage/git-marketplace`，
  K8s 上必须挂 PVC 到 `/app/server/storage`，否则 `EmptyDir` 在 pod 重建时**会丢所有
  审核通过的插件源码**（DB 里的 skill 记录还在，但 `downloadSkillAsZip` /
  `git upload-pack` 都拿不到文件，reconcile 也会失败）。
- `replicas: 1` 是默认且推荐 —— 内网工具型应用完全够用。
- 想要 `replicas: N>1`：必须 `accessModes: ReadWriteMany`（NFS / CephFS / Longhorn
  共享卷），且 `GitMarketService` 当前**没有分布式锁**，两个 pod 同时调用
  `syncApprovedSkillToGit` 会产生 racing commit。生产多副本前需要先在
  `service.ts` 加一行 PG advisory lock 或 Redis lock 包住写端。本场景**不建议做**。

### 4.2 Ingress body size

- 单个技能 ZIP 上限 50MB（`server/src/main.ts:23` 的 `json({ limit: '50mb' })` + 客户端
  限制），`deploy/k8s/skillhub.yaml:115` 的 `proxy-body-size: "64m"` 留了点余地，OK。
- **但 `POST /skillhub.git/git-upload-pack` 走 `raw({ limit: '100mb' })`，
  client 发的是整包 packfile**（不是单文件 ZIP），多个插件增量同步会超 100MB。
- 推荐把 ingress 注解统一调到 `256m`：

  ```yaml
  nginx.ingress.kubernetes.io/proxy-body-size: "256m"
  ```

  再不够就上 `1g`，K8s 网络层一般不差这点 buffer 内存。

### 4.3 Ingress streaming 超时

`git upload-pack` 是流式响应（HTTP/1.1 chunked，无 Content-Length），nginx-ingress
默认 `proxy-read-timeout: 60s` 会把长传输掐断。Claude Code 客户端会重试几次后报
`RPC failed; curl 56 GnuTLS recv error`。

加上：

```yaml
nginx.ingress.kubernetes.io/proxy-read-timeout: "1800"   # 30 分钟
nginx.ingress.kubernetes.io/proxy-send-timeout: "1800"
nginx.ingress.kubernetes.io/proxy-buffering: "off"        # 不缓存 packfile 流
```

如果走 Envoy / 自研反代，对应字段是 `route.idle_timeout` / `stream_idle_timeout`，
同样要放宽到分钟级。

### 4.4 SPA history fallback 与 `.git` 路径的冲突

`server/src/main.ts:48-58` 的 SPA fallback 用 `req.path.startsWith('/api')` 和
`req.path.includes('.git')` 把 Git 协议路径显式排除。这条排除在 NestJS 进程内自己
执行没问题，但**外层 ingress 不能再加 `try_files` / `rewrite` 把未匹配路径回根**，
否则 `GET /skillhub.git/info/refs` 会在 ingress 层被改写到 `/index.html`，整个
`marketplace add` 立即失败。`deploy/k8s/skillhub.yaml` 的 Ingress 写法是直传，没踩这个
坑，自定义 chart 时要保持。

## 5. 当前 `deploy/k8s/skillhub.yaml` 的差异清单

下表对照**当前清单**（`deploy/k8s/skillhub.yaml`）与 git-market 链路的**最低要求**，
标出可以补强的项：

| 项 | 当前 | 建议 | 原因 |
|---|---|---|---|
| 镜像 | `harbor.../skillhub:latest` | 保持 | OK |
| `replicas` | `1` | 保持 | 单副本无歧义 |
| PVC 容量 | `2Gi` | 视插件总量评估，单包 ZIP 不大，2Gi 可撑数百插件；超 50 个插件建议 `5Gi` | 仓库 packfile 会随版本数增长 |
| `proxy-body-size` | `64m` | 调到 `256m` | packfile 单包 > ZIP 单包 |
| streaming 超时 | 未设 | 显式 `proxy-read-timeout: 1800` 等 | 长 packfile 传输 |
| `readinessProbe` | `/api/v1/skills` | OK，或改为 `/api/v1/marketplace/manifest`（更轻、只读 JSON） | 不依赖 DB 全表 |
| `livenessProbe` | 缺 | 补 `httpGet /api/v1/skills` + `failureThreshold: 3` | 避免 git 子进程僵死后无限重启 |
| `startupProbe` | 缺 | 补 `httpGet /api/v1/skills` + `failureThreshold: 30, periodSeconds: 5` | 首次启动 `ensureRepoInitialized` 跑 git init/commit，可能 10-30s |
| `securityContext.runAsNonRoot` | 未设 | 视集群策略补 `runAsNonRoot: true` + `runAsUser: 1000` + `fsGroup: 1000` | 多数内网 K8s 已默认 restricted |
| `resources` | 250m / 256Mi（req），1 / 1Gi（limit） | 视并发调大；JSZip + git spawn 都是尖峰 | upload 期间 CPU 会跳 |
| 镜像 tag | `latest` | 生产改 immutable tag（如 commit SHA） | 回滚可追溯 |

完整补强版 `Deployment` 片段示例（只列增量，未列字段保持现状）：

```yaml
spec:
  replicas: 1
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: skillhub
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 2Gi
          startupProbe:
            httpGet: { path: /api/v1/skills, port: 3001 }
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            httpGet: { path: /api/v1/marketplace/manifest, port: 3001 }
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /api/v1/skills, port: 3001 }
            initialDelaySeconds: 30
            periodSeconds: 30
            failureThreshold: 3
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "256m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "1800"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "1800"
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
```

## 6. 启动期自愈（`reconcileGitMarketOnBoot`）

`SkillsService.reconcileGitMarketOnBoot()`（CLAUDE.md 描述）会在 NestJS 启动时跑一次：

- DB 中所有 `status='approved'` 的 skill，对照 `git-market.service.ts:isPluginLayoutValid()`
  检测 `/app/server/storage/git-marketplace/plugins/<slug>/.claude-plugin/plugin.json`
  是否仍合法（`skills: [...]` 全部为目录路径、`author` 为对象）。
- 非法（早期脏数据）→ 调 `syncApprovedSkillToGit` 重写。
- DB 中有但仓库没有 → 重新提交。
- 仓库有但 DB 中已下架/删除 → `rebuildMarketplaceIndex` 物理删目录 + 重建 manifest。

PVC 是**持久化**时，这个自愈只跑一次且幂等，无副作用。但如果 PVC 是 `EmptyDir` 或
被错挂为临时卷，**pod 重建后每次冷启动都会重做 `git init` + 全量 reconcile**，
DB 里的审核通过列表会被全量重新发布（功能上对，但增加启动时间）。

`startupProbe` 之所以必要：首次冷启动 + 0 插件 → `git init` + 一次空 commit ≈ 1-2s；
50 个插件 reconcile 全重写 ≈ 10-30s（受 PVC IO 性能影响）。默认 30s 启动窗口可能不够。

## 7. 健康探针的选择

不要把 git Smart HTTP 端点直接当探针：

- `GET /skillhub.git/info/refs?service=git-upload-pack` 会 `spawn('git', ...)`，
  每次探针触发额外开一个子进程，频率高（每 10s 一次 × 3 副本）会浪费 CPU。
- `POST /skillhub.git/git-upload-pack` 走 `raw` 解析 + 子进程，更重。

推荐：

- `readinessProbe`：`GET /api/v1/marketplace/manifest`（直接读 `marketplace.json` 文件）
- `livenessProbe`：`GET /api/v1/skills`（DB 已就绪即代表服务整体可用）
- `startupProbe`：同上，单独给宽窗口

## 8. 备份与恢复

`server/storage/git-marketplace/` 是**真 Git 仓库**，可走两种备份：

### 方式 A：PVC 快照（推荐）

```bash
# Velero 备份整个 PVC
velero backup create skillhub-storage --include-resources pvc \
  --selector app=skillhub
velero backup get

# 恢复
velero restore create --from-backup skillhub-storage
```

注意：snapshot 是文件系统级一致快照，但 `git upload-pack` 期间 snapshot 可能
捕获到 mid-write 的 packfile —— 恢复后跑一次 `git fsck` 校验。

### 方式 B：周期 `git bundle`

部署一个 CronJob，把仓库打包成 single-file bundle 推到对象存储：

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: skillhub-gitmarket-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: harbor.../skillhub:latest
              command: ["/bin/sh", "-c"]
              args:
                - |
                  git -C /app/server/storage/git-marketplace bundle create \
                    /tmp/skillhub-marketplace.bundle --all
                  # 然后用 mc / awscli / ossutil 推到对象存储
              volumeMounts:
                - name: storage
                  mountPath: /app/server/storage
                  readOnly: true
          restartPolicy: OnFailure
          volumes:
            - name: storage
              persistentVolumeClaim:
                claimName: skillhub-storage
```

恢复：`git clone /path/to/skillhub-marketplace.bundle /new/repo/dir` → 整体覆盖 PVC。

### 灾难场景

- **PVC 损坏** + 无备份：用 `scripts/regression-test.mjs` 跑一次，会通过 API 触发
  `approveSkill`，由后端 `syncApprovedSkillToGit` 重建仓库（前提是 DB 没丢）。
- **DB 损坏** + PVC 在：仓库能读但没人触发发布，从 DB 恢复后跑一次
  `reconcileGitMarketOnBoot` 即可（pod 滚动重启自动触发）。

## 9. 故障排查

### 9.1 客户端 `marketplace add` 报 `Repository not found` / 502

```bash
# 1. 直接打 info/refs 端点，看是否拿到 pkt-line
kubectl -n skillhub port-forward svc/skillhub 3001:3001
curl -i "http://localhost:3001/skillhub.git/info/refs?service=git-upload-pack"
# 期望：HTTP/1.1 200 + Content-Type: application/x-git-upload-pack-advertisement
# 首行长度 4 字节 hex 开头，例如 "001e# service=git-upload-pack\n"

# 2. 看 pod 日志里有没有 ENOENT / spawn ENOENT
kubectl -n skillhub logs deploy/skillhub | grep -iE "git|spawn|ENOENT"
# ENOENT → 镜像没装 git，回到 Dockerfile
# 没输出但 curl 是 502 → ingress 改写了路径
```

### 9.2 客户端能 add 但 `install` 报 `RPC failed`

- 99% 是 ingress 把 packfile 流截断了。
- `kubectl -n skillhub logs` 看 `Git upload-pack transfer stderr`，正常为空；
  有内容说明 `git` 进程本身报错（仓库损坏 / 权限）。
- 抓 ingress 侧：`kubectl logs -n ingress-nginx <controller-pod>` 看是否有
  `client sent invalid chunked body` / `upstream timed out`。

### 9.3 `approveSkill` 后 git-market 没有更新

```bash
# 看 reconcile 是不是失败
kubectl -n skillhub logs deploy/skillhub | grep -iE "syncApproved|isPluginLayout|rebuildMarket"

# 直接进 pod 查
kubectl -n skillhub exec -it deploy/skillhub -- bash
cd /app/server/storage/git-marketplace
git log --oneline | head    # 确认有 release-bot commit
cat .claude-plugin/marketplace.json | head -40
```

常见原因：

- PVC `ReadOnlyMany` 被错挂（`syncApprovedSkillToGit` 写不进去）。
- `runAsNonRoot` + 没 `fsGroup` → PVC 在 pod 第一次写入时 `Permission denied`。

### 9.4 `git: not found` 但 `which git` 在镜像里能找到

基本不会发生，但如果用 `kubectl exec` 进 pod 看到的 PATH 和 controller 实际
spawn 的 PATH 不一致，原因是 controller `spawn` 不带 `env`，只继承
`process.env`。在 K8s 里这意味着 `PATH` 来自容器镜像的 `ENV`，如果用了
`command: [/bin/sh, -c, "node dist/main"]` 之类的包装脚本而脚本里 `unset PATH`，
会断。`Dockerfile` 里没有显式 `ENV PATH=...`，依赖 base 镜像默认（`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`），正常包含 `/usr/bin/git`。

## 10. 与现有文档的关系

- **镜像构建**：`docs/deployment-guide.md` §8.1（Dockerfile 多阶段 + git 安装）。
- **基础 K8s 清单**：`deploy/k8s/skillhub.yaml`（Namespace / Secret / ConfigMap / PVC /
  Deployment / Service / Ingress），可直接 `kubectl apply -f`。
- **本文新增**：
  - 协议层 `raw()` 解析与 content-type 的耦合（§2）
  - streaming 超时与 body size 的具体数值与原因（§4.2-4.4）
  - 探针选择与启动期窗口（§5、§7）
  - 备份方案（§8）
  - 故障排查的 git 专属命令（§9）

升级 `deploy/k8s/skillhub.yaml` 时建议同步把 §5 表格里的「建议」列落到清单里。
