# Round Table Topic1 Cross-Review：Agent Reply 结构化升级（v2）

> 更新于 2026-03-18。基于对4份原始报告的完整阅读 + 代码现状核查（`types.ts`、`schema.ts`、`moderator.ts`、`orchestrator.ts`）重写。

---

## 1) 评审范围

- 项目基线（代码）：`src/lib/orchestrator/*`、`src/lib/decision/*`、`src/lib/db/*`
- 对比报告（4 份）：
  - `Trust-first … by gpt5.4.md`
  - `信任优先…结构化制品升级路径 by claude.md`
  - `Agent Reply Structuring for Trust-First MAS by gemini.md`
  - `Trust-First 多智能体系统中 Agent Reply 结构化设计深度调研报告 by minimax-2.5.md`

---

## 2) 项目现状（代码核查结论）

### 已有基础

| 位置 | 内容 |
|------|------|
| `orchestrator/types.ts:64` | `StructuredAgentKeyPoint` / `StructuredAgentReply` 类型已定义，含 `stance`、`keyPoints`、`caveats`、`questionsForOthers`、`narrative` |
| `orchestrator/moderator.ts:59` | `buildAgentSystemPrompt` 已在 prompt 末尾注入 `---STRUCTURED--- + JSON` 指令 |
| `orchestrator/moderator.ts:338` | `parseStructuredAgentReply` 已实现解析逻辑 |
| `orchestrator/orchestrator.ts:844` | `phaseInitialResponses` 已调用 `parseStructuredAgentReply`，`structured` 字段挂在 `AgentResponse` 上 |
| `db/schema.ts:132` | `decisionClaims` + `claimSourceLinks` 表已存在（summary 层） |
| `decision/validators.ts` | `validateDecisionSummary` 已有 `sourceIds/gapReason` 校验 |

### 关键缺口（阻碍结构化升级的核心问题）

1. **`structured` 字段不持久化**
   `orchestrator.ts:858` 只把 `narrative` 写入 `messages.content`，`structured` 对象在内存中用完即丢。`messages` 表无 artifact 字段（`schema.ts:40`）。

2. **`StructuredAgentKeyPoint` 缺少 `gapReason`**
   现有 `evidenceCited: string[]` 是弱约束，没有"无证据时必须填 gapReason"的互斥规则，与 summary 层的 `decisionClaims.gapReason` 不对称。

3. **resume/replay 过程中结构化信息未从持久层恢复**
   类型上 `AgentResponse` 支持 `structured?`，但恢复逻辑当前只基于 `messages.content` 重建，导致 structured 信息在恢复后不可用。

4. **analysis 阶段仍以文本聚合为主**
   当前会把 structured 摘要拼接进 `r.content` 再交给 moderator，但尚未实现“按 claim/evidence 字段的确定性聚合”。

5. **无 `schemaVersion` 字段**
   无法做回放兼容性判断，未来 schema 演进时历史数据无法区分版本。

---

## 3) 四份报告交叉结论

### 3.1 高一致性结论（4 份全部支持）

1. 不应一步到位做大而全 schema，先做最小可验证 contract。
2. 逻辑字段（可机读/可验证）与 UI 叙事字段必须分层，moderator 聚合只读逻辑层。
3. 过度复杂 schema 会带来生成不稳、解析失败、token/延迟/维护成本飙升。
4. 结构化升级优先服务四个场景：聚合、resume/replay、follow-up、testing。
5. 在部分供应商/模式下，内建 citations 与 strict JSON 输出存在兼容性冲突（例如 Claude/Bedrock 的特定组合）；RT 仍应自建 citation label 映射体系以保证可控性。

### 3.2 关键分歧

| 分歧点 | gpt5.4 / claude / gemini | minimax |
|--------|--------------------------|---------|
| 第一优先字段 | claim-citation-gap 证据闭环 | confidence 标准化 |
| reasoning trace | 先证据闭环，再增量加 trace | 更早引入 reasoning_trace |

### 3.3 证据质量分层（采纳权重）

- **高权重**：`gpt5.4`、`claude` — 聚焦官方文档/顶会论文主链，与 RT 现有代码演进路径兼容
- **中权重**：`gemini` — 结论方向正确，但来源中二手/社区文章比例偏高
- **低-中权重**：`minimax` — "confidence-first"与 RT 现有"evidence-first 信任链"冲突；来源噪声高

### 3.4 新增共识（本次读完4份后补充）

- **"格式即真理"陷阱**（gemini 明确提出）：JSON 校验通过 ≠ 内容可信，必须有独立认识论验证（citation label 可解析到真实 source）。
- **逻辑字段应置于 schema 头部**（gemini）：LLM 处理 token 序列，关键逻辑字段夹在长叙事中间会导致注意力丢失。
- **`claim_type` 分层**（gpt5.4 平衡版）：把 fact/assumption/projection/value_judgment 硬拆开，防止"预测"伪装成"事实"混入聚合。

---

## 4) Cross-Review 最终判断

### 采用：Evidence-first + Minimal Contract + Progressive Tightening

**如果只做一件事：把现有 `StructuredAgentReply` 从"提示词约定"升级为"可持久化、可校验、可回放的 evidence-first contract"。**

理由：
1. 与现有 summary 层信任模型同向（`decisionClaims.gapReason` + `claimSourceLinks` 已存在）。
2. 能最快形成"从 agent → moderator 聚合 → summary"的端到端可验证链。
3. 对 resume/replay、moderator 聚合、测试自动化的增益最大，改造面可控。
4. 不依赖厂商 citations feature 作为唯一方案（在部分供应商/模式下与 strict JSON 存在兼容性限制），RT 自有 citation label 体系更可控。

---

## 5) 数据契约 V1（定稿）

在现有 `StructuredAgentReply` 基础上收敛为：

```json
{
  "schemaVersion": "rt.agent.reply.v1",
  "stance": "support | oppose | mixed | unsure",
  "claims": [
    {
      "claim": "string",
      "claimType": "fact | assumption | projection | value_judgment",
      "reasoning": "string",
      "citationLabels": ["R1", "R2"],
      "gapReason": "string | null",
      "confidenceBand": "high | medium | low"
    }
  ],
  "caveats": ["string"],
  "questionsForOthers": ["string"],
  "narrative": "string"
}
```

**强校验规则（必须）：**

1. 每个 claim 必须满足二选一：`citationLabels.length > 0` 或 `gapReason` 非空（互斥规则）。
2. `citationLabels` 默认要求可在当轮 research sources 中解析；若当轮无稳定 research sources，则记录 unresolved label 并降级告警，不作为 parse 失败。
3. `schemaVersion` 必填，便于回放兼容性判断。
4. `claimType` 必填枚举，防止 assumption 伪装成 fact 进入聚合。

**与现有类型的差异：**

| 字段 | 现有 `StructuredAgentKeyPoint` | V1 |
|------|-------------------------------|-----|
| `claim` | ✅ | ✅ |
| `reasoning` | ✅ | ✅ |
| `evidenceCited` | `string[]`（弱约束） | 改名 `citationLabels`，加可解析校验 |
| `confidenceBand` | ✅ | ✅ |
| `claimType` | ❌ | ✅ 新增 |
| `gapReason` | ❌ | ✅ 新增，与 `citationLabels` 互斥 |
| `schemaVersion` | ❌ | ✅ 新增 |

---

## 6) 下一步开发路线

### Phase 1（1 周）：落地 Agent Artifact V1

目标：把"有结构"从内存态变成持久化、可校验、可回放。

**6.1 代码改造点**

1. `src/lib/orchestrator/types.ts`
   - `StructuredAgentKeyPoint`：`evidenceCited` 改名 `citationLabels`，新增 `claimType`、`gapReason`
   - `StructuredAgentReply`：新增 `schemaVersion`，`keyPoints` 改名 `claims`

2. `src/lib/orchestrator/moderator.ts`
   - `buildAgentSystemPrompt`：更新 JSON 输出契约，加入 `schemaVersion`、`claimType`、`gapReason` 字段说明
   - `parseStructuredAgentReply`：增强校验——互斥规则、schemaVersion 检查；citationLabels 解析失败记为可观测告警（非致命）

3. `src/lib/db/schema.ts` + migration
   - 新增 `agent_reply_artifacts` 表：
     ```
     id, sessionId, agentId, phase, round,
     schemaVersion, artifactJson, parseSuccess,
     citationResolveRate, createdAt
     ```
   - 不要把 artifact JSON 塞进 `messages.content`，保持 messages 表干净

4. `src/lib/db/repository.ts`
   - 新增 `upsertAgentReplyArtifact` / `getAgentReplyArtifacts(sessionId, phase, round)`
   - 建立 `(sessionId, agentId, phase, round)` 唯一索引

5. `src/lib/orchestrator/orchestrator.ts`
   - `phaseInitialResponses` / `phaseDebate`：解析后调用 `upsertAgentReplyArtifact` 持久化
   - 解析失败时降级到 narrative，但必须写入 `parseSuccess: false` 日志

6. `src/lib/orchestrator/resume.ts`
   - `DiscussionResumeState.agentResponses` 恢复时优先从 `agent_reply_artifacts` 读取，而非只靠文本

**6.2 验收标准**

1. `agent_reply_artifacts` 覆盖率 > 95%（有结构回复的消息）
2. `citationLabels` 可解析率 > 90%
3. 解析失败自动降级 narrative，产生日志与统计事件
4. resume 后 `agentResponses.structured` 不为空

---

### Phase 2（1 周）：Moderator 聚合改为结构化优先

目标：从"文本摘要驱动"切换为"claim/evidence 驱动"。

**6.3 聚合策略**

1. `buildAnalysisPrompt` 改为优先读 `structured.claims`，按以下维度聚合：
   - **共识**：相同/近似 claim 的多 agent 支持计数（按 `claimType` 分组，fact 与 assumption 分开统计）
   - **分歧**：同 claim 下 stance 冲突 + 证据冲突（同 label 不同结论）
   - **风险**：`claimType=assumption` 且 `confidenceBand=high` 的 claim 自动降权并标记

2. summary 的 `evidence[]` 尽可能直接继承 agent artifact 中已验证 claim，不再从自由文本二次抽取。

---

### Phase 3（0.5~1 周）：评测与守护栏

目标：把结构化升级变成可持续质量资产。

**6.4 新增指标**

1. `artifact_parse_success_rate`
2. `artifact_citation_resolve_rate`
3. `artifact_gap_reason_rate`（有 gapReason 的 claim 占比）
4. `unsupported_high_confidence_claim_rate`（无 citation 且 high confidenceBand 的 claim 占比）
5. `assumption_claim_rate`（claimType=assumption 占比，过高说明证据不足）

**6.5 新增测试**

1. 单测：`parseStructuredAgentReply` 对脏 JSON、半结构化输出、字段缺失、互斥规则违反的鲁棒性
2. 集成：`start → analysis → summary → resume` 全链路 artifact 不丢失
3. 回归：模型切换后 contract 合规率不下降

---

## 7) 明确不建议现在做的事

1. 不要先做概率分布式 confidence（alpha/beta 等）——虚假精确性，LLM 无法可靠生成。
2. 不要先做 argument graph / formal logic 编码——形式正确但内容灌水，moderator 被伪精确迷惑。
3. 不要把所有 narrative 强塞 strict JSON——会显著抬高失败率，损害叙事质量。
4. 不要依赖厂商内建 citation 当唯一证据系统——在部分供应商/模式下与 strict JSON 存在兼容性限制，应采用 RT 自建映射做主链。
5. 不要让 agent 自我声明聚合权重（`aggregationHints.shouldDeferTo` 等）——违反 RT 信任架构，创造操纵激励。
6. 不要在 schema 里堆大量 optional 字段"以后再用"——Claude 明确指出 optional 参数放大 grammar 状态空间。

---

## 8) 本周执行清单

1. 定稿 `rt.agent.reply.v1` JSON contract，更新 `types.ts`（半天）
2. 完成 DB migration + `agent_reply_artifacts` repository 接口（1 天）
3. 更新 `buildAgentSystemPrompt` + 增强 `parseStructuredAgentReply` 校验（1 天）
4. 串联 orchestrator 持久化与 resume 恢复（1.5 天）
5. 增加 8-12 个核心测试（1 天）
6. 小样本回放评估，调阈值（0.5 天）

---

## 9) 一句话结论

你们不需要"再设计一个大而全框架"；已有 60% 基础。下一步最有价值的是：把现有 `StructuredAgentReply` 加上 `schemaVersion + claimType + gapReason`，然后持久化到独立的 `agent_reply_artifacts` 表，让 resume、moderator 聚合、测试都能消费它——而不是让它继续只活在内存里。
