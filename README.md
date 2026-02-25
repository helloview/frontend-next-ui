# Frontend (Next.js 16 + pnpm)

按模板重构为可维护结构，并去掉预置 mock 数据，全部走后端 API。

## 技术栈

- Next.js 16 + React 19 + TypeScript
- NextAuth (JWT session + refresh rotation)
- Tailwind CSS
- React Hook Form + Zod
- TanStack Query
- ESLint + Prettier

## 已对接的后端 API

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/password/reset/request`
- `POST /v1/auth/password/reset/confirm`
- `POST /v1/auth/oauth/google`
- `GET /v1/users/me`
- `GET /v1/users`
- `PATCH /v1/users/{userID}/roles`
- `POST /v1/todos/items`
- `GET /v1/todos/items`
- `PATCH /v1/todos/items/{itemID}`
- `POST /v1/todos/items/{itemID}/complete`
- `POST /v1/todos/items/{itemID}/reopen`
- `DELETE /v1/todos/items/{itemID}`
- `GET /v1/todos/heatmap`
- `GET /v1/todos/summary`

## 页面

- `/login`: 登录（credentials + 可选 Google）
- `/register`: 注册
- `/forgot-password`: 申请重置码
- `/reset-password`: 提交验证码重置
- `/dashboard`: 概览 / 用户管理 / 资料 / 安全

## 目录约定

- `src/lib/api/client.ts`: 通用 API 请求层
- `src/lib/auth-api.ts`: 认证相关 API
- `src/lib/user-api.ts`: 用户管理 API
- `src/components/dashboard/panels/*`: dashboard 结构化 panel
- `src/app/api/ums/*`: 受保护的前端代理 API（读取 session token 再转发）

## 环境变量

复制 `.env.example` 到 `.env.local` 后修改：

- `NEXT_PUBLIC_UMS_API_BASE_URL`
- `NEXT_PUBLIC_TODO_API_BASE_URL`
- `AUTH_SECRET`
- 可选 Google: `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

推荐 gateway 模式（单入口）：

- `NEXT_PUBLIC_UMS_API_BASE_URL=http://localhost:8080/ums`
- `NEXT_PUBLIC_TODO_API_BASE_URL=http://localhost:8080/todo`

## Run

```bash
cd frontend
pnpm install
pnpm dev
```
