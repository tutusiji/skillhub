# Remix SkillHub - 企业 AI 技能与插件市场

面向企业内网与私有化部署的 **AI 技能/插件集市**。系统采用前后端一体化架构，支持 **Claude Code 原生插件市场协议**、**双引擎安全风控审核（正则 + DeepSeek LLM）**、**在线源码树预览**、**多端一键直装** 与 **全生命周期管理**。

---

## ✨ 核心特性

- 🏢 **企业私有化 Git 插件市场**：内置符合 RFC 9017 规范的 Git Smart HTTP 协议，无需搭建复杂的 GitLab/Gitea，单服务即可充当 Claude Code 的私有插件市场。
- ⚡ **Claude Code 原生直装**：
  - 仅需一次性添加市场：`/plugin marketplace add http://skillhub.corp/skillhub.git`
  - 随时安装任意技能：`/plugin install <plugin-name>@skillhub`
- 🛡️ **双引擎安全风控沙箱**：
  - **引擎 1（正则特征库）**：毫秒级拦截硬编码密钥、敏感文件窃取、提权命令与内网 SSRF 风险；
  - **引擎 2（DeepSeek-V4 LLM 语义推理）**：深度研判 Prompt 注入、混淆越狱与隐蔽数据外发。
- 📦 **自动化 Git 同步发布管道**：Web 端上传 ZIP 源码包，审核通过后自动规范化解压、自动更新 `marketplace.json`、自动生成 Git Commit。
- 🧬 **多版本发布与元数据自编辑**：同一插件支持多版本共存/替换（`coexist` / `replace`），审核通过自动归档父版本并继承计数，作者可自编辑元数据，管理员可回滚链上历史版本。
- 💻 **多客户端兼容**：同时支持 Claude Code、Cursor、MCP Server 协议与企业级 SkillHub CLI。

---

## 🏗️ 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│                      客户端生态 (Clients)                   │
│   Claude Code CLI  │  Cursor IDE  │  Web 浏览器  │  CLI 工具 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Git Smart HTTP
┌──────────────────────────────▼──────────────────────────────┐
│                    SkillHub 统一后端 (NestJS)                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Git 市场模块 (isomorphic-git, /skillhub.git)            │ │
│ │ 技能生命周期 (ZIP 解析, 文件树索引, 版本分发)             │ │
│ │ 双引擎风控网关 (Regex 规则库 + DeepSeek-V4 语义研判)    │ │
│ │ 多端安装协议转换器 (Claude / Cursor / MCP / CLI)         │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      数据与存储层 (Storage)                  │
│        PostgreSQL             │   内置 Git 市场仓库 / ZIP 池 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 开发与运行

### 0. 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 20（实测 22.22.3） | 后端用到全局 `fetch`，请勿低于 18 |
| pnpm | ≥ 9（实测 11.3.0） | 本仓库是 pnpm workspace，不要用 npm/yarn 安装 |
| git | 任意近期版本 | 插件市场的 `git-upload-pack` 会调用系统 `git` 二进制 |
| PostgreSQL | 14+（必需） | 唯一数据库，见「数据库」章节 |

### 1. 安装依赖

```bash
pnpm install
```

根目录和 `server/` 都是 workspace 成员（见 `pnpm-workspace.yaml`），**一条命令会同时装好前后端**，不需要再 `cd server && pnpm install`。

后端依赖含原生模块（`pg`、`esbuild`），已在 `pnpm-workspace.yaml` 的 `allowBuilds` 中放行，首次安装会编译，耗时略长。

### 2. 配置环境变量

两个应用读**不同**的 env 文件，这一点最容易踩坑：

- **前端**读根目录 `.env`（Vite 约定，仅 `VITE_` 前缀变量生效）
- **后端**读 `server/.env` / `server/.env.local`（`envFilePath` 相对进程工作目录，而后端进程的工作目录是 `server/`）

最小可用配置：

```bash
# 根目录 .env —— 留空表示走 Vite 代理，与后端同源，推荐
echo 'VITE_API_BASE_URL=""' > .env
```

`server/.env` 需配置 PostgreSQL 连接（见「数据库」章节）；LLM 三项留空时语义引擎降级为本地启发式规则。按需补：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `APP_ENV` | `dev` | 环境标识（dev/test/prod），决定加载 `server/.env.<APP_ENV>` 覆盖配置 |
| `PORT` | `3001` | 后端监听端口 |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | 仅 Postgres 模式生效 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `postgres` / `postgres` / `skillhub` | 仅 Postgres 模式生效 |
| `DATABASE_URL` | 空 | 填了就优先于上面几项，且自动按 Postgres 连接 |
| `IAM_BASE_URL` / `IAM_API_TOKEN` | 空 | 内部 IAM 单点登录；留空走本地桩（7 位数字工号） |
| `LLM_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 任意 OpenAI 兼容网关（通义百炼 / DeepSeek / vLLM） |
| `LLM_MODEL_NAME` | `qwen-plus` | 语义审核引擎所用模型 |
| `LLM_API_KEY` | 空 | **只在首次启动时播种进数据库**，之后由「风控中心 → 大模型网关」界面维护 |

`LLM_*` 均可留空：留空时双引擎审核的「引擎 2」自动降级为本地启发式规则，审核链路不中断。
模型调用**不依赖任何大模型 SDK**，直接以 OpenAI 兼容协议调网页接口，前端网关配置页提供
通义千问 / DeepSeek / 内网网关的厂商快捷回填。

### 3. 启动开发环境

需要**两个终端**，先起后端：

```bash
# 终端 1：NestJS 后端，监听 3001，watch 模式
pnpm run server:dev

# 终端 2：Vite 前端开发服务器，监听 7001
pnpm run dev
```

打开 [http://localhost:7001](http://localhost:7001)。登录方式：

| 方式 | 账号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 超级管理员 | `admin` | `skill@2026` | 唯一可委任管理员；可进审核、风控中心与权限设置 |
| 普通用户（预置） | `7462201`（陈建国） | `Password123!` | 演示普通用户 |
| 普通用户（预置） | `7462202`（张伟） | `Password123!` | 演示普通用户 |
| 模拟用户 | `huang.kun11` 或工号 `7462200` | `Password123!` | 黄坤，未来实验室/研究四部；名下有演示技能、悬赏需求与建议 |
| 模拟用户 | `wang.fang` / `li.na` / `zhao.qiang` / `chen.chen` | `Password123!` | 未来实验室各研究组模拟员工 |
| 内部 OSS 登录 | 任意 7 位数字工号 | 免密 | 走 IAM 桩校验并自动开号，如 `7462200` |
| 自助注册 | 6-12 位数字工号 | 自定义 | 新账号固定为普通用户 |

> 账号标识：普通员工用工号（或登录名），超级管理员用登录名 `admin`。登录接口后端同时兼容邮箱
> 作为历史账号的兜底通道，但前端只暴露工号/登录名输入框。
> 预置账号仅在空库首启时播种；模拟员工与演示数据由启动时的幂等播种（`demo-data` 模块）自动补齐，
> 可安全重复执行，不影响真实数据。
>
> ⚠️ **上表全部账号仅存在于非生产环境**。生产环境（`APP_ENV=prod`）默认跳过所有演示数据播种
> （因为它们共用弱口令 `Password123!`），只保留超级管理员 `admin`，且必须在首次登录后立即改密。
> 生产上线前请对照 `docs/deployment-guide.md` 的「生产上线前的安全检查清单」逐项确认。

首次启动后端会自动完成建表、播种预置账号 / 审核规则 / 示例悬赏需求，并初始化 `server/storage/git-marketplace` 这个 Git 市场仓库，**无需任何手工初始化步骤**。

管理入口速览（都在右上角用户下拉菜单里）：

- **权限设置**（仅超管）：委任管理员，并为每个管理员勾选「审核管理 / 风控中心」菜单权限，未勾选的菜单该用户登录后不可见。
- **技能征集管理**：征集需求市场 + 管理员审核队列（普通用户仍可发布悬赏）。
- **建议管理**（下拉菜单仅管理员；右下角「建议反馈」悬浮按钮全员可用）：管理员查看全部员工建议并可删除；普通用户查看自己的建议并提交新建议。
- **分类和专家组管理**：管理员维护技能分类标签，并按岗位专家组为已上架技能打标（专家组即标签，一个技能可属于多个专家组）。

> 所有页面右下角固定悬浮两个按钮：「建议反馈」（竖向文字，全员可见，点击进入建议反馈页）与「返回顶部」。

几个开发期行为值得知道：

- Vite 把 `/api`、`/skillhub.git`、`/market.git`、`/.claude-plugin` 全部代理到 `BACKEND_TARGET`（默认 `http://127.0.0.1:3001`），所以前后端同源，浏览器不会有 CORS 问题。
- 7001 被占用时 Vite 会自动落到 7002、7003……注意看终端实际输出的端口。
- 后端没起时页面不会白屏：前端会退回本地演示数据，`<Header>` 上的状态点变琥珀色；接口则返回可读的 502 提示。
- `DISABLE_HMR=true` 可关掉 HMR 与文件监听（为 AI Studio / agent 批量改文件设计）。

### 4. 校验改动

```bash
pnpm run lint             # tsc --noEmit，本项目唯一的「lint」
pnpm run test:regression  # API 回归断言（当前约 360 条，随市场插件数波动），需后端已在运行
pnpm run test:plugin-e2e  # 调真实 claude CLI 走完市场添加→安装→卸载全链路（当前约 171 条断言）；未装 claude 会跳过
pnpm run test:all         # 上面三个串起来
```

`test:plugin-e2e` 会读写 `~/.claude/`（用户级配置），执行前会自动备份 `known_marketplaces.json`。

两个测试脚本都接受 base URL 参数，可直接打到远端：

```bash
node scripts/regression-test.mjs https://your-host:7300
```

回归脚本会自行清理它创建的数据，并恢复运行前的 LLM 配置，可安全重复执行。项目**没有单元测试框架**，这两个可执行套件就是全部回归保障。

### 5. 常用命令速查

```bash
pnpm run dev            # 前端 dev server (7001)
pnpm run build          # 构建前端到 dist/
pnpm run preview        # 预览前端构建产物
pnpm run lint           # 类型检查
pnpm run server:dev     # 后端 watch 模式 (3001)
pnpm run server:build   # 后端编译到 server/dist/
pnpm run server:start   # 以生产模式跑后端 (node dist/main)
```

---

## 🧭 页面路由

前端使用**路径型路由**（非 hash），可直接分享书签：

| 路径 | 页面 |
| --- | --- |
| `/` | 技能集市 |
| `/demands` | 技能征集（管理） |
| `/personal` | 个人中心 |
| `/audit` | 审核管理（管理员） |
| `/rules` | 风控中心（管理员） |
| `/settings` | 权限设置（仅超级管理员） |
| `/feedback` | 建议管理 |
| `/manage` | 分类和专家组管理（管理员） |
| `/skill/:slug` | 技能详情 |

旧的 `#tab=xxx` / `#skill=xxx` 链接会在访问时自动迁移到对应路径。菜单级权限（审核管理、风控中心）
由超级管理员在「权限设置」页按用户勾选，未勾选的用户登录后看不到对应菜单。

---

## 🗄️ 数据库

`server/src/database/database.module.ts` 同时支持两种数据库，靠环境变量切换，实体定义共用：

数据库统一使用 **PostgreSQL**。先建库，再在 `server/.env` 配置连接：

```bash
createdb skillhub
cat >> server/.env <<'EOF'
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=your_pg_user
DB_PASSWORD=your_pg_password
DB_NAME=skillhub
EOF
```

连接参数也可用 `DATABASE_URL` 一次性指定（优先级更高）。

内网 dev / test / prod 通常各有一套 PostgreSQL：把各环境的连接写入 `server/.env.test` / `server/.env.prod`
（不入库），启动时用 `APP_ENV` 切换即可（详见 [`docs/deployment-guide.md`](docs/deployment-guide.md) 第 5.3 节）。

两点注意：

1. `synchronize: true` 目前对两种数据库都开着 —— 改实体定义会让 TypeORM 自动改表结构，**生产环境的表结构变更请先备份**。
2. `server/storage/` 全是运行时数据（Git 市场仓库），已被 gitignore，由启动流程自动重建，不要提交或手工编辑。删掉 `server/storage/git-marketplace` 是安全的，下次启动会自愈。

---

## 📦 生产部署

生产是**单进程**：`server/src/main.ts` 检测到 `../dist/index.html` 存在时，由 NestJS 直接托管前端构建产物，不需要跑 Vite。

```bash
pnpm run build && pnpm run server:build
pnpm run server:start          # 或用 systemd 常驻
```

**推荐部署方式：Kubernetes + 远程 PostgreSQL**（应用镜像构建推送一次到内网 registry，数据库用集群外远程实例，无需为数据库打镜像）。完整指南（数据库配置、systemd、Docker、Kubernetes、内网域名与 frp/HTTPS 接入、备份升级）见：
**[`docs/deployment-guide.md`](docs/deployment-guide.md)**。systemd 用户服务与 frp 简版见 [`deploy/README.md`](deploy/README.md)。

要点：对外入口指向后端 **3001**（不是 Vite 的 7001）；安装指令中的市场地址随访问域名动态生成。

---

## 🔧 故障排查

| 症状 | 原因与处理 |
| --- | --- |
| `/api/*` 返回 5xx / 502 | 几乎总是 NestJS 进程没起。前端自身没有后端，代理上游挂了拿不到 404。先 `ss -ltnp \| grep 3001` 确认，再 `pnpm run server:dev` |
| 页面能开但数据是假的、状态点是琥珀色 | 后端不可达，前端已回退演示数据。同上排查 |
| 前端起在 7002 / 7003 | 7001 被占用，Vite 自动顺延，以终端输出为准 |
| 页面状态错乱 / 想清空本地数据 | 业务数据全部以数据库为准，本地仅存登录令牌。`src/main.tsx` 的 ErrorBoundary 提供「重置缓存并恢复」，会清掉本地会话令牌与历史残留键并刷新（退出登录、回到访客态） |
| 超管账号提示密码不对 | 首次启动后超管初始密码为 `skill@2026`；若数据库里已存在同名账号，`onModuleInit` 会把它校正为超管并重置为初始密码。改过密码后不要乱删 `users` 表 |
| OSS 登录提示工号无效 | 未配置 `IAM_BASE_URL` 时桩实现只接受 7 位数字工号；配置后校验逻辑看 `server/src/modules/auth/oss-iam.service.ts` |
| `pnpm install` 卡在原生模块编译 | `pg` / `esbuild` 需要本地编译，属正常耗时；缺编译工具链时装一下 `build-essential`、`python3` |
| 审核报告里语义引擎结论是 `heuristic` | 未配 LLM 凭据或调用失败，已按设计降级。查 `llmVerdict.degradedReason`，或到「风控中心 → 大模型网关」做连通性测试 |
| 后端日志报 `invalid input syntax for type uuid` | Postgres 下用非法格式 id 查 uuid 主键。新增此类查询请走 `server/src/common/db-id.util.ts` 的 `isUuid` / `findByUuid` |

---

## 📖 Claude Code 插件市场使用指南

> **市场地址是动态的**：`marketplace add` 的地址根据你当前访问的域名自动生成（`<当前访问地址>/skillhub.git`）。
> 开发、测试、生产环境（如 `tech-dev.com:17200` / `tech-test.com:17200` / `tech.com:17200`）无需改代码，访问哪个环境就复制哪个地址。

### 第一步：在 Claude Code 中注册企业私有市场（仅需 1 次）
```bash
/plugin marketplace add <你当前访问的地址>/skillhub.git
```

### 第二步：安装任意企业技能
```bash
/plugin install sql-diagnose-agent@skillhub
/plugin install superpowers@skillhub
```

### 第三步：市场新增/更新插件后，同步拉取最新清单
```bash
/plugin marketplace update skillhub
```

> 新插件发布后必须执行第三步，否则客户端拉不到新插件。技能详情页的「安装指令」区域也会展示同款命令（`claude plugin marketplace update skillhub`），带一键复制。
>
> 插件安装落点：`marketplace add` 把市场仓库克隆到 `~/.claude/plugins/marketplaces/skillhub/`（源）；
> `plugin install` 把单个插件复制到 `~/.claude/plugins/cache/skillhub/<插件>/<版本>/`（Claude Code 实际加载的安装副本）。

---

## 🛠️ 项目工程结构

```text
gemini-skillhub/
├── src/                    # React 19 + Vite 前端应用
│   ├── components/         # UI 组件（集市、详情、审核、分类专家组管理、建议反馈等）
│   ├── hooks/              # 数据 hook（useExpertDomains 等）
│   ├── mock/               # 离线演示数据（业务数据以数据库为权威）
│   ├── services/           # API 客户端（api.ts）
│   └── types/              # TypeScript 核心业务实体类型定义
├── server/                 # NestJS 企业级后端服务
│   ├── src/
│   │   ├── modules/
│   │   │   ├── git-market/       # Git Smart HTTP 协议与自动 Commit 模块
│   │   │   ├── skills/           # 技能 CRUD、ZIP 无损上传解析与版本管理
│   │   │   ├── audit/            # 双引擎风控审计网关（正则 + LLM 语义）
│   │   │   ├── auth/             # 工号/登录名鉴权、OSS 单点登录、RBAC
│   │   │   ├── demands/          # 技能征集悬赏市场
│   │   │   ├── feedback/         # 建议反馈管理
│   │   │   ├── skill-categories/ # 技能分类标签管理
│   │   │   ├── expert-domains/   # 岗位专家组管理（技能归属标签）
│   │   │   └── demo-data/        # 演示用户与数据播种（幂等）
│   │   ├── database/       # 数据库实体与 ORM Schema
│   │   └── main.ts         # 服务入口与全局配置
│   └── package.json
├── docs/                   # 架构文档（database-schema.md 等）
├── scripts/                # 回归测试等脚本
├── package.json            # 前端工程配置
└── tsconfig.json
```

---

## 📝 开发规范

- 所有前后端业务函数必须包含规范的**中文注释**。
- 保持前后端 TypeScript 类型定义的高度一致与复用。
