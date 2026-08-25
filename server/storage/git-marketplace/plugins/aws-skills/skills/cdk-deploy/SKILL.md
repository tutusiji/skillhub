---
name: cdk-deploy
description: AWS CDK 部署技能 — 基础设施即代码编写、CDK Stack 设计、部署流水线配置。使用 CDK/SST 定义和部署 AWS 资源时使用。
---

# AWS CDK 部署

使用 CDK 定义基础设施，遵循最佳实践。

## CDK Stack 设计原则
- 一个 Stack 对应一个部署单元
- 资源依赖用 `addDependency()` 显式声明
- 敏感配置用 Secrets Manager / SSM Parameter Store
- 跨 Stack 引用用 `cdk.Fn.importValue()` 或 SSM

## 部署流程
1. `cdk synth` — 生成 CloudFormation 模板，检查
2. `cdk diff` — 对比线上差异
3. `cdk deploy` — 部署（自动创建 Changeset）
4. `cdk destroy` — 清理（慎用）

## 常见陷阱
- 不要在 Stack 中硬编码 ARN，用 `Stack.of(this).partition` 等
- Lambda 函数内存从 128MB 起调，按需调整
- IAM 最小权限原则，避免 `Action: "*"`
- CloudFormation 资源限制 500 个/Stack，超出需拆分
