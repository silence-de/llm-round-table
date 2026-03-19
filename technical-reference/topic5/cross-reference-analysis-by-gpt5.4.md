# Topic5 Cross Reference Analysis (Reliability / Partial Failure / Resume / Reconnect)

## 1) Scope
本文件把 topic5 四份报告压缩成 RT 的可靠性开发依据，覆盖 phase reliability、partial failure、resume/replay、SSE reconnect 和 observability。

输入材料：
- Claude: `长会话 LLM 决策工作流的可靠性与可恢复性架构设计 by claude.md`
- GPT: `长会话 LLM Decision Workflow 的 Reliability、Partial Failure、Resume、Reconnect 与可观测性设计研究 by gpt5.4.md`
- Gemini: `长会话 LLM 工作流可靠性设计研究 by gemini.md`
- Minimax: `长会话 LLM Decision Workflow 可靠性设计深度研究报告 by minimax 2.5.md`

## 2) Source Weighting
- 高权重：GPT / Claude
  - 原因：resume/replay/reconnect 语义拆分最清晰，且与 RT 现有会话型架构高度对齐。
- 中权重：Minimax
  - 原因：failure taxonomy、dashboard、SSE appendices 有实用价值，但部分术语比 RT 当前所需更重。
- 中权重：Gemini
  - 原因：方向一致，但工程约束和状态边界定义不如 GPT/Claude 精细。

## 3) Consensus / Disagreement Matrix

### 共识
- 可靠性应按 phase 记录，而不是只看最终 completed。
- Partial failure 必须分类处理，不能统一“重试一下”。
- Resume 与 Replay 语义不同，状态边界必须清楚。
- SSE 重连必须依赖服务端配合，不能只靠前端自动重连。
- 可观测性要覆盖恢复成功率、降级率、阶段失败率、断连恢复时延。

### 分歧
- 是否引入更完整 saga/补偿框架：
  - GPT/Claude 倾向最小幂等 + 可恢复边界
  - Minimax 更愿意引入更完整 failure playbook
- Compound reliability 的数学表达：
  - 报告有不同提法
  - 但对当前 RT，先做可观测 phase metrics 比推一个统一复合分更重要

## 4) Adoption Decisions

### 采纳
- phase-based reliability 记录
- typed checkpoint + stable boundary resume
- SSE heartbeat + catch-up 语义
- partial failure 分类与标准降级动作

### 部分采纳
- compound reliability 总分：
  - 可以做 ops 参考
  - 不应过早产品化为单一总指标

### 不采纳
- 在未定义幂等边界前，直接做“任意步骤自动重放”
- 把 replay 与 resume 混成同一用户语义

## 5) RT-Specific Constraints
- RT 当前已有 resume plan、ledger checkpoint、SSE heartbeat；因此 topic5 的主任务不是新造概念，而是把已有能力补成可依赖的协议。
- RT 目前最大的可靠性缺口不是“没有恢复”，而是“恢复与重连仍偏经验规则化，幂等与 catch-up 还不够严格”。
- 由于 RT 产物包括 summary、PDF、research state，重复写入和跨会话污染要比纯聊天系统更危险。

## 6) Current Code Review
- 已具备：
  - heartbeat 事件：[`types.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/sse/types.ts), [`use-discussion-stream.ts`](/Users/chengxi-mba/Projects/round-table/src/hooks/use-discussion-stream.ts)
  - stable-boundary resume：[`resume.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/orchestrator/resume.ts)
  - task ledger checkpoints：[`schema.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/db/schema.ts)
  - ops/calibration dashboard 基础：[`repository.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/db/repository.ts)
- 核心缺口：
  - 缺少 event-id catch-up 协议。
  - 缺少跨阶段 artifact 写入的幂等键设计。
  - failure taxonomy、error code、降级动作还没统一。

## 7) Development Guidance

### P0
- 为 SSE 事件增加单调 `eventId` 与 session-scoped buffer。
- 客户端重连时提交 `lastEventId`，服务端补发缺失事件。
- 为 summary / ledger snapshot / exports 定义 idempotency key。
- 建立统一错误分类：
  - `transient`
  - `degraded`
  - `terminal`

### P1
- 为 degraded agent、missing research、partial summary、stream disconnect 写标准处理模板。
- 把 phase reliability 统计接入 ops API。
- 增加强优先回归测试：
  - disconnect + catch-up
  - summary interrupted resume
  - research degraded completion
  - duplicate write prevention

### P2
- 离线 replay 工具化
- 更完整的 saga / compensation 仅在 side-effect 增多后再评估

## 8) Validation Plan
- 测试：
  - reconnect 不丢关键 phase 事件
  - 重试不产生重复 artifacts
  - resume 恢复后 phase/round 一致
- 运维指标：
  - phase failure rate
  - resume success rate
  - reconnect recovery latency
  - degraded completion rate

## 9) Bottom Line
topic5 最稳的开发依据是：RT 的可靠性必须建立在“明确状态边界 + 幂等写入 + 服务端协助重连补发”之上，而不是继续依赖“断了就重新开一轮”。这条结论与现有实现强相关，且能直接指导下一阶段的可靠性补强。
