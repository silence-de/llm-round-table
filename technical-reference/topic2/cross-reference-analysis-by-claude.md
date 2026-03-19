# Topic 2 Cross-Reference Analysis: Task Ledger 与 Typed State 演进设计
> 分析者：Claude Sonnet 4.6 | 日期：2026-03-19

---

## 1. 各报告核心主张摘要

**Claude 报告（决策摘要评审门设计）**
本报告聚焦于评审器（Judge）的架构设计，核心主张是：评审器必须是内部质量保障信号，而非面向用户的权威来源。推荐多维度布尔通过/失败判定替代连续分数，以避免"权威剧场"（authority theater）。评审维度应锚定可外部验证的参考（简报约束、证据清单、风险列表），最大重写轮次应限制为 2 轮。评审结果绝不以精确分数形式暴露给终端用户，仅作为内部运维遥测数据使用。

**GPT 报告（Message-Driven 向 Task Ledger/Typed State 演进）**
核心主张是：RT 的根本矛盾在于"可恢复、可回放、可复审"的需求与"叙事性、非结构化"的消息历史之间的张力。推荐采用 history + ledger 的混合模式——消息历史作为 append-only 事件流（审计轨迹），Task Ledger 作为物化视图（可查询的规范状态）。明确反对引入完整 DAG/graph runtime，建议以 typed state + 显式阶段机（FSM）+ checkpoint 快照 + fork 语义替代。Progress Ledger 可退化为 cursor + completion_flags + stall_signal。

**MiniMax 报告（Message-Driven 向 Task-Ledger/Typed-State 驱动系统演进）**
核心主张是：RT 应采用最小化 Task Ledger 设计，包含五个核心字段：Objective、CurrentPhase、EvidenceCollected、DecisionDraft、PhaseHistory。明确认为 RT 不需要独立的 Progress Ledger，进度信息可内嵌于 Task Ledger 的阶段状态字段。运行时架构应采用 FSM 而非完整 DAG runtime。提出三阶段渐进迁移路线：影子���本 → 混合驱动 → 账本优先。

**Gemini 报告（智能体决策系统演进研究）**
核心主张是：多智能体系统正经历从消息驱动向状态驱动的根本性范式转移。Task Ledger 作为系统一等公民，能有效解耦"策略意图"与"执行噪音"。推荐 RT 保留一个最小化的 Progress Ledger（退化为"轮次管理器"），负责 Next Speaker 决定、Stall 监测和指令生成。强调 UI Hydration 应直接读取结构化 Ledger 而非解析消息文本，并将"时间旅行"（What-if 分析）视为高商业价值功能。

---

## 2. 共识点

**共识一：消息历史（Message History）不应是唯一状态载体**
四份报告均认为，纯 message-driven 模式在 RT 的"可恢复、可回放、可复审"需求下存在结构性缺陷。GPT 报告指出其导致状态漂移和 token 成本线性增长；MiniMax 报告指出状态提取的不确定性；Gemini 报告指出上下文膨胀导致关键决策信息丢失；Claude 报告虽聚焦评审器，但同样依赖结构化状态（证据清单、风险列表）作为评审锚点。

**共识二：Task Ledger 与消息历史应共存，而非互斥**
GPT、MiniMax、Gemini 三份报告均明确反对完全抛弃消息历史。共同立场是：消息历史作为 append-only 审计日志和证据链，Task Ledger 作为可查询的规范状态（物化视图）。GPT 报告用 Event Sourcing + Materialized View 类比；MiniMax 报告用 messageId 引用关联两者；Gemini 报告将消息历史定位为"辅助展示"。

**共识三：不应引入完整 DAG/graph runtime**
GPT、MiniMax、Gemini 三份报告均明确反对为 RT 引入 LangGraph 等完整图执行模型。共同理由是：RT 流程相对固定，不涉及代码执行，完整 runtime 带来的复杂度与收益不匹配。推荐替代方案均指向 FSM（有限状态机）+ checkpoint 快照的轻量组合。

**共识四：checkpoint/快照机制是实现 resume/replay 的必要条件**
GPT、MiniMax、Gemini 三份报告均将 checkpoint 持久化视为支撑 resume、replay、follow-up 的前置条件。GPT 报告引用 LangGraph persistence 语义；MiniMax 报告建议在阶段转换时创建检查点；Gemini 报告将 checkpoint 定位为"无损重连"的基础。

**共识五：评审/Judge 应基于结构化状态对象而非自然语言历史**
GPT 报告明确指出"judge 针对 typed state，而不是针对自然语言历史"；Claude 报告设计的四个评审维度均要求可外部锚定的结构化参考输入；MiniMax 报告指出基于 EvidenceCollected 的 relevanceScore 可做证据质量统计；Gemini 报告指出独立评委智能体读取 Task Ledger 中的证据链比阅读原始消息记录高效得多。

**共识六：渐进式迁移优于推倒重来**
GPT 报告提出五阶段迁移路线（从为 message 引入稳定 ID 到正式支持 replay/fork）；MiniMax 报告提出三阶段路线（影子账本 → 混合驱动 → 账本优先）；Gemini 报告提出四阶段路线（Shadow Schema → Ledger-Augmented Prompts → State-Led Recovery → Ledger-First Orchestration）。三者均强调保留 history 作为回退保障。

---

## 3. 分歧点

**分歧一：RT 是否需要独立的 Progress Ledger**

这是四份报告中最实质性的分歧。

- MiniMax 报告明确认为 RT **不需要**独立的 Progress Ledger，进度信息可完全内嵌于 Task Ledger 的 CurrentPhase 和 PhaseHistory 字段，独立 Progress Ledger 是针对代码执行场景的过度设计。
- GPT 报告的立场是"需要 Progress 语义，不需要 Progress Ledger 的完整形态"，建议将其退化为 Task Ledger 内的 `cursor` 字段（next_task_id + waiting_on + stall_signal），或作为极小的运行轨迹日志。
- Gemini 报告认为 RT **确实需要** Progress Ledger，但应最小化为"轮次管理器"，保留 Next Speaker 决定器、Stall 监测器和指令生成器三个功能。
- Claude 报告未直接讨论 Progress Ledger，但其评审门设计隐含了对结构化进度控制的需求（重写触发机制、维度优先级）。

**分歧二：Task Ledger 的最小字段集合**

三份直接讨论 Task Ledger schema 的报告在字段粒度上存在差异：

- GPT 报告的 schema 最为详尽，包含 goal、stage_plan、tasks[]（带 status/owner/依赖/输入输出引用）、evidence[]、claims_or_facts[]、assumptions[]、decision_snapshot、cursor，强调任务级可恢复性。
- MiniMax 报告的 schema 最为精简，仅五个核心字段：Objective、CurrentPhase、EvidenceCollected、DecisionDraft、PhaseHistory，强调最小可行性。
- Gemini 报告的 schema 介于两者之间，包含 discussion_goal、consensus_map、participant_registry、evidence_vault、current_phase、planning_horizon、stall_index，独有 participant_registry（参与者观点摘要与贡献度统计）和 consensus_map（共识/争议点的显式映射）。

**分歧三：评审结果的暴露边界**

- Claude 报告立场最为严格：评审结果（包括 PASS/FAIL 判定）绝不以任何形式暴露给终端用户，仅作为内部运维遥测数据，原因是 LLM 评审器本身不可靠，暴露会制造"权威剧场"。
- Gemini 报告将 Judge 集成视为产品功能，认为独立评委智能体可以"随时接入，读取 Task Ledger 中的证据链，并给出独立评分"，暗示评审结果具有一定的用户可见性。
- GPT 报告和 MiniMax 报告均未直接讨论评审结果的暴露边界，但两者对 Judge 的定位均偏向内部校验（结构化对象的一致性验证）而非用户可见的质量背书。

**分歧四：迁移路线的起点假设**

- GPT 报告的迁移路线从最底层开始（为每条 message 引入稳定 ID），假设现有系统连消息 ID 都不稳定，迁移粒度最细。
- MiniMax 报告假设现有系统已有 AllMessages 列表，迁移起点是在其旁构建影子账本，粒度居中。
- Gemini 报告的迁移起点是"状态影子模式"——异步提炼智能体从消息历史中提取 Ledger，假设现有系统可以支持异步旁路写入，对现有系统侵入性最低但依赖 LLM 提取准确性。

---

## 4. 互补点

**互补一：Gemini 报告独有的 consensus_map 与 participant_registry 设计**
Gemini 报告提出了其他三份报告均未覆盖的两个字段：`consensus_map`（显式记录已达成共识的点、仍存在争议的点及对应证据）和 `participant_registry`（参与者当前观点摘要与贡献度统计）。这两个字段对 RT 的多智能体讨论场景具有独特价值——consensus_map 使主持人可以直接判断讨论是否收敛，participant_registry 支持贡献度可视化和发言权分配。其他报告的 schema 中均缺乏对"共识状态"的显式建模。

**互补二：Claude 报告独有的评审偏差量化与反模式体系**
Claude 报告系统性地量化了 LLM 评审器的四类偏差（自我增强偏差 10%-25%、冗长偏差 91.3%、位置偏差、推理能力偏差），并给出了具体的缓解措施（跨模型族评审、参考引导、链式思考、反偏差指令）。这套偏差分析体系是其他三份报告完全未覆盖的，对 RT 的 Judge 模块设计具有直接的工程指导价值。其"标准漂移"（criteria drift）发现也提示 Task Ledger 的评审维度本身需要版本控制和定期校准。

**互补三：GPT 报告独有的"审计型 replay vs 探索型 replay"区分**
GPT 报告明确区分了两种语义不同的 replay：审计型 replay（复现旧结论，不重跑 LLM，直接读取已持久化的 artifact）和探索型 replay（从旧状态分叉，用新证据重新生成输出）。这一区分是其他三份报告均未明确提出的，但对 RT 的产品设计至关重要——混淆两者会导致用户以为在"复审旧结论"，系统却偷偷重跑 LLM 得到不同文本，破坏信任。

**互补四：MiniMax 报告独有的状态一致性约束与 schema 迁移处理**
MiniMax 报告是四份报告中唯一明确讨论"状态更新时的一致性约束"（如阶段转换时 EvidenceCollected 必须满足前置条件）和"schema 版本演进时的历史数据迁移"（读取时为缺失字段提供默认值，或编写迁移脚本）的报告。这两个工程细节在其他报告中均被忽略，但在实际实现中是常见的故障来源。

---

## 5. 对 Round Table 实现的综合建议

以下建议按优先级排序，综合四份报告的核心洞察：

**建议一（最高优先级）：立即为消息历史引入稳定 ID 和结构化元数据**
在引入任何 Task Ledger 之前，先完成这一基础工作：为每条消息分配稳定的 `message_id`，记录 `role`、`author`、`created_at`、`parent_id`（可选）。这是 GPT 报告迁移路线的第一步，也是 Claude 报告评审维度（证据覆盖、风险披露）能够锚定原始证据的前提。没有稳定的消息 ID，Task Ledger 中的 evidence 引用将无法实现可追溯性。

**建议二（高优先级）：采用五字段最小 Task Ledger，以 cursor 替代独立 Progress Ledger**
综合 GPT 和 MiniMax 报告的分歧，推荐折中方案：以 MiniMax 的五字段为基础（Objective、CurrentPhase、EvidenceCollected、DecisionDraft、PhaseHistory），在其中加入 GPT 报告的 `cursor` 字段（next_task_id、waiting_on、stall_signal）。同时借鉴 Gemini 报告，增加 `consensus_map` 字段显式记录共识/争议状态。这一方案避免了独立 Progress Ledger 的复杂度，同时保留了进度控制语义。

**建议三（高优先级）：在阶段转换时创建 checkpoint，而非每条消息后**
MiniMax 和 GPT 报告均支持这一策略。具体触发点：CurrentPhase 发生变化时、DecisionDraft 发生结构性更新时、等待人类输入时（cursor.waiting_on 非 none）。每个 checkpoint 持久化完整的 Task Ledger 快照 + thread_id，支持 resume 和 fork。

**建议四（中优先级）：明确区分审计型 replay 与探索型 replay，并在产品层面暴露这一区分**
采纳 GPT 报告的独有洞察：审计型 replay 直接读取已持久化的 artifact（不重跑 LLM），探索型 replay 从旧 checkpoint fork 出新 branch_id 后允许重新生成。在 UI 层面，两种模式应有明确的视觉区分，防止用户混淆"复审旧结论"与"基于旧状态重新讨论"。

**建议五（中优先级）：Judge 模块采用 Claude 报告的布尔判定设计，但评审对象指向 Task Ledger 结构化字段**
结合 Claude 报告的评审器设计（多维度布尔 PASS/FAIL + 结构化反馈 + 最多 2 轮重写）和 GPT/MiniMax/Gemini 报告对结构化状态的强调：评审维度应锚定 Task Ledger 的可验证字段（evidence_ids 非空、claims 覆盖 success_criteria、decision_snapshot 包含 pros/cons/risks）。评审结果仅作为内部运维信号，不以任何形式暴露给终端用户。

**建议六（低优先级，但需提前规划）：为 Task Ledger schema 引入版本控制机制**
采纳 MiniMax 报告的独有洞察：schema 演进不可避免，需在设计初期引入 `ledger_version` 字段（GPT 报告也有此字段），并制定读取时为缺失字段提供默认值的策略。同时采纳 Claude 报告关于"标准漂移"的发现：评审维度本身也需要版本控制，像代码一样迭代，并配合定期的人工校准审核。

---

## 6. 遗留问题

**遗留问题一：claims/evidence 的最小本体模型边界尚未确定**
GPT 报告区分了 claims_or_facts（带证据引用与置信/争议状态）、evidence（带 source_ref 和 hash）、assumptions（带 risk_if_wrong）三类对象；MiniMax 报告将其合并为 EvidenceCollected 单��数组；Gemini 报告使用 evidence_vault + consensus_map 的双层结构。四份报告均未给出在 RT 实际决策场景中，这些对象的最优粒度划分的实证依据。具体问题是：是否需要区分"事实性证据"与"观点性证据"？assumption 是否需要独立字段？这需要通过 RT 的真实讨论数据来验证。

**遗留问题二：评审器（Judge）的校准半衰期与跨模型族部署的工程可行性**
Claude 报告明确提出了这两个开放问题，但其他三份报告均未涉及。在 RT 的生产环境中：（1）评审器在多长时间内从可靠变为不可靠（校准半衰期），需要通过自身生产数据建立基线；（2）跨模型族评审（使用不同供应商的模型作为评审器）的成本-收益比，以及在跨模型不可行时同源缓解措施的有效性下限，均需要在 RT 的具体部署环境中评估。这两个问题直接影响 Judge 模块的长期可靠性。

**遗留问题三：多轮 follow-up 中 Task Ledger 的分支管理与合并语义**
GPT 报告提出了 fork 语义（从旧 checkpoint 创建新 branch_id，保留原分支不变），MiniMax 报告提出了多轮讨论的嵌套结构问题，Gemini 报告将 What-if 分析视为高价值功能。但四份报告均未解决：当用户在多个 fork 分支上分别推进讨论后，如何合并不同分支的 claims、evidence 和 decision_snapshot？分支之间的冲突解决策略是什么？这是 RT 支持真正的"假设分析"功能时必须面对的核心工程问题，目前在所有四份报告中均属空白。
