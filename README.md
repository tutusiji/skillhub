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
  - **引擎 2（DeepSeek-V3 LLM 语义推理）**：深度研判 Prompt 注入、混淆越狱与隐蔽数据外发。
- 📦 **自动化 Git 同步发布管道**：Web 端上传 ZIP 源码包，审核通过后自动规范化解压、自动更新 `marketplace.json`、自动生成 Git Commit。
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
│ │ 双引擎风控网关 (Regex 规则库 + DeepSeek-V3 语义研判)    │ │
│ │ 多端安装协议转换器 (Claude / Cursor / MCP / CLI)         │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      数据与存储层 (Storage)                  │
│    PostgreSQL (元数据/JSONB)   │   内置 Git Bare 仓库/ZIP池  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装根目录及前端依赖
pnpm install

# 进入服务端目录并安装后端依赖
cd server && pnpm install
```

### 2. 本地启动开发环境

```bash
# 启动前端开发服务器 (端口 7001)
pnpm run dev

# 启动 NestJS 后端服务 (端口 3001)
cd server && pnpm run start:dev
```

访问前端页面：[http://localhost:7001](http://localhost:7001)
后端 API 根地址：[http://localhost:3001](http://localhost:3001)
Git 市场地址：`http://localhost:3001/skillhub.git`

前端默认连接 `http://localhost:3001`，可通过根目录 `.env` 的 `VITE_API_BASE_URL` 覆盖。后端不可用时，前端会自动回退到本地演示数据。

---

## 📖 Claude Code 插件市场使用指南

### 第一步：在 Claude Code 中注册企业私有市场（仅需 1 次）
```bash
/plugin marketplace add http://localhost:3001/skillhub.git
```

### 第二步：安装任意企业技能
```bash
/plugin install sql-diagnose-agent@skillhub
/plugin install k8s-auto-ops-copilot@skillhub
```

### 第三步：拉取最新技能更新
```bash
/plugin marketplace update skillhub
```

---

## 🛠️ 项目工程结构

```text
gemini-skillhub/
├── src/                    # React 19 + Vite 前端应用
│   ├── components/         # UI 组件 (市场看板、详情页、审核中心、文件树)
│   ├── mock/               # 本地开发 Mock 数据
│   └── types/              # TypeScript 核心业务实体类型定义
├── server/                 # NestJS 企业级后端服务
│   ├── src/
│   │   ├── modules/
│   │   │   ├── git-market/ # Git Smart HTTP 协议与自动 Commit 模块
│   │   │   ├── skills/     # 技能 CRUD、ZIP 上传解析与版本管理
│   │   │   ├── audit/      # 双引擎风控审计网关 (Regex + DeepSeek)
│   │   │   └── auth/       # 企业鉴权与 Token 守卫
│   │   ├── database/       # 数据库模型与 ORM Schema
│   │   └── main.ts         # 服务入口与全局配置
│   └── package.json
├── package.json            # 前端工程配置
└── tsconfig.json
```

---

## 📝 开发规范

- 所有前后端业务函数必须包含规范的**中文注释**。
- 保持前后端 TypeScript 类型定义的高度一致与复用。
