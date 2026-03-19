# Topic 5 开发计划：Reliability / Partial Failure / Resume / Reconnect
> 基于 cross-reference-analysis-by-claude.md + GPT 补充 | 2026-03-19

## 依赖关系总览

```
T5-1 (SSE eventId + buffer + catch-up)
  └── T5-3 (客户端重连协议)
T5-2 (幂等键设计)
  └── T5-4 (统一错误分类 + 处理模板)
        └── T5-5 (phase reliability 指标 + ops)
T5-6 (离线 replay 工具) ── 依赖 T5-1 + T5-2
```

**可并行**：T5-1 与 T5-2 可同时启动；T5-3 依赖 T5-1；T5-4 依赖 T5-2；T5-5 依赖 T5-4。

---

## T5-1：SSE eventId + Session-scoped Buffer

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：可与 T5-2 同时进行

### 背景
当前 SSE 事件无单调 eventId，断线重连只能重新开一条流，无法补发缺失事件。

### 任务
- [ ] 为每个 SSE 事件增加单调递增 `id` 字段（session 内全局序号，从 1 开始）
- [ ] 服务端维护 session-scoped ring buffer（最近 200 个事件，按 eventId 索引）
- [ ] 第一阶段优先使用进程内 ring buffer 或数据库补发；Redis 作为后续扩展，不作为当前硬依赖
- [ ] SSE 事件格式与补发逻辑兼容 `Last-Event-ID` 语义
- [ ] 实现 `getEventsSince(sessionId, lastEventId)` 函数：返回 buffer 中 > lastEventId 的事件列表

### 验收
- 同一 session 内 eventId 严格单调递增，无重复
- buffer 在 TTL 内可正确返回指定 eventId 之后的所有事件

---

## T5-2：幂等键设计（Idempotency Keys）

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：可与 T5-1 同时进行

### 背景
summary / ledger snapshot / exports 可能在重试时产生重复写入。需为所有外部副作用操作定义幂等键。

### 任务
- [ ] 定义幂等键规则：
  - summary 写入：基于 `session_id + summary_version` 或内容 hash
  - ledger checkpoint：基于 `session_id + phase + created_boundary`
  - export：基于 `session_id + artifact_type + content_hash`，不使用“分钟级时间戳”这类脆弱键
- [ ] 第一阶段优先在 repository 层实现幂等去重与重复写保护；是否上全表 UNIQUE 约束按实际表结构逐个评估
- [ ] 对已是一对一主键表的写入，不重复引入无意义幂等列
- [ ] 单元测试：同一幂等键的第二次写入不产生新记录

### 验收
- 重试场景下数据库记录数不增加
- 幂等键冲突时返回已有记录 ID，不报错

---

## T5-3：客户端重连协议（Last-Event-ID catch-up）

**优先级**：P0
**依赖**：T5-1 完成
**可并行**：无

### 背景
客户端重连时提交 `Last-Event-ID`，服务端补发缺失事件，实现无缝续接。

### 任务
- [ ] 客户端 SSE 连接逻辑：
  - 记录最后收到的 `event.lastEventId`
  - 断线检测：`EventSource` onerror 后 exponential backoff 重连（1s / 2s / 4s，最多 3 次）
  - 浏览器端优先通过查询参数携带 `?lastEventId={id}`；不依赖手工设置 `Last-Event-ID` header
- [ ] 服务端重连处理：
  - 读取 `lastEventId` 参数
  - 调用 `getEventsSince(sessionId, lastEventId)` 补发缺失事件
  - 补发完成后切换为实时流模式
- [ ] 补发事件增加元数据标记（如 `replayed: true`），避免与“用户语义上的 replay”混淆

### 验收
- 模拟断线 + 重连测试：重连后不丢失任何 phase 事件
- 补发事件在 UI 中不产生重复渲染

---

## T5-4：统一错误分类 + 处理模板

**优先级**：P0
**依赖**：T5-2 完成
**可并行**：无

### 背景
failure taxonomy 未统一。需定义 transient / degraded / terminal 三类错误及对应处理模板。

### 任务
- [ ] 定义错误分类枚举：
  ```ts
  type FailureClass = 'transient' | 'degraded' | 'terminal'
  ```
  - `transient`：网络超时、rate limit → 自动重试（最多 3 次，exponential backoff）
  - `degraded`：单个 agent 失败、research 部分缺失 → 降级继续，标注缺口
  - `terminal`：session 数据损坏、无法恢复的 LLM 错误 → 停止，通知用户
- [ ] 为以下场景编写标准处理模板：
  - degraded agent：跳过该 agent，在 ledger 中记录 `degraded_agents[]`
  - missing research：生成 gapReason，继续 summary 生成
  - partial summary：保存已完成部分，标注 `summary_status: 'partial'`
  - stream disconnect：触发 T5-3 重连协议
- [ ] 在 orchestrator 中统一使用上述分类，替换现有的零散 try/catch

### 验收
- 所有 orchestrator 错误路径均有明确的 FailureClass 标注
- degraded 场景下 session 不中断，用户收到降级提示

---

## T5-5：Phase Reliability 指标 + Ops Dashboard

**优先级**：P1
**依赖**：T5-4 完成
**可并行**：无

### 背景
将 phase reliability 统计接入 ops API，监控端到端成功率与各阶段失败分布。

### 任务
- [ ] 在 `phase_executions` 表中记录每个 phase 的：
  - `started_at`、`completed_at`、`status: 'success' | 'degraded' | 'failed'`
  - `failure_class`、`failure_reason`
- [ ] 实现 `GET /api/ops/reliability` 返回：
  - `phase_failure_rate`（按 phase 分类）
  - `resume_success_rate`（重连后成功续接的比例）
  - `reconnect_recovery_latency_p50/p95`
  - `degraded_completion_rate`（degraded 场景下最终完成的比例）
- [ ] 在 ops dashboard 中展示上述指标的 7 天趋势图
- [ ] 设置���警阈值：`phase_failure_rate > 10%` 触发告警

### 验收
- 指标计算结果与手动统计一致
- 告警在测试环境可被触发

---

## T5-6：离线 Replay / Audit 工具

**优先级**：P2
**依赖**：T5-1 + T5-2 完成
**可并行**：无

### 背景
支持从任意 checkpoint 重放 session，用于调试和审计。

### 任务
- [ ] 实现 `replaySession(sessionId, fromCheckpointId)` 函数：
  - 读取指定 checkpoint 的 ledger 快照
  - 优先基于持久化 session events / artifacts 重建审计视图，不依赖短 TTL 的 SSE buffer
  - 默认不重跑 LLM，只做 audit replay
- [ ] CLI 工具：`npx rt-replay --session <id> --from <checkpointId>`
- [ ] 重放日志格式：JSONL，每行一个事件，包含 eventId、type、payload、timestamp

### 验收
- 重放结果与原始 session 的 artifact 内容一致
- CLI 工具在 README 中有使用说明
