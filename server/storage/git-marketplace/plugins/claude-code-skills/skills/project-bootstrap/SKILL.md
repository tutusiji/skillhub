---
name: project-bootstrap
description: 项目脚手架 — 一键生成项目基础结构，包含目录规范、CI 配置、测试框架、文档模板。开始新项目时使用。
---

# 项目脚手架

快速创建符合规范的项目骨架。

## 支持的项目类型

- **Node.js API** — Express/Fastify + TypeScript + Jest + ESLint
- **Go Service** — 标准布局 + go test + golangci-lint
- **Python Service** — FastAPI + pytest + ruff
- **React Frontend** — Vite + TypeScript + Vitest + Tailwind

## 生成内容

每个项目骨架包含：

```
project/
├── .github/workflows/     # CI 流水线
│   └── ci.yml             # lint + test + build
├── src/                   # 源码目录
├── tests/                 # 测试目录
├── docs/                  # 文档
│   └── README.md
├── .gitignore
├── .editorconfig
├── package.json / go.mod  # 依赖管理
└── Makefile               # 常用命令封装
```

## 使用方式

1. 确认项目类型和技术栈
2. 询问项目名称和描述
3. 生成目录结构和配置文件
4. 初始化 git 仓库
5. 创建初始 README 和 CHANGELOG
