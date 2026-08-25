---
name: api-design-cn
description: API 设计规范 — 按照国内 RESTful 最佳实践设计接口，包含 URL 规范、状态码、分页、错误码、版本管理。设计新 API 或重构现有 API 时使用。
---

# API 设计规范

遵循 RESTful 最佳实践设计接口，适合国内团队。

## URL 规范

- 基路径: `/api/v1/资源名`
- 资源名用复数: `/api/v1/users`（不用 `/user`）
- 层级不超过 3 层: `/api/v1/users/{id}/orders`
- 用连字符不用下划线: `/api/v1/user-profiles`
- 动作用子资源表达: `POST /api/v1/users/{id}/actions/disable`

## HTTP 方法

| 方法 | 语义 | 幂等 | 示例 |
|------|------|------|------|
| GET | 查询 | 是 | `GET /users` |
| POST | 创建 | 否 | `POST /users` |
| PUT | 全量更新 | 是 | `PUT /users/{id}` |
| PATCH | 部分更新 | 否 | `PATCH /users/{id}` |
| DELETE | 删除 | 是 | `DELETE /users/{id}` |

## 状态码

- `200` — 成功（GET/PUT/PATCH/DELETE）
- `201` — 创建成功（POST）
- `204` — 无内容（DELETE 成功）
- `400` — 参数错误
- `401` — 未认证
- `403` — 无权限
- `404` — 资源不存在
- `409` — 冲突（重复创建）
- `422` — 业务校验失败
- `500` — 服务器错误

## 分页

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## 错误响应

```json
{
  "code": "USER_NOT_FOUND",
  "message": "用户不存在",
  "details": { "userId": "123" },
  "traceId": "abc-123-def"
}
```

## 版本管理
- URL 版本: `/api/v1/`、`/api/v2/`
- 新版本只在不兼容变更时递增
- 旧版本至少维护 6 个月
