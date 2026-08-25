---
name: workflow-orchestration
description: 工作流编排 — 定义和执行多步骤任务流程，支持条件分支、并行执行、错误重试。需要自动化复杂开发流程时使用。
---

# 工作流编排

将复杂任务分解为可编排的自动化流程。

## 工作流定义

```yaml
name: feature-delivery
steps:
  - id: spec
    skill: spec-writing
    output: spec_doc

  - id: plan
    depends_on: [spec]
    skill: planning
    input: { spec: "$spec_doc" }

  - id: implement
    depends_on: [plan]
    parallel: true
    skill: subagent-driven-development
    input: { plan: "$plan" }

  - id: review
    depends_on: [implement]
    skill: code-review
    on_failure: { retry: 2 }

  - id: ship
    depends_on: [review]
    condition: "review.passed == true"
    skill: ship
```

## 核心概念

- **步骤 (step)** — 一个原子任务，调用一个 skill
- **依赖 (depends_on)** — 步骤间的前置关系
- **并行 (parallel)** — 无依赖的步骤可并行执行
- **条件 (condition)** — 根据上一步输出决定是否执行
- **重试 (on_failure)** — 失败后自动重试 N 次

## 使用场景
- 功能交付全流程: 规划 → 实现 → 审查 → 发布
- Bug 修复流程: 复现 → 定位 → 修复 → 验证 → 发布
- 代码重构流程: 影响分析 → 拆分任务 → 逐步重构 → 验证
