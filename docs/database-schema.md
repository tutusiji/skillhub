# SkillHub 数据库架构文档

SkillHub 后端使用 **TypeORM** 做对象关系映射，数据库统一使用 **PostgreSQL**（SQLite 支持已移除），
连接由 `server/.env` 的 `DB_*` 变量或 `DATABASE_URL` 控制。

`synchronize` 按环境门控（`!isProduction()`）：开发/测试启动时按实体自动建表/改表；**生产环境关闭自动改表**，首次建表先用 `APP_ENV=dev` 启动一次，之后常驻 prod。生产改实体后需手动迁移或临时用 dev 同步。

---

## 实体总览

| 实体类 | 表名 | 主键 | 用途 |
| --- | --- | --- | --- |
| `UserEntity` | `users` | uuid（自动生成） | 员工账号、RBAC 角色、工号、登录方式 |
| `SkillEntity` | `skills` | varchar（业务 ID） | 技能元数据与多端安装命令 |
| `AuditRuleEntity` | `audit_rules` | varchar（业务 ID） | 双引擎风控规则（正则/LLM 模板） |
| `AuditReportEntity` | `audit_reports` | uuid（自动生成） | 每次体检的扫描报告快照 |
| `SkillDemandEntity` | `skill_demands` | uuid（自动生成） | 悬赏需求市场（征集/应征/验收） |
| `LlmConfigEntity` | `llm_configs` | varchar（固定 `default`） | 大模型网关配置，全局单行 |
| `FeedbackEntity` | `feedback` | uuid（自动生成） | 员工建议（管理员可查看与删除，无回复流转） |
| `SkillCategoryEntity` | `skill_categories` | varchar（业务 ID） | 技能分类标签（集市 tab 与发布表单数据源） |
| `ExpertDomainEntity` | `expert_domains` | varchar（业务 ID） | 岗位专家组配置（技能归属标签，可增删改查） |

> ⚠️ **uuid 主键契约**：`users` / `audit_reports` / `skill_demands` 的主键是真正的 uuid 列。
> PostgreSQL 的 uuid 列对非法格式字符串查询会抛 `invalid input syntax for type uuid` 并冒泡成 500。
> **凡是用外部传入 id 查这些表的代码，必须经 `server/src/common/db-id.util.ts` 的 `isUuid` / `findByUuid`
> 校验**（非法 id 返回 null/404）。已有回归断言覆盖该契约（分组 9）。

---

## users（员工账号与 RBAC）

| 列名 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | PK | TypeORM `@PrimaryGeneratedColumn('uuid')` |
| `name` | varchar(150) | NOT NULL | 员工姓名 |
| `email` | varchar(150) | UNIQUE NOT NULL | 企业邮箱，历史上是登录凭证，现为兜底通道 |
| `employee_id` | varchar(32) | UNIQUE NULL | **员工工号**，普通用户的主要登录标识 |
| `login_name` | varchar(64) | UNIQUE NULL | 专用登录名，仅超级管理员为 `admin` |
| `auth_provider` | varchar(20) | default `'password'` | `password` 自助注册 / `oss` IAM 单点登录开号 |
| `password_hash` | varchar(255) | NOT NULL | bcrypt 哈希；OSS 开号账号存放不可用随机哈希 |
| `role` | varchar(30) | default `'user'` | `super_admin` / `admin` / `user` |
| `menu_permissions` | simple-json | default `[]` | 菜单级权限（`audit` 审核管理 / `rules` 风控中心），超管恒全量 |
| `department` | varchar(100) | default `'技术研发中心'` | 所属部门 |
| `avatar_url` | text | NULL | 头像 |
| `points` | int | default 10000 | 悬赏积分余额（服务端权威） |
| `created_at` | timestamp | NOT NULL | 创建时间 |
| `updated_at` | timestamp | NOT NULL | 更新时间 |

角色语义：

- `super_admin`：系统根权限。登录名 `admin`，**不分配工号**。唯一可委任/撤销管理员的主体，其余权限与 admin 相同。
- `admin`：技能审核、风控中心规则与大模型网关配置、需求审批。**不可**二次授权他人。
- `user`：普通用户。检索、发布需求、揭榜、安装插件。

> 注册接口**不接受 role 字段**，新账号恒为 `user`；`super_admin` 也不可通过
> `PATCH /auth/users/:id/role` 授予（白名单仅 `admin` / `user`），这是刻意设计的权限边界。

---

## skills（技能与插件主表）

主键为 varchar 业务 ID（如 `skill-1`）。

| 列名 | 类型 | 约束/默认 | 说明 |
| --- | --- | --- | --- |
| `id` | varchar(64) | PK | 技能 ID |
| `name` | varchar(150) | NOT NULL | 展示名称 |
| `slug` | varchar(100) | UNIQUE | 唯一 slug，插件目录名（ASCII） |
| `category` | varchar(50) | NOT NULL | 分类 |
| `description` | text | NOT NULL | 功能描述 |
| `author` | varchar(100) | NOT NULL | 作者名快照（无外键） |
| `department` | varchar(100) | default `'研发中心'` | 作者部门快照 |
| `avatar` | text | NULL | 图标 |
| `version` | varchar(30) | default `'v1.0.0'` | 最新版本号 |
| `status` | varchar(30) | default `'pending'` | `approved` / `pending` / `rejected` / `offline` |
| `clients` | simple-json | default `[]` | 支持的客户端列表 |
| `tags` | simple-json | default `[]` | 标签列表 |
| `downloads` / `likes` / `stars` | int | default 0 | 社交计数 |
| `permissions` | simple-json | default `[]` | 声明的系统权限 |
| `installCommands` | simple-json | NOT NULL | 多端安装命令 `{claude, cursor, mcp, cli}` |
| `fileTree` | simple-json | default `[]` | 文件树（含文本文件 content，供详情预览） |
| `zip_blob` | text | NULL | 上传时的**原始 ZIP**（base64），无损下载与 Git 市场发布的数据源 |
| `zip_file_name` | varchar(255) | NULL | 上传时的原始 ZIP 文件名（下载优先使用） |
| `expert_domains` | simple-json | default `[]` | 归属的专家组标签清单（可属于多个） |
| `readme` | text | NULL | 说明文档正文 |
| `expert_domain` | varchar(50) | NULL | 专家组领域（主领域，详情页兼容） |
| `auditScore` | int | default 100 | 双引擎风控评分 |
| `reviewed_by` | text | NULL | 审核人 |
| `reviewed_at` | text | NULL | 审核时间 |
| `admin_feedback` | text | NULL | 审核意见/驳回理由 |
| `parent_skill_id` | text | NULL | 多版本：前驱版本 ID（第一版为 NULL；索引 `idx_skills_parent`） |
| `superseded_by_id` | text | NULL | 多版本：当前 archived 版本被哪个 approved 版本替代（反向指针） |
| `archived_at` | text | NULL | 多版本：被新版替代的时间戳（区分 `rejected` 死信与 `archived` 历史版） |
| `supersede_mode` | varchar(20) | NULL | 多版本：`replace`（替代旧版，审核通过自动归档父版并继承 counters）/ `coexist`（共存，独立计数） |
| `created_at` / `updated_at` | timestamp | NOT NULL | 时间戳 |

> **多版本发布版本链**：新版本通过 `parent_skill_id` 指向旧版本，审核通过时若为 `replace` 模式，
> 父版本 `status` 置 `archived` 且 `superseded_by_id` 指向新版；`coexist` 模式父版本保持 `approved`。
> counters 在「替代」模式下于**上传时**从父版本复制起点（累计不清零），`coexist` 模式独立计数。
> 归档版本对非 owner/管理员不可见（`GET /api/v1/skills/:id/versions` 与列表/详情均收敛）。

> ⚠️ 部分列**未声明 `name:`，实际列名即驼峰**：`installCommands`、`fileTree`、`auditScore`、
> `permissions` 等。写原生 SQL / 迁移脚本时按上表列名，不要按属性名转 snake_case。

---

## audit_rules（双引擎风控规则）

主键为 varchar 业务 ID。字段：`id`、`name`、`type`（`regex`/`llm`）、`severity`、`category`、
`description`、`pattern`（正则表达式）、`llm_prompt_template`（LLM 研判模板）、
**`isEnabled`**（布尔，实际列名驼峰）、**`isPreset`**（布尔，实际列名驼峰）、`created_at`。

> ⚠️ `isEnabled` / `isPreset` 同样未声明 `name:`，PostgreSQL 中的列名就是驼峰，不是 `is_enabled`。

---

## audit_reports（体检报告）

主键为 uuid。

| 列名 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid PK | 报告 ID |
| `skill_id` | varchar(64) NULL | 关联技能（无外键约束） |
| `score` | int default 100 | 综合评分 0~100 |
| `status` | varchar(30) | `passed` / `warning` / `failed` |
| `duration_ms` | int default 0 | 扫描耗时 |
| `regex_hits` | simple-json default `[]` | 正则命中清单快照 |
| `llm_verdict` | simple-json | LLM 语义研判结论快照（含 `engine` / `model` / `degradedReason`） |
| `created_at` | timestamp | 体检时间 |

---

## skill_demands（悬赏需求市场）

主键为 uuid。字段：`id`、`title`、`description`、`target_domain`、`expected_output`、
`bounty_points`（发布时从发布者积分冻结扣减）、`deadline_text`、`author_id`/`author_name`/
`author_avatar`/`author_department`（作者快照，无外键）、`status`（`pending`/`approved`/
`rejected`/`fulfilled`/`closed`）、`reject_reason`、`candidates`（simple-json 数组，应征方案快照）、
`points_refunded`（幂等退款标记）、`reviewed_by`、`reviewed_at`、`created_at`、`updated_at`。

> 悬赏积分的一切变动都在 `dataSource.transaction()` 内完成，保证余额与需求状态原子提交。

---

## llm_configs（大模型网关配置）

全局**仅一行**，主键固定为 `default`。字段：`base_url`（OpenAI 兼容网关基址）、`api_key`
（明文仅存服务端，API 只回传掩码）、`model_name`、`temperature`、`max_tokens`、`system_prompt`、
`timeout_ms`、`max_retries`、`is_enabled`、`last_tested_at`、`test_status`、`test_message`、`updated_at`。

> 对接模型**不引入任何大模型 SDK**：`server/src/modules/audit/llm-audit.service.ts` 用原生
> `fetch` 调 OpenAI 兼容 `/chat/completions`，因此通义千问（百炼兼容模式）、DeepSeek、内网
> vLLM 网关都能直接用。前端网关配置页提供厂商快捷回填。

---

## feedback（员工建议）

主键为 uuid。字段：`id`、`title`、`content`、`category`（`feature`/`bug`/`security`/
`experience`/`other`）、`rating`（1-5）、`submitter_id`（提交者 uuid）、`submitter_name` /
`submitter_employee_id` / `submitter_avatar` / `submitter_department`（提交者快照，无外键）、
`created_at`。

> 接口语义：`POST /api/v1/feedback` 提交（需登录）；`GET` 管理员看全部、普通用户只看自己的；
> `DELETE /api/v1/feedback/:id` 管理员或提交者本人可删。无回复流转。

---

## skill_categories（技能分类标签）

主键为 varchar 业务 key（与 `skills.category` 取值对应）。字段：`id`、`label`（展示名）、
`sort_order`（排序）、`is_enabled`（停用后不再出现在集市 tab 与发布表单）、`created_at`、`updated_at`。
空库启动时播种 8 个默认分类。

> 接口：`GET /api/v1/skill-categories` 匿名可读（`?all=1` 含停用）；增删改仅管理员。

---

## expert_domains（岗位专家组）

主键为 varchar 业务 key（如 `fullstack`、`data_analyst`）。字段：`id`、`name`（全称）、
`short_label`（首页卡片标题）、`description`（详情描述，首页卡片副标题小字）、`icon_name`、
`badge_bg` / `badge_text` / `badge_border`（徽章配色 class）、`sort_order`、`created_at`、`updated_at`。
空库启动时播种 9 个默认专家组。

技能与专家组是多对多标签关系：`skills.expert_domains`（simple-json 数组）记录归属，
由管理员在「分类和专家组管理」页维护。前端保留同名常量 `EXPERT_DOMAINS` 作为离线兜底。

> 接口：`GET /api/v1/expert-domains` 匿名可读；增删改仅管理员；
> 技能归属 `PUT /api/v1/skills/:id/expert-domains` body `{ domains: string[] }` 仅管理员。

---

## 部署说明

- 连接参数见 `server/.env`（`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`，
  或 `DATABASE_URL` 一次性指定，优先级更高）。
- `synchronize` 非生产开启（按实体自动建表/改表），**生产关闭**；生产首次建表用 `APP_ENV=dev` 启动一次，此后改实体需手动迁移。
- `simple-json` 列在 PostgreSQL 中落为 JSON 文本（不是 JSONB 列）。
