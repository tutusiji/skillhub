---
name: secrets-detection
description: 硬编码密钥检测 — 扫描代码中的 API Key、密码、私钥等敏感信息。提交代码前或定期安全巡检时使用。
---

# 硬编码密钥检测

扫描源码中的敏感信息，防止密钥泄露到代码仓库。

## 检测模式

### API Key 类

| 模式 | 说明 |
|------|------|
| `sk-[A-Za-z0-9]{20,}` | OpenAI API Key |
| `AKIA[A-Z0-9]{16}` | AWS Access Key |
| `ghp_[A-Za-z0-9]{36}` | GitHub Personal Token |
| `gho_[A-Za-z0-9]{36}` | GitHub OAuth Token |
| `xox[baprs]-[A-Za-z0-9-]+` | Slack Token |
| `AIza[A-Za-z0-9_-]{35}` | Google API Key |

### 私钥类

| 模式 | 说明 |
|------|------|
| `-----BEGIN RSA PRIV​ATE KEY-----` | RSA 私钥 |
| `-----BEGIN EC PRIV​ATE KEY-----` | EC 私钥 |
| `-----BEGIN OPENSSH PRIV​ATE KEY-----` | SSH 私钥 |

### 通用密码模式

```
password = "xx{省略}x"
passwd = "xxx"
secret = "xxx"
token = "xxx"
apiKey = "xxx"
```

### 连接字符串

```
postgresql://user:{密码}@host:port/db
mongodb://user:{密码}@host:port/db
redis://:{密码}@host:port
```

## 扫描范围

- 源码文件（.py .js .ts .go .java .rb .php）
- 配置文件（.yml .yaml .json .env .ini .conf .toml）
- Shell 脚本（.sh .bash）
- 文档文件（.md .txt .rst）
- Dockerfile / docker-compose.yml

## 排除规则

以下路径默认跳过：
- `.git/` — 版本历史
- `node_modules/` — 第三方依赖
- `vendor/` — Go 依赖
- `*.lock` — 锁定文件（可能含 hash）
- `*_test.go` / `*.test.js` — 测试文件中的 mock key

## 报告格式

```
## 密钥泄露扫描报告

扫描文件: 1,234
发现问题: 5

### 严重

1. [src/config/database.js:12] 数据库连接字符串含明文密码
   内容: postgresql://admin:s3cret@10.0.1.5:5432/prod
   修复: 改用环境变量 DB_URL 注入

2. [.env:5] AWS Access Key 硬编码
   内容: AKIA...EXAMPLE
   修复: 移到 CI/CD 密钥管理，轮换已泄露的 Key
```

## 修复原则

1. 发现的密钥视为已泄露，立即轮换
2. 改用环境变量或密钥管理服务注入
3. `.env` 加入 `.gitignore`
4. Git 历史中的密钥用 `git filter-branch` 清理
