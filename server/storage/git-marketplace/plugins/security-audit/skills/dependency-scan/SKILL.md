---
name: dependency-scan
description: 依赖漏洞扫描 — 检查项目依赖中的已知 CVE 漏洞，分析受影响范围并给出升级建议。项目上线前或依赖更新时使用。
---

# 依赖漏洞扫描

扫描项目依赖中的已知漏洞，评估影响范围并提供修复建议。

## 扫描流程

1. 读取依赖锁定文件（package-lock.json / go.sum / requirements.txt / pom.xml）
2. 逐个依赖查 CVE 数据库
3. 匹配版本范围，判断是否受影响
4. 按严重程度排序输出报告

## 各语言工具

| 语言 | 锁定文件 | 推荐工具 |
|------|----------|----------|
| Node.js | package-lock.json | npm audit / yarn audit |
| Python | requirements.txt | pip-audit / safety |
| Go | go.sum | govulncheck |
| Java | pom.xml | OWASP Dependency-Check |
| Ruby | Gemfile.lock | bundler-audit |

## 严重程度分级

| 级别 | CVSS 评分 | 处理时限 |
|------|-----------|----------|
| 严重 | 9.0-10.0 | 立即修复，阻断上线 |
| 高危 | 7.0-8.9 | 上线前修复 |
| 中危 | 4.0-6.9 | 限期一周内修复 |
| 低危 | 0.1-3.9 | 排期修复 |

## 报告格式

```
## 依赖漏洞报告

扫描时间: 2024-01-15
扫描依赖: 245 个
发现漏洞: 8 个（严重 2 / 高危 3 / 中危 2 / 低危 1）

### 严重

#### CVE-2024-XXXX — lodash < 4.17.21
- 当前版本: 4.17.20
- 漏洞类型: 原型链污染
- 影响: 攻击者可篡改对象原型，导致 RCE
- 修复方案: 升级到 4.17.21+
- 依赖链: myapp → utils → lodash@4.17.20
```

## 内网离线扫描

内网无外网时，CVE 数据库需要离线同步：
1. 在有外网机器上下载离线 CVE 数据库
2. 拷贝到内网指定目录
3. 工具配置为使用本地数据库扫描
