---
name: gstack
description: gstack 技能套件路由器 — 将请求分派到合适的专家技能：规划、审查、QA、发布、调试、文档、安全、设计。使用 gstack 但未指定具体技能时触发。
---

# gstack 路由器

gstack 是一套 23 个工具的集合，将 Claude Code 变成虚拟工程团队。此技能负责将请求路由到对应的专业技能。

## 可用技能

| 技能 | 角色 | 使用场景 |
|------|------|----------|
| `/gstack:office-hours` | CEO | 产品拷问 — 你到底在做什么？ |
| `/gstack:plan-ceo-review` | CEO | 对功能想法的战略挑战 |
| `/gstack:plan-eng-review` | 工程经理 | 实现前的架构锁定 |
| `/gstack:plan-design-review` | 设计师 | 实现前的设计评审 |
| `/gstack:review` | 审查员 | 在任何分支上查找生产级 bug |
| `/gstack:qa` | QA 主管 | 打开真实浏览器测试 staging URL |
| `/gstack:ship` | 发布工程师 | 以规范的提交卫生发布 PR |
| `/gstack:cso` | 安全官 | OWASP + STRIDE 安全审计 |
| `/gstack:design-consultation` | 设计师 | 一对一设计反馈 |
| `/gstack:design-shotgun` | 设计师 | 快速设计迭代 |
| `/gstack:design-html` | 设计师 | 从设计生成生产级 HTML |
| `/gstack:land-and-deploy` | 发布工程师 | 一步合并并部署 |
| `/gstack:canary` | 发布工程师 | 金丝雀部署与回滚 |
| `/gstack:investigate` | 调试专家 | 根因调试方法论 |
| `/gstack:retro` | 工程经理 | 每周工程回顾 |
| `/gstack:document-release` | 文档工程师 | 生成发布文档 |
| `/gstack:document-generate` | 文档工程师 | 生成 API 文档、README 等 |
| `/gstack:autoplan` | 规划师 | 自动生成实现计划 |
| `/gstack:learn` | 学习者 | 捕获并编码经验教训 |

## 路由逻辑

当用户说"用 gstack"但未指定技能时：
1. 描述功能想法 → 路由到 `/gstack:office-hours`
2. 有变更待审查 → 路由到 `/gstack:review`
3. 想测试 → 路由到 `/gstack:qa`
4. 想发布 → 路由到 `/gstack:ship`
5. 提到安全 → 路由到 `/gstack:cso`
6. 其他 → 询问需要哪个技能
