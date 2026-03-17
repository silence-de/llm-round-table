# Round Table 开发计划

> 基于 cross-reference-analysis（修订版）和 GPT-5.4 Final Review 的共识优先级。
> 每个任务设计为可独立交给 Claude Code Sonnet 执行的单元，附完整上下文和验收标准。

---

## Phase 1：结构化基础（Task 1-3）

### Task 1：Agent 回复结构化 Schema

**目标**：agent 回复从自由文本升级为「显示层 + 逻辑层」双轨输出。

**改动文件**：
- `src/lib/orchestrator/types.ts`
- `src/lib/orchestrator/moderator.ts`
- `src/lib/orchestrator/orchestrator.ts`

**步骤**：

1. 在 `src/lib/orchestrator/types.ts` 中新增 `StructuredAgentReply` 接口：

```typescript
export interface StructuredAgentKeyPoint {
  claim: string;
  reasoning: string;
  evidenceCited: string[];  // citation labels like "R1", "R2"
  confidenceBand: 'high' | 'medium' | 'low';
}

export interface StructuredAgentReply {
  stance: 'support' | 'oppose' | 'mixed' | 'unsure';
  keyPoints: StructuredAgentKeyPoint[];
  caveats: string[];
  questionsForOthers: string[];
  narrative: string;  // 自然语言版本，给 UI 展示
}
```

2. 修改 `AgentResponse` 接口，新增可选的 `structured` 字段：

```typescript
export interface AgentResponse {
  agentId: string;
  displayName: string;
  content: string;  // 保留原始文本，向后兼容
  structured?: StructuredAgentReply;  // 新增
}
```

3. 在 `src/lib/orchestrator/moderator.ts` 中修改 `buildAgentSystemPrompt`：
   - 在 prompt 末尾追加结构化输出要求，让 agent 同时返回 JSON 结构和自然语言 narrative
   - 输出格式要求：先输出自然语言观点（用于 UI 展示和 SSE 流式输出），然后在末尾用 `---STRUCTURED---` 分隔符后输出 JSON
   - prompt 中明确说明 JSON 部分的 schema

4. 在 `src/lib/orchestrator/moderator.ts` 中新增 `parseStructuredAgentReply(content: string): { narrative: string; structured?: StructuredAgentReply }` 函数：
   - 用 `---STRUCTURED---` 分隔符切分 content
   - 前半段作为 narrative（即使 JSON 解析失败也能降级使用）
   - 后半段尝试 JSON.parse，失败则 structured 为 undefined
   - 做基本的字段校验（stance 枚举值、keyPoints 是否为数组等），不合法的字段静默降级

5. 在 `src/lib/orchestrator/orchestrator.ts` 的 agent 响应收集逻辑中（搜索 `agentResponses.set`），调用 `parseStructuredAgentReply` 解析 content，将 `structured` 字段写入 `AgentResponse`。

6. 修改 `buildAnalysisPrompt`：
   - 当 agent 回复包含 structured 字段时，在传给 moderator 的 prompt 中同时展示 narrative 和结构化摘要
   - 格式：`### agentName\n观点：narrative\n结构化：stance=X, keyPoints=[...]`
   - 当没有 structured 时，保持原来的 `### agentName\ncontent` 格式降级

**验收标准**：
- `npm run build` 通过
- 现有测试通过
- 当 agent 返回不含 `---STRUCTURED---` 的纯文本时，系统行为与改动前完全一致（降级兼容）

---

### Task 2：Trust Validators

**目标**：把「信任」从 prompt discipline 落到硬约束——对 DecisionSummary 做字段级校验，标记违规而非静默忽略。

**改动文件**：
- `src/lib/decision/types.ts`（新增类型）
- 新建 `src/lib/decision/validators.ts`
- `src/lib/decision/utils.ts`（集成 validator）

**步骤**：

1. 在 `src/lib/decision/types.ts` 中新增：

```typescript
export interface TrustViolation {
  field: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface TrustValidationResult {
  valid: boolean;
  violations: TrustViolation[];
  score: number;  // 0-100, 用于内部评估，不对用户展示
}
```

2. 新建 `src/lib/decision/validators.ts`，导出 `validateDecisionSummary(summary: DecisionSummary, brief: DecisionBrief, sourceCount: number): TrustValidationResult`。

3. 校验规则（每条规则产生一个 TrustViolation）：

| 规则 ID | 字段 | 严重度 | 条件 |
|---------|------|--------|------|
| `nextActions_empty` | nextActions | error | `nextActions.length === 0` |
| `redLines_empty` | redLines | error | `redLines.length === 0` |
| `revisitTriggers_empty` | revisitTriggers | error | `revisitTriggers.length === 0` |
| `evidence_missing` | evidence | error | `evidence.length === 0` |
| `evidence_all_gaps` | evidence | warning | 所有 evidence 条目都只有 gapReason 而没有 sourceIds |
| `why_no_evidence` | why + evidence | warning | 存在 why 条目但 evidence 中没有任何 sourceIds 引用（即所有推荐理由都无证据支持） |
| `confidence_no_sources` | confidence + evidence | warning | `confidence >= 70` 但 evidence 中没有任何 sourceIds（高置信度但无证据） |
| `gap_as_conclusion` | evidence | warning | 某条 evidence 的 claim 出现在 why 或 recommendedOption 中，但该 evidence 只有 gapReason 没有 sourceIds（把证据空白当结论用） |
| `recommendation_missing` | recommendedOption | warning | `recommendedOption` 为空字符串 |

4. 在 `src/lib/decision/utils.ts` 的 `parseDecisionSummary` 函数末尾，调用 `validateDecisionSummary` 并将 violations 挂到返回的 summary 上。在 `DecisionSummary` 接口中新增可选字段 `trustViolations?: TrustViolation[]`。

5. 验证 violations 会通过现有的 persistence 流程存入 DB（DecisionSummary 序列化为 JSON 存在 `decision_summaries.content` 中）。

**验收标准**：
- `npm run build` 通过
- 新建 `src/lib/decision/__tests__/validators.test.ts`，至少覆盖上述 9 条规则各一个正例和反例
- 现有流程不受影响（violations 是附加信息，不阻断流程）

---

### Task 3：TaskLedger 数据结构设计

**目标**：定义 TaskLedger 的类型和初始化/更新逻辑，为 Phase 2 的 prompt 改造做准备。本 task 只定义数据结构和更新函数，不改动 prompt。

**改动文件**：
- `src/lib/orchestrator/types.ts`（新增类型）
- 新建 `src/lib/orchestrator/task-ledger.ts`

**步骤**：

1. 在 `src/lib/orchestrator/types.ts` 中新增：

```typescript
export interface TaskLedger {
  /** brief 的标准化单段摘要 */
  briefSummary: string;
  /** 不可妥协项，从 brief.nonNegotiables 提取 */
  nonNegotiables: string[];
  /** 已达成共识的 claim */
  acceptedClaims: Array<{ claim: string; supportedBy: string[]; round: number }>;
  /** 已被否决/撤回的 claim */
  rejectedClaims: Array<{ claim: string; rejectedReason: string; round: number }>;
  /** 尚未解决的分歧 */
  unresolvedDisagreements: Array<{ point: string; positions: Record<string, string> }>;
  /** 已识别的证据空白 */
  evidenceGaps: string[];
  /** 当前轮次需要回答的问题 */
  currentQuestions: string[];
  /** 收敛条件是否满足 */
  convergenceReached: boolean;
  /** 上次更新的轮次 */
  lastUpdatedRound: number;
}
```

2. 新建 `src/lib/orchestrator/task-ledger.ts`，导出：

```typescript
/**
 * 从 brief + agenda 初始化一个空 TaskLedger
 */
export function initTaskLedger(brief: DecisionBrief, agenda: DiscussionAgenda): TaskLedger;

/**
 * 用 moderator 的 Analysis 结果更新 TaskLedger
 * - agreements → acceptedClaims（追加，去重）
 * - disagreements → unresolvedDisagreements（替换为最新）
 * - shouldConverge → convergenceReached
 * - disagreements 的 followUpQuestion → currentQuestions
 */
export function updateLedgerFromAnalysis(
  ledger: TaskLedger,
  analysis: ModeratorAnalysis,
  round: number
): TaskLedger;

/**
 * 将 TaskLedger 序列化为可嵌入 prompt 的文本块
 * 格式紧凑，适合作为 system prompt 的一部分
 */
export function ledgerToPromptBlock(ledger: TaskLedger): string;
```

3. `initTaskLedger` 实现：
   - `briefSummary`：拼接 `brief.topic + brief.goal + brief.constraints` 为一段话（不超过 200 字）
   - `nonNegotiables`：将 `brief.nonNegotiables` 按中文分号/逗号切分为数组
   - 其他字段初始化为空数组/false/0

4. `updateLedgerFromAnalysis` 实现：
   - 将 `analysis.agreements` 追加到 `acceptedClaims`，用 `claim` 文本去重
   - 将 `analysis.disagreements` 替换 `unresolvedDisagreements`
   - 从 disagreements 提取 `followUpQuestion` 作为 `currentQuestions`
   - 设置 `convergenceReached = analysis.shouldConverge`
   - 设置 `lastUpdatedRound = round`
   - 返回新对象（不 mutate 原 ledger）

5. `ledgerToPromptBlock` 实现：
   - 生成格式化文本，类似：
   ```
   【决策概要】topic + goal + constraints 摘要
   【不可妥协】item1、item2
   【已达共识】claim1（支持者：A, B）；claim2...
   【待解决分歧】point1：A认为X，B认为Y
   【证据空白】gap1、gap2
   【当前问题】question1、question2
   ```
   - 空的部分不输出

**验收标准**：
- `npm run build` 通过
- 新建 `src/lib/orchestrator/__tests__/task-ledger.test.ts`，覆盖 init、update（含去重）、ledgerToPromptBlock 的基本用例
- 此 task 不改动 orchestrator.ts 或 moderator.ts 的任何现有逻辑

---

## Phase 2：状态管理 + 评估（Task 4-6）

> 依赖 Phase 1 完成。

### Task 4：Orchestrator 集成 TaskLedger

**目标**：将 TaskLedger 集成到 orchestrator 的运行流程中，moderator prompt 改为消费 ledger + 当轮回复，而非完整历史。

**改动文件**：
- `src/lib/orchestrator/orchestrator.ts`
- `src/lib/orchestrator/moderator.ts`

**步骤**：

1. 在 `DiscussionOrchestrator` 类中新增私有属性 `private taskLedger: TaskLedger`。在 constructor 中调用 `initTaskLedger(config.brief, config.agenda)` 初始化。

2. 在 `phaseAnalysis` 方法中，`parseAnalysis` 之后立即调用 `updateLedgerFromAnalysis(this.taskLedger, analysis, round)` 更新 ledger。

3. 修改 `buildAnalysisPrompt` 签名，新增可选参数 `ledger?: TaskLedger`：
   - 当 ledger 存在时，prompt 结构改为：
     ```
     当前决策状态（TaskLedger）：
     {ledgerToPromptBlock(ledger)}

     本轮各参与者新回复：
     {当轮 responses}

     请基于以上信息分析...（保持原有 JSON 格式要求不变）
     ```
   - 当 ledger 不存在时，保持原有行为（降级兼容）
   - **关键**：不再传入完整的 allMessages，只传当轮的 responses

4. 修改 `buildDebatePrompt`，新增可选参数 `ledger?: TaskLedger`：
   - 当 ledger 存在时，在 prompt 中加入 `ledgerToPromptBlock(ledger)` 替代 `buildDecisionContextBlock` 中的部分重复信息
   - 保留 agent 自己的 `previousContent`（这是必要的上下文）

5. `buildSummaryPrompt` 和 `buildDecisionSummaryPrompt` **暂不改动**——这两个 prompt 需要完整信息来生成最终产物，不适合只用 ledger 替代。

6. 在 orchestrator.ts 的 `phaseAnalysis` 和 `phaseDebate` 调用处传入 `this.taskLedger`。

**验收标准**：
- `npm run build` 通过
- 现有测试通过
- 手动验证：Analysis 阶段的 prompt 不再包含完整历史消息，而是包含 TaskLedger + 当轮 responses

---

### Task 5：Summary Evaluator Gate

**目标**：在决策摘要生成后，用 moderator 同一模型做一次 QA 校验。不通过则自动重试一次。评估结果记录为 session event，不对用户展示分数。

**改动文件**：
- 新建 `src/lib/decision/evaluator.ts`
- `src/lib/orchestrator/orchestrator.ts`
- `src/lib/orchestrator/types.ts`（DiscussionSessionEvent 新增 type）

**步骤**：

1. 在 `src/lib/orchestrator/types.ts` 的 `DiscussionSessionEvent.type` 联合类型中新增 `'summary_evaluation'`。

2. 新建 `src/lib/decision/evaluator.ts`，导出：

```typescript
export interface SummaryEvaluation {
  pass: boolean;
  checks: Array<{
    name: string;
    pass: boolean;
    reason: string;
  }>;
  overallNote: string;
}

/**
 * 构建 evaluator prompt：给定 brief + summary，检查 5 个维度
 */
export function buildEvaluatorPrompt(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  summary: DecisionSummary
): string;

/**
 * 解析 evaluator 的 JSON 回复
 */
export function parseEvaluation(content: string): SummaryEvaluation;
```

3. `buildEvaluatorPrompt` 生成的 prompt 要求 LLM 用 JSON 回复，检查以下 5 个维度：
   - `brief_coverage`：是否覆盖了 brief 中的关键约束和目标
   - `disagreement_coverage`：推荐是否回应了讨论中的主要分歧（根据 summary.openQuestions 判断）
   - `evidence_alignment`：recommendation 和 why 是否与 evidence 对齐，而非与 gap 对齐
   - `gap_honesty`：证据空白是否被诚实呈现，而非被当作结论使用
   - `completeness`：redLines、revisitTriggers、nextActions 是否非空且具体

4. 在 `orchestrator.ts` 的 `phaseCompleted`（或生成 DecisionSummary 后的位置）中：
   - 调用 moderator 模型运行 evaluator prompt
   - 解析结果
   - 如果 `pass === false`，将 evaluation feedback 附加到 DecisionSummary prompt 末尾，重新生成一次（最多重试 1 次）
   - 无论 pass 与否，通过 `onSessionEventPersist` 记录 `summary_evaluation` 事件，metadata 包含 evaluation 结果

**验收标准**：
- `npm run build` 通过
- evaluator prompt 能正确生成和解析
- 重试逻辑最多执行 1 次（不会无限循环）
- evaluation 结果记录在 session_events 表中

---

### Task 6：Phase 级 Event Metrics

**目标**：为每个 phase 记录开始/结束/失败事件，支持后续的可靠性分析。

**改动文件**：
- `src/lib/orchestrator/types.ts`
- `src/lib/orchestrator/orchestrator.ts`

**步骤**：

1. 在 `DiscussionSessionEvent.type` 中新增 `'phase_started' | 'phase_completed' | 'phase_failed'`。

2. 在 orchestrator.ts 中，在每个 `phase*` 方法的开头和结尾分别 emit `phase_started` 和 `phase_completed` 事件。metadata 包含：
   - `phase`: 当前阶段名
   - `round`: 当前轮次（如果适用）
   - `durationMs`: 阶段耗时（completed 时计算）
   - `agentCount`: 参与 agent 数量（如果适用）
   - `degradedCount`: 降级 agent 数量

3. 当 phase 中发生异常时（catch 块），emit `phase_failed` 事件，metadata 包含 error message。

4. 实现方式：在 orchestrator 中新增一个私有方法 `private emitPhaseEvent(type, phase, round?, extra?)` 封装事件创建逻辑，保持代码整洁。

**验收标准**：
- `npm run build` 通过
- 运行一次完整 session 后，session_events 表中包含各 phase 的 started/completed 事件
- 事件中包含正确的 durationMs

---

## Phase 3：精细化（Task 7-9）

> 依赖 Phase 2 完成。

### Task 7：单轮 Reflection（纠错回合）

**目标**：在 Analysis 后、Debate 前，给每个 agent 一次机会看到 moderator 的聚合分析并修正观点。限制为 1 轮，限制为结构化修正。

**改动文件**：
- `src/lib/orchestrator/types.ts`（DiscussionPhase 新增 REFLECTION）
- `src/lib/orchestrator/moderator.ts`（新增 buildReflectionPrompt）
- `src/lib/orchestrator/orchestrator.ts`（新增 phaseReflection）

**步骤**：

1. 在 `DiscussionPhase` 枚举中，在 `ANALYSIS` 和 `DEBATE` 之间新增 `REFLECTION = 'reflection'`。

2. 在 moderator.ts 中新增 `buildReflectionPrompt`：
   - 输入：brief、agenda、agent 自己之前的 content、moderator 的 analysis narrative + 结构化分歧
   - prompt 要求 agent 只回答以下之一：
     - "维持原观点"（给出简要理由）
     - "修正观点"（说明修正了什么、为什么）
     - "补充新信息"（说明新增了什么视角）
   - 限制 150 字以内
   - 输出为自然语言（不要求结构化，因为这是轻量修正）

3. 在 orchestrator.ts 的分析-辩论循环中，`phaseAnalysis` 之后、判断是否需要 debate 之前，插入 `phaseReflection`：
   - 并行调用所有 active agents
   - 将 reflection 结果追加到 `allMessages` 和 `agentResponses`（覆盖之前的 response，因为这是修正后的最新观点）
   - 如果 reflection 内容是"维持原观点"类型，不更新 agentResponses

4. 新增环境变量 `ROUND_TABLE_ENABLE_REFLECTION`（默认 `false`），只有显式开启时才执行 reflection 阶段。这样可以安全上线，逐步验证。

**验收标准**：
- `npm run build` 通过
- 当 `ROUND_TABLE_ENABLE_REFLECTION=false` 时，行为与改动前完全一致
- 当 `ROUND_TABLE_ENABLE_REFLECTION=true` 时，Analysis 后能看到 reflection 阶段的 SSE 事件和消息

---

### Task 8：基于 decisionType 的 Agent 子集路由

**目标**：根据 `decisionType` 和 `desiredOutput` 自动推荐 agent 子集，而非默认全选。

**改动文件**：
- 新建 `src/lib/agents/routing.ts`
- `src/app/api/sessions/[id]/start/route.ts`（集成路由建议）

**步骤**：

1. 新建 `src/lib/agents/routing.ts`，导出：

```typescript
export interface AgentRoutingAdvice {
  /** 推荐参与的 agent IDs */
  recommended: string[];
  /** 可选参与的 agent IDs */
  optional: string[];
  /** 不推荐参与的 agent IDs（附原因） */
  excluded: Array<{ agentId: string; reason: string }>;
  /** 推荐的 maxDebateRounds */
  suggestedRounds: number;
}

/**
 * 根据决策类型和期望输出给出 agent 路由建议
 */
export function getAgentRoutingAdvice(
  decisionType: DecisionType,
  desiredOutput: DesiredOutput,
  availableAgentIds: string[]
): AgentRoutingAdvice;
```

2. 路由规则（硬编码，不用 LLM）：
   - `investment` / `risk`：优先选擇有分析能力的模型（claude, gpt, deepseek）；minimax/kimi/qwen 为 optional
   - `career`：全选（多视角有价值）
   - `life`：全选
   - `comparison` 类 desiredOutput：建议 maxDebateRounds 至少 2，确保充分对比
   - `action_plan` 类 desiredOutput：建议 maxDebateRounds = 1，快速收敛
   - 当 availableAgentIds 数量 ≤ 3 时，不做排除（样本太少）

3. 在 `start/route.ts` 中，session 创建后、进入讨论前，调用 `getAgentRoutingAdvice`。当前**仅记录建议到 session event**（type: `'agent_routing'`），不自动覆盖用户选择。这是保守上线策略。

**验收标准**：
- `npm run build` 通过
- routing 函数对各 decisionType 返回合理建议
- 不影响现有的 agent 选择逻辑

---

### Task 9：Follow-up Ledger 继承

**目标**：follow-up session 除了继承 action items 外，还继承上一次的 TaskLedger 摘要。

**改动文件**：
- `src/lib/orchestrator/task-ledger.ts`（新增 ledger 序列化/反序列化）
- `src/lib/db/schema.ts`（sessions 表新增 ledger_snapshot 列）
- `src/lib/db/client.ts`（ensureColumn）
- `src/lib/db/repository.ts`（保存/读取 ledger）
- `src/app/api/sessions/[id]/follow-up/route.ts`（传递 ledger）

**步骤**：

1. 在 `task-ledger.ts` 中新增：
   - `export function serializeLedger(ledger: TaskLedger): string` — JSON.stringify
   - `export function deserializeLedger(json: string): TaskLedger | null` — JSON.parse with try-catch

2. 在 `schema.ts` 的 `sessions` 表新增：`ledgerSnapshot: text('ledger_snapshot').notNull().default('')`

3. 在 `client.ts` 中新增 `ensureColumn('sessions', 'ledger_snapshot', "TEXT NOT NULL DEFAULT ''")`

4. 在 `repository.ts` 中：
   - 在 session completed 时（`updateSessionStatus` 或类似函数），保存 ledger snapshot
   - 新增函数 `getSessionLedgerSnapshot(sessionId: string): TaskLedger | null`

5. 在 `follow-up/route.ts` 中：
   - 读取 parent session 的 ledger snapshot
   - 将关键信息（acceptedClaims、unresolvedDisagreements、evidenceGaps）格式化为 `parentContext` 字符串的一部分传入新 session
   - 格式：
     ```
     上次讨论结论：[accepted claims 摘要]
     上次未解决的分歧：[unresolved disagreements]
     上次的证据空白：[evidence gaps]
     ```

6. 在 orchestrator 的 `phaseCompleted` 或 summary 生成后，通过 callback 保存 ledger snapshot。在 `DiscussionConfig` 中新增可选 callback：`onLedgerSnapshotPersist?: (ledger: TaskLedger) => Promise<void> | void`

**验收标准**：
- `npm run build` 通过
- follow-up session 能读取到 parent 的 ledger 信息
- 没有 parent ledger 时降级为原有行为

---

## 执行注意事项

1. **每个 Task 完成后运行 stage gate**：`npm run test && npm run lint && npm run build`
2. **每个 Task 独立 commit**，commit message 格式：`feat(orchestrator): Task N - 简要描述`
3. **降级兼容是硬性要求**：所有新增字段必须是 optional 或有 default，不能破坏现有 session 的读取
4. **不要改动 page.tsx**——前端展示层的改动另行安排
5. **prompt 中所有文本保持中文**，与现有 prompt 风格一致
