# Round Table — Full Project Red Team Review

> **Reviewer**: Claude Opus 4.6
> **Date**: 2026-03-19
> **Scope**: UI/UX & 前端交互、后端交互逻辑、架构设计、持续优化方向

---

## 统计总览

| 维度 | P0 | P1 | P2 | 合计 |
|------|:--:|:--:|:--:|:----:|
| 维度 1: UI/UX & 前端交互 | 5 | 10 | 10 | 25 |
| 维度 2: 后端交互逻辑 | 0 | 4 | 7 | 11 |
| 维度 3: 架构设计 | 2 | 6 | 4 | 12 |
| 维度 4: 持续优化方向 | 1 | 8 | 6 | 15 |
| **合计** | **8** | **28** | **27** | **63** |

---

## 维度 1: UI/UX & 前端交互

### P0 — 严重问题

#### 1.1 Watchdog 超时消息无恢复路径
- **位置**: `src/hooks/use-discussion-stream.ts:49-52`
- **描述**: 错误消息 "Connection interrupted. Please refresh and use resume if needed" 无法区分暂时性网络故障和真实错误，强制用户刷新页面导致 UI 状态丢失。
- **影响**: 暂时性网络抖动即引发用户恐慌；无法判断 session 是否可恢复。
- **建议**: 实现指数退避自动重连；先展示可关闭的警告横幅（10-20s），超时后再升级为模态弹窗并带"重新连接"按钮；调用 `/api/sessions/{id}/resume-preview` 展示可恢复的内容。

#### 1.2 Zustand Store 在 Resume 时未同步
- **位置**: `src/hooks/use-discussion-stream.ts:246-254` + `src/stores/discussion-store.ts:41`
- **描述**: `resume_snapshot` 事件设置了 `resumeSnapshot` 但未将 recovery metadata（nextPhase, nextRound）合并到活跃的 phase/round 状态。刷新页面后 snapshot 丢失（未持久化）。
- **影响**: Resume 工作流静默失败；用户可能重复执行已完成的阶段。
- **建议**: 收到 `resume_snapshot` 事件时立即合并 snapshot 字段到 phase/round；将 resumeSnapshot 持久化到 sessionStorage。

#### 1.3 Error 状态在 Session 切换时未清除
- **位置**: `src/stores/discussion-store.ts:339-374`（reset 函数）
- **描述**: `reset()` 未显式清除 `error` 字段。旧的 error toast 在启动新 session 时仍然存在。
- **影响**: 用户无法分辨错误属于哪个 session，认知负荷高。
- **建议**: 在 reset 函数中添加 `error: null`；在 `startDiscussion` 中先调用 `setError(null)` 再 `store.reset()`。

#### 1.4 Interjection 提交无 Loading 状态
- **位置**: `src/hooks/use-discussion-stream.ts:122-177`
- **描述**: `sendInterjection()` 不返回 loading 状态；按钮不禁用；无成功确认。慢网络下用户可能重复提交。
- **影响**: 关键时刻的 interjection 体验差；存在重复提交风险。
- **建议**: 在 store 中添加 `sendingInterjection` boolean；提交期间禁用输入；本地乐观展示 + 服务端同步。

#### 1.5 Session Resume 失败时无降级方案
- **位置**: `src/app/api/sessions/[id]/resume-preview/route.ts:19-22`
- **描述**: Resume 失败（404/500）返回错误但 UI 无明确提示。
- **影响**: Follow-up 工作流静默中断；用户无法判断 resume 丢失还是系统报错。
- **建议**: 返回描述性错误信息；在客户端展示模态弹窗："恢复上下文不可用，是否重新开始？"

### P1 — 重要问题

#### 1.6 SSE 事件解析静默丢弃异常
- **位置**: `src/hooks/use-discussion-stream.ts:84-90`
- **描述**: JSON.parse 失败被静默 catch，无任何日志。如果事件格式错误或跨边界拆分，讨论状态过期但用户无感知。
- **影响**: 静默数据丢失；讨论可能无提示地冻结。
- **建议**: 添加 `console.error` 日志；连续 3 次以上解析失败后设置错误状态提示用户。

#### 1.7 Markdown 引号预处理脆弱
- **位置**: `src/components/ui/markdown-content.tsx:130-178`
- **描述**: 基于复杂正则的 CJK 引号预处理（`**"x"**` → `"**x**"`）存在边缘情况，无法处理所有嵌套场景。
- **影响**: Markdown 渲染不一致，尤其是非英文内容。
- **建议**: 使用更健壮的解析器（remark-parse + CJK 插件）；建立边缘用例测试语料。

#### 1.8 自动滚动忽略用户滚动意图
- **位置**: `src/components/discussion/discussion-feed.tsx:81-84`
- **描述**: 每次消息变化都调用 `scrollIntoView({ behavior: 'smooth' })`，无防抖，无用户意图检测。移动端体验尤其差。
- **影响**: 高频消息时滚动抖动；用户无法回看已有内容。
- **建议**: 防抖 150ms；仅在用户已位于底部（100px 范围内）时自动滚动；用户上滑时显示"跳转最新"按钮。

#### 1.9 Agent Card 流式时自动滚动频繁
- **位置**: `src/components/discussion/agent-card.tsx:29-36`
- **描述**: 每个 token 到达都触发卡片滚动到底部。10+ tokens/sec 时用户无法阅读中间内容。
- **影响**: 可读性差；用户跟不上 agent 回复。
- **建议**: 仅在已位于底部时滚动；防抖 200ms；用户上滑时暂停自动滚动。

#### 1.10 Evidence 链接引用断裂无降级
- **位置**: `src/components/discussion/decision-summary-card.tsx:206-227`
- **描述**: Evidence 引用 `sourceIds`，如果 source 被删除或查找失败，原始 sourceId 直接渲染（行 225），无降级样式。
- **影响**: 用户点击期望有效链接却无法验证 claims。
- **建议**: 断裂链接使用灰色/删除线 + tooltip "来源未找到"；hydration 时校验所有 evidence 引用。

#### 1.11 Interjection 在 Feed 中缺少阶段上下文
- **位置**: `src/stores/discussion-store.ts:33` + feed 渲染
- **描述**: Interjection 存储了可选的 phase/round 元数据但未在 feed 中展示。用户看到混在 agent 消息中的 interjection 无法判断是哪个阶段。
- **影响**: Interjection 看起来孤立；难以追踪其对决策的影响。
- **建议**: 创建 `InterjectionBubble` 组件，展示 "You @ Round 2, Analysis: [content]"。

#### 1.12 Degraded Agent 无恢复指示
- **位置**: `src/stores/discussion-store.ts:145-150` + `src/hooks/use-discussion-stream.ts:213-220`
- **描述**: `agent_degraded` 事件添加到 `degradedAgents` 数组，但无反向事件移除。一旦标记为 degraded，即使恢复也不会更新。
- **影响**: 误导性的信任信号；用户误以为 agent 仍在失败。
- **建议**: 添加 `agent_recovered` SSE 事件类型；在 degradation 后的成功轮次中发出。

#### 1.13 Research Panel 验证表单缺少输入校验
- **位置**: `src/components/discussion/research-panel.tsx:162-194`
- **描述**: URL 输入无校验（可能无效、恶意或不完整）；claimHint/verificationNote 无长度限制。
- **影响**: 服务端收到垃圾数据；过长提交可能导致错误。
- **建议**: 客户端 URL 校验 `try { new URL(verifyUrl) }`；设置最大长度限制。

#### 1.14 Action Items 状态转换未展示不允许的选项
- **位置**: `src/components/discussion/action-items-board.tsx:139-141`
- **描述**: `allowedStatuses` 计算了但未反映在 UI 中。不允许的转换在服务端静默失败。
- **影响**: 用户以为转换成功但实际静默失败。
- **建议**: 不允许的选项添加 `aria-disabled` + `opacity-50 cursor-not-allowed`。

#### 1.15 空状态文本硬编码中文
- **位置**: `src/components/discussion/discussion-feed.tsx:76`
- **描述**: `'等待会议开始…'` 硬编码，无 i18n 系统。
- **影响**: 非中文用户无法使用。
- **建议**: 提取到 locale 文件或 context；提供英文默认值。

### P2 — 优化建议

#### 1.16 复制按钮仅 hover 显示 — 移动端不友好
- **位置**: `src/components/discussion/discussion-feed.tsx:210-219`
- **建议**: 添加 long-press handler 或始终以低透明度显示。

#### 1.17 Phase Separator 样式难以区分
- **位置**: `src/components/discussion/discussion-feed.tsx:149-172`
- **建议**: 添加阶段图标；增大 font-weight 或添加 border-bottom。

#### 1.18 Round Table SVG 不支持无障碍缩放
- **位置**: `src/components/discussion/round-table-stage.tsx:162-191`
- **建议**: 添加 `<desc>` 和 `<title>`；使用 CSS `transform: scale()` 响应缩放。

#### 1.19 无明确的"会议结束"画面
- **位置**: `src/hooks/use-discussion-stream.ts:234-241`
- **建议**: 展示完成模态："讨论完成! X 轮次, Y 来源, Z 声明"。

#### 1.20 Typing 指示器与活跃发言者状态不同步
- **位置**: `src/components/discussion/discussion-feed.tsx:53-67`
- **建议**: 仅对 `message.isStreaming && isActive` 的 agent 展示打字动画。

#### 1.21 Research Panel 分组切换时无动画过渡
- **位置**: `src/components/discussion/research-panel.tsx:79-85`
- **建议**: 添加 Framer Motion `AnimatePresence`。

#### 1.22 Loading Skeleton 数量固定为 3
- **位置**: `src/components/discussion/research-panel.tsx:309-318`
- **建议**: 改为随机 1-5 个或仅显示 "搜索中..." + spinner。

#### 1.23 无 Session 超时预警
- **位置**: `src/app/api/sessions/[id]/start/route.ts:35`
- **建议**: 4 分 30 秒时 toast 提醒用户；允许用户请求延长或提前结束。

#### 1.24 Moderator 消息流式指示器风格不一致
- **位置**: `src/components/discussion/discussion-feed.tsx:237-282`
- **建议**: 统一 moderator 和 agent 在流式期间的视觉突出度。

#### 1.25 浏览器抓取证据快照不可访问
- **位置**: `src/components/discussion/decision-summary-card.tsx:104-116`
- **建议**: 确保 `source.snapshotPath` 已填充；在 evidence badge 中添加 `[查看快照]` 链接。

---

## 维度 2: 后端交互逻辑

### P1 — 重要问题

#### 2.1 Judge Gate Rewrite Loop 无进度停滞早退机制
- **位置**: `src/lib/orchestrator/orchestrator.ts:1412-1475`
- **描述**: Rewrite 循环条件 `while (currentJudge.gate === 'REWRITE' && rewriteCount < 2)` 即使 `newJudge.passedCount < currentJudge.passedCount`（改进停滞）也继续循环。允许在更差和相同方案之间振荡。
- **影响**: 浪费 token 预算；最终摘要可能不如前版本。
- **建议**: 添加 `noImprovementCount` 计数器，连续 2 次无改善即 break。

#### 2.2 SSE Catch-Up Replay 缺少 Gap 检测
- **位置**: `src/app/api/sessions/[id]/start/route.ts:331-340`
- **描述**: 重连时重放缓冲事件，但不验证 eventId 序列是否连续。如果客户端错过事件 1-5 并以 `lastEventId=2` catch up，收到事件 3+ 但存在 gap。无告警机制。
- **影响**: 客户端可能丢失关键 phase_change 或 agent_done 事件；前端对事件流 gap 无感知。
- **建议**: Gap 检测后发射 `system_note` 事件通知客户端。

#### 2.3 SiliconFlow 批量限制未一致执行
- **位置**: `src/lib/orchestrator/orchestrator.ts:415-427` + `src/lib/llm/siliconflow-provider.ts:112-128`
- **描述**: 两个独立的排队机制：orchestrator 层批处理和 SiliconFlowProvider 内部 `acquireSlot()`。可能有不同的最大并发值，导致不可预测的并发行为。
- **影响**: 批次隔离保证失效；429 限流错误可能无法正确传播。
- **建议**: 移除 SiliconFlowProvider 内部排队，让 orchestrator 批处理成为唯一并发控制。

#### 2.4 Provider 429/503 错误无自动重试
- **位置**: `src/lib/llm/deepseek-provider.ts:13`, `siliconflow-provider.ts:16`, `moonshot-provider.ts:13`
- **描述**: 所有 provider SDK 使用 `maxRetries: 1` 无指数退避。虽然 `failure-classifier.ts` 识别 429/503 为 TRANSIENT 且可重试，但 orchestrator 从未调用 `classifyError()` 或实现重试。
- **影响**: SiliconFlow 的 429 限流直接中止整个讨论而非 backoff 恢复；已实现的 failure classifier 成为死代码。
- **建议**: 用指数退避包装 provider 调用；使用已有的 `classifyError()` 区分可重试和不可重试错误。

### P2 — 优化建议

#### 2.5 Agent Degradation 阈值跨阶段不重置
- **位置**: `src/lib/orchestrator/orchestrator.ts:68-73, 497-518`
- **描述**: `agentTimeoutCount` map 每次超时递增但跨阶段不重置。一次 INITIAL_RESPONSES 阶段超时的 agent 在后续阶段仍被标记为 degraded。
- **建议**: 在阶段切换时 `this.agentTimeoutCount.clear()`。

#### 2.6 Session Stop 请求非幂等
- **位置**: `src/app/api/sessions/[id]/stop/route.ts:5-22`
- **描述**: Stop route 接受 POST 无幂等保护。并发 stop 请求不验证 session 状态是否实际改变。
- **建议**: 添加 stop request ID 和幂等检查。

#### 2.7 Resume Plan 丢失 Ledger 上下文
- **位置**: `src/app/api/sessions/[id]/start/route.ts:183-185` vs `src/lib/orchestrator/resume.ts:214-226`
- **描述**: Resume 逻辑构建 `resumePlan` 但从未调用 `enrichResumePlanWithLedger()`，导致 ledger checkpoint 和 `needsExternalInput` 标志丢失。
- **建议**: 获取并应用 ledger checkpoint 到 resumePlan。

#### 2.8 L0/L1 Pre-Check 失败的 Rewrite 指令过于泛化
- **位置**: `src/lib/orchestrator/orchestrator.ts:1337-1361`, `src/lib/decision/judge.ts:278-297`
- **描述**: L0/L1 check 失败是硬性 FAIL 维度，但生成的 rewrite 指令是通用的。例如 L1 citation 可解析性失败时，rewrite 指令不说明如何具体修复。
- **建议**: 让 L0/L1 rewrite 指令包含可操作信息："仅使用可用引用标签（R1-R5），无效引用需删除"。

#### 2.9 Stream Multiplexer 不区分错误类型
- **位置**: `src/lib/orchestrator/stream-multiplexer.ts:128-140`
- **描述**: Promise rejections 作为 `provider_error` 发射，不区分终端错误（401 auth）和暂时性错误（网络超时）。
- **建议**: 在 stream chunk 中保留错误分类信息。

#### 2.10 Ledger Checkpoint 写入 Fire-and-Forget 无错误跟踪
- **位置**: `src/lib/orchestrator/orchestrator.ts:1564-1579`
- **描述**: 每个阶段用 `void shadowWriteLedgerCheckpoint()` 写入，静默吞掉错误。DB 不可用时 checkpoint 丢失。
- **建议**: 跟踪并报告持续 checkpoint 失败；连续 3 次失败后升级为 session DEGRADED 状态。

#### 2.11 SiliconFlow 批量大小默认过低
- **位置**: `src/lib/orchestrator/orchestrator.ts:415-424`
- **描述**: 当 `ROUND_TABLE_SILICONFLOW_BATCH_SIZE` 和 `SILICONFLOW_MAX_CONCURRENCY` 未定义时，默认为 1，导致顺序执行可并行的批次。
- **建议**: 使用合理默认值 3。

---

## 维度 3: 架构设计

### P0 — 严重问题

#### 3.1 Route Handler 超时 vs 编排持续时间
- **位置**: `src/app/api/sessions/[id]/start/route.ts:35`
- **描述**: Route 超时为 300 秒（5 分钟），但 orchestrator 阶段可能需要 6000+ 秒（5 agents × 4 phases × 300s timeout）。Session 在编排中途被强制终止，留下损坏状态。
- **影响**: Session 在摘要生成或 judge 评估期间中止；决策摘要不完整或未保存。
- **建议**: 增加 maxDuration 到 1200-1800 秒（20-30 分钟）；添加优雅降级——在每个阶段超时边界前做 checkpoint；考虑按阶段拆分编排为独立 API 调用。

#### 3.2 Decision Memory 表未在迁移中创建
- **位置**: `src/lib/db/client.ts` + `src/lib/db/schema.ts:244-269`
- **描述**: `session_reflections` 和 `lessons` 表在 schema.ts 中定义但未在 client.ts 的 `sqlite.exec()` 块中初始化。现有部署不会创建这些表。
- **影响**: 所有 Decision Memory（Topic 6）功能在生产环境中静默失败；`upsertSessionReflection()` 和 `upsertLesson()` 崩溃并报 "no such table" 错误。
- **建议**: 在初始 `sqlite.exec()` 块中添加 CREATE TABLE 语句；实现迁移辅助函数自动创建缺失的表。

### P1 — 重要问题

#### 3.3 SQLite 并发无 WAL 或连接池
- **位置**: `src/lib/db/client.ts:3-19`
- **描述**: 单一共享 `better-sqlite3` Database 实例，无 WAL 模式或连接池。并发 session 在数据库级别序列化所有写操作，无 `SQLITE_BUSY` 超时或错误处理。
- **影响**: 5+ 并发 session 时出现可观察的持久化延迟；`SQLITE_BUSY` 错误导致静默失败。
- **建议**: 启用 WAL 模式 `sqlite.pragma('journal_mode = WAL')`；设置 busy timeout `sqlite.pragma('busy_timeout = 5000')`。

#### 3.4 SSE Event Buffer: 内存泄漏且无持久化
- **位置**: `src/lib/sse/event-buffer.ts`
- **描述**: 进程内 Map-based 环形缓冲（200 事件/session，30min TTL）无持久化。进程崩溃丢失所有缓冲事件。无全局内存限制，跨 session 无限制累积。
- **影响**: 进程崩溃丢失所有事件；多并发 session 可能耗尽堆内存。
- **建议**: 添加数据库备份 fallback；实现全局内存预算（如总 SSE 缓冲最大 10MB）；使用创建时间而非 `lastAccessAt` 做 TTL 过期。

#### 3.5 Orchestrator 作为单一 Async Generator 缺乏错误恢复
- **位置**: `src/lib/orchestrator/orchestrator.ts:82-223`
- **描述**: DiscussionOrchestrator 是单一 `async *run()` generator 顺序编排所有阶段。任何未处理的错误终止整个 generator，损坏 session 状态。无逐阶段错误边界或恢复机制。
- **影响**: 分析/辩论中的暂时性 DB 错误导致整个 session 失败；必须从头重启编排。
- **建议**: 重构为显式阶段边界，每个阶段有独立的错误处理和重试逻辑；成功阶段后做 checkpoint。

#### 3.6 Lesson 生命周期永不晋级为 Active
- **位置**: `src/lib/decision/reflection.ts` + `src/lib/db/repository.ts:3000+`
- **描述**: Session reflections（T6-1）异步生成，与编排解耦。候选 lessons 创建但永不自动晋级。晋级逻辑 `canPromoteLesson` 存在但在正常流程中从未被调用。
- **影响**: Session 完成时不保证 reflection 持久化；lessons 永远停留在 "candidate" 状态，永不注入 follow-up session。
- **建议**: 让 reflection 生成在编排结束前**阻塞**；在 reflection 生成结束时自动晋级满足阈值的 lessons。

#### 3.7 多表更新无事务语义
- **位置**: `src/lib/db/repository.ts`（全局）
- **描述**: Session 状态跨多个表（sessions、messages、minutes、decisionSummaries 等）。Orchestrator 调用独立的 insert/update 无事务包裹。`appendMessage()` 和 `updateSessionStatus('completed')` 之间崩溃留下部分写入状态。
- **影响**: 跨表一致性违反；resume 逻辑在部分写入的 session 上失败。
- **建议**: 用 Drizzle 事务 API 或 better-sqlite3 事务包裹关键状态变更。

#### 3.8 Task Ledger vs Judge Gate 职责边界不清
- **位置**: `src/lib/orchestrator/task-ledger.ts` vs `src/lib/decision/judge.ts`
- **描述**: TaskLedger 跟踪决策进度（claims、risks、coverage），JudgeGate 评估摘要质量（L0/L1 checks、dimensions）。无显式同步：ledger 在编排期间更新，但 judge 评估使用实时 ledger。Rewrite 指令不更新 ledger，造成分歧。
- **影响**: Ledger 不完整时 judge 评估不可靠；risk disclosure 维度可能在 ledger 有未覆盖的高风险项时仍通过。
- **建议**: 在 judge 评估前显式"冻结"TaskLedger；传递冻结快照给 judge evaluator。

### P2 — 优化建议

#### 3.9 Void Fire-and-Forget Checkpoint 写入
- **位置**: `src/lib/orchestrator/orchestrator.ts:568, 628, 636, 680, 771, 1186, 1288`
- **描述**: `void shadowWriteLedgerCheckpoint()` 静默吞掉错误。
- **建议**: 改为 `await` 加错误处理；连续 3 次失败升级为 DEGRADED。

#### 3.10 DecisionSummary 类型不完整
- **位置**: `src/lib/decision/types.ts:114-130`
- **描述**: 可选 `redLines`、未验证的 `confidence` 范围（0-100）。Judge checks 假设字段存在。
- **建议**: 使用 branded types 和 zod 校验；required 化关键字段。

#### 3.11 SSE Event 类型缺少 Discriminated Union
- **位置**: `src/lib/sse/types.ts`
- **描述**: SSEEvent 是扁平接口加可选字段，无按类型区分。客户端代码必须手动检查 `event.type` 后访问类型特定字段。
- **建议**: 使用 discriminated unions 启用类型窄化。

#### 3.12 超时配置未校验
- **位置**: `src/lib/orchestrator/orchestrator.ts:374-407`
- **描述**: 超时值按 agent tier 和 phase 硬编码，不验证所有超时之和是否小于 route maxDuration（300s）。
- **建议**: 初始化时校验；超时总和接近 route maxDuration 时发出警告。

---

## 维度 4: 持续优化方向

### P0 — 严重问题

#### 4.1 Fire-and-Forget DB 写入无错误处理
- **位置**: `src/lib/orchestrator/orchestrator.ts:821, 928`
- **描述**: 关键数据持久化（usage、ledger checkpoints）使用 `void` 无错误处理或重试逻辑。
- **影响**: 静默数据丢失；无法观测写入失败；usage 指标不可靠。
- **建议**: 实现指数退避重试。

### P1 — 重要问题

#### 4.2 Store 每 Token 创建新 Map
- **位置**: `src/stores/discussion-store.ts:202, 223, 248`
- **描述**: `appendAgentToken()` 每 token 创建整个 `agentMessages` Map 的浅拷贝。500-token 回复 = 500 次 Map 分配。
- **影响**: GC 压力、内存抖动，慢设备上流式期间有可感知的延迟。
- **建议**: 使用 immer 或重构为批量更新；启用 shallow 比较。

#### 4.3 Token 估算使用每次编译的正则且 CJK 比率不准
- **位置**: `src/lib/orchestrator/orchestrator.ts:350-360`
- **描述**: 正则模式每次调用编译；CJK 比率 1.5 tokens/char（实际应为 0.5-0.7）；无多语言支持。
- **影响**: 每 session 累计 20-40ms；CJK token 估算膨胀 2-3x。
- **建议**: 使用 `js-tiktoken` 库或缓存正则模式。

#### 4.4 无分布式 Tracing
- **位置**: 整个 `src/lib/orchestrator/orchestrator.ts` 和 LLM providers
- **描述**: 无 request ID 跨调用传播；无 trace span 用于阶段计时；无法关联跨异步操作的日志。
- **影响**: 无法诊断慢的辩论轮次；无法检测级联超时；无法追踪 agent degradation 的根因。
- **建议**: 集成 OpenTelemetry。

#### 4.5 核心 Orchestrator 逻辑测试覆盖不足
- **位置**: `test/orchestrator.test.ts`（1 个主测试 vs 1200 行代码）
- **未覆盖**: Agent 超时/降级处理（lines 853-880）；辩论轮次进展和 ledger 更新（lines 1078-1202）；收敛决策逻辑（lines 931-1055）；带重试的摘要生成（lines 1300-1435）。
- **建议**: 为辩论轮次、agent 降级、ledger checkpoints 和收敛决策添加专门测试。

#### 4.6 Decision Reflection (T6) 完全未测试
- **位置**: `src/lib/decision/reflection.ts`, `src/lib/decision/follow-up-context.ts`
- **未覆盖**: Lesson 晋级阈值（`MIN_PATTERN_COUNT = 3`）；Forecast Brier score 计算；Lesson 过期逻辑；Follow-up context 过滤。
- **建议**: 为 reflection.ts 所有函数和 follow-up context 构建添加测试套件。

#### 4.7 LLM Provider 流式错误处理未测试
- **位置**: `src/lib/llm/openai-provider.ts`, `src/lib/orchestrator/stream-multiplexer.ts`
- **未覆盖**: 流式期间超时；部分响应后错误；限流（HTTP 429）；流中断连接重置。
- **建议**: 为每个超时/错误场景添加错误注入测试。

#### 4.8 结构化输出持久化前无校验
- **位置**: `src/lib/orchestrator/orchestrator.ts:906-916`
- **描述**: 无论校验警告如何都存储 artifacts；不拒绝无效 claims（空文本、错误 `claimType`、冲突的 `citationLabels`/`gapReason`）。
- **影响**: 无效 claims 污染决策分析。
- **建议**: 校验结构化回复并拒绝/标记无效 artifacts。

#### 4.9 Follow-Up Context Build Path 未接入
- **位置**: `src/lib/decision/follow-up-context.ts`（`buildFollowUpContext()` 和 `renderFollowUpContextPrompt()`）
- **描述**: T6 函数完整实现但在代码库中**从未被调用**。Follow-up session 不会注入历史 lessons。
- **影响**: T6 决策记忆功能是死代码。
- **建议**: 在 follow-up session 初始化中接入。

### P2 — 优化建议

#### 4.10 硬编码中文 Prompt 阻碍 i18n
- **位置**: `src/lib/orchestrator/moderator.ts`（8 个 prompt 构建器）、`src/lib/decision/follow-up-context.ts`、`src/lib/decision/evaluator.ts`、`src/lib/decision/templates.ts`
- **描述**: 所有系统 prompt 硬编码中文，无法支持英语、日语等。
- **建议**: 重构为 locale-keyed 模板系统。

#### 4.11 无延迟直方图
- **位置**: `src/lib/orchestrator/orchestrator.ts`
- **描述**: 阶段持续时间仅在完成时报告；无 time-to-first-token（TTFT）跟踪。
- **建议**: 跟踪每 agent 的 TTFT 并报告百分位数（p50, p99）。

#### 4.12 结构化回复标记检测效率低
- **位置**: `src/stores/discussion-store.ts:232-240`
- **描述**: 循环式子串匹配 `---STRUCTURED---` 标记；如果模型在文本中输出该标记会被错误截断。与 orchestrator 侧（lines 865-869）重复实现。
- **建议**: 使用 `indexOf()` 替代；移除 store 侧重复逻辑。

#### 4.13 数据库事务完整性未测试
- **位置**: `src/lib/db/repository.ts`（600+ 行）
- **未覆盖**: 同一 session 并发写入；部分失败回滚；外键约束违反。
- **建议**: 添加并发和约束违反测试。

#### 4.14 Agent 可用性无缓存失效
- **位置**: `src/lib/agents/registry.ts`
- **描述**: 每个 session 加载 agent 定义；API key 撤销在服务器重启前不生效。
- **建议**: 缓存 agent 可用性并设 60 秒 TTL。

#### 4.15 无 Session 操作限流
- **位置**: `src/app/api/sessions/[id]/interjections/route.ts`
- **描述**: Interjection POST 无限流；客户端可每秒发送 1000 请求。
- **建议**: 实现 session 级限流（如 10 interjections/min per session）。

#### 4.16 失败 Provider 无熔断器
- **位置**: `src/lib/llm/provider-registry.ts`
- **描述**: 如果 OpenAI API 宕机，每个 agent 请求都失败；无指数退避；无 fallback provider。
- **建议**: 实现 circuit breaker 模式 + provider fallback 链。

---

## 修复优先级建议

### 立即修复（P0，阻断生产部署）

| # | 问题 | 预估工时 |
|---|------|---------|
| 3.1 | Route handler 超时 vs 编排持续时间 | 2h |
| 3.2 | Decision Memory 表未创建 | 1h |
| 1.1 | Watchdog 超时消息无恢复路径 | 4h |
| 1.3 | Error 状态未跨 session 清除 | 0.5h |
| 4.1 | Fire-and-forget DB 写入无错误处理 | 4h |

### 短期修复（P1，下一个迭代）

| 类别 | 关键问题 | 预估工时 |
|------|---------|---------|
| 可靠性 | SQLite WAL + busy timeout (#3.3) | 0.5h |
| 可靠性 | Provider 429/503 自动重试 (#2.4) | 3h |
| 性能 | Store 每 token Map 分配 (#4.2) | 2h |
| 数据完整性 | 多表更新事务化 (#3.7) | 4h |
| 测试 | Orchestrator 核心路径测试 (#4.5) | 8h |
| 功能 | T6 follow-up context 接入 (#4.9) | 4h |

### 中期规划（P2，持续改进）

- 类型安全: SSE Discriminated Union (#3.11)、DecisionSummary branded types (#3.10)
- 可观测性: OpenTelemetry 集成 (#4.4)、延迟直方图 (#4.11)
- i18n: Prompt 模板系统 (#4.10)、UI 文本抽取 (#1.15)
- 韧性: Circuit breaker (#4.16)、限流 (#4.15)
