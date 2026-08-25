---
name: git-commit-pro
description: Git 提交规范助手 — 分析代码变更，自动生成符合 Conventional Commits 规范的中文提交信息。执行 git commit 前使用。
---

# Git 提交规范助手

分析 `git diff` 和 `git status`，自动生成规范的中文 commit message。

## 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

## 类型 (type)

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | 新增用户导出接口 |
| fix | 修复 Bug | 修复登录超时不跳转问题 |
| docs | 文档变更 | 更新 API 使用说明 |
| style | 代码格式 | 统一缩进为 2 空格 |
| refactor | 重构 | 提取公共验证逻辑到 utils |
| perf | 性能优化 | 减少列表页重复渲染 |
| test | 测试相关 | 补充订单模块单元测试 |
| chore | 构建/工具 | 升级依赖版本 |
| ci | CI/CD | 添加自动化部署流程 |
| revert | 回退 | 回退 v2.1.0 的缓存改动 |

## 范围 (scope)

用模块名或功能区域表示影响范围：
- `feat(auth): 新增手机号验证码登录`
- `fix(api): 修复分页参数 off-by-one 错误`
- `refactor(utils): 提取日期格式化公共方法`

## Subject 规范

- 用中文，不超过 50 字
- 不加句号
- 祈使句语气：「新增」「修复」「优化」而非「新增了」
- 说做了什么，不说为什么（为什么放 body）

## Body 规范

- 解释为什么做这个改动
- 每行不超过 72 字
- 多点用空行分隔的列表

## Footer

- Breaking changes: `BREAKING CHANGE: 登录接口参数从 token 改为 sessionId`
- 关联 issue: `Closes #123`, `Refs #456`

## 工作流程

1. 执行 `git diff --staged` 获取暂存区变更
2. 分析变更文件和内容，判断类型和范围
3. 生成符合规范的 commit message
4. 展示建议，用户确认后执行提交

## 多文件变更

如果一次提交涉及多个模块：
- 选最大的变更类型作为 type
- scope 用 `*` 或省略
- body 里分模块列出改动

```
feat(*): 新增用户管理模块

- auth: 新增手机号验证码登录
- api: 新增用户 CRUD 接口
- ui: 新增用户列表和详情页
```
