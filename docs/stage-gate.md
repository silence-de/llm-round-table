# Stage Gate

更新时间：2026-03-11

## 统一门禁命令

```bash
npm run gate
```

该命令顺序执行：

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. `npm run test:smoke-api`

## Smoke API Checks

`test/smoke-api.test.ts` 覆盖最小可运行 API 健康检查：

- `POST /api/sessions/[id]/start` 错误结构
- `POST /api/sessions/[id]/interjections` 错误结构
- `POST /api/sessions/[id]/resume-preview` 参数校验

目标是确保每阶段都能复用同一套机器门禁，不依赖人工判定。
