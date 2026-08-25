# SkillHub 部署说明

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
