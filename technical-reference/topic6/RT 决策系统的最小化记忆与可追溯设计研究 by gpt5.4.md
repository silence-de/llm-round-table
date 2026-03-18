# RT 决策系统的最小化记忆与可追溯设计研究

## Executive Summary

本研究给出的结论是：对“每次 session 是一次重要决策、follow-up 是一等需求、要对比 prior prediction vs actual outcome、要沉淀 lessons learned，但不想引入重型长期记忆系统”的 RT 类产品，**最小可行的记忆系统不是“无边界长期记忆”，而是“以决策为中心的、可审计的、append-only 的决策事件与派生物体系”**：把“决策（Decision）—预测（Prediction）—结果（Outcome）—复盘（Retrospective/Lesson）”做成一条可追溯链条，并把跨 session 的连续性限定在这条链条上，而不是让 agent 自主维护开放式个人记忆或世界模型。该路线可直接借鉴工程领域的“append-only decision log / event sourcing / postmortem”范式，将“连续性”做成**显式链接**与**不可变历史**，再用**物化视图（materialized view）**为 follow-up 提供“够用上下文”。citeturn8view3turn8view4turn8view5turn8view6

对 follow-up continuity，“最该继承”的不是全文上下文，而是一张“决策续会简报（Follow-up Brief）”：**结论（当时决定）、关键假设、带时间界限的预测、成功指标与观测计划、已用证据与证据缺口、待办与下一次检查点**。这与 ADR 的最低要求（context/decision/consequences，且强调“为何做此决策”）一致，也与 AAR 的核心议程（本应发生/实际发生/哪里对或错/下次怎么做）一致。citeturn8view5turn15view1

对 lessons learned，“最小 schema”应当是一张能在下一次决策中**被检索、被对照、能触发行为改变**的小卡片：包含**触发情境、原预测/原假设、真实结果、偏差解释（为什么错/为什么对）、可执行的规则更新（做法/检查项/阈值）、适用范围与置信度**。此结构在精神上更接近 postmortem 的“impact/root cause/follow-up actions”与 AAR 的“改进策略”，而不是无限追加的“反思随笔”。citeturn8view6turn15view0turn15view1

对 calibration traceability：把预测当作一等对象，用**严格适当评分规则（strictly proper scoring rules）**与（至少）Brier score 家族为每条预测打分并随时间汇总，能把“是否更准/更诚实”变成可量化反馈；同时用 provenance（例如 PROV 的 entity-activity-agent 结构与“provenance of provenance”）把“预测是基于哪些证据/数据/分析活动生成的、谁负责、后来如何被验证、复盘结论如何派生”结构化串起来。citeturn21view0turn20view1turn8view7turn32view0

为了避免“旧偏见被机械复制”，核心机制是：**(1) 原始预测与原始假设不可变；(2) follow-up 强制写清“哪些条件变了、哪些证据补齐了、因此为何允许更新”；(3) 系统对用户展示的是“差异（delta）+ 证据状态”，而不是把旧结论当作 prompt 里的隐形指令；(4) 复盘采用 blameless 视角，聚焦系统性信息缺口与流程改进，而非事后合理化**。这既呼应了 blameless postmortem 的组织实践，也与“结果知识会提高事后可预测性感知（hindsight bias）”的行为决策研究一致。citeturn8view6turn24view0turn24view1

## Verified Findings

第一，MemGPT 的核心定位是“在固定上下文窗口上制造无限上下文的幻觉”，方法是**智能管理不同 memory tiers，并用 interrupts 管理控制流**；它被用于文档分析与多轮跨 session 对话，以支持“remember/reflect/evolve”的长程交互。citeturn8view0

第二，Generative Agents 的架构明确主张：扩展 LLM **存储完整经历记录（complete record of experiences）**，并**随时间把记忆综合为更高层反思（higher-level reflections）**，再动态检索以驱动后续计划与行为；其系统由 observation、planning、reflection 等组件构成。citeturn9view0

第三，Reflexion 提出不改权重、用**语言反馈（linguistic feedback）**强化 agent：让 agent 对反馈进行 verbal reflection，并把反思文本维持在**episodic memory buffer**里，从而在后续 trial 中做出更好决策。citeturn10view0

第四，ReAct 展示了“推理痕迹（reasoning traces）+ 行动（actions）”交错生成的范式：推理痕迹用于诱导/跟踪/更新计划并处理异常，行动用于对接外部信息源（知识库/环境）以降低幻觉与误差传播，并提升可解释性与可信度。citeturn11view0

第五，在工程文档中，entity["company","Microsoft","tech company"]的 Event Sourcing pattern 将系统状态建模为**append-only 事件序列**：事件被持久化到 event store 作为权威记录；系统可通过 replay 事件物化当前状态，并常用 materialized view 提供可查询视图；事件不可变、append-only 是关键优势之一。citeturn8view3

第六，同样在工程文档中，entity["company","Microsoft","tech company"]对 ADR 的定义强调：ADR 记录架构决策并提供“与上下文相关的论证与影响”；ADR **作为 append-only log**，应从工作开始时建立并贯穿生命周期（甚至可追溯生成），将需求与约束纳入决策影响描述。citeturn8view4

第七，entity["company","Amazon Web Services","cloud provider"]的 ADR process 明确：每条 ADR 至少包含**context/decision/consequences**，强调“why 而不是 how”；当 ADR 被接受后即**immutable**，若有新洞见则创建新 ADR 并使其 supersede 旧 ADR，而不是回写篡改历史。citeturn8view5

第八，entity["company","Google","tech company"]的 SRE 文档把 postmortem 定义为：对一次事件的书面记录，包含影响、缓解/解决动作、根因与防复发的后续动作；并强调 blameless：聚焦系统原因而不是指责个人，且 postmortem 需要被 review，否则等于不存在。citeturn8view6

第九，entity["organization","United States Army","us army"]的 AAR 定义为提升后续表现的“guided analysis”；AAR 议程包含“本应发生什么、实际发生什么、哪些对/错、下次如何做到标准”，并强调开放讨论、避免“指责式 critique”。citeturn15view0turn15view1

第十，关于“长对话上下文”的工程经验：entity["company","LangChain","llm dev platform"]指出长对话会挑战上下文窗口，并且即便模型支持更长上下文也可能被陈旧/离题内容“分心”，造成更高成本与更慢响应；同时记忆写入既可在 hot path 进行，也可作为后台任务（background）进行，二者在延迟、复杂度与质量上存在权衡。citeturn12view0

第十一，entity["company","LlamaIndex","llm data framework"]的 ChatSummaryMemoryBuffer 展示了一个典型“最小化跨轮记忆”的方法：在 token 限制下，**对放不进 buffer 的历史消息进行迭代摘要**，在控制成本/延迟的同时尽量保留潜在相关信息。citeturn13view0

第十二，entity["organization","U.S. Government Accountability Office","us audit agency"]对 entity["organization","NASA","us space agency"] lessons learned 的调查表明：NASA 的流程要求项目经理贯穿生命周期回顾与应用 lessons，并及时提交重要 lesson；但存在“跨机构共享有限”“缺乏系统性通知重要 lessons 的方法”“提交与描述 lesson 费时”“对分享失败有顾虑”等现实阻力，导致系统并不自动带来组织学习。citeturn14view2

第十三，entity["organization","NASA","us space agency"]公开页面将其 lessons learned system 描述为包含“官方审核过”的 lessons 数据库，面向多学科用户使用。citeturn14view1

第十四，在可追溯性与 provenance 标准方面，entity["organization","World Wide Web Consortium","web standards body"]的 PROV-DM 将 provenance 定义为关于 entity/activity/people 的信息，用于评估数据或事物的质量、可靠性或可信度；并提供 bundle 等机制支持“provenance of provenance”，可用于审计链条的再审计。citeturn8view7

第十五，PROV-JSON（W3C Member Submission）给出了 PROV 的 JSON 序列化：强调“compact and faithful representation”“适合在服务与客户端间交换”，并把 entity/activity/agent 等按类型与 identifier 索引，以便快速查找。citeturn32view0

第十六，在 calibration 的量化反馈方面，Gneiting & Raftery（JASA）说明严格适当评分规则用于评估概率预测；严格适当性（strict propriety）的关键意义之一是：在期望意义下激励预测者报告其真实信念（honest quoting）。citeturn21view0turn21view1

第十七，关于“概率预测误差如何诊断”，Stephenson 等（2008）将 Brier score 定义为“预测概率与二元结果的均方差”，并讨论了（在常用分箱下）与可靠性（reliability）、分辨率（resolution）、不确定性（uncertainty）等相关的分解，可为改进预测提供诊断信息。citeturn20view1

第十八，关于“校准为何重要”，Guo 等（2017）把 calibration 定义为“输出概率要代表真实正确率的可能性”，并报告现代神经网络常常校准不佳，且温度缩放等后处理方法在很多数据集上有效。citeturn22view0

第十九，关于“复盘为何会系统性偏”，entity["people","Baruch Fischhoff","behavioral decision researcher"]指出结果知识会提高事后对该结果的主观可预测性（hindsight ≠ foresight），且这种“creeping determinism”会损害从历史中学习的能力。citeturn24view0turn24view1

第二十，关于“证据缺口与反证测试”，entity["people","Peter Cathcart Wason","cognitive psychologist"]在 2-4-6 任务中研究了人们倾向于只寻求确认性证据（confirming evidence）而非同时寻求反证，这会导致错误结论；该发现为“下一次决策需要结构化证据缺口与反证计划”提供了实验支持。citeturn26view0

## Memory Types Relevant to RT

对 RT，“记忆”不应被理解为开放式长期知识库，而应理解为**决策工作流中的状态与证据工件（artifacts）**。将记忆类型拆开，能够把“必须跨 session 保留的少量内容”与“会把系统带向重型自主记忆的内容”切割开来。

在工程上，短期记忆（thread/session scoped）通常就是会话历史与状态；但长对话存在上下文窗口与“模型被陈旧信息分心”的问题，因此需要主动遗忘或压缩。citeturn12view0turn13view0 这意味着 RT 的跨 session continuity 不应靠“把几十轮聊天喂回去”，而应靠“稳定、可检索的小工件”。

结合工程文档中的 memory 分类（semantic/episodic/procedural）与 RT 的需求，可以得到一组对 RT “刚好够用”的记忆类型映射：citeturn12view0

- **Session Working Context（会中工作上下文）**：仅对当前 session 有效，包括议程、当前讨论的选项、最新数据片段与未决问题。它的目标是帮助完成当次决策，而不是沉淀长期记忆。citeturn12view0  
- **Decision Episode Record（决策事件记录，episodic）**：跨 session 的主干记忆。把每次 session 的“决策、假设、预测、证据、证据缺口、行动计划”固化为不可变工件（append-only）。这更接近 event sourcing 的“事件序列是权威记录”、ADR 的“append-only decision log、accepted 后不可改”，而不是“可被覆盖更新的个人档案”。citeturn8view3turn8view4turn8view5  
- **Prediction–Outcome Ledger（预测-结果账本，calibration memory）**：把预测当作一等对象并能回收结果，用于比较 prior prediction vs actual outcome，并生成校准指标。其统计层面的工具来自严格适当评分规则与 Brier score 系列。citeturn21view0turn20view1  
- **Lessons Library（教训库，semantic）**：跨事件复用的“规则/原则”层知识。它不是“经历全文的向量库”，而是少量结构化 lesson card，带适用范围与触发条件，避免“到处都适用”的空泛总结。该库的组织学习逻辑对应 postmortem / AAR 的“把改进动作固化并传播”。citeturn8view6turn15view0turn14view2  
- **Procedural Memory（流程记忆）**：RT 的模板、rubric、校准评分规则、复盘流程本身。它应被版本化（因为流程会变），并且更新频率应远低于“每轮对话都写”。citeturn12view0turn8view5  
- **Traceability/Provenance（可追溯记忆）**：不是“更多内容”，而是“更强链接”。用 PROV 的 entity-activity-agent 结构把“证据—分析活动—决策工件—预测—结果—复盘”连成链，并允许对 provenance 本身再追溯（bundle）。citeturn8view7turn32view0  

对 RT 来说，“episodic memory”最小化的关键不是少存点，而是**只把决策工作流需要的那部分经历结构化固化**；“reflection memory”最小化的关键不是不停反思，而是**把反思压缩成可执行的规则更新**，并与预测/结果强绑定。citeturn9view0turn10view0turn15view1

## Follow-up Continuity Model

本节直接回答问题 1，并给出 RT 的 follow-up continuity 最小模型。

**问题 1：follow-up session 最应该继承什么？最不该继承什么？**

### 最应该继承的内容

RT 的 follow-up session 继承内容应当以“能复现当时决策状态、能执行后续验证与纠偏”为准绳，而不是“尽可能多的历史”。结合 ADR 的最低三要素（context/decision/consequences）以及 AAR 的对照式议程（本应发生/实际发生/如何改进），follow-up 最应该继承以下信息包：citeturn8view5turn15view1

1) **摘要（Summary）**：一段极短（例如 5~10 句）的“发生了什么+我们要解决什么”。其作用是重建 shared context，而不是替代全文。长上下文会让模型与人都被“过期细节”分心，因此摘要应当是强制压缩而不是可选项。citeturn12view0turn13view0  

2) **结论（Decision / Conclusion）**：当时做了什么决定、选择了哪个方案、决定状态（proposed/accepted/superseded 类似 ADR lifecycle）、以及“如果后续推翻，必须通过新记录 supersede 而非改写旧记录”的规则。citeturn8view5turn8view4  

3) **假设（Assumptions）**：当时依赖的关键假设清单，尤其是高不确定、易翻转的假设；这部分是避免 hindsight bias 的底座，因为它把“当时我们以为世界是怎样的”固定下来。citeturn24view0turn24view1  

4) **预测（Predictions）与成功指标（Success Metrics）**：每条预测都要带时间界限、度量口径与概率（或区间），以服务“prior prediction vs actual outcome”与后续校准评分；这与严格适当评分规则“激励诚实报告信念”的逻辑一致：你必须先把信念写下来，才能谈校准。citeturn21view0turn20view1  

5) **证据已知+证据缺口（Evidence Used + Evidence Gaps）**：已经用过哪些证据（链接/数据快照/分析产物 ID），以及还缺什么才能验证/推翻假设。证据缺口必须被显式继承，否则 follow-up 会退化成“讨论旧结论”。Wason 的实验表明人们天然偏向确认性测试，因此系统层面应强制把“反证与缺口”作为一等内容。citeturn26view0  

6) **后续动作与检查点（Actions + Checkpoints）**：谁在何时产出什么证据/数据、何时评估预测、下一次 follow-up 的触发条件。这对应 postmortem 的“follow-up actions”与 AAR 的“下次怎么做到标准”。citeturn8view6turn15view1  

### 最不该继承的内容

最不该继承的是任何会把系统推向“开放式长期记忆、人格档案、全量经历回放”的内容，这些内容会引入成本、隐私与偏见复制，并且不直接服务决策闭环：

- **全量对话记录作为默认上下文**：长 history 不仅有 token 成本，还会让模型“被陈旧/离题内容分心”，并降低响应质量。全量记录最多作为“冷存档/审计用”，不应默认进入 follow-up 上下文。citeturn12view0turn13view0  
- **无结构的“感受/评语/立场”沉淀**：如果它们不能被还原成假设、预测或可执行规则，就会变成偏见的固定化载体，并在 follow-up 中被机械复用。hindsight bias 的研究提醒：人会在结果出现后自动重写“当时的可预测性”，因此系统不应鼓励随意回写主观叙事。citeturn24view0turn24view1  
- **跨决策的泛化用户画像（profile）**：对 RT（决策系统）而言，跨 session 的关键不是“用户是谁”，而是“这次决策的假设-证据-预测-结果是什么”。把用户画像做大，会把 RT 变成开放式个人记忆系统。citeturn12view0turn9view0  

### 必答：follow-up 应带“摘要、结论、假设、证据缺口”中的哪些？

结论是：**四者都应带，但粒度不同**——摘要要短、结论要不可变可 supersede、假设要可校验、证据缺口要可执行。其原因分别来自：长上下文风险（摘要要强压缩）、append-only 决策史（结论不可改写）、避免 hindsight bias（假设要固化）、对抗确认偏差（证据缺口要显式并包含反证计划）。citeturn12view0turn8view5turn24view0turn26view0  

## Lessons Learned Schema

本节回答问题 2，并给出“session-end reflection artifact”的建议 schema。

### 问题 2：lessons learned 的最小 schema 应该是什么？

从 “AAR/postmortem/lessons learned system 的经验”看，lesson 之所以常失败，不是因为没有存档，而是因为**太费时、缺少系统性传播、难以与后续流程集成**。citeturn14view2turn8view6 因此 RT 的 lesson schema 必须满足两个硬约束：

- **能直接挂到某个预测与结果上**（否则无法比较 prior vs actual，且容易事后合理化）。citeturn24view0turn20view1  
- **能触发下一次决策中的具体行为改变**（检查项、阈值、需要补的证据、需要升级的验证强度）。citeturn8view6turn15view1turn26view0  

一个 RT 适用的“最小 lessons learned card”可以如下（字段尽量少，但每个字段都有明确用途）：

- `lesson_id`：唯一 ID  
- `source_decision_id` / `source_session_ids`：来源决策/会话链接  
- `trigger_context`：触发情境（在什么条件下出现问题/成功）  
- `prior_assumptions`：当时关键假设（只列影响最大的 1~3 条）  
- `prior_predictions`：当时预测（引用 prediction_id，避免复写）  
- `observed_outcome`：实际结果（引用 outcome_id）  
- `delta_analysis`：偏差解释（为何对/为何错；信息缺口/模型偏差/执行偏差/外部变化）  
- `actionable_update`：可执行更新（流程检查项/实验设计/阈值/监控/决策门槛）  
- `applicability_scope`：适用边界（哪些情况下适用、哪些明确不适用）  
- `confidence`：对该 lesson 的置信度（可粗粒度：low/med/high）  
- `evidence_refs`：证据引用（数据快照 ID/文档链接/实验结果 ID）  

这张卡片的结构是把 postmortem 的“影响—根因—后续动作”和 AAR 的“下次怎么做”压缩到可复用最小集，同时把 GAO 所指出的“缺少系统性通知与集成”问题转化为“lesson 必须可检索且直接嵌入决策流程”的产品约束。citeturn8view6turn15view1turn14view2

### 额外要求：session-end reflection artifact 的建议 schema

RT 的 session-end reflection artifact 建议分两层：**不可变的决策记录（Decision Episode Record）** + **面向 follow-up 的压缩视图（Follow-up Brief）**。不可变记录用于审计与比较；压缩视图用于下一次 session 的默认上下文（可随新信息生成新版本，但旧版本不覆盖）。这与 event sourcing 的“事件不可变 + 物化视图可重建”以及 ADR 的“accepted immutable / supersede”一致。citeturn8view3turn8view5  

下面给出一个“够用且可落库”的建议 schema（示意，非强制；字段可裁剪）：

```json
{
  "artifact_type": "rt_session_end_reflection",
  "decision_id": "D-2026-000123",
  "session_id": "S-2026-03-18-01",
  "status": "accepted",
  "summary": {
    "problem": "要解决什么决策问题（一句话）",
    "decision": "我们决定做什么（不可变表述）",
    "why": "最关键的 3 条理由/权衡（面向 why，不写 how）"
  },
  "context": {
    "constraints": ["硬约束/边界条件"],
    "options_considered": ["A", "B", "C"],
    "non_goals": ["明确不做什么"]
  },
  "assumptions": [
    {"assumption": "关键假设 1", "risk": "high", "how_to_falsify": "需要的反证/观测"},
    {"assumption": "关键假设 2", "risk": "med", "how_to_falsify": "需要的反证/观测"}
  ],
  "predictions": [
    {"prediction_id": "P-1", "statement": "可观测事件定义", "probability": 0.7, "due_date": "2026-06-30", "metric": "指标口径/数据源"},
    {"prediction_id": "P-2", "statement": "可观测事件定义", "probability": 0.3, "due_date": "2026-04-30", "metric": "指标口径/数据源"}
  ],
  "evidence": {
    "used": [{"ref": "E-1", "type": "doc|data|analysis", "notes": "一句话说明"}],
    "gaps": [{"gap": "缺什么证据", "owner": "谁补", "eta": "何时", "acceptance_criteria": "满足什么算补齐"}]
  },
  "follow_up_plan": {
    "checkpoints": [{"date": "2026-04-15", "purpose": "看 P-2 / 补 E-gap"}],
    "actions": [{"owner": "负责人", "action": "下一步动作", "due_date": "2026-04-10"}]
  },
  "provenance": {
    "generated_by": "rt_reflection_pipeline_v1",
    "inputs": ["transcript_id", "attachments_ids"],
    "schema_version": "1.0"
  }
}
```

这个 schema 的设计重点是：把“反思”限制为**决策+假设+预测+证据缺口+行动计划**，并显式支持后续校准与复盘，而不是把它做成无上限的叙事记忆。其“why-not-how”“accepted immutable / supersede”的原则直接来自 ADR；其“以对照改进为议程”的原则来自 AAR；其“必须产出后续动作”的原则来自 postmortem。citeturn8view5turn15view1turn8view6  

## Calibration Traceability Implications

本节回答问题 3，并说明“retrospective / calibration / follow-up”三者如何互相连接，以及为何这能在不引入重型记忆的情况下达成追溯。

### 问题 3：retrospective / calibration / follow-up 三者应如何互相连接？

一个对 RT 最小且强约束的连接方式是建立 **Decision Graph（决策图）**，其中节点与边都尽量少但语义清晰：

- 节点：`Decision`、`Prediction`、`Outcome`、`Lesson`、`Evidence`  
- 关键边：  
  - Decision `hasPrediction` Prediction  
  - Prediction `evaluatedBy` Outcome  
  - Lesson `derivedFrom` (Prediction, Outcome, Evidence)  
  - Follow-up session `continues` Decision（或 supersedes 关系）  

此连接方式本质上是在应用 event sourcing 的“状态来自事件序列 + 视图可重建”以及 ADR 的“新洞见用新记录 supersede 旧记录”，让 follow-up 不需要“把旧对话全部带上”，只要加载该决策图的一个 materialized view 即可。citeturn8view3turn8view5

### Calibration 的最小闭环

在量化层面，calibration traceability 需要两类最小对象：

- **Prediction（预测）**：可观测事件定义 + 概率/区间 + 截止日期 + 度量口径  
- **Outcome（结果）**：事件是否发生/数值是多少 + 观测窗口 + 数据来源  

有了这两类对象，就可以用严格适当评分规则体系为“预测质量”产生可累计的数值反馈。严格适当性的意义在于：它在期望意义下奖励真实信念、惩罚策略性虚报，从机制上支撑“校准不是主观自评而是客观对照”。citeturn21view0turn21view1

进一步，在诊断层面，Brier score 及其分解（reliability/resolution/uncertainty 等）提供了“错在过度自信？错在分辨率不足？还是基准率变化？”的分析入口，可将复盘从故事化叙述拉回到可操作的改进方向。citeturn20view1

### Traceability 的最小闭环

可追溯（traceability）并不要求存更多文本，而要求更清晰的 provenance 结构。PROV-DM 的 entity/activity/agent 关系能够表达：某条 Prediction（entity）是由某次 session 决策活动（activity）生成、由哪些 Evidence（entities）使用（used）、由哪些负责人（agents）承担责任，并且复盘产物（Lesson entity）是从 Prediction 与 Outcome 派生（derivation）。PROV 的 bundle 机制还可用于保存“关于追溯本身的追溯”，满足审计式回看。citeturn8view7turn32view0

### 为什么不需要“重型长期记忆”也能做到？

因为你要追溯的对象是**决策闭环**而非**开放世界知识**。当 Prediction/Outcome/Lesson 都变成显式对象并且被链接时，follow-up 只需要检索“与当前 decision_id 直接相连的对象”就能完成 continuity；而 retrospective 只需要在 outcome 到期时生成一次 lesson；calibration 只需要在 ledger 上持续累计评分即可。此模式的核心是“**结构化对象 + 显式链接**”，而不是“向量库里搜回一堆旧话”。citeturn8view3turn8view7turn21view0

## Recommended Minimum Design for RT

本节给出 RT 适用的最小 memory architecture，并明确回答问题 4、5、6，同时列出 Anti-Patterns 与 Open Questions。

### RT 适用的最小 memory architecture

推荐的最小架构可以用 5 个存储与 2 条生成管线概括：

**存储（stores）**

1) **Decision Event Store（必选）**：append-only。写入：session 结束时生成的 Decision Episode Record（以及 supersede 关系）。实现可用“事件序列 + 物化视图”的模式，事件不可变。citeturn8view3turn8view4turn8view5  
2) **Prediction–Outcome Ledger（必选）**：Prediction 与 Outcome 作为一等对象，支持到期评估与打分。citeturn21view0turn20view1  
3) **Lessons Library（必选）**：小而精的 lesson cards；每张卡必须链接到 prediction/outcome，并带适用范围与动作更新。通过检索（结构化过滤优先）在新决策开始时推荐相关 lessons。citeturn8view6turn14view2  
4) **Evidence Registry（建议）**：只存 evidence 的引用与快照元数据（hash、时间窗、来源），不默认把全文塞进上下文。通过 provenance 关联决策与预测。citeturn8view7turn32view0  
5) **Cold Archive（可选）**：原始对话 transcript 与附件。默认不参与检索，仅用于审计/争议解决；避免长上下文导致分心与成本膨胀。citeturn12view0turn13view0  

**生成（pipelines）**

A) **Session-End Reflection Pipeline（必选）**：在 session 结束后（后台）生成 reflection artifact 与 follow-up brief。理由：hot path 写记忆会增加延迟、引入“边聊边写”的质量波动与复杂度；后台写入更符合“把记忆形成与主任务解耦”的工程权衡。citeturn12view0turn15view0  

B) **Outcome Due Calibration + Retrospective Pipeline（必选）**：当预测到期或关键指标更新时，生成 outcome、更新 scoring、并触发 lesson 生成（或半自动草稿等待确认）。其形式与 postmortem/AAR 的“事件后回顾”一致。citeturn8view6turn15view1turn20view1  

### 问题 4：哪些 memory 写入应该在 session 结束时生成，而不是运行中持续生成？

建议“结束时生成”的写入包括：

- **Decision Episode Record / Follow-up Brief**：需要整场信息汇总与权衡收敛，运行中生成容易噪声大且被中途观点牵引；同时热路径写入会增加系统复杂度与延迟。citeturn12view0turn8view5  
- **预测清单（Prediction list）**：预测必须在会末“冻结”，否则容易被后续讨论悄悄改写，削弱可比性并放大 hindsight bias。citeturn24view0turn21view0  
- **证据缺口与反证计划（Evidence gaps / falsification plan）**：会中产生的缺口常随讨论演化，收敛后再落库更能形成可执行任务；且能对抗人类只找确认性证据的倾向。citeturn26view0turn15view1  
- **“程序性更新”（Procedural update）的候选项**：如果要更新决策 rubric 或模板，应该作为会后草案进入 review，而不是运行中自动改系统提示/规则，避免把短期情绪写进流程。citeturn12view0turn8view5  

运行中持续生成的内容，最多限于**临时工作状态**（例如议程进度、待讨论问题列表），并且默认只存在 session working context，不进入长期存储。citeturn12view0  

### 问题 5：对 RT 来说，什么是“够用的 memory”，什么是明显过度设计？

**够用的 memory（满足需求且低复杂度）**

- 每个决策 1 份不可变 Decision Episode Record（结构化）+ 1 份更短 Follow-up Brief（面向续会）  
- 每个决策 1~N 条预测（概率/区间 + 截止 + 指标口径）+ 到期 outcome  
- 每个决策 0~M 条 lesson cards（只沉淀“可执行规则更新”）  
- 检索策略以**显式链接（decision_id）+ 结构化过滤（标签/适用范围）**为主，必要时才做语义检索；避免让“记忆检索”成为主系统复杂度来源。citeturn8view3turn8view5turn14view2  

**明显过度设计（会把 RT 推向 open-ended autonomous memory architecture）**

- **让 agent 自主决定在对话中持续写入长期记忆，并在跨 session 任意检索**：这正是 MemGPT/Generative Agents 所服务的“长期交互代理”方向，会引入大量 memory 管理、删除/冲突解决与检索可靠性问题，不符合“每次 session 是一次重要决策”的产品边界。citeturn8view0turn9view0turn12view0  
- **存储“完整经历记录 + 自动反思层级不断增长”**：Generative Agents 的“complete record + higher-level reflections”对模拟人类行为有效，但对 RT 会导致反思泛化与偏见固化，且维护成本迅速上升。citeturn9view0turn14view2  
- **多层级、分页式虚拟记忆（paging/interrupt）作为默认机制**：MemGPT 的 memory tiers + interrupt 控制流是为“无限上下文幻觉”而设计；RT 的连续性目标更窄，用 append-only 决策工件即可，不需要让 LLM 学会做“操作系统式内存管理”。citeturn8view0turn8view3  
- **把历史对话摘要当作“可不断覆盖更新的统一 profile”**：这会造成“历史被重写”，与 ADR 的 immutable/supersede 原则冲突，且削弱校准对比。citeturn8view5turn24view0  

### 问题 6：如何让 memory 帮助下一次决策，而不是把旧偏见机械复制过去？

可以从机制上做 6 个硬约束（不是软提示）：

1) **不可变过去（immutable past）**：预测与假设在 session 结束时冻结；后续只能通过新记录 supersede，而不能回写旧记录。这对应 ADR 的 accepted immutable 规则，也避免 hindsight bias 的“重写当时信念”。citeturn8view5turn24view0  

2) **强制差异解释（delta-first follow-up）**：follow-up UI/提示词的第一屏不是“旧结论”，而是“自上次以来哪些证据变了/哪些假设被证实或被推翻/哪些预测到期”。这等价于把旧决策当作可检验对象，而不是新决策的先验指令。citeturn15view1turn26view0  

3) **证据缺口一等化（evidence gaps as first-class）**：每次续会必须回答“缺口是否补齐、若未补齐为何还能推进、下一步怎么获得反证”。这直接对抗只找确认性证据的倾向。citeturn26view0  

4) **用校准分数替代“讲得通”**：把预测评分（proper scoring rules / Brier family）纳入复盘与个人/团队视图；否则系统会奖励叙事能力而不是判断精度。citeturn21view0turn20view1  

5) **blameless & systems-first 的复盘模板**：把复盘焦点放在信息、流程与系统性原因，而不是“谁错了”；否则人会趋向隐藏失败，导致 lessons 不被提交与传播（GAO 也观察到分享失败的顾虑与时间成本）。citeturn8view6turn14view2  

6) **将 lesson 表述为“条件化规则”而非“价值判断”**：lesson 必须带适用范围与反例边界；这与 Model Cards / Datasheets 的“明确 intended use、披露限制与上下文”思想同构：通过结构化披露边界来减少误用与过度泛化。citeturn31view0turn30view0  

### Anti-Patterns

以下模式明确不建议借鉴（会显著推高复杂度并偏离 RT 目标）：

- **开放式 autobiographical memory**：把 session 作为“人生经历”持续积累并跨任务自由检索（Generative Agents 风格的 complete record + reflection 增长）。citeturn9view0  
- **LLM 自主管理多层记忆分页与中断控制流**：为“无限上下文”而生，对 RT 的决策闭环属于重炮打蚊子（MemGPT 风格）。citeturn8view0  
- **持续在线写入、持续在线反思、持续在线重写系统规则/提示词**：把偶发噪声固化为长期偏见，并引入不可控漂移。citeturn12view0turn24view1  
- **把历史摘要当“真相”，允许覆盖更新**：导致 revisionist history，损害 prior vs actual 对比与责任归因；与 ADR 的 supersede 模式相冲突。citeturn8view5turn24view0  
- **默认用语义检索在全量 transcript 里“找相关历史”**：会把 continuity 变成“召回一堆旧话”，极易引入陈旧信息干扰；与“长上下文会分心”的经验相冲突。citeturn12view0turn13view0  

### Open Questions

- **预测粒度与数量上限**：每次决策应允许多少条预测？过多会变成形式主义，过少又无法校准与复盘。评分规则与组织激励如何设计以避免“只预测容易命中的事”？citeturn21view0turn20view1  
- **Outcome 的归因标准**：当结果受外部环境变化影响时，如何在 schema 中区分“决策错”“执行错”“环境变了”，并保证可比性？（event sourcing 很擅长保留事件，但对归因仍需产品规则。）citeturn8view3turn15view1  
- **lesson 的治理（谁审、如何合并、如何废弃）**：GAO 的调查显示“费时、缺乏系统性通知”会导致低提交率；RT 需要最小治理流程，避免教训库膨胀成第二个知识库。citeturn14view2turn14view1  
- **provenance 的实现边界**：PROV 能表达复杂追溯，但 RT “最小可行”应实现到什么程度（仅关键实体与关系，还是全链路活动）才能平衡成本与收益？citeturn8view7turn32view0  

## Source List

- MemGPT: Towards LLMs as Operating Systems（arXiv）citeturn8view0  
- Generative Agents: Interactive Simulacra of Human Behavior（arXiv）citeturn9view0  
- Reflexion: Language Agents with Verbal Reinforcement Learning（arXiv）citeturn10view0  
- ReAct: Synergizing Reasoning and Acting in Language Models（arXiv）citeturn11view0  
- Event Sourcing pattern（Microsoft Learn）citeturn8view3  
- Maintain an architecture decision record (ADR)（Microsoft Learn）citeturn8view4  
- ADR process（AWS Prescriptive Guidance）citeturn8view5  
- Blameless Postmortem for System Resilience（Google SRE book）citeturn8view6  
- After Action Reviews, Appendix K（FM 7-0, U.S. Army）citeturn15view0turn15view1  
- Survey of NASA’s Lessons Learned Process（GAO-01-1015R）citeturn14view2  
- NASA Lessons Learned（NASA 官方页面）citeturn14view1  
- PROV-DM: The PROV Data Model（W3C Recommendation）citeturn8view7  
- The PROV-JSON Serialization（W3C Member Submission）citeturn32view0  
- Memory overview（LangChain 官方文档）citeturn12view0  
- Chat Summary Memory Buffer（LlamaIndex 官方文档）citeturn13view0  
- Strictly Proper Scoring Rules, Prediction, and Estimation（Gneiting & Raftery, JASA 2007）citeturn21view0turn21view1  
- Notes and Correspondence: Two Extra Components in the Brier Score Decomposition（Stephenson et al., 2008）citeturn20view1  
- On Calibration of Modern Neural Networks（Guo et al., 2017）citeturn22view0  
- Hindsight ≠ Foresight: The Effect of Outcome Knowledge on Judgment under Uncertainty（Fischhoff, 1975）citeturn24view0turn24view1  
- On the Failure to Eliminate Hypotheses in a Conceptual Task（Wason, 1960）citeturn26view0  
- Judgment under Uncertainty: Heuristics and Biases（Tversky & Kahneman, 1974）citeturn28view0  
- Model Cards for Model Reporting（arXiv）citeturn31view0  
- Datasheets for Datasets（Microsoft Research PDF）citeturn30view0