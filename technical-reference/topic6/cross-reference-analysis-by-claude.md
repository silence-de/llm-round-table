# Topic 6 Cross-Reference Analysis: 轻量级决策记忆架构设计
> 分析者：Claude Sonnet 4.6 | 日期：2026-03-19

---

## 1. 各报告核心主张摘要

**Claude 报告（决策支持产品的轻量级记忆架构设计）**
RT 所需的不是"记忆系统"，而是"会话边界结构化写入 + 最小化持久化存储 + 定向检索注入"的轻量架构。记忆总量应控制在 50-100 条结构化记录以内，仅在会话结束时通过反思机制批量生成，而非运行时连续写入。RT 只需三种记忆类型：会话工作状态、决策档案、校准日志。校准追踪是刚需而非可选，LLM 系统性过度自信（高信心预测实际错误率达 20-30%）使 Brier 分数框架成为必要基础设施。

**GPT 报告（RT 决策系统的最小化记忆与可追溯设计研究）**
RT 的记忆问题本质是"以决策为中心的、可审计的、append-only 的决策事件与派生物体系"。核心主张是将"决策—预测—结果—复盘"做成一条可追溯链条，连续性限定在这条链条上而非开放式个人记忆。引入 Event Sourcing 范式（不可变事件序列 + 物化视图）和 ADR 的 immutable/supersede 原则，强调 PROV-DM 的 entity-activity-agent 结构实现 provenance 追溯。防止旧偏见复制的核心是六条硬约束机制，而非软提示。

**MiniMax 报告（Memory Types Relevant to RT）**
采用"三层+一引擎"架构：Session Context Layer、Decision Record Layer、Calibration Data Layer，加上预定义规则驱动的 Selection Engine。强调四个必须字段的最小 Lessons Learned Schema（Problem、Decision Rationale、Outcome、Lesson），以及明确的复杂度边界（核心组件 ≤5 个，不依赖向量数据库，检索 <1 秒）。提出"决策进度仪表盘"作为 follow-up 启动界面，将待验证预测、待确认假设、待填补证据缺口可视化呈现。

**Gemini 报告（轻量级决策记忆系统设计）**
提出 SRDP（Stateful Reflective Decision Process）架构，核心主张是将情景记忆（Episodic Memory）强烈排斥，仅保留反思记忆（Reflection Memory）作为核心资产。借鉴 ISO/IEC 17025 计量学溯源链概念，将校准追溯分为事实层、逻辑层、归因层三级递进结构。Lessons Learned 的 generalized_rule 字段必须被强制抽象为面向未来时态的行动指令，绝对禁止叙事形态。通过 Session-end Hook 机制实现记忆写入与推理循环的彻底解耦。

---

## 2. 共识点

**共识一：会话结束时批量写入，严禁运行时连续写入**
四份报告均明确反对在推理循环中持续写入长期记忆。Claude 报告引用 LangChain 生产实践和 ACC 论文；GPT 报告将运行时写入列为反模式；MiniMax 报告明确"Session 进行时不进行任何持久化写入"；Gemini 报告将此定为"设计铁律"并提出 Session-end Hook 机制。

**共识二：原始对话记录绝不进入跨会话上下文**
四份报告一致认为完整 transcript 不应继承到 follow-up session。Claude 报告引用 ACC 论文证明完整上下文回放导致更高幻觉率；GPT 报告将其列为"最不该继承的内容"；MiniMax 报告明确列出"不继承"清单；Gemini 报告将其定性为"绝对禁止传递的噪音"。

**共识三：follow-up 必须继承的四类核心内容**
四份报告在继承内容上高度一致：摘要/结论、关键假设、带时间界限的预测（含置信度）、证据缺口。GPT 报告额外强调后续动作与检查点；Gemini 报告将其称为"连续性握手机制"的白名单。

**共识四：预测必须是一等对象，且在会话结束时冻结**
Claude 报告引用 Tetlock 四要素��架；GPT 报告强调"预测必须在会末冻结，否则容易被后续讨论悄悄改写"；MiniMax 报告设计了完整的 Prediction Tracker 生命周期管理；Gemini 报告要求通过 Function Calling 或强类型 JSON Schema 强制输出可测试前提。

**共识五：反对 MemGPT 式自主记忆管理和 Generative Agents 式无界情景流**
四份报告均将这两种模式列为反模式。Claude 报告详细分析了其 token 成本和幻觉风险；GPT 报告将其定性为"重炮打蚊子"；MiniMax 报告列出六种反模式清单；Gemini 报告以最强烈的语气批判，称其为"工业级决策工作流中不折不扣的毒药"。

**共识六：经验教训必须有适用边界和可操作性，不能是泛泛观察**
Claude 报告要求 lesson 精确到"在什么条件下、观察到什么偏差、建议什么调整"；GPT 报告要求 lesson 能"触发下一次决策中的具体行为改变"；MiniMax 报告要求 lesson 字段"具体、可操作，明确适用条件和潜在反例"；Gemini 报告要求 generalized_rule 必须是"面向未来时态的行动指令或检查清单"。

---

## 3. 分歧点

**分歧一：情景记忆（Episodic Memory）的保留程度**
Claude 报告和 GPT 报告采取"选择性保留"立场——将情景记忆简化为结构化的决策档案/Decision Episode Record，保留其骨架但丢弃叙事细节。MiniMax 报告持中间立场，建议"选择性情景记忆，仅存储关键节点"。Gemini 报告立场最激进，将情景记忆标注为"强烈排斥（过度设计）"，主张彻底以反思记忆替代，原始情景是"导致系统性偏见复制的根源"。这一分歧在实现层面影响显著：前三者保留了某种形式的决策事件记录，Gemini 报告则主张只保留从中提炼的规则。

**分歧二：校准追溯的理论框架深度**
Claude 报告和 GPT 报告均以 Brier 分数及其分解（reliability/resolution/uncertainty）为核心量化工具，Claude 报告还引用了 KalshiBench 和 ForecastBench 的实证数据。MiniMax 报告在校准指标上更为开放，列出 ECE、MSCE、Brier Score 等多种选项，认为"各有优缺点"，未给出明确推荐。Gemini 报告则完全绕开了具体评分规则，转而借鉴 ISO/IEC 17025 计量学溯源链概念，将校准追溯定义为"事实层—逻辑层—归因层"三级结构，强调残差计算而非概率评分。这一分歧反映了对"校准"概念本身的不同理解：概率预测准确性 vs. 决策溯源完整性。

**分歧三：Lessons Learned 的最小 Schema 字段设计**
四份报告在 schema 设计上存在实质性差异。Claude 报告的 schema 最为详细，包含 evidence_basis（含 pattern_count）、applicability_conditions、expiry_policy 等字段，强调多次观察才能提升为教训。GPT 报告的 schema 强调 delta_analysis（偏差解释）和 actionable_update，并要求 lesson 表述为"条件化规则"。MiniMax 报告主张四个必须字段（Problem、Decision Rationale、Outcome、Lesson），是四者中最简洁的。Gemini 报告的 schema 最具工程导向，核心是 trigger_condition 和 generalized_rule，前者用于确定性匹配触发，后者强制为系统指令形态。

**分歧四：是否需要向量数据库/语义检索**
MiniMax 报告明确将"向量数据库依赖"列为反模式，主张关系型/文档数据库加标签检索已足够。GPT 报告同样建议"结构化过滤优先，必要时才做语义检索"。Claude 报告未明确排斥向量检索，但其检索设计以"确定性的结构化查询"为主。Gemini 报告则提出用 domain_tags 结合轻量级文本分类器替代向量相似度计算，批判 cosine similarity 的"模糊、不可控"。总体上三份报告倾向于排斥向量数据库，但排斥程度和替代方案有所不同。

---

## 4. 互补点

**互补一：GPT 报告独有的 Event Sourcing + ADR immutable/supersede 范式**
GPT 报告是四份报告中唯一系统性引入软件工程 Event Sourcing 范式的。"事件不可变 + 物化视图可重建"的设计，以及 ADR 的"accepted 后不可改、新洞见用新记录 supersede 旧记录"原则，为 RT 的决策历史管理提供了一个成熟的工程范式。其他三份报告虽然都强调"不可变"，但未给出如此清晰的工程实现路径。这一范式对 RT 实现"防止历史被重写"具有直接的落地价值。

**互补二：Gemini 报告独有的三层校准追溯结构（事实层—逻辑层—归因层）**
Gemini 报告借鉴 ISO/IEC 17025 计量学概念，将校准追溯分解为三个递进层级：事实层（系统执行客观 Delta 计算）、逻辑层（哈希链/UUID 将校准对比绑定回原始决策上下文）、归因层（LLM 才被允许介入，面对客观偏差数据进行根因分析）。这一"LLM 只在归因层介入"的设计，有效防止了后见之明偏见，是其他三份报告未覆盖的独特洞察。

**互补三：MiniMax 报告独有的"决策进度仪表盘"产品化视角**
MiniMax 报告是四份报告中唯一从产品 UI/UX 角度提出具体交互设计的。"决策进度仪表盘"将当前决策状态、待验证预测列表、待确认假设列表、待填补证据缺口列表可视化呈现，作为 follow-up session 的启动界面。这一设计将抽象的记忆架构转化为用户可感知的产品功能，填补了其他三份报告在产品层面的空白。

**互补四：Claude 报告独有的 LLM 过度自信实证数据与校准刚��论证**
Claude 报告是四份报告中唯一系统性引用 KalshiBench 和 ForecastBench 实证数据的，明确指出 LLM 在 90% 以上信心时实际错误率高达 20-30%，且链式推理反而恶化校准性能。这一实证基础将"校准追踪"从可选功能提升为刚需，并为"在呈现 AI 辅助分析时应始终附带历史校准数据作为可信度调节器"提供了直接依据。其他三份报告均未提供此类实证支撑。

---

## 5. 对 Round Table 实现的综合建议

以下建议按优先级排序，综合四份报告的核心洞察。

**建议一（最高优先级）：实现 Session-end Hook 机制，彻底解耦记忆写入与推理循环**
四份报告一致支持此原则。具体实现：当用户确认"结束决策"时，触发独立的后台 LLM 实例（Summarizer & Reflector），离线处理 transcript，生成结构化的 Session-end Reflection Artifact。该 artifact 写入持久化存储后，原始 transcript 可冷归档。Artifact 的核心字段应包含：decision_summary、predictions（含概率和截止日期）、assumptions_register（含 how_to_falsify）、evidence_gaps、follow_up_triggers。参考 Claude 报告的完整 Schema 和 Gemini 报告的 state_handoff 结构。

**建议二（最高优先级）：建立 Prediction-Outcome Ledger，将预测作为一等对象管理**
参考 GPT 报告的 Prediction–Outcome Ledger 设计和 Claude 报告的 Tetlock 四要素框架。每条预测必须包含：可观测事件定义、截止日期、概率估计（0-1）、度量口径/数据源、关键假设引用。预测在会话结束时冻结，不可回写。到期时系统自动触发验证流程，计算 Brier 分数。这是 RT 校准追踪能力的基础设施。

**建议三（高优先级）：采用 ADR 的 immutable/supersede 原则管理决策历史**
参考 GPT 报告的 Event Sourcing 范式。决策记录一旦 accepted 即不可修改；若有新洞见，创建新记录并标注 supersedes 关系，而非回写旧记录。这是防止"历史被重写"和 hindsight bias 的工程级保障，比软提示更可靠。

**建议四（高优先级）：实现 Gemini 报告的三层校准追溯结构**
事实层由系统自动执行（客观 Delta 计算，不涉及 LLM）；逻辑层通过 UUID 将校准对比绑定回原始决策记录（确保不可抵赖性）；归因层才允许 LLM 介入，面对客观偏差数据进行根因分析。这一设计有效防止 LLM 在归因时产生后见之明偏见。

**建议五（中优先级）：实现 MiniMax 报告的"决策进度仪表盘"作为 follow-up 启动界面**
follow-up session 启动时，系统自动呈现：当前决策状态、待验证预测列表（含到期日期）、待确认假设列表（含验证状态）、待填补证据��口列表。这将抽象的记忆架构转化为用户可操作的产品功能，降低认知负担，同时强制将"差异（delta）+ 证据状态"作为 follow-up 的第一屏，而非直接呈现旧结论。

**建议六（中优先级）：Lessons Learned 采用 Claude 报告的 pattern_count + expiry_policy 机制**
单次观察不应提升为全局教训（pattern_count ≥ 3 才考虑提升）。每条教训必须有 applicability_conditions 和 expiry_policy（review_after_sessions + auto_flag_if_contradicted）。Gemini 报告的 generalized_rule 字段格式（面向未来时态的系统指令，而非第一人称叙事）应作为 lesson 内容的写作规范。

---

## 5b. GPT 分析补充：代码现状与开发指引

> 来源：`cross-reference-analysis-by-gpt5.4.md`，提取其中对 RT 当前实现最有价值的工程判断。

**当前代码缺口（GPT 视角）**
- 缺少独立 `session_end_reflection` artifact：会话结束时无结构化记忆写入点。
- 缺少 lessons learned 生命周期规则：无 `pattern_count`、`expiry_policy`、`conflict_marker`。
- 缺少 follow-up memory injection 白名单机制：follow-up 继承内容边界未定义。

**P0 开发优先级（GPT 视角）**
- 定义 `session_end_reflection` 最小 schema：`decision_summary`、`assumptions_with_status`、`evidence_gaps`、`forecast_items`、`lessons_candidate`。
- 在 session completion / stop 时单点生成，不在推理循环中写入。
- Follow-up 只注入：上次结论、未关闭假设、证据缺口、已验证 lessons。

**P1 开发优先级（GPT 视角）**
- 引入 lessons promotion 规则：`pattern_count`、`evidence_count`、`expiry_policy`、`conflict_marker`。
- 在 calibration 面板联通预测-结果对账与 lesson 命中。

**P2 开发优先级（GPT 视角）**
- 增加有界归档策略：时间窗口、数量上限、过期清理。
- 不同主题域之间做记忆隔离，避免跨域污染。

**验收指标（GPT 视角）**
- 测试：follow-up 不依赖长 transcript 仍能正确续接、expired lessons 不再注入、low-confidence assumptions 不进入新会话 prompt。
- 运营指标：`follow_up_token_reduction`、`lesson_hit_rate`、`stale_lesson_rollback_rate`。

---

## 6. 遗留问题

**遗留问题一：非二元预测的校准指标标准化**
Claude 报告提出 CRPS（连续排名概率评分）作为候选方案但未给出结论；MiniMax 报告列出 ECE、MSCE、Brier Score 等选项但认为"各有优缺点"；GPT 报告和 Gemini 报告均未深入讨论。RT 的许多决策涉及连续值预测（时间线、成本、市场份额），Brier 分数仅适用于二元事件。如何为不同预测类型选择可比较的校准指标，并在产品层面保持可解释性，四份报告均未给出可直接落地的答案。

**遗留问题二：Lessons Learned 的治理机制——谁审、如何合并、如何废弃**
GPT 报告引用 GAO 对 NASA 的调查，��出"费时、缺乏系统性通知"导致低提交率；Gemini 报告提出"垃圾回收与冲突管理"问题，但未给出轻量级解决方案；Claude 报告的 expiry_policy 提供了部分答案，但最优复审周期仍需实证数据。当外部环境发生范式变迁时，如何在不引入复杂图数据库的前提下，实现旧经验的优雅汰换，四份报告均未解决。

**遗留问题三：LLM 生成的 Reflection Artifact 的质量保障机制**
Claude 报告明确提出"LLM 的幻觉倾向意味着反思内容可能包含原始对话中不存在的细节"，并提出人工审核问题，但未给出高频使用场景下的可行方案。MiniMax 报告提出"引入参与者确认机制、人工审核抽样、多 Generator 交叉验证"等方向，但未深入。GPT 报告和 Gemini 报告均未正面处理此问题。在 RT 这类高风险决策场景中，如何在不引入过高人工成本的前提下，保障 Session-end Reflection Artifact 的内容准确性，是四份报告共同留下的空白。
