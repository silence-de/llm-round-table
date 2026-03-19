# Topic6 Cross Reference Analysis (Minimal Memory / Follow-up Continuity / Calibration Traceability)

## 1) Scope
本文件回答 topic6 的核心问题：RT 需要什么记忆，哪些不该记，何时写入，如何把 follow-up、retrospective、calibration 连成闭环，同时避免重型 memory 架构把系统拖垮。

输入材料：
- Claude: `决策支持产品的轻量级记忆架构设计 by claude.md`
- GPT: `RT 决策系统的最小化记忆与可追溯设计研究 by gpt5.4.md`
- Gemini: `轻量级决策记忆系统设计 by gemini.md`
- Minimax: `Memory Types Relevant to RT by minimax2.5.md`

## 2) Source Weighting
- 高权重：GPT / Claude / Minimax
  - 原因：都把“session-end artifact + bounded memory + follow-up whitelist”讲得清楚。
- 中权重：Gemini
  - 原因：方向正确，但部分叙述偏架构宣言，工程边界略弱于前三者。

## 3) Consensus / Disagreement Matrix

### 共识
- RT 不需要开放式重型长期记忆。
- Follow-up 继承的是结构化决策状态，不是原始 transcript。
- 长期记忆写入应在 session end 生成，而不是运行中持续生成。
- Lessons learned 必须有最小 schema、证据锚定和过期机制。
- Calibration / retrospective / follow-up 必须联通。

### 分歧
- 是否需要更多“认知科学式 memory taxonomy”：
  - 各报告都提到工作记忆/情景记忆/语义记忆等
  - 但落到 RT 时都收敛为“只保留最小必要结构”
- lessons schema 的丰富度：
  - Minimax/Gemini更愿意加字段
  - GPT/Claude更偏保守最小化

## 4) Adoption Decisions

### 采纳
- session-end reflection artifact
- bounded decision archive
- follow-up injection whitelist
- lesson promotion + expiry policy

### 部分采纳
- 更复杂的多类型 memory 分类：
  - 作为概念参考
  - 不作为第一阶段数据模型目标

### 不采纳
- MemGPT 式运行时自主管理长期记忆
- 递归摘要作为主 memory 机制
- 把原始思维链和低置信旧猜测带入 follow-up

## 5) RT-Specific Constraints
- RT 已有 task ledger、resume、follow-up 基础，说明“会话连续性”不是空白。
- 当前最缺的不是更多历史，而是“会话结束时产出什么结构化记忆、下次会话注入什么、禁止注入什么”。
- RT 属于离散决策工作流，不是连续社交模拟；因此重型 episodic memory 天然不合适。

## 6) Current Code Review
- 已具备：
  - ledger / phase history / checkpoint：[`task-ledger.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/orchestrator/task-ledger.ts), [`schema.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/db/schema.ts)
  - follow-up / resume 基础：[`resume.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/orchestrator/resume.ts)
  - 研究与决策 artifact 导出：[`session-artifact-files.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/session-artifact-files.ts)
- 核心缺口：
  - 缺少独立 `session_end_reflection` artifact。
  - 缺少 lessons learned 生命周期规则。
  - 缺少 follow-up memory injection 白名单机制。

## 7) Development Guidance

### P0
- 定义 `session_end_reflection` 最小 schema：
  - `decision_summary`
  - `assumptions_with_status`
  - `evidence_gaps`
  - `forecast_items`
  - `lessons_candidate`
- 在 session completion / stop 时单点生成。
- Follow-up 只注入：
  - 上次结论
  - 未关闭假设
  - 证据缺口
  - 已验证 lessons

### P1
- 引入 lessons promotion 规则：
  - `pattern_count`
  - `evidence_count`
  - `expiry_policy`
  - `conflict_marker`
- 在 calibration 面板联通预测-结果对账与 lesson 命中。

### P2
- 增加有界归档策略：
  - 时间窗口
  - 数量上限
  - 过期清理
- 不同主题域之间做记忆隔离，避免跨域污染。

## 8) Validation Plan
- 测试：
  - follow-up 不依赖长 transcript 仍能正确续接
  - expired lessons 不再注入
  - low-confidence assumptions 不进入新会话 prompt
- 指标：
  - follow-up token reduction
  - lesson hit rate
  - stale lesson rollback rate

## 9) Bottom Line
topic6 最稳的结论是：RT 的 memory 不该追求“多”，而应追求“少量、结构化、在会话边界写入、可验证地注入下一次决策”。这比引入任何重型长期记忆框架都更符合 RT 的产品边界，也更适合作为下一阶段开发依据。
