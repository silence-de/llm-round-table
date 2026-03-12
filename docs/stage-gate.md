# Stage Gate

更新时间：2026-03-12

## 统一门禁命令

```bash
npm run gate
```

该命令顺序执行：

1. `npm run test`
2. `npm run lint`
3. `npm run build`
4. `npm run test:smoke-api`

当前 `npm run test` 已额外包含本阶段收尾测试：

- browser verification 的 snapshot fallback / manual review 标记
- calibration route 的 empty-state / low-data 聚合稳定性
- personal decision templates 的首波模板覆盖与配置完整性
- PDF dossier 的 `pdfinfo` + `pdftoppm` smoke 校验

## Smoke API Checks

`test/smoke-api.test.ts` 覆盖最小可运行 API 健康检查：

- `POST /api/sessions/[id]/start` 错误结构
- `POST /api/sessions/[id]/interjections` 错误结构
- `POST /api/sessions/[id]/resume-preview` 参数校验

目标是确保每阶段都能复用同一套机器门禁，不依赖人工判定。
