# SkillHub 部署说明（systemd 简版）

> 完整内网部署指南（数据库迁移 / Docker / Kubernetes / frp / HTTPS 反代 / 备份升级）见
> [`docs/deployment-guide.md`](../docs/deployment-guide.md)。本文为 systemd 直接部署的速查。
>
> K8s 部署下 **Git Smart HTTP 协议端点**（`skillhub.git`、`market.git`）的
> 专项注意事项（ingress body size / streaming 超时 / 探针 / 备份 / 排障）见
> [`docs/git-smart-http-k8s.md`](../docs/git-smart-http-k8s.md)。

## 单进程生产模式

`server/src/main.ts` 在检测到 `../dist/index.html` 存在时，会由 NestJS 直接托管前端
构建产物（静态资源 + SPA history fallback），因此**生产环境只需要跑一个进程**：

- `/api/v1/*` → NestJS 接口
- `/skillhub.git`、`/.claude-plugin/*` → Claude Code 插件市场（Git Smart HTTP）
- 其余 GET → `dist/index.html`（前端 SPA）

对外入口不再依赖 Vite dev server（dev server 仅本地开发使用）。

## 安装 systemd 用户服务

```bash
# 1. 构建前端与后端产物
cd /home/tutuos/CodeLab/gemini-skillhub
pnpm run build && pnpm run server:build

# 2. 安装并启用服务（用户级，已开启 linger，重启后自动拉起）
cp deploy/skillhub-server.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now skillhub-server

# 3. 查看状态与日志
systemctl --user status skillhub-server
journalctl --user -u skillhub-server -f
```

## 常用运维命令

```bash
systemctl --user restart skillhub-server   # 重新部署后重启
systemctl --user stop skillhub-server      # 停止
loginctl show-user "$USER" | grep Linger   # 确认 Linger=yes（否则退出登录服务会被回收）
```

## 更新流程

```bash
git pull
pnpm install
pnpm run build && pnpm run server:build
systemctl --user restart skillhub-server
```

## 对外映射（frp）

`/etc/frp/frpc.toml` 中 `skillhub-dev` 代理需指向后端 **3001** 端口，
而不是 Vite 的 7001：

```toml
[[proxies]]
name = "skillhub"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3001      # 单进程模式：后端同时提供前端页面
remotePort = 17300
```

修改后执行 `sudo systemctl restart frpc` 生效。

## LLM 审核引擎配置

双引擎中的「语义研判引擎」支持任意 OpenAI 兼容网关（DeepSeek / 通义 / vLLM / 内网代理）。

两种配置方式，二选一即可：

1. **环境变量播种**（首次启动生效，适合运维预置）——在 `server/.env` 或 systemd 单元里加：

   ```ini
   Environment="LLM_BASE_URL=https://api.deepseek.com/v1"
   Environment="LLM_MODEL_NAME=deepseek-chat"
   Environment="LLM_API_KEY=sk-xxxxxxxx"
   ```

2. **管理端界面**（推荐日常使用）——登录后进入「风控中心 → 大模型网关」，
   填写 Base URL / API Key / 模型名，点「测试网关连通性」由服务端发起真实探测，
   确认通过后勾选「启用真实大模型语义研判」并保存。

要点：

- API Key 仅存服务端数据库，接口只回传掩码，前端不缓存明文。
- 三项全部留空也能正常跑：语义引擎自动降级为本地启发式规则，审核流程不中断，
  报告里会标注 `engine: heuristic` 与降级原因。
- 超时（默认 20s）与重试次数（默认 2 次）可在界面调整；4xx 凭据错误不会重试。

## 回归测试

部署或升级后建议跑一遍：

```bash
pnpm run test:regression                          # API 回归断言（当前约 360 条，随市场插件数波动）
pnpm run test:plugin-e2e                          # 约 171 条真实 claude CLI 插件安装断言
node scripts/regression-test.mjs https://souxy.com:7300   # 顺带验证公网隧道
```

多版本发布流程（元数据自编辑 / coexist+replace 发布 / 归档可见性 / 管理员回滚）已纳入回归，
`pnpm run test:regression` 时自动覆盖（group 18）。
