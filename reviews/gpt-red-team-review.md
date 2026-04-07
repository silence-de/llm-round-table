**关键问题（按严重度）**

1. **[P0][后端交互逻辑] `ROUND_TABLE_ACCESS_TOKEN` 与前端调用链未打通，生产模式会全量 401。**  
`proxy` 强制要求 `x-round-table-token` 或 Bearer，但前端所有 `fetch('/api/...')` 都没有附带该头。  
参考：[README.md:71](/Users/chengxi-mba/Projects/round-table/README.md#L71)、[src/proxy.ts:5](/Users/chengxi-mba/Projects/round-table/src/proxy.ts#L5)、[src/hooks/use-discussion-stream.ts:56](/Users/chengxi-mba/Projects/round-table/src/hooks/use-discussion-stream.ts#L56)

2. **[P1][后端交互逻辑] 决策置信度存在“双轨值”不一致，已导致测试失败。**  
`normalizePersistedDecisionSummary` 会重算 `confidence`，但 `getSessionDetail` 又优先用持久化 `adjustedConfidence` 生成 `confidenceMeta`，两边可能不一致。  
参考：[src/lib/decision/utils.ts:231](/Users/chengxi-mba/Projects/round-table/src/lib/decision/utils.ts#L231)、[src/lib/db/repository.ts:744](/Users/chengxi-mba/Projects/round-table/src/lib/db/repository.ts#L744)、[test/api-routes.test.ts:1595](/Users/chengxi-mba/Projects/round-table/test/api-routes.test.ts#L1595)

3. **[P1][后端交互逻辑] `usage` 累加是读改写，存在并发丢增量风险。**  
`updateSessionUsage` 先读后写，不是原子加；并发阶段有 `void persistUsage(...)`。  
参考：[src/lib/db/repository.ts:1370](/Users/chengxi-mba/Projects/round-table/src/lib/db/repository.ts#L1370)、[src/lib/orchestrator/orchestrator.ts:821](/Users/chengxi-mba/Projects/round-table/src/lib/orchestrator/orchestrator.ts#L821)

4. **[P1][后端交互逻辑] resume preview 会向任意 `sessionId` 写事件，造成脏数据。**  
前端会用 `'preview'` 作为占位 id 调接口，后端直接 `appendSessionEvent(id, ...)`。  
参考：[src/app/page.tsx:1238](/Users/chengxi-mba/Projects/round-table/src/app/page.tsx#L1238)、[src/app/api/sessions/[id]/resume-preview/route.ts:32](/Users/chengxi-mba/Projects/round-table/src/app/api/sessions/[id]/resume-preview/route.ts#L32)

5. **[P1][后端交互逻辑/安全] snapshot 下载缺少目录白名单校验，存在本地文件读取面。**  
当前仅 `path.resolve` + `existsSync`，未限制必须在数据目录下。  
参考：[src/app/api/sessions/[id]/research/sources/[sourceId]/snapshot/route.ts:19](/Users/chengxi-mba/Projects/round-table/src/app/api/sessions/[id]/research/sources/[sourceId]/snapshot/route.ts#L19)

6. **[P1][后端交互逻辑] SSE 编码升级为 `id + data` 后，测试解析器仍按纯 JSON chunk 解析，Gate 红灯。**  
`encodeSSE` 输出 `id:` 行，`readSSEEvents` 直接 `JSON.parse(chunk)`。  
参考：[src/lib/sse/types.ts:35](/Users/chengxi-mba/Projects/round-table/src/lib/sse/types.ts#L35)、[test/test-helpers.ts:53](/Users/chengxi-mba/Projects/round-table/test/test-helpers.ts#L53)

7. **[P2][UI/UX] Live feed 不是时间序，用户看到的“对话顺序”会失真。**  
Live 模式先 push 全部 moderator，再按 participants 固定顺序 push agent。  
参考：[src/app/page.tsx:773](/Users/chengxi-mba/Projects/round-table/src/app/page.tsx#L773)

8. **[P2][UI/UX] Action Item 日期按 UTC 零点存取，跨时区会出现前后偏移。**  
`T00:00:00Z` + `toISOString().slice(0,10)` 的组合会在部分时区变形。  
参考：[src/components/discussion/action-items-board.tsx:211](/Users/chengxi-mba/Projects/round-table/src/components/discussion/action-items-board.tsx#L211)

9. **[P2][UI/UX] Tab 组件缺少无障碍语义（`role=tablist/tab`、`aria-selected`）。**  
对键盘与读屏可达性不友好。  
参考：[src/components/workspace/setup-panel.tsx:28](/Users/chengxi-mba/Projects/round-table/src/components/workspace/setup-panel.tsx#L28)、[src/components/workspace/history-panel.tsx:20](/Users/chengxi-mba/Projects/round-table/src/components/workspace/history-panel.tsx#L20)

10. **[P2][架构设计] 可靠性指标接口是“全表拉取后 JS 过滤”，数据量上来会退化。**  
参考：[src/lib/db/repository.ts:2908](/Users/chengxi-mba/Projects/round-table/src/lib/db/repository.ts#L2908)

11. **[P2][架构设计] DB 层缺少外键约束 + 启动时动态迁移，完整性和演进风险高。**  
目前依赖应用层手动级联删除。  
参考：[src/lib/db/client.ts:21](/Users/chengxi-mba/Projects/round-table/src/lib/db/client.ts#L21)、[src/lib/db/client.ts:264](/Users/chengxi-mba/Projects/round-table/src/lib/db/client.ts#L264)

12. **[P3][持续优化] 当前质量门已破：`npm test` 失败 4 项，`npm run lint` 有 1 个 error。**  
Lint error 在 `prefer-const`。  
参考：[src/stores/discussion-store.ts:230](/Users/chengxi-mba/Projects/round-table/src/stores/discussion-store.ts#L230)

---

**按你要求的四个方向汇总**

- **1) UI/UX 前端问题**：对话顺序失真、日期时区偏移、tab 无障碍语义缺失、失败场景（如 bootstrap/calibration）提示弱。  
- **2) 后端交互逻辑**：鉴权链路断裂、置信度字段不一致、usage 并发丢增量、resume preview 脏事件、snapshot 路径边界缺失、SSE 协议变更未同步测试。  
- **3) 架构设计**：大文件高耦合（`page.tsx`/`repository.ts`）、事件统计查询不可扩展、数据库无 FK 且迁移机制脆弱。  
- **4) 持续优化方向（建议优先级）**：先修 P0/P1（鉴权、置信度一致性、SSE 测试、usage 原子更新），再做 P2（时间序 feed、日期语义、a11y），最后推进架构治理（拆分 `page.tsx`/`repository.ts`、正式 migration + FK）。  

--- 
第二点，后端交互逻辑已进行修复，但仍未验证修复是否完全正确。