# 信任优先多智能体决策系统：结构化制品升级路径

## Executive Summary

**核心结论：在 Round Table（RT）式信任优先决策系统中，智能体回复从自由文本升级为结构化制品（structured artifact）的最关键第一步是引入带有 `evidence` 数组的引证字段设计，而非全面推行复杂 JSON schema。** 这一判断基于六大一手文献体系的交叉验证：MetaGPT 的 Pydantic 类型化文档流水线、ChatDev 的自由文本对话链、Anthropic/OpenAI 的约束解码结构化输出、GopherCite 的受限采样逐字引用、DSPy 的声明式类型签名与断言机制，以及 DCI 框架的类型化认识论行为（typed epistemic acts）。

核心发现可归结为三点。**第一，结构化输出并非全有或全无的选择**——MetaGPT 要求所有中间产物为类型化 JSON 文档，而 ChatDev 完全依赖自然语言，两者在各自场景下均有成功案例，关键在于结构化程度与系统目标的匹配。**第二，引证字段是 RT 系统收益最高的单一结构化投资**——WebGPT、ALCE、GopherCite 三个引证系统的研究一致表明，带编号引用标记 `[n]` 的引证结构是可验证性提升的最大杠杆。**第三，过度约束解码会造成语义质量退化**——Tam et al. (2024) 和 Park et al. (2024) 的实证研究证明，token 级别的强制约束会扭曲语言模型的输出分布，这对 RT 系统的叙事质量构成直接威胁。

---

## Verified Findings（已验证事实 vs. 推断建议）

### 已验证事实（来自一手文献）

**MetaGPT 的结构化中间产物体系。** MetaGPT（arXiv:2308.00352）定义了五个角色（Product Manager、Architect、Project Manager、Engineer、QA Engineer），每个角色通过 `Action` 类产出类型化文档。核心创新在于 `ActionNode` 使用 **Pydantic BaseModel** 进行 schema 强制验证，输出以 `[CONTENT]...[/CONTENT]` 标签包裹的 JSON 文档存储，验证失败时触发自动重试。产物包括 PRD（含 `Product Goals`、`User Stories`、`Competitive Analysis`、`Requirement Pool` 等字段）、System Design（含 `File Lists`、`Data Structures`、`Interface Definitions`）等。论文明确声明：*"Unlike other works, MetaGPT requires agents to generate structured outputs... The use of intermediate structured outputs significantly increases the success rate."* 智能体间通过发布-订阅（publish-subscribe）机制共享类型化 `Message` 对象。

**ChatDev 的自由文本对话链。** ChatDev（arXiv:2307.07924, ACL 2024）采用完全不同的策略：每个阶段由恰好两个智能体进行自然语言对话，输出通过 **正则表达式提取**（如从对话中提取代码块）而非 schema 验证。结构通过三个 JSON 配置文件（`ChatChainConfig.json`、`PhaseConfig.json`、`RoleConfig.json`）在流程层面（而非输出层面）强制。MetaGPT 论文直接将自身与 ChatDev 对比：ChatDev 的跨智能体通信是自然语言，MetaGPT 的则是标准化结构文档。**这一对比直接证明了"全结构化"与"全文本"两种路线在软件开发场景下的共存。**

**Anthropic 与 OpenAI 的约束解码结构化输出。** 两家平台均支持通过 JSON Schema 定义输出格式，配合 `strict: true` 模式实现 **100% schema 合规率**（OpenAI 官方数据：从训练alone的 93% 提升至 100%）。Anthropic 文档明确定义工具为"确定性系统与非确定性智能体之间的契约"（contract between deterministic systems and non-deterministic agents）。关键限制：严格模式下所有字段必须 `required`，不支持 `additionalProperties`，Anthropic 限制每请求最多 20 个严格工具、24 个可选参数。**两个平台的技术实现均依赖 constrained sampling/decoding——在 token 生成层面通过有限状态机约束有效 token 集合。**

**引证系统的结构化方案对比。** 四个一手系统提供了从简单到复杂的引证 schema 光谱：
- **RARR**（arXiv:2210.08726, ACL 2023）：最简方案——平铺证据片段列表 `A = {e₁, ..., eₘ}`，每个片段含 URL 与文本，无编号引用标记
- **WebGPT**（arXiv:2112.09332）：编号方括号标记 `[1][2]` 内联于答案文本，引用指向通过 `Quote:` 动作收集的网页摘录（含页面标题、域名、文本）
- **ALCE**（arXiv:2305.14627, EMNLP 2023）：同样使用 `[n]` 编号标记，但增加了三维自动评估——流畅度（MAUVE）、正确性（EM/Recall）、**引证质量**（基于 NLI 模型的引证召回率与精确率）
- **GopherCite**（arXiv:2203.11147）：最严格方案——`%<Claim>%(Document Title)%[Verbatim Quote]%` 格式，在引用模式下使用 **constrained decoding 强制逐字引用**，杜绝证据捏造

**ReAct 的标签化推理轨迹。** ReAct（arXiv:2210.03629, ICLR 2023）通过 `Thought N:` / `Act N:` / `Obs N:` 前缀标签组织推理步骤，但思维内容本身为 **自由文本**，无 schema 强制。结构仅通过少样本示例的格式示范维持。论文明确声明："No ad-hoc format choice, thought design, or example selection is used in this paper."

**DSPy 的类型化签名与断言机制。** DSPy（arXiv:2310.03714, ICLR 2024 Spotlight）引入声明式签名系统 `"question: str -> answer: str"`，支持 Pydantic BaseModel 作为输出类型。DSPy Assertions（arXiv:2312.13382）进一步引入 `dspy.Assert`（硬约束，失败触发回退重试）和 `dspy.Suggest`（软约束，仅记录），通过动态签名修改（添加 `past_output` 和 `instruction` 字段）引导自我修正。实验显示约束通过率提升达 **164%**。

**约束解码的质量退化风险。** Tam et al. (2024) 和 Grammar-Aligned Decoding（arXiv:2405.21047）研究证实，标准 grammar-constrained decoding（GCD）会**扭曲 LLM 的输出分布**，产出语法合规但语义退化的结果。JSONSchemaBench（arXiv:2501.10868）在 10K 真实 JSON schema 上的评测发现，token 化歧义会导致约束解码产生意外数值（如阻断 ',' 使 '89,000' 变为 '890000'）。**这一发现对 RT 系统至关重要——过度的 schema 强制可能损害智能体的叙事推理质量。**

**多智能体辩论与投票的聚合发现。** arXiv:2508.17536 的实证研究揭示了一个重要事实：**简单多数投票即可获得多智能体辩论的大部分收益**，辩论的真正价值来自多智能体集成（ensembling）而非智能体间通信本身。但 DCI 框架（arXiv:2603.11781）提出了更精细的方案——类型化认识论行为（typed epistemic acts），每个交互行为包含 `mode`（模式）、`act`（行为类型）、`intent`（意图）三层结构，明确区分提案（proposal）与质疑（challenge），保留异议（dissent），实现 100% 任务完成率。

**生产环境的结构化输出实证。** 多智能体事件响应研究（arXiv:2511.15755）在 348 次对照试验中发现：多智能体结构化系统实现 **100% 可操作建议率**（vs 单智能体的 1.7%），质量方差为零（std = 0.000）。关键发现：*"Sequential composition naturally produces structured outputs (root cause → actions → risk), whereas [single-agent] generates unstructured text requiring post-processing."*

### 推断建议（基于文献推理，非直接验证）

基于上述实证，为 RT 系统推断以下设计建议：（1）RT 应采用"渐进结构化"策略而非一步到位的全 schema 强制；（2）引证字段应优先于推理字段结构化；（3）moderator 聚合应基于类型化字段而非自由文本解析；（4）schema 设计应区分"机器验证字段"与"人类叙事字段"。

---

## Best Candidate Schemas（三个候选 schema 版本）

### 版本一：Minimal Schema（最小可行方案）

此方案的设计哲学是：**只结构化机器必须读取的字段，其余保留为自由文本。** 这直接参考了 ReAct 的标签化前缀方案与 RARR 的平铺证据列表。

```json
{
  "agentId": "evidence-analyst-01",
  "role": "analyst",
  "position": "support | oppose | neutral | uncertain",
  "confidence": 0.72,
  "body": "（自由文本叙事，无 schema 约束，供人类阅读）",
  "evidence": [
    {
      "claimRef": "claim-uuid-001",
      "sourceId": "src-003",
      "snippet": "逐字引用或紧密释义",
      "relevance": "high | medium | low"
    }
  ],
  "gapReason": "insufficient-data | conflicting-sources | out-of-scope | null",
  "timestamp": "2026-03-17T10:30:00Z"
}
```

**机器验证字段（logic fields）：** `position`（枚举验证）、`confidence`（范围 0.0–1.0）、`evidence[].claimRef`（UUID 外键验证）、`evidence[].relevance`（枚举验证）、`gapReason`（枚举或 null）、`timestamp`（ISO 8601）。

**UI 叙事字段（非验证）：** `body`（自由文本）、`evidence[].snippet`（文本内容，不做语义验证）。

**优势：** 字段数仅 8 个，LLM 生成合规率高，叙事质量不受约束解码影响。Moderator 可直接对 `position` 和 `confidence` 进行结构化聚合（加权投票），而无需解析自由文本。

**劣势：** `body` 中的推理链不可追踪，无法支持细粒度的 follow-up 定位与 replay。

### 版本二：Balanced Schema（平衡方案）

此方案引入推理步骤的半结构化追踪，参考 ReAct 的 Thought-Action-Observation 模式与 DCI 的 typed epistemic acts，但不对推理内容本身做 schema 强制。

```json
{
  "agentId": "domain-expert-02",
  "role": "expert",
  "turnId": "turn-005",
  "replyTo": "turn-003",

  "position": "oppose",
  "confidence": 0.65,
  "confidenceDelta": -0.12,

  "reasoning": [
    {
      "stepType": "observation | inference | assumption | challenge | concession",
      "content": "（自由文本推理步骤）",
      "dependsOn": ["turn-002.reasoning[0]"]
    }
  ],

  "body": "（面向人类的完整叙事摘要）",

  "evidence": [
    {
      "claimRef": "claim-uuid-002",
      "sourceId": "src-007",
      "sourceType": "peer-reviewed | official-report | expert-testimony | user-provided",
      "snippet": "逐字引用文本",
      "snippetHash": "sha256:a1b2c3...",
      "relevance": "high",
      "contradicts": false
    }
  ],

  "gapReason": "conflicting-sources",
  "gapDetail": "来源 src-007 与 src-003 在关键数据点上存在 15% 差异",

  "followUpSuggestions": ["应进一步核实 2025 年 Q3 数据"],

  "metadata": {
    "modelId": "claude-3.5-sonnet",
    "promptVersion": "v2.1",
    "latencyMs": 1230,
    "tokenCount": 487,
    "timestamp": "2026-03-17T10:31:15Z"
  }
}
```

**机器验证字段（严格验证）：** `position`（枚举）、`confidence`（0.0–1.0 浮点）、`confidenceDelta`（浮点，与上一轮的变化量）、`reasoning[].stepType`（枚举，五选一）、`reasoning[].dependsOn`（引用路径验证）、`evidence[].sourceType`（枚举）、`evidence[].snippetHash`（SHA-256 格式验证）、`evidence[].contradicts`（布尔）、`gapReason`（枚举或 null）、`metadata` 全部字段。

**UI 叙事字段（非验证）：** `body`、`reasoning[].content`、`evidence[].snippet`（文本内容）、`gapDetail`、`followUpSuggestions`。

**设计亮点：**
- `confidenceDelta` 字段支持校准追踪（calibration tracking），moderator 可检测信心变化异常的智能体
- `reasoning[].stepType` 参考 DCI 的类型化认识论行为，区分观察、推断、假设、质疑、让步五种行为类型
- `reasoning[].dependsOn` 创建推理步骤间的有向图，支持 replay 时的因果追踪
- `evidence[].snippetHash` 参考 GopherCite 的逐字引用验证思路，通过哈希比对检测引用是否被篡改
- `evidence[].contradicts` 标记反面证据，支持 moderator 的冲突检测

### 版本三：Over-Engineered Schema（过度工程方案）

此方案展示全面结构化的极端情况——每个字段都有严格类型约束和嵌套验证。**此方案作为反面教材展示，不建议 RT 采用。**

```json
{
  "agentId": "strategic-advisor-03",
  "role": { "name": "advisor", "domain": "finance", "certLevel": 3 },
  "turnId": "turn-008",
  "replyTo": "turn-006",
  "sessionId": "session-abc-123",
  "threadId": "thread-xyz-789",

  "position": {
    "stance": "conditional-support",
    "conditions": ["若 Q4 营收超过预期 10%"],
    "alternativeStance": "oppose",
    "alternativeConditions": ["若监管政策收紧"]
  },

  "confidence": {
    "point": 0.68,
    "interval": [0.55, 0.81],
    "distribution": "beta",
    "alphaParam": 6.8,
    "betaParam": 3.2,
    "calibrationHistory": [
      { "turnId": "turn-003", "predicted": 0.75, "actual": true },
      { "turnId": "turn-005", "predicted": 0.60, "actual": false }
    ]
  },

  "reasoning": [
    {
      "stepId": "step-001",
      "stepType": "observation",
      "epistemicMode": "descriptive",
      "illocutionaryForce": "assert",
      "content": "Q3 财报显示营收同比增长 23%",
      "formalLogic": "revenue_growth(Q3) = 0.23",
      "dependsOn": ["turn-002.reasoning[0]", "turn-004.reasoning[2]"],
      "strengthOfSupport": 0.85,
      "defeasible": true,
      "counterarguments": [
        { "ref": "turn-006.reasoning[1]", "rebuttalStrength": 0.4 }
      ]
    }
  ],

  "body": "（完整叙事）",

  "evidence": [
    {
      "evidenceId": "ev-001",
      "claimRef": "claim-uuid-002",
      "sourceId": "src-007",
      "sourceType": "peer-reviewed",
      "sourceTrust": 0.92,
      "snippet": "逐字引用",
      "snippetHash": "sha256:a1b2c3...",
      "snippetLocation": { "page": 12, "paragraph": 3, "charOffset": 1450 },
      "relevance": "high",
      "relevanceScore": 0.88,
      "contradicts": false,
      "corroboratedBy": ["ev-003", "ev-005"],
      "temporalValidity": { "from": "2025-01-01", "to": "2025-12-31" },
      "biasAssessment": { "direction": "neutral", "confidence": 0.7 }
    }
  ],

  "gapReason": "conflicting-sources",
  "gapDetail": "...",
  "gapSeverity": "medium",
  "gapResolutionPlan": { "action": "request-expert", "deadline": "2026-03-20" },

  "aggregationHints": {
    "weight": 0.85,
    "expertise": ["corporate-finance", "M&A"],
    "conflictsOfInterest": [],
    "shouldDeferTo": ["evidence-analyst-01"]
  },

  "followUpSuggestions": [...],
  "metadata": { "...": "（含完整 token 使用统计、延迟分布、重试次数等）" }
}
```

**此方案的问题在下文"Anti-Patterns"部分详细分析。**

---

## Implications for Round Table（对 RT 系统的含义）

### 结构化输出如何改善 RT 的五个核心能力

**Moderator 聚合。** 这是结构化输出的最大收益点。当所有智能体回复包含类型化的 `position`（枚举）和 `confidence`（浮点）字段时，moderator 可以执行确定性聚合——加权投票、共识检测、分歧识别——而无需对自由文本进行不可靠的语义解析。arXiv:2511.15755 的 348 次对照试验直接证明了这一点：结构化多智能体系统的质量方差为零。DCI 框架（arXiv:2603.11781）进一步表明，当交互行为被类型化（区分 proposal 与 challenge）时，可以追踪每个立场变化的因果链条，而非仅统计最终投票。**对 RT 的推断建议：moderator 应仅依赖 logic fields 进行聚合决策，body 字段仅用于生成面向用户的叙事摘要。**

**Session Resume（会话恢复）。** 结构化回复使会话状态可以被完整序列化和反序列化。LangGraph 的做法提供了直接参考——它在每个节点返回时对 Pydantic 状态对象进行验证和检查点保存（checkpointing），支持任意步骤的回退与重放。RT 的 Balanced Schema 中 `turnId` / `replyTo` 字段创建了回复链的有向图，`reasoning[].dependsOn` 创建了推理步骤间的因果图，两者结合即可完整重建任意时刻的决策上下文。

**Replay（重放）。** 结构化的 `reasoning` 数组使每个推理步骤可被独立审查。当 `stepType` 为枚举值时，replay 界面可以按类型过滤（如只显示所有 "challenge" 类型的步骤），快速定位关键分歧点。MetaGPT 的双重存储策略（`.json` 用于机器读取、`.md` 用于人类审查）为 RT 提供了直接参考。

**Follow-up（追问）。** `gapReason` 枚举字段是 follow-up 的结构化触发器。当智能体报告 `"gapReason": "insufficient-data"` 时，moderator 可以自动生成针对性追问，而非依赖自由文本中的模糊表述。`evidence[].contradicts` 布尔字段标记反面证据的存在，为 moderator 提供冲突解决的结构化入口。

**Testing（测试）。** 结构化 schema 使回复可以被断言测试。DSPy Assertions（arXiv:2312.13382）提供了直接模式：`dspy.Assert(confidence >= 0.0 and confidence <= 1.0)` 和 `dspy.Assert(position in valid_positions)` 可以在开发和运行时验证智能体输出。这将 RT 的质量保证从"人工审查自由文本"升级为"自动化回归测试结构化输出"。

### 引证字段设计与 citation labels / gapReason 的共存

引证字段设计需要解决三个张力：（1）引用标记（citation labels）需要在 `body` 自由文本中内联，但标记目标需要指向结构化的 `evidence[]` 数组；（2）`gapReason` 需要覆盖"证据不足"和"证据冲突"两种不同的缺口类型；（3）反面证据需要与支持性证据在同一数组中共存但被明确区分。

**推荐的共存设计**（推断建议）：`body` 中使用 WebGPT/ALCE 风格的 `[n]` 编号标记内联引用，`n` 对应 `evidence[]` 数组的索引。`evidence[]` 中每个条目包含 `contradicts: boolean` 标记正反面证据。当 `evidence` 数组为空或不足以支撑 `position` 时，`gapReason` 必须非空——这是一个**跨字段验证规则**，应由 moderator 在接收回复时程序化检查。`gapDetail` 作为自由文本补充解释缺口原因，不做 schema 验证。

---

## Recommended Minimum Design for RT（RT 最小起步设计）

**如果 RT 只做一件事，应首先设计并强制 `evidence` 数组字段。**

理由如下。RT 系统的核心目标是"更高可验证性、更低幻觉面"。在所有可结构化的字段中，`evidence` 是唯一同时满足三个条件的字段：（1）**机器可验证**——`sourceId` 可以对照已知来源库验证存在性，`snippetHash` 可以验证引用文本未被篡改，`claimRef` 可以验证引用指向了实际存在的主张；（2）**直接抑制幻觉**——GopherCite 的研究表明，当引用被约束为逐字引用时，支持率（Supported & Plausible）从基线显著提升，结合选择性弃权可达 90%；（3）**moderator 可操作**——当多个智能体引用相同 `sourceId` 时，moderator 可以检测证据趋同性；当 `contradicts` 标记出现时，moderator 可以主动识别并呈现证据冲突。

`position` 和 `confidence` 字段虽然对聚合至关重要，但它们可以在第二阶段引入——在没有这两个字段的情况下，moderator 仍可从 `body` 文本中推断立场（虽然不够可靠）。而在没有 `evidence` 字段的情况下，系统的可验证性主张完全不成立。

**最小起步 schema：**

```json
{
  "agentId": "string (required)",
  "body": "string (free text, required)",
  "evidence": [
    {
      "sourceId": "string (required, validated against source registry)",
      "snippet": "string (required)",
      "relevance": "high | medium | low (required)"
    }
  ],
  "gapReason": "insufficient-data | conflicting-sources | out-of-scope | null"
}
```

仅四个顶层字段，`evidence` 数组条目仅三个字段。此 schema 足够简单，LLM 生成合规率极高（参考 OpenAI 结构化输出在简单 schema 上的 100% 合规率），同时提供了引证追踪的核心基础设施。

---

## Anti-Patterns（RT 系统应明确避免的设计）

### 反模式一：全面约束解码强制 schema 合规

**不适合 RT 的原因：** Tam et al. (2024) 与 Park et al. (2024, arXiv:2405.21047) 的研究明确证明，grammar-constrained decoding 会扭曲 LLM 的条件概率分布。RT 系统的 `body` 字段和 `reasoning[].content` 字段承载了面向人类的叙事推理，这些字段的质量高度依赖 LLM 的自然语言生成能力。对这些字段施加 token 级约束解码会直接损害叙事流畅度和推理深度。**正确做法是：对 logic fields 使用解析+重试（parse-and-retry）策略，对叙事字段保持自由生成。**

### 反模式二：条件化立场的嵌套对象设计

Over-Engineered Schema 中的 `position` 字段被设计为嵌套对象（含 `conditions`、`alternativeStance`、`alternativeConditions`），这看似精确但在实践中有两个致命问题。**第一，LLM 难以可靠地生成条件化多立场结构**——这需要模型同时维护多个假设世界状态，远超当前模型的结构化输出能力边界。**第二，moderator 无法对条件化立场进行确定性聚合**——当一个智能体"在条件 A 下支持、条件 B 下反对"而另一个智能体"在条件 C 下支持"时，聚合逻辑变为组合爆炸。RT 应采用简单枚举 `position`（含 `uncertain` 选项），将条件化论证放入 `body` 自由文本。

### 反模式三：置信度概率分布建模

Over-Engineered Schema 中的 `confidence` 字段包含 Beta 分布参数（`alphaParam`、`betaParam`）和校准历史（`calibrationHistory`）。**这对 RT 系统是错误的抽象层次。** 当前 LLM 并不具备生成校准良好的概率分布参数的能力——研究表明 LLM 的置信度表达与实际准确率之间的校准性仍然很差。将一个 0.0–1.0 的标量置信度升级为完整概率分布，引入的是虚假精确性（false precision）而非真正的不确定性量化。**RT 应使用单一浮点 `confidence` 值，辅以 `confidenceDelta` 追踪变化趋势，在 moderator 层面进行简单的置信度加权聚合。**

### 反模式四：推理步骤的形式逻辑编码

将 `reasoning[].formalLogic` 字段设计为形式逻辑表达式（如 `revenue_growth(Q3) = 0.23`）假设 LLM 能可靠地将自然语言推理翻译为形式表示。**DSPy 和 ReAct 的经验均表明，推理内容应保持为自由文本——结构化应发生在推理步骤的元数据层面（如 `stepType` 枚举），而非内容层面。** MetaGPT 的成功同样佐证此点：它结构化的是文档类型和字段名（PRD 的 `Product Goals`、`User Stories`），而非文档内容本身的逻辑结构。

### 反模式五：自包含聚合提示

Over-Engineered Schema 中的 `aggregationHints`（含 `weight`、`expertise`、`shouldDeferTo`）让智能体自行声明自己的聚合权重和专长领域。**这违反了 RT 的信任架构原则——聚合权重应由 moderator 根据历史表现和角色定义决定，而非由智能体自我声明。** 允许智能体声明 `"shouldDeferTo"` 相当于将聚合控制权下放给被聚合的对象，这在博弈论上创造了操纵激励。

---

## Open Questions（未解决问题）

**引用验证的工程可行性。** GopherCite 的 constrained decoding 逐字引用方案在 RT 系统中的工程实现复杂度尚不清楚。RT 的证据来源可能包括用户上传的文档、外部数据库、以及其他智能体的先前回复——这些来源的逐字引用约束是否能在可接受的延迟内实现？`snippetHash` 验证是否足以替代 GopherCite 的生成时约束？

**`stepType` 枚举的完备性。** Balanced Schema 中的五种推理步骤类型（observation、inference、assumption、challenge、concession）是否覆盖了 RT 决策场景的全部认识论行为？DCI 框架的类型系统更为丰富，但复杂性也更高。如何确定 RT 所需的最小认识论行为集合？

**跨轮次 schema 演化。** RT 系统将随时间演进其 schema 版本。当 session 跨越 schema 升级时（如从 Minimal Schema 升级到 Balanced Schema），历史回复的向后兼容如何保证？是否需要引入 `schemaVersion` 字段和迁移策略？

**约束解码 vs. parse-and-retry 的成本效益比。** 对于 logic fields，OpenAI/Anthropic 的 constrained decoding（100% 合规率，但可能的质量退化）与 DSPy 风格的 parse-and-retry（非 100% 首次合规，但保留分布自然性）哪种更适合 RT？这取决于 RT 的延迟容忍度和重试成本。

**多智能体引证冲突的自动解决。** 当两个智能体引用同一来源但得出相反结论时，moderator 应如何程序化地处理？ALCE 的 NLI-based 引证质量评估提供了部分方案，但将其集成到实时决策系统中的工程路径尚未被充分探索。

---

## Source List（来源列表）

**研究论文（同行评审/arXiv）：**
- MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework. Hong et al., arXiv:2308.00352
- ChatDev: Communicative Agents for Software Development. Qian et al., arXiv:2307.07924, ACL 2024
- ReAct: Synergizing Reasoning and Acting in Language Models. Yao et al., arXiv:2210.03629, ICLR 2023
- Toolformer: Language Models Can Teach Themselves to Use Tools. Schick et al., arXiv:2302.04761, NeurIPS 2023
- RARR: Researching and Revising What Language Models Say. Gao et al., arXiv:2210.08726, ACL 2023
- WebGPT: Browser-Assisted Question-Answering with Human Feedback. Nakano et al., arXiv:2112.09332
- ALCE: Enabling Large Language Models to Generate Text with Citations. Gao et al., arXiv:2305.14627, EMNLP 2023
- GopherCite: Teaching Language Models to Support Answers with Verified Quotes. Menick et al., arXiv:2203.11147
- DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines. Khattab et al., arXiv:2310.03714, ICLR 2024
- DSPy Assertions: Computational Constraints for Self-Refining Language Model Pipelines. Singhvi et al., arXiv:2312.13382
- Efficient Guided Generation for Large Language Models (Outlines). Willard & Louf, arXiv:2307.09702
- Prompting Is Programming: A Query Language for Large Language Models (LMQL). Beurer-Kellner et al., arXiv:2212.06094, PLDI 2023
- Grammar-Aligned Decoding. Park et al., arXiv:2405.21047
- JSONSchemaBench: Generating Structured Outputs from Language Models. arXiv:2501.10868
- From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts (DCI). arXiv:2603.11781
- Multi-Agent LLM Orchestration Achieves Deterministic, High-Quality Decision Support. arXiv:2511.15755
- Debate or Vote: Which Yields Better Decisions in Multi-Agent LLMs? arXiv:2508.17536
- Improving Factuality and Reasoning through Multiagent Debate. Du et al., arXiv:2305.14325, ICML 2024
- SLOT: Structured LLM Output Transformer. arXiv:2505.04016
- CRANE: Reasoning-Augmented Constrained Decoding. arXiv:2502.09061

**官方工程文档：**
- Anthropic: Building Effective Agents. anthropic.com/research/building-effective-agents
- Anthropic: Writing Effective Tools for Agents. anthropic.com/engineering/writing-tools-for-agents
- Anthropic: Structured Outputs. platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic: Tool Use Documentation. docs.anthropic.com/en/docs/build-with-claude/tool-use
- OpenAI: Function Calling Guide. platform.openai.com/docs/guides/function-calling
- OpenAI: Structured Outputs Guide. platform.openai.com/docs/guides/structured-outputs
- OpenAI: Introducing Structured Outputs in the API. openai.com/index/introducing-structured-outputs-in-the-api
- MetaGPT: GitHub Repository. github.com/FoundationAgents/MetaGPT
- ChatDev: GitHub Repository. github.com/OpenBMB/ChatDev
- Microsoft AutoGen: Official Documentation. microsoft.github.io/autogen
- DSPy: Official Documentation. dspy.ai
- Pydantic AI: Official Documentation. ai.pydantic.dev