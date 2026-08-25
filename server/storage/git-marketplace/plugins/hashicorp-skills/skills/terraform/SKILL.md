---
name: terraform
description: Terraform 基础设施编排 — 模块设计、状态管理、变更审查、安全变量管理。使用 Terraform 管理云资源时使用。
---

# Terraform 最佳实践

安全、可维护地管理基础设施代码。

## 模块设计
- 一个模块对应一组逻辑资源（如 "vpc"、"rds"）
- 输入变量用 `variable` 块声明，带 `type` 和 `description`
- 输出用 `output` 块，供上层模块引用
- 版本锁定: `source = "git::https://...?ref=v1.2.0"`

## 状态管理
- 远程状态: S3 + DynamoDB 锁定（禁止本地 state）
- 状态隔离: 按环境分 workspace 或分目录
- 敏感数据: `sensitive = true` 标记，避免日志泄露
- 禁止手改 state，用 `terraform state mv/rm`

## 变更审查
1. `terraform fmt -check` — 格式检查
2. `terraform validate` — 语法校验
3. `terraform plan` — 生成变更计划，人工审查
4. `terraform apply` — 确认后执行

## 安全规范
- 禁止将 secrets 写入 .tf 文件
- 用 `vault` 或 AWS Secrets Manager 管理密钥
- `terraform plan` 输出包含敏感值时用 `-out` 写文件
- CI/CD 中用 `terraform plan -detailed-exitcode` 判断是否有变更
