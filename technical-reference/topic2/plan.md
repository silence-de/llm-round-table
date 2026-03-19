# Topic 2 开发计划：Task Ledger 与 Typed State 演进
> 基于 cross-reference-analysis-by-claude.md | 2026-03-19

## 依赖关系总览

```
T2-1 (消息稳定 ID)
  └── T2-2 (Task Ledger 最小 schema + cursor)
        ├── T2-3 (phase-aligned checkpoint)
        │     └── T2-5 (resume/fork 语义)
        └── T2-4 (consensus_map 字段)
T2-6 (ledger_version 版本控制) ── 可与 T2-1 并行，T2-2 完成后锁定
```

**可并行**：T2-1 与 T2-6 可同时启动；T2-3 与 T2-4 在 T2-2 完成后可并行。

---

## T2-1：为消息历史引入稳定 ID 与结构化元数据

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：可与 T2-6 同时进行

### 背景
没有稳定的消息 ID，Task Ledger 中的 evidence 引用无法实现可追溯性。这是所有后续任务的基础。

### 任务
- [ ] 为每条消息分配稳定 `message_id`（UUID v4，服务端生成）
- [ ] 消息元数据字段：`role`、`author`（agent_id 或 'user'/'moderator'）、`created_at`、`parent_id`（可选，用于回复链）
- [ ] 在 `schema.ts` 中确认 messages 表包含上述字段
- [ ] 在 `repository.ts` 中确认 `insertMessage` 返回 message_id
- [ ] 历史消息迁移：为已有无 ID 消息补生成 deterministic ID（基于 session_id + sequence_number 的 hash）

### 验收
- 同一消息在 resume 后 message_id 不变
- parent_id 引用链可完整重建对话树

---

## T2-2：Task Ledger 最小 schema + cursor 字段

**优先级**：P0
**依赖**：T2-1 完成
**可并行**：完成后 T2-3 / T2-4 可并行

### 背景
采用 MiniMax 五字段为基础，加入 GPT 的 cursor 字段，替代独立 Progress Ledger。

### 任务
- [ ] 确认/扩展 `TaskLedger` 类型包��：
  ```ts
  {
    ledgerVersion: string
    sessionId: string
    objective: string
    currentPhase: DiscussionPhase
    phaseHistory: LedgerPhaseHistoryEntry[]
    evidenceCollected: EvidenceRef[]      // message_id 引用
    decisionDraft: DecisionDraftSnapshot | null
    cursor: LedgerCursor                  // waitingOn + stallSignal
    riskRegister: LedgerRiskEntry[]
    consensusMap: ConsensusEntry[]        // 新增
  }
  ```
- [ ] 定义 `ConsensusEntry`：`{ topic: string, status: 'agreed' | 'disputed' | 'open', evidenceRefs: string[] }`
- [ ] 定义 `EvidenceRef`：`{ messageId: string, claimText: string, sourceId?: string }`
- [ ] 更新 `initTaskLedger` 初始化逻辑
- [ ] 更新 `deserializeLedger` 向前兼容默认值

### 验收
- 所有字段有默认值，���版 ledger JSON 可无损反序列化
- `consensusMap` 初始为空数组，不影响现有流程

---

## T2-3：Phase-aligned Checkpoint 持久化

**优先级**：P0
**依赖**：T2-2 完成
**可并行**：可与 T2-4 同时进行

### 背景
在阶段转换时创建 checkpoint，而非每条消息后。触发点：CurrentPhase 变化、DecisionDraft 结构性更新、cursor.waitingOn 非 none。

### 任务
- [ ] 确认 `shadowWriteLedgerCheckpoint` 在以下时机被调用：
  - `phase_started` 事件后
  - `phase_completed` 事件后
  - `cursor.waitingOn` 从 none 变为非 none 时
- [ ] checkpoint 存储内容：完整 ledger JSON + thread_id + phase + timestamp
- [ ] 为 checkpoint 增加 `trigger_reason` 字段：`'phase_start' | 'phase_complete' | 'waiting_on' | 'manual'`
- [ ] 确认 `upsertLedgerCheckpoint` 使用 session_id + phase 作为 upsert key（同一 phase 只保留最新）
- [ ] 增加 `listLedgerCheckpoints(sessionId)` 返回按时间排序的 checkpoint 列表

### 验收
- 每个 phase 边界均有对应 checkpoint 记录
- checkpoint 写入失败不阻塞主流程（try/catch 已有）

---

## T2-4：consensus_map 更新逻辑

**优先级**：P1
**依赖**：T2-2 完成
**可并行**：可与 T2-3 同时进行

### 背景
consensus_map 使主持人可直接判断讨论是否收敛，是 Gemini 报告独有的高价值字段。

### 任务
- [ ] 在 moderator analysis 阶段，从 agent replies 的 position 分布中提取共识/争议点
- [ ] 实现 `updateConsensusMap(ledger, agentReplies)` 函数：
  - 若某议题 ≥ 80% agents 为 support/oppose 同向 → status: 'agreed'
  - 若 support 与 oppose 均 > 20% → status: 'disputed'
  - 否则 → status: 'open'
- [ ] 将 consensus_map 更新集成到 `updateLedgerFromAnalysis` 调用链
- [ ] 在 `decision-summary-card.tsx` 中展示 consensus_map 摘要（已达成共识 N 项，争议 M 项）

### 验收
- consensus_map 在每轮 moderator analysis 后自动更新
- UI 展示不超过 5 条最新共识/争议条目

---

## T2-5：审计型 replay 与探索型 replay 语义区分

**优先级**：P1
**依赖**：T2-3 完成
**可并行**：无

### 背景
GPT 报告独有洞察：审计型 replay（读已持久化 artifact，不重跑 LLM）与探索型 replay（从旧 checkpoint fork，重新生成）必须在产品层面明确区分。

### 任务
- [ ] 在 `resume.ts` 中区分两种 resume 模式：
  - `mode: 'audit'`：直接读取 checkpoint artifact，不触发任�� LLM 调用
  - `mode: 'fork'`：从指定 checkpoint 创建新 branch（新 session_id，parent_session_id 引用原 session）
- [ ] 在 `schema.ts` 中为 sessions 表增加 `parent_session_id` 字段（fork 时填写）
- [ ] API：`POST /api/sessions/[id]/fork` 接受 `checkpoint_id`，返回新 session_id
- [ ] UI：resume 入口提供两个明确选项："查看历史记录"（audit）vs "基于此状态继续"（fork）

### 验收
- audit 模式下不产生任何新 LLM 调用
- fork 模式下新 session 的 parent_session_id 正确指向原 session

---

## T2-6：ledger_version 版本控制

**优先级**：P2
**依赖**：无（可与 T2-1 并行）
**可并行**：可与 T2-1 同时进行，T2-2 完成后锁定 v1

### 任务
- [ ] 确认 `TaskLedger.ledgerVersion` 字段已存在（当前实现已有）
- [ ] 在 `deserializeLedger` 中根据 ledgerVersion 做条件迁移
- [ ] 文档化 v1 schema 字段列表，作为后续版本 baseline
- [ ] 为缺失 ledgerVersion 的历史记录默认赋值 `"1.0"`

### 验收
- 无 ledgerVersion 的历史 checkpoint 可被正确读取
- v1 → v2 迁移函数有对应单元测试
