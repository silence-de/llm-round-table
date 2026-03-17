# Trust-first 多智能体决策系统中：把 agent reply 从自由文本升级为结构化 artifact 的可验证最小改造

## Executive Summary

【已验证事实】以软件工程多智能体为例，**MetaGPT**把多角色协作组织成 SOP 流水线：从“结构化 PRD（含 User Stories、Requirement Pool）→ 架构设计产物（File Lists、Data Structures、Interface Definitions）→ 任务分发→ 测试用例→ 最终交付”，并明确提出“为每个角色建立 schema/format”，用“文档与图（structured outputs）”而非纯对话来传递必要信息、避免无关/缺失信息，且通过共享消息池 + 订阅机制来管理信息分发与过载。citeturn11view0turn11view1 **ChatDev**则用 chain-structured workflow 把任务拆成顺序 phase/subtask，并强调跨 phase 只传递“solutions”（而非全对话历史）以维持连续性、降低信息淹没，还强调中间结果可被审查以定位问题。citeturn5view0turn5view2turn5view1

【已验证事实】在生产级 API 上，结构化输出正在从“提示词约束”走向“平台级约束”：  
- entity["company","OpenAI","ai lab"] Structured Outputs 明确宣称：模型输出会遵循开发者提供的 JSON Schema，从而避免遗漏必需字段或生成无效枚举；并给出“显式拒绝可程序化检测”等工程收益。citeturn6view0  
- entity["organization","Anthropic","ai company"] 的 Claude Structured Outputs 通过把 schema 编译为 grammar 来约束输出，同时给出明确的复杂度上限（可选参数、union types 等）与工程代价（首请求编译延迟、token 增量、cache 失效规则）。citeturn6view1  
- entity["company","Amazon","tech company"] Bedrock Structured outputs 同样强调“确保 schema compliance、减少 retry/解析成本”，但也明确写出：对 Anthropic 模型，structured outputs 与 citations 同时启用会 400。citeturn9view0  
- entity["company","Google","tech company"] Gemini Structured outputs/controlled generation 也强调“保证 JSON 结构但不保证语义正确”，并提醒复杂 schema 会导致 400，需要简化（减少可选字段、降低嵌套、缩短属性名等）。citeturn9view1turn9view2  

【对 RT 的推断建议】对“Round Table（RT）式、moderator 主导、证据优先、高风险决策”的系统，把 agent reply 升级为结构化 artifact 的关键不是“把全文变成 JSON”，而是**把“可聚合/可验证/可回放”的最小信息面做成严格 contract**：  
- 需要机器验证的核心应是：**结论/建议、可检验的 claim 列表、每条 claim 的证据指针（或缺证原因 gapReason）、以及 follow-up 请求**。  
- 叙事性解释（用于 UI 可读性）可以保留自由文本，但必须与逻辑字段隔离，避免污染聚合与测试。  
- **如果 RT 只能先做一件事：先做 `claims[]` 的字段设计**（每条 claim 必须带 `citations[]` 或 `gapReason`，并能被 moderator 做硬校验与统计）。理由：它直接降低 hallucination surface（无证据的断言会被结构化暴露），并成为 aggregation / follow-up / testing 的共同基座。citeturn11view0turn6view0turn9view1  

## Verified Findings

【已验证事实】MetaGPT 的核心动机之一是：多轮“天真串联”会导致 **cascading hallucinations** 与逻辑不一致；因此它把 SOP 编码进提示序列，并强调以结构化中间产物减少错误传播。citeturn4view0turn11view0  

【已验证事实】MetaGPT 明确批评“多数多智能体框架用 unconstrained natural language 作为通信接口”，并用“telephone game 信息失真”说明纯自然语言在多轮协作中会扭曲原始信息；其应对是为角色建立 schema/format、用文档与图作为 deliverables，且声称这些文档“包含全部必要信息，避免无关或缺失内容”。citeturn11view0  

【已验证事实】ChatDev 把软件开发拆成顺序 phases/subtasks，并用 chat chain 指导“要沟通什么”，以多轮对话达成共识并抽取 solutions；其文本明确指出“chain-style 结构提供透明视图，允许检查中间 solutions 并帮助定位问题”。citeturn5view2turn5view0  

【已验证事实】ChatDev 还直接把“只共享每个 subtask 的 solutions 而非完整通信历史”作为一种机制：减少被过多信息淹没、鼓励更聚焦合作，并促进跨 phase 的上下文连续性。citeturn5view1  

【已验证事实】从生产 API 看，“结构化输出”被作为降低工程不确定性与解析成本的关键能力：  
- OpenAI Structured Outputs：保证遵循 JSON Schema，减少校验/重试，并可程序化检测拒绝。citeturn6view0turn7view0  
- Claude Structured Outputs：通过 schema→grammar 编译来约束输出；但存在明确复杂度限制与工程代价（编译延迟、token 成本、cache 规则）。citeturn6view1  
- Gemini Structured outputs：强调“保证 JSON 结构≠保证语义正确”，要求应用侧仍做校验；复杂 schema 可能触发 400，且给出简化方向（减少可选字段等）。citeturn9view1turn9view2  
- Bedrock Structured outputs：同样强调减少 prompt-based approach 的 error/retry，并把“schema 先验校验→编译→缓存”写成流程；同时写明“与 citations 不兼容（Anthropic）”。citeturn9view0  

【已验证事实】“结构化输出”与“平台内建 citations”在一些栈上存在硬冲突：Claude 文档明确写出 citations 与 JSON schema constraints 冲突、同时启用会报错；Bedrock 文档也写出了对应限制。citeturn6view1turn9view0  

【已验证事实】在评估与迭代方面，Anthropic 把“prompt chaining”描述为串联步骤并在中间插入 programmatic checks（gate）的 workflow；并把 eval 定义为“给定输入→对输出应用 grading logic”，同时指出 agent eval 更复杂，因为多轮、工具、状态变化会让错误传播与累积。citeturn10view2turn6view4  

## Best Candidate Schemas

下面给出 3 个候选 schema（最小版 / 平衡版 / 过度设计版）。它们都遵循一个共同原则：**逻辑字段可 machine-validated，叙事字段只服务 UI**。其中证据字段的设计刻意不依赖“模型厂商内建 citations”，因为已验证存在“structured outputs ↔ citations”不兼容的现实约束。citeturn6view1turn9view0  

【问题一】RT 这类系统，agent reply 的最小结构化 schema 应该长什么样？  
【问题二】哪些字段应严格验证，哪些字段只用于 UI narrative？

### 最小版：Claim-Evidence Contract（重点压缩 hallucination surface）

```json
{
  "schema_version": "rt.reply.v1.min",
  "reply_id": "uuid",
  "agent": { "id": "string", "role": "string" },
  "task": { "id": "string", "prompt_summary": "string" },

  "answer": {
    "recommended_action": "string",
    "confidence": { "level": "low|medium|high", "rationale": "string" }
  },

  "claims": [
    {
      "claim_id": "C1",
      "statement": "string",
      "citations": ["S1", "S2"],
      "gapReason": null
    }
  ],

  "sources": [
    { "label": "S1", "source_id": "string", "locator": "string", "quote": "string" }
  ],

  "followups": [
    { "question": "string", "why_it_matters": "string" }
  ],

  "ui_narrative": { "explanation": "string" }
}
```

【逻辑字段（建议严格验证）】  
- `schema_version`：固定枚举；用于回放与兼容。  
- `reply_id`、`agent.id`、`task.id`：格式与非空校验；用于重放/去重/追责。  
- `answer.recommended_action`：非空、长度上限（防止把整篇解释塞这里）。  
- `answer.confidence.level`：枚举；`rationale` 可限制长度（避免长篇）。  
- `claims[]`：至少 1 条；每条 `claim_id` 唯一；`statement` 非空、长度上限。  
- **证据一致性硬约束**：  
  - `claims[].citations[]` 必须全部出现在 `sources[].label` 中；  
  - `sources[].label` 必须唯一；  
  - `sources[]` 可要求 `additionalProperties=false`（防止模型塞杂项）；  
  - **互斥规则**：`citations` 为空时，`gapReason` 必须为非空枚举；`citations` 非空时，`gapReason` 必须为 null。  
- `followups[]`：可选但建议上限（例如 ≤5），否则会把不确定性外包成一堆问题。  

【UI narrative 字段（不应参与聚合/测试）】  
- `ui_narrative.explanation`：允许自由文本；不做强语义校验，只做长度与敏感内容策略。  

【来源侧依据】这个最小版之所以以 claim→evidence 为核心，是因为：  
- MetaGPT 明确认为纯自然语言通信会失真，并提出以“schema/format + 文档/图”保证必要信息、避免缺失/无关。citeturn11view0turn11view1  
- ChatDev 强调“只传 solutions”来降低信息淹没并保持跨阶段连续性；对 RT 来说，“claims + sources”就是可跨轮传递的最小 solutions。citeturn5view1turn5view2  

### 平衡版：Decision Record + Evidence Map（面向 moderator 聚合与回放）

```json
{
  "schema_version": "rt.reply.v1.balanced",
  "reply_id": "uuid",
  "agent": { "id": "string", "role": "string" },
  "task": {
    "id": "string",
    "decision_context": "string",
    "risk_tier": "low|medium|high",
    "time_horizon": "immediate|weeks|months|years"
  },

  "logic": {
    "decision": {
      "recommended_action": "string",
      "alternatives_considered": [
        { "alt_id": "A1", "name": "string", "summary": "string" }
      ],
      "decision_criteria": [
        { "criterion_id": "K1", "name": "string", "weight": 0.0, "notes": "string" }
      ],
      "tradeoffs": [
        { "summary": "string", "impacted_criteria": ["K1"], "citations": ["S1"], "gapReason": null }
      ]
    },

    "claims": [
      {
        "claim_id": "C1",
        "statement": "string",
        "claim_type": "fact|assumption|projection|value_judgment",
        "citations": ["S1"],
        "gapReason": null,
        "depends_on": ["C0"]
      }
    ],

    "uncertainties": [
      { "item": "string", "impact": "low|medium|high", "how_to_reduce": "string" }
    ],

    "calibration": {
      "confidence_score": 0.72,
      "why_not_higher": "string",
      "what_would_change_my_mind": "string"
    }
  },

  "evidence": {
    "sources": [
      {
        "label": "S1",
        "source_id": "string",
        "type": "paper|tech_report|official_doc|user_provided",
        "locator": "string",
        "quote": "string"
      }
    ]
  },

  "ui_narrative": {
    "summary": "string",
    "explanation": "string",
    "tone": "neutral|cautious|urgent"
  },

  "followups": [
    { "question": "string", "blocking": true, "why_it_matters": "string" }
  ]
}
```

【逻辑字段（建议严格验证）】  
- 在最小版基础上，新增 `task.risk_tier/time_horizon` 这类**聚合维度**（enum），便于 moderator 对不同风险档采取不同聚合/校验策略。  
- `logic.decision.*`：引入 alternatives、criteria、tradeoffs，让聚合不仅是“投票”，而是“在共同坐标系里合并证据与权衡”。（这是对 MetaGPT “SOP 流水线把结构化产物逐步传递”的抽象化迁移。）citeturn11view0turn11view1  
- `claims[].claim_type`：把“事实/假设/预测/价值判断”硬拆开。原因很现实：结构化输出保证的是**结构**而不是**语义正确**；当你把“预测”伪装成“事实”，moderator 很难在聚合时发现。Google 明确提示“结构化输出不保证语义正确，需要应用侧验证”。citeturn9view1turn9view2  
- `calibration.confidence_score`：范围校验（0~1）；长度上限；用于后续评测与对齐。  

【UI narrative 字段（不应参与聚合/测试）】  
- `ui_narrative.*`：只做展示。建议 moderator 聚合时忽略它，只在最终对用户解释时调用。  

### 过度设计版：Argument Graph + Audit Trail（示范“不要这么做”）

```json
{
  "schema_version": "rt.reply.v1.overdesigned",
  "reply_id": "uuid",
  "agent": { "id": "string", "role": "string", "model": "string", "prompt_hash": "string" },

  "task": {
    "id": "string",
    "decision_ontology": { "domain": "string", "subdomain": "string", "jurisdiction": "string" },
    "constraints": { "budget": 0, "deadline": "date-time", "must_not": ["string"] }
  },

  "logic": {
    "claims": [
      {
        "claim_id": "C1",
        "statement": "string",
        "modal": "certain|likely|possible|speculative",
        "quant": { "p": 0.0, "ci95": [0.0, 0.0] },
        "support": {
          "citations": ["S1"],
          "evidence_strength": "weak|medium|strong",
          "counter_evidence": ["S9"]
        },
        "inference_rule": "deduction|abduction|induction",
        "depends_on": ["C0"]
      }
    ],
    "argument_graph": {
      "nodes": [{ "id": "N1", "type": "claim|criterion|risk" }],
      "edges": [{ "from": "N1", "to": "N2", "relation": "supports|attacks|depends" }]
    },
    "decision": {
      "options": [
        {
          "alt_id": "A1",
          "scores": [{ "criterion_id": "K1", "value": 0.0, "justification_claims": ["C1"] }]
        }
      ]
    }
  },

  "evidence": {
    "sources": [{ "label": "S1", "source_id": "string", "locator": "string", "quote": "string" }],
    "normalization": { "dedupe_keys": ["string"], "canonical_source_ids": ["string"] }
  },

  "audit": {
    "intermediate_states": [{ "step": 1, "artifact_hash": "string" }],
    "replay": { "inputs": ["string"], "random_seed": 0 }
  },

  "ui_narrative": { "summary": "string", "full_report": "string" }
}
```

【为什么它是“过度设计”】它把很多“听起来很严谨”的概念（argument graph、推理规则、概率区间、audit trail）一次性塞进 contract，但真实世界的模型与工程限制很快会把它击穿：  
- Claude/Bedrock/Gemini 等都明确存在 **schema complexity** 的硬限制或 400 风险，尤其是 optional 字段、union types、深嵌套会引起编译/验证成本飙升。citeturn6view1turn9view0turn9view2  
- Anthropic 还明确指出：某些格式对模型更难写（例如把复杂内容塞进 JSON 会带来额外 escaping/格式开销），这会让输出更脆、更慢、更容易出错。citeturn10view3  

## Implications for Round Table

【问题三】structured reply 如何改善 moderator aggregation、resume、replay、follow-up、testing？

【对 RT 的推断建议】把 agent reply 结构化后，RT 的能力提升不是抽象的“更好”，而是可以落在下面这些“字段级杠杆”上：

**Aggregation（聚合）**  
- 只要 `claims[]` 与 `sources[]` 存在，moderator 就能做**硬统计**：每个 agent 提了多少“无证据 claim”（`gapReason != null`）、哪些 claim 被多 agent 支持、哪些关键信息只有单点来源。MetaGPT 的论述里，“schema/format + 文档化 deliverables”就是为了防止遗漏/无关信息并提高协作效率；RT 的聚合可以把这种思想用在“断言-证据”的聚合上。citeturn11view0turn11view1  
- 将 `claim_type`（fact/assumption/projection/value_judgment）结构化后，moderator 可以把“价值判断分歧”与“事实分歧”分开处理，减少在高风险决策里把争论搅成一团。Google 对 structured output 的提醒（结构≠语义）意味着：类型标注本质上是在逼模型把话说清楚，便于后续检验。citeturn9view1turn9view2  

**Resume（断点续作）**  
- ChatDev 明确采用“只传 solutions 而非全对话历史”来保持跨 phase 连续性并减轻信息负担；RT 的最小结构化 artifact（answer + claims + followups）就是可持久化的“solutions”，可以在下一轮作为系统状态输入，而不是把一堆聊天记录塞回去。citeturn5view1turn5view2  

**Replay（回放与可重复）**  
- `schema_version + reply_id + task.id + sources[]` 让你能把同一问题在同样证据集下重复跑、对比差异（尤其适合 regression 测试）。  
- ChatDev 的工程实现层面直接把 “replay mode” 当成系统能力，并支持对 workflow/yaml 做 schema 校验；这说明“可回放 + 配置/产物可校验”在多智能体系统里不是理论，而是落地需求。citeturn12view2turn12view0  

**Follow-up（追问与校准）**  
- 把 follow-up 结构化为 `followups[].blocking` 可以让 moderator 判断“继续决策前必须补的信息”与“可选补充”。这对应 Anthropic 在 workflow 里强调的：prompt chaining 可以在中间步骤加 programmatic gates 来确保过程仍在轨道上；blocking follow-up 本质上就是一种 gate 条件。citeturn10view2  

**Testing（测试与评估）**  
- Anthropic 把 eval 描述为“对输出应用 grading logic”，而 agent eval 的难点在于多轮与错误传播；结构化逻辑字段的直接收益是：你能对 `claims[].gapReason`、`citations` 覆盖率、`confidence_score` 校准误差等做自动化评分，而不是靠人工读长文。citeturn6view4turn6view2  
- OpenAI Structured Outputs 的工程主张之一就是减少校验/重试与提示词强约束成本；这让“测试失败是语义错误而非解析错误”成为可能，从而把评测的注意力集中在更重要的问题上。citeturn6view0turn7view0  

## Recommended Minimum Design for RT

【对 RT 的推断建议】如果 RT 真要把 hallucination surface 压下去、同时把 moderator 聚合做稳定，建议按“先硬后软”的顺序推进（不是把 schema 一次性做大，而是先把最关键的可验证面打穿）。

**如果 RT 只做一件事：先做 `claims[]` 字段设计（含 citations/gapReason 的互斥校验）**  
- 原因一：MetaGPT 的核心经验是“为角色建立 schema/format，并用结构化交付物避免无关/缺失信息”；对 RT 来说，最容易失真且最危险的就是“没有证据的断言”，`claims[]` 把它暴露出来。citeturn11view0turn11view1  
- 原因二：ChatDev 的“只传 solutions”思想提示：系统状态应该是可压缩、可传递、可审查的；claims 列表正是决策型系统里最小的“可审查解”。citeturn5view1turn5view2  
- 原因三：生产 API 的结构化输出能力保证的是键/类型/枚举等结构正确，而不是内容真伪；因此最务实的策略是：先把“哪些句子必须有证据”做成结构与校验，再逐步提升内容质量。citeturn6view0turn9view1turn9view2  

**逻辑字段 vs 叙事字段的最小分层（建议直接写进 RT contract）**  
- 逻辑层（machine-validated）：`answer.recommended_action`、`claims[]`、`sources[]`、`followups[]`、`confidence`（至少 level）。  
- 叙事层（UI-only）：`ui_narrative.summary/explanation`。  
- 强制规则：moderator 聚合只读逻辑层；UI 层只能解释逻辑层，不能引入新 claim（否则你会得到“结构化外壳 + 自由文本暗门”，hallucination surface 反而扩大）。  

**证据字段如何设计以兼容 citation labels 与 gapReason（问题五）**  
- 关键现实约束：Claude/Bedrock 文档都明确写出“structured outputs 与 citations 不兼容”，这意味着你不能把“证据/引用”寄托在厂商的 citations feature 上（至少不能与 strict JSON 同时启用）。citeturn6view1turn9view0  
- 因此建议：RT 自己维护 `sources[]`（带 `label`）和 claim 的 `citations[]`（引用 label），并让 gapReason 成为 claim 的**必填补位字段**。这使得：  
  - UI 依然能用 `label` 做可读的 [S1]/[S2]；  
  - 系统能用 `source_id/locator` 做去重与验证；  
  - claim 级 gapReason 能精准表达“缺口在哪里”，而不是整篇回答一个笼统的 “no citations”。  
- 额外建议（仍属推断）：`source_id` 最好是 RT 侧生成的 canonical id（例如对 URL+片段定位做 hash），避免 agent 自己造 id 造成不可重复与不可聚合。  

**避免 schema 复杂度陷阱（问题四的一部分）**  
- Claude/Bedrock/Gemini 都明确提示复杂 schema 会带来编译延迟、token 成本、cache 失效、甚至 400；且 Claude 对 optional 参数、union types 给出硬限制与简化建议（减少 optional、减少 union、扁平化）。citeturn6view1turn9view0turn9view2  
- 这直接推导出 RT 的工程策略：  
  - 字段名短、层级浅、optional 少；  
  - **能 required 就 required**（很多时候“默认值”对模型并不稳定，反而应该让模型显式写出默认值）；  
  - 复杂对象尽量拆成多个小对象/数组，而不是深层嵌套。  

## Anti-Patterns

【问题四】schema 过复杂和过简单分别会导致什么失败模式？  
【问题六】哪些系统要求 JSON/typed artifact，哪些仍保留自由文本，原因是什么？（反面也能解释原因）

【已验证事实】复杂 schema 在多个平台上会造成硬失败或软失败：Claude 有明确复杂度上限与 “Schema is too complex” 的错误路径；Gemini/Vertex 也明确复杂 schema 会导致 400，并建议减少 optional/嵌套/约束等。citeturn6view1turn9view2turn9view1  
【对 RT 的推断建议】下面这些设计在 RT 上高概率是坑（不适合 RT 的原因写在每条里）：

**把“整篇回答”强行塞进严格 JSON（尤其是长文本、多层嵌套）**  
- 不适合原因：复杂度与 token 成本会上升，触发平台限制；同时模型写长 JSON 更容易出格式/转义错误。Anthropic 明确指出某些格式（如把代码塞进 JSON）会增加 writing overhead；换到决策场景，长篇解释同样会把模型写进“格式角落”。citeturn10view3turn6view1  

**结构化字段太少：只有 `final_answer` + `confidence`，没有 claim/evidence 映射**  
- 不适合原因：这相当于把“高风险系统里最危险的部分——无证据断言”完全留在自由文本里，moderator 无从做硬验证；也无法像 ChatDev 那样“只传 solutions”，因为你连 solutions 的边界都没定义。citeturn5view1turn5view2  

**把厂商 citations feature 当成证据系统的基础，同时又要 strict JSON 输出**  
- 不适合原因：Claude 与 Bedrock 都明确写出 structured outputs 与 citations 不兼容；工程上这会变成“要么有结构没引用，要么有引用没结构”的二选一，导致系统架构反复推翻。citeturn6view1turn9view0  

**把 schema 当成“防幻觉的银弹”**  
- 不适合原因：多个官方文档都明确表达同一件事：结构化输出解决的是结构/类型/可解析性，不保证语义正确；OpenAI 也明确指出 structured outputs 不能防止所有模型错误（例如 JSON 值内部仍可能错）。citeturn9view1turn7view0  

**在 schema 里堆大量 optional 字段，试图“以后再用”**  
- 不适合原因：Claude 明确指出 optional 参数会放大 grammar 状态空间并触达复杂度限制；Gemini/Vertex 也把“减少 optional properties”列为解决 InvalidArgument 的手段。citeturn6view1turn9view2  

**强行引入“论证图/推理规则/概率区间”作为强制字段（过度设计版那类）**  
- 不适合原因：这类字段对模型来说很容易“形式正确但内容灌水”，反而让 moderator 被伪精确迷惑；同时复杂度/校验成本大幅上升，直接踩中平台限制。citeturn6view1turn9view2  

## Open Questions

【已验证事实】现有官方文档已经清楚表明：结构化输出在生产中是可行且常见，但仍受限于复杂度、token/延迟成本、以及与 citations 等功能的兼容性边界。citeturn6view1turn9view0turn9view1  
【对 RT 的推断建议】RT 在落地时还有一些关键未决问题，需要用原型与评测数据回答，而不是靠“更复杂的 schema”硬想：

- **证据粒度**：`locator` 到底用页码/段落号/检索 chunk id/还是 quote？不同粒度影响去重、聚合与审计成本。Claude/Bedrock 的 incompatibility 提示了你可能必须自建一套 locator 体系，但“多细”需要实验。citeturn6view1turn9view0  
- **claim 切分策略**：claim 粒度太粗会降低可验证性，太细会让输出爆炸并触发复杂度/长度问题（平台限制与 token 成本都是真实存在的）。citeturn6view1turn9view2  
- **聚合算法的输入 contract**：moderator 到底聚合“结论”、还是聚合“criteria/权重”、还是聚合“claim-evidence 覆盖率”？不同聚合目标会反过来决定 schema 的必需字段。Anthropic 强调“为需要添加多步系统前先用 eval 找到真正的瓶颈”，RT 也需要先用 eval 指标锁定“最该结构化的那部分”。citeturn10view4turn6view4  
- **如何评测“更低 hallucination surface”**：结构化后你可以统计 gapReason、无证据 claim 比例、证据覆盖率，但这是否真的降低错误决策率，需要与离线/在线 eval 绑定。Anthropic 对 agent eval 复杂性的描述意味着：你可能需要把“多轮 follow-up”也纳入 eval，而不是只看最终答案。citeturn6view4turn10view2  

## Source List

- MetaGPT（论文，arXiv HTML 版）：强调 SOP、结构化 PRD→设计产物→测试、为角色建立 schema/format、用 structured outputs（文档/图）替代纯对话、共享消息池与订阅机制。citeturn11view0turn11view1turn4view0  
- ChatDev（论文，arXiv HTML 版）：chat chain 分阶段分子任务、只传 solutions 以维持连续性、透明可审查中间结果、communicative dehallucination。citeturn5view0turn5view1turn5view2  
- ChatDev（官方工程文档/GitHub）：支持 replay mode、log mode；workflow 以 YAML 组织并提供 schema 校验命令。citeturn12view2turn12view0  
- OpenAI Structured model outputs（官方工程文档）：保证遵循 JSON Schema，减少校验重试、可检测拒绝等。citeturn6view0  
- OpenAI “Introducing Structured Outputs in the API”（官方技术说明）：阐述 structured outputs、限制与“不防止所有语义错误”等。citeturn7view0  
- Anthropic “Building effective agents”（官方工程/研究文章）：workflow 模式（prompt chaining 可插 gate）、强调简化与透明、讨论结构化输出格式负担与工具接口设计。citeturn10view2turn10view3turn6view3  
- Anthropic “Demystifying evals for AI agents”（官方工程文章）：定义 eval 与 agent eval 的多轮复杂性与错误传播问题。citeturn6view4  
- Claude API Docs：Structured outputs 的复杂度限制、工程代价、以及与 citations 不兼容。citeturn6view1  
- Claude Agent SDK Docs：structured outputs 可在多轮 tool use 后返回 validated JSON，解释“默认 free-form text 适合聊天但不适合程序化使用”。citeturn6view2  
- Amazon Bedrock Docs：structured outputs 的端到端流程（校验→编译→缓存）与“与 citations 不兼容（Anthropic）”。citeturn9view0  
- Google Gemini API Docs：structured outputs（JSON Schema）、保证结构但不保证语义正确、复杂 schema 风险。citeturn9view1turn9view2