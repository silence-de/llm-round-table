# Topic 1 Cross-Reference Analysis: Agent Reply 结构化设计
> 分析者：Claude Sonnet 4.6 | 日期：2026-03-19

## 1. 各报告核心主张摘要

**Claude 报告**（信任优先多智能体决策系统：结构化制品升级路径）

在六大一手文献体系（MetaGPT、ChatDev、GopherCite、DSPy、DCI、arXiv:2511.15755）的交叉验证下，该报告认为 RT 系统结构化升级的最高杠杆点是引入带 `evidence` 数组的引证字段，而非全面推行复杂 JSON schema。核心理由是：引证字段同时满足机器可验证、直接抑制幻觉、moderator 可操作三个条件。报告明确警告约束解码（constrained decoding）会扭曲 LLM 输出分布，主张对逻辑字段使用 parse-and-retry，对叙事字段保持自由生成。提出三版 schema（Minimal / Balanced / Over-Engineered），并将 Over-Engineered 版作为反面教材，详细分析五类反模式。

**GPT 报告**（Trust-first 多智能体决策系统中：把 agent reply 从自由文本升级为结构化 artifact 的可验证最小改造）

该报告以生产级 API 约束（OpenAI、Anthropic、Gemini、Bedrock 的结构化输出文档）为主要依据，强调"结构化输出保证结构，不保证语义"这一现实边界。核心主张是：RT 最应优先实现的是 `claims[]` 字段设计（每条 claim 必须带 `citations[]` 或 `gapReason` 的互斥校验），而非 `evidence` 数组。特别指出 Claude/Bedrock 平台上 structured outputs 与 citations 功能存在硬冲突，因此 RT 必须自建 `sources[]` 体系。提出"逻辑层 machine-validated，叙事层 UI-only"的分层原则，并强调 moderator 聚合只能读逻辑层。

**MiniMax 报告**（Trust-First 多智能体系统中 Agent Reply 结构化设计深度调研报告���

该报告以 MetaGPT、ChatDev、LangChain/LlamaIndex 工程实践为基础，提出 RT 最小结构化 schema 应包含四个核心字段：`content`、`confidence`、`citations`、`reasoning_trace`。与其他三份报告不同，该报告将 `confidence` 字段的标准化设计列为第一优先级，理由是置信度直接影响聚合算法选择、人工干预阈值和 follow-up 触发条件。报告还特别强调 XML 标签在提示工程中的结构边界价值，以及三层兜底解析策略（直接解析→轻量净化→二次修复）的工程必要性。

**Gemini 报告**（从叙事到工件：在信任优先的多智能体决策系统中实现回复结构化的架构框架研究报告）

该报告从架构哲学层面切入，将结构化回复定位为"受版本控制、逻辑自洽���具备认识论保障的合同"。核心主张是：RT 最应优先实现的是"证据绑定（Evidence Binding）"——任何事实性陈述都必须强制绑定到包含 `source_id`、`verbatim_quote`、`rhetorical_label` 的结构化证据对象。报告独有地提出了"协调税（Coordination Tax）"概念，警告过复杂 schema 会让模型将注意力消耗在管理括号和 key 名上而非核心推理。还明确反对"智能体自我报告状态（Self-Reported State）"和"无约束 P2P Swarm 协作"两种 RT 不适用的架构模式。

---

## 2. 共识点

**共识一：逻辑字段与叙事字段必须严格分离**（四份报告均支持）

所有报告都明确区分了"机器验证字段"（logic fields）与"人类叙事字段"（narrative/UI fields），并一致主张 moderator 聚合只能依赖逻辑字段，叙事字段仅用于 UI 展示。Claude 报告称之为"logic fields vs UI 叙事字段"，GPT 报告称之为"逻辑层 vs 叙事层"，MiniMax 报告称之为"逻辑字段 vs UI 字段"，Gemini 报告称之为"The Logic Layer vs The Narrative Layer"。

**共��二：证据/引用字段是结构化升级的最高优先级**（四份报告均支持）

四份报告均将某种形式的证据字段列为最优先实现的结构化投资。Claude 报告优先 `evidence[]`，GPT 报告优先 `claims[].citations[]`，MiniMax 报告将 `citations` 列为三个核心字段之一，Gemini 报告优先 `grounding_evidence`。具体命名和粒度有差异，但"证据绑定是降低幻觉表面的最大杠杆"这一判断完全一致。

**共识三：过度复杂的 schema 是反模式**（四份报告均支持）

所有报告都提供了"过度设计版"schema 作为反面教材，并一致指出：深层嵌套、大量 optional 字段、形式逻辑编码、概率分布建模等设计会导致解析失败率上升、token 成本膨胀、平台复杂度限制触发，以及模型注意力被格式管理消耗。

**共识四：`gapReason` 是证据缺口的必要结构化表达**（四份报告均支持）

四份报告均包含某种形式的 `gapReason` 字段设计。Claude 报告将其设计为枚举（insufficient-data / conflicting-sources / out-of-scope），GPT 报告将其设计为 claim 级别的互斥必填字段，MiniMax 报告将其设计为 citation 条目内的 `gap_reason` 枚举，Gemini 报告将其设计为 `evidence_bundle` 中的 `gapReason` 分类。

**共识五：schema 应分阶段渐进实施，而非一步到位**（Claude���GPT、MiniMax 明确支持，Gemini 隐含支持）

三份报告明确建议从最小可行 schema 开始，逐步迭代扩展字段。MiniMax 报告给出了最明确的三优先级排序。GPT 报告提出"先硬后软"的推进顺序。Claude 报告提出"渐进结构化"策略。

**共识六：`confidence` 字段对 moderator 聚合至关重要**（四份报告均支持）

所有报告都包含 `confidence` 字段，并将其用于置信度加权聚合。MiniMax 报告将其列为第一优先级，Gemini 报告将低于阈值的 confidence 作为自动触发校准协议的条件，Claude 报告引入 `confidenceDelta` 追踪变化趋势，GPT 报告将其设计为 `calibration.confidence_score`。

---

## 3. 分歧点

**分歧一：最应优先实现的单一字段**

这是四份报告最核心的分歧。Claude 报告认为应优先 `evidence[]` 数组（理由：同时满足机器可验证、抑制幻觉、moderator 可操作三条件）。GPT 报告认为应优先 `claims[]` 字段（理由：claim 是决策系统里最小的"可审查解"，直接暴露无证据断言）。MiniMax 报告认为应优先 `confidence` 字段（理由：置信度直接影响聚合算法选择和人工干预阈值）。Gemini 报告认为应优先 `grounding_evidence`（证据绑定，理由：将信任从对智能体智力的崇拜转移到对证据链的审核）。

实质上，Claude/Gemini 的分歧在于粒度（evidence 数组 vs 证据绑定到句子级别），GPT 的分歧在于组织单元（以 claim 为中心 vs 以 evidence 为中心），MiniMax 的分歧在于优先维度（置信度聚合 vs 证据可验证性）。

**分歧二：约束解码（constrained decoding）的态度**

Claude 报告明确警告约束解码会扭曲 LLM 输出分布，引用 Tam et al. (2024) 和 Park et al. (2024) 的实证研究，主张对叙事字段保持自由生成，对逻辑字段使用 parse-and-retry。Gemini 报告则引用数据称约束解码在某些分类任务中提高了 42% 的准确率，态度明显更正面。GPT 报告和 MiniMax 报告对此问题未作明确表态，但 GPT 报告引用了平台文档中关于 schema 复杂度限制的工程约束。

**分歧三：`reasoning_trace` / 推理步骤字段的优先级**

MiniMax 报告将 `reasoning_trace` 列为第三优先级（后续迭代），认为其主要价值在于调试和 follow-up，不触发核心逻辑。Claude 报告在 Balanced Schema 中引入了 `reasoning[].stepType` 枚举（五种认识论行为类型），并通过 `dependsOn` 字段创建推理步骤间的有向图，赋予其较高的架构地位。GPT 报告在平衡版中引入了 `claims[].depends_on` 字段，但将推理追踪附属于 claim 结构而非独立字段。Gemini 报告将 `thought_trace` 定位为纯叙事字段，不做任何结构化验证。

**分歧四：`position`/`stance` 字段的设计粒度**

Claude 报告将 `position` 设计为简单枚举（support / oppose / neutral / uncertain），并明确反对条件化立场的嵌套对象设计。MiniMax 报告的 `stance` 枚举包含 `conditional_support` 选项，比 Claude 报告多一个值。Gemini 报告将 `intent` 设计为更宽泛的回复意图枚举（提案、质疑、补充、确认），与立场枚举的语义不同。GPT 报告在平衡版中引入了 `alternatives_considered` 和 `decision_criteria` 字段，将立场判断扩展为多维度决策记录。

---

## 4. 互补点

**互补一：GPT 报告独有——平台级 structured outputs 与 citations 的硬冲突**

GPT 报告是四份报告中唯一明确指出 Claude/Bedrock 平台上 structured outputs 与 citations 功能存在硬冲突（同时启用会报 400）的报告。这一工程约束直接影响 RT 的证据系统架构决策：不能依赖平台内建 citations 功能，必须自建 `sources[]` 体系并维护 canonical source_id。其他三份报告均未提及这一约束，但它对 RT 的实现路径有实质性影响。

**互补二：Gemini 报告独有——"协调税"与 token 级 schema 布局优化**

Gemini 报告提出了"协调税（Coordination Tax）"概念，指出智能体之间传递的非结构化上下文过多会导致模型在 token 级注意力中迷失关键逻辑约束。在此基础上，该报告进一步建议将高频被代码消费的逻辑字段集中在 schema 开头，或使用 XML 标签包裹核心元数据——因为在长文本环境中 XML 比 JSON 具备更强的结构稳定性。这一 token 级布局优化视角在其他三份报告中完全缺失。

**互补三：Gemini 报告独有——明确反对"智能体自我报告状态"**

Gemini 报告明确指出"允许智能体自行标记任务为 DONE"会产生循环论证——智能体会优化回复以满足"完成"的格式，而不论实际工作是否达标。验证权必须保留在 moderator 或独立审计智能体手中。这一架构原则在其他报告中未被明确讨论，但对 RT 的 moderator 设计有直接指导意义。

**互补四：MiniMax 报告独有——三层兜底解析策略与 Schema 版本向后兼容**

MiniMax 报告是四份报告中唯一详细描述生产环境解析容错机制的报告：直接解析→轻量净化（截取第一个 `{` 到最后一个 `}`）→二次修复（将失败样本喂回模型）。同时，该报告也是唯一明确讨论 schema 版本向后兼容问题的报告，建议新字段标记为可选或设置合理默认值，并监控解析成功率、字段缺失率等运营指标。这些工程细节对 RT 的生产落地至关重要。

---

## 5. 对 Round Table 实现的综合建���

以下建议综合四份报告，按优先级排序：

**建议一（最高优先级）：以 claim-evidence 绑定为核心设计第一版 schema**

综合 Claude 报告的 `evidence[]` 优先论、GPT 报告的 `claims[]` 优先论和 Gemini 报告的证据绑定论，建议 RT 第一版 schema 采用"claim 为组织单元，evidence 为验证锚点"的结构：每条 `claim` 必须携带 `citations[]`（引用 RT 自建 `sources[]` 中的 canonical source_id）或非空 `gapReason` 枚举，两者互斥且必填。这一设计同时满足了 GPT 报告强调的"暴露无证据断言"和 Claude/Gemini 报告强调的"证据可验证性"。

**建议二（高优先级）：自建 sources[] 体系，不依赖平台内建 citations 功能**

采纳 GPT 报告的独有发现：由于 Claude/Bedrock 平台上 structured outputs 与 citations 存在硬冲突，RT 必须自建 `sources[]` 数组，每个条目包含 RT 侧生成的 canonical `source_id`（建议对 URL+片段定位做 hash）、`label`（供 UI 显示 [S1]/[S2]）和 `quote`（原文片段）。`claim.citations[]` 引用 `sources[].label`，由 moderator 在接收时做交叉验证。

**建议三（高优先级）：`confidence` 字段与 `position`/`stance` 字段同步引入，作为 moderator 聚合的基础**

采纳 MiniMax 报告对 `confidence` 优先级的判断和 Claude 报告对 `position` 枚举设��的建议。`confidence` 使用 0.0–1.0 浮点值（不使用离散等级，保留精度），低于可配置阈值时自动触发 follow-up 或校准协议（参考 Gemini 报告的 Maker-Checker 模式）。`position` 使用简单枚举（support / oppose / neutral / uncertain），不引入条件化嵌套（采纳 Claude 报告的反模式警告）。

**建议四（中优先级）：逻辑字段使用 parse-and-retry，叙事字段保持自由生成**

采纳 Claude 报告对约束解码风险的警告，结合 MiniMax 报告的三层兜底策略：对 `position`、`confidence`、`claims[].gapReason` 等枚举/数值字段使用 parse-and-retry（首次解析失败则重试，不使用 token 级约束解码）；对 `body`/`ui_narrative`/`thought_trace` 等叙事字段保持完全自由生成。这一策略在保证逻辑字段合规率的同时，避免了约束解码对叙事质量的损害。

**建议五（中优先级）：将高频逻辑字段置于 schema 顶部，避免深层嵌套**

采纳 Gemini 报告的 token 级布局优化建议：`position`、`confidence`、`claims[]` 等 moderator 必读字段应置于 schema 顶层，叙事字段（`body`、`ui_narrative`）置于末尾。字段名保持简短，层级不超过三层，optional 字段最小化（采纳 GPT 报告引用的平台文档建议）。

**建议六（后续迭代）：引入 `reasoning_trace` 时采用步骤类型枚举���非内容结构化**

当 RT 需要推理可追踪性时，采纳 Claude 报告的 `reasoning[].stepType` 枚举设计（observation / inference / assumption / challenge / concession），但推理内容本身（`content` 字段）保持自由文本，不做 schema 强制。同时采纳 Gemini 报告的建议：`thought_trace` 作为纯叙事字段，不参与 moderator 聚合逻辑。

---

## 6. 遗留问题

**遗留问题一：约束解码的质量退化风险在 RT 场景下的实证边界尚不清楚**

Claude 报告引用 Tam et al. (2024) 证明约束解码会扭曲输出分布，Gemini 报告引用数据称约束解码在分类任务中提升了 42% 准确率。两者并不矛盾（分类任务 vs 叙事推理任务），但 RT 的 logic fields（枚举、浮点数）与叙事字段（body、reasoning content）的边界在实践中是否足够清晰、parse-and-retry 的延迟成本是否可接受，四份报告均未给出 RT 场景下的实证数据。这需要通过原型测试来确定。

**遗留问题二：claim 粒度与 schema 复杂度之间的最优平衡点未被确定**

GPT 报告指出 claim 粒度太粗会降低可验证性，太细会导致输出爆炸并触发平台复杂度限制。MiniMax 报告指出 `reasoning_trace` 的详细程度（每个 token？每个句子？每个主要步骤？）尚无定论。四份报告均未给出 RT 高风险决策场景下 claim 切分的具体操作标准，也未提供不同粒度选择对解析成功率和幻觉率的量化影响数据。

**遗留问题三：schema 跨版本演进时的向后兼容策略四份报告均未充分解决**

Claude 报告将"跨轮次 schema 演化"列为 open question，MiniMax 报告建议引入版本号和可选字段默认值，但均未给出具体的迁移策略。当 RT 从 Minimal Schema 升级到 Balanced Schema 时，历史 session 中已存储的结构化回复如何被新版 moderator 正确读取？是否需要迁移脚本？是否需要 `schema_version` 字段驱动的条件解析逻辑？这一工程问题在四份报告中均停留在提问层面，未给出可操作的解决方案。
