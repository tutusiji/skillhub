---
name: cost-ops
description: AWS 成本运维 — 分析云资源成本、识别浪费、优化计费模式。当需要降低 AWS 账单、排查异常费用时使用。
---

# AWS 成本运维

识别和消除云资源浪费。

## 检查项

### 计算资源
- 未使用的 EC2 实例（低 CPU 利用率 < 10%）
- 过大的实例类型（可降配或改 Spot）
- 长期运行的 Lambda 函数（考虑改 Fargate）
- 未终止的 EMR 集群

### 存储资源
- 未挂载的 EBS 卷
- 过大的 EBS 卷（使用率 < 30%）
- S3 生命周期策略（旧数据转 Glacier）
- 未清理的快照

### 网络
- 跨可用区流量费用（可优化架构减少跨 AZ 调用）
- NAT Gateway 费用异常（检查是否有大量下载）

## 优化建议
- Reserved Instances / Savings Plans — 长期稳定负载
- Spot Instances — 可中断的批处理任务
- Auto Scaling — 按需扩缩容
- 存储分层 — 热数据 Standard，冷数据 Glacier
