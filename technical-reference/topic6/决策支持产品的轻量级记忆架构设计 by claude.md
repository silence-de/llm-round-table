# 决策支持产品的轻量级记忆架构设计

Round Table（RT）的核心产品挑战在于：**如何在不引入重量级自主记忆系统的前提下，实现跨会话的跟踪连续性、经验教训积累与校准可追溯性。** 经过对 MemGPT、Generative Agents、LangMem、Anthropic 上下文工程、CoALA 认知架构、AAR/AI 事后复盘以及 Tetlock 超级预测方法论等一手学术文献与技术报告的系统研究，本报告给出的核心结论是：RT 所需的并非一个"记忆系统"，而是一套**会话边界结构化写入 + 最小化持久化存储 + 定向检索注入**的轻量架构。理想状态下，RT 的记忆总量应控制在 **50-100 条结构化记录**以内，每条记录由会话结束时的反思机制生成，而非运行时连续写入。这一设计既足以支撑跟踪会话（follow-up session）对先前预测的回溯评估，又能避免无界记忆带来的上下文污染、偏差放大与工程过度投入。

---

## 经过验证的核心发现

**发现一：会话结束时的批量写入远优于运行时连续写入。** Park et al.（2023）在 Generative Agents 中采用了连续写入的 Memory Stream，每个时间步都向记忆流中添加观察记录，模拟 25 个智能体两天的运行耗费了数千美元的 token 成本。其消融实验显示，反思（reflection）模块对最终表现的边际贡献（μ=29.89 vs μ=26.88）远低于基础观察记忆的贡献，这意味着**精心设计的少量反思记录比海量原始观察更有价值**。Packer et al.（2023）的 MemGPT 则要求 LLM 在每次推理时都承担记忆管理职责——判断什么该存入 archival storage、什么该保留在 working context——这种"热路径"记忆推理被多个生产系统明确标记为反模式。相比之下，LangChain 团队在 Agent Builder 的生产实践中记录到：**在会话结束时显式提示智能体进行记忆反思和整理，比运行时连续管理更可靠、更经济**。OpenAI 的上下文个性化文档同样推荐"两阶段记忆处理"：会话中轻量笔记（note-taking），会话边界时合并去重与冲突消解（consolidation）。

**发现二：有界记忆在准确性和稳定性上优于无界记忆。** Bousetouane（2026）在 Agent Cognitive Compressor（ACC）论文中给出了迄今最有力的实证：在 IT 运维、网络安全和医疗工作流中，采用有界压缩认知状态（CCS）的智能体在幻觉率和行为漂移方面显著优于采用完整上下文回放和基于检索的智能体。ACC 的核心原则是"**只携带经过验证的实体、已作出的承诺和下一步最优行动——其余一律不带**"。Kang et al.（2025）的 ACON 上下文压缩方法将峰值 token 使用量减少了 **26-54%**，同时保持了 95% 以上的任务准确率。这些发现直接支持 RT 采用有界设计。

**发现三：校准追踪所需的最小数据结构已有成熟范式。** Tetlock 的超级预测方法论规定每条预测必须包含四个要素：明确的是/否陈述、具体截止日期、概率估计（0-100%）、修订历史。Brier 分数（BrS = Σ(pₜ - xₜ)²/N）可分解为校准度（calibration）、分辨力（resolution）和不确定性（uncertainty）三个正交维度。Dodge et al.（2021）在 AAR/AI 中将事后复盘结构化为四个标准问题：预期发生什么、实际发生什么、为何存在差异、可以学到什么。这套框架直接可映射到 RT 的跟踪会话结构。

**发现四：LLM 存在系统性过度自信问题，这使得校准追踪成为刚需而非可选功能。** KalshiBench（2024）的实验表明，所有前沿 LLM 在表达 90% 以上信心时实际错误率高达 **20-30%**。更令人警惕的是，链式推理（chain-of-thought）等推理增强手段反而**恶化了校准性能**——它们倾向于强化初始假设而非真正基于证据更新。ForecastBench（Karger et al., ICLR 2025）的基准测试显示，最佳 LLM 的 Brier 分数约为 0.101，而超级预测者为 0.081，LLM 仍未达到专家人类水平。

---

## RT 所需的记忆类型

RT 并不需要认知科学中完整的记忆分类体系。基于 CoALA 框架（Sumers et al., 2023）和 ACC 的有界设计原则，RT 应仅保留**三种记忆类型**，且每种都需严格定义边界。

**第一类：会话工作状态（Session Working State）。** 这对应 CoALA 的"工作记忆"和 MemGPT 的"core memory block"概念，但在 RT 中应进一步简化。它是当前会话的活跃上下文，包含决策问题定义、当前约束条件、参与者角色与立场、以及从持久存储中检索注入的相关历史。此记忆仅存在于会话期间，**会话结束即销毁**，其有价值的内容由会话结束反思机制提取到持久存储中。关键设计原则来自 Anthropic 的上下文工程指南：采用"即时加载"（just-in-time context）而非"预加载所有"——在会话开始时仅注入与当前决策直接相关的少量历史记录，而非整个记忆库。

**第二类：决策档案（Decision Archive）。** 这是 RT 唯一的持久化存储，对应 Generative Agents 中反思记录的简化版本。每条记录由会话结束时的结构化反思生成，包含决策摘要、关键结论、核心假设、预测与置信度、证据缺口以及待验证事项。这些记录采用结构化格式（JSON schema），**数量有界**（建议上限 100 条，超出后按重要性评分淘汰最低项）。重要性评分借鉴 Generative Agents 的 1-10 分机制，但简化为三档：高（战略性决策）、中（战术性决策）、低（例行性决策）。

**第三类：校准日志（Calibration Log）。** 这是专门用于追踪预测准确性的结构化记录，独立于决策档案存在。每当跟踪会话完成"预测 vs. 实际结果"的比对后，生成一条校准记录，包含原始预测、实际结果、Brier 分数以及偏差分析。校准日志的价值在于支撑**跨决策的模式识别**——例如发现"在供应链相关决策中系统性高估了恢复速度"这类洞察。

RT **不需要**的记忆类型包括：程序性记忆（procedural memory，RT 不需要学习新技能）、连续性对话记忆（recall memory，RT 不是聊天机器人）、以及无界的语义知识库（semantic memory，RT 不做通用知识管理）。

---

## 跟踪会话连续性模型

### 跟踪会话应该继承什么

这是本研究需要明确回答的核心问题。基于 Tetlock 的反锚定策略、AAR/AI 的结构化复盘方法、以及 ACC 的有界状态原则，**跟踪会话应该继承以下四类内容，但每类都有严格的继承规则：**

**摘要（Summary）：必须继承，但仅限结构化摘要。** 跟踪会话需要知道"上次讨论了什么问题"和"做出了什么决策"，但不需要上次会话的完整对话记录。结构化摘要（而非叙事性总结）可以有效防止上下文污染。OpenAI 的生产实践表明，摘要实际上充当了"无尘室"（clean room），可以纠正或省略先前会话中的错误推理。

**结论与预测（Conclusions & Predictions）：必须继承，这是跟踪的核心对象。** 跟踪会话的首要目的就是比对"先前预测 vs. 实际结果"。每条结论和预测必须保留其原始置信度和关键假设，以支持 Brier 分数计算和校准分析。Tetlock 的方法论特别强调：**原始预测记录必须包含时间戳且不可修改**，这是防止事后叙事偏差（hindsight bias）的唯一可靠手段。

**核心假设（Key Assumptions）：必须继承，但标注为"待验证"而非"已确认"。** 假设是连接预测与结果之间因果链的关键环节。跟踪会话需要评估"哪些假设被证实、哪些被证伪、哪些仍不确定"。继承假设时应显式标注其验证状态（未验证/已证实/已证伪/部分成立），避免将未经验证的假设隐式转化为"已知事实"。

**证据缺口（Evidence Gaps）：必须继承，这是驱动后续信息收集的关键输入。** 上次会话中识别出的"我们不知道什么"对跟踪会话同样重要——它指向了需要在两次会话之间补充调研的方向。

### 跟踪会话不应继承什么

**原始对话记录：绝不继承。** 完整的讨论过程包含大量探索性发言、被否决的方案和无结论的讨论分支，这些内容在跟踪会话中只会造成上下文污染和注意力分散。ACC 论文明确证实：完整上下文回放导致更高的幻觉率和行为漂移。

**被否决的替代方案的详细论证：不继承。** 仅在决策摘要中保留"考虑过但未采纳的方案"的简要列表即可。详细的否决理由属于会话内部推理过程，不应进入持久化存储。

**参与者的临时性观点和情绪表达：不继承。** 这类内容是 Generative Agents 论文中记录的"记忆驱动人格漂移"问题的直接来源。Isabella 的兴趣被其他智能体的建议逐渐重塑，正是因为系统连续存储了所有社交互动。RT 必须避免这一陷阱。

**运行时产生的中间推理步骤：不继承。** LLM 的思维链（chain-of-thought）输出属于推理过程的副产品，不是决策记录的组成部分。

---

## 经验教训最小可行 Schema

经验教训（Lessons Learned）是 RT 记忆架构中最具长期价值的组件，但也是最容易过度设计的部分。基于 Generative Agents 的反思机制、AAR/AI 的四步框架和 CoALA 的"记忆写入是刻意行为"原则，以下是 RT 经验教训的最小可行 Schema：

```json
{
  "lesson_id": "LL-2026-0042",
  "created_at": "2026-03-15T16:30:00Z",
  "source_session_id": "RT-2026-0315",
  "source_type": "follow_up_review",

  "lesson_statement": "在涉及多方供应商的交付时间线评估中，RT 系统性地低估了协调延迟，平均偏差为 +2.3 周",

  "evidence_basis": {
    "supporting_sessions": ["RT-2026-0112", "RT-2026-0203", "RT-2026-0315"],
    "pattern_count": 3,
    "confidence": "medium"
  },

  "context_tags": ["supply_chain", "timeline_estimation", "multi_vendor"],

  "applicability_conditions": "当决策涉及 3 个以上外部供应商的协调交付时适用",

  "recommended_adjustment": "在多供应商场景下，对交付时间线估计自动添加 30% 缓冲",

  "expiry_policy": {
    "review_after_sessions": 10,
    "auto_flag_if_contradicted": true
  },

  "importance": "high",
  "status": "active"
}
```

这个 Schema 的设计遵循了几个关键原则。**教训必须是可操作的陈述（actionable statement），而非泛泛的观察。** Generative Agents 的反思机制生成的是"Klaus Mueller 致力于他的城市化研究"这类概括性陈述，但对于决策支持而言，教训需要精确到"在什么条件下、观察到什么偏差、建议什么调整"。**教训必须有证据基础和置信度标注。** 单次观察不应提升为全局教训——OpenAI 的记忆个性化文档明确要求区分"这一次"（this time）和"从现在开始"（from now on）。只有在**多次会话中观察到一致模式**后，才应将观察提升为经验教训。Schema 中的 `pattern_count` 字段正是为此设计。**教训必须有过期策略。** 认知科学中的"经验过度拟合"（experience overfitting）——过度依赖过去经验导致无法适应新情况——是记忆系统的根本性风险。Schema 中的 `expiry_policy` 通过设定复审周期和矛盾自动标记来对抗这一风险。

经验教训的**生成时机**应严格限定为两种场景：一是跟踪会话完成预测 vs. 结果比对后，二是校准日志积累到足够样本量（建议 ≥3 条同类记录）后触发的模式识别。**绝不应在常规决策会话的运行时生成经验教训**——这违反了"热路径不做记忆推理"的原则。

---

## 校准可追溯性的设计含义

校准追踪是 RT 区别于一般 AI 对话系统的核心差异化能力。Tetlock 在超级预测研究中证明，**系统性地跟踪预测准确性是提升决策质量的最有效手段之一**——Good Judgment Project 中，仅约 1 小时的去偏差训练就将预测准确率提升了约 14%，而这种训练的基础就是校准数据。

RT 的校准追踪应建立在 Brier 分数框架之上，但需要针对决策支持场景做必要的适配。预测市场和预测锦标赛处理的是明确的二元问题（"X 事件是否会在 Y 日期前发生？"），而 RT 的决策往往涉及多维度评估和非二元结果。因此，RT 应支持两种校准模式：**二元预测校准**（适用于可以明确判定为"发生/未发生"的预测）和**区间预测校准**（适用于数值估计，如"项目完成时间"或"市场份额变化幅度"）。

校准追踪与跟踪会话和经验教训之间的连接关系应如下设计。跟踪会话是校准数据的**唯一生成入口**——只有在跟踪会话中完成了"预测 vs. 实际结果"的显式比对后，才写入一条校准记录。校准记录积累后，支撑两种下游消费：一是**个体决策校准曲线**（reliability diagram），按概率区间统计"预测 N% 的事件实际发生了多少比例"，直接暴露系统性过度自信或不足自信的模式；二是**按领域/标签的校准分析**，识别"在哪些类型的决策中校准性能最差"，这些分析结果可触发经验教训的生成。

KalshiBench 和 ForecastBench 的研究结果对 RT 的设计有一个重要启示：**不要假设 LLM 辅助的预测天然具有良好的校准性**。LLM 的系统性过度自信意味着 RT 在呈现 AI 辅助分析时应始终附带历史校准数据作为"可信度调节器"。例如，当 LLM 在某领域的历史校准数据显示其 80% 信心的预测实际准确率仅为 55% 时，RT 应向决策者显式呈现这一偏差。

---

## RT 最小推荐设计

### 架构总览

```
┌──────────────────────────────────────────┐
│           RT 会话运行时上下文               │
│  ┌────────────────────────────────────┐   │
│  │  系统指令（静态，只读）              │   │
│  ├────────────────────────────────────┤   │
│  │  当前决策上下文（会话级）            │   │
│  │  · 决策问题定义                     │   │
│  │  · 参与角色与约束条件               │   │
│  ├────────────────────────────────────┤   │
│  │  检索注入区（会话开始时填充）        │   │
│  │  · 相关历史决策摘要（≤5 条）        │   │
│  │  · 适用的经验教训（≤3 条）          │   │
│  │  · 相关校准上下文（如有）           │   │
│  ├────────────────────────────────────┤   │
│  │  当前会话对话                       │   │
│  └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
              ↕ 会话边界写入 / 会话开始检索
┌──────────────────────────────────────────┐
│        RT 持久化存储（有界，结构化）        │
│                                          │
│  决策档案    ≤100 条结构化记录            │
│  经验教训    ≤30 条活跃教训              │
│  校准日志    按时间窗口滚动（保留最近 1 年）│
└──────────────────────────────────────────┘
```

### 数据流规则

**会话开始时**：系统根据当前决策的主题标签和上下文，从持久化存储中检索最相关的历史决策摘要（按重要性 × 相关性排序，取 top-5）、适用的经验教训（按 `applicability_conditions` 匹配，取 top-3）、以及相关领域的校准统计。这些内容注入到运行时上下文的"检索注入区"。此过程是**确定性的结构化查询**，不依赖 LLM 进行记忆管理决策。

**会话运行时**：不进行任何记忆写入操作。所有 LLM 推理能力集中用于当前决策分析。

**会话结束时**：触发结构化反思流程，生成会话结束反思制品（Session-End Reflection Artifact），写入持久化存储。

### 会话结束反思制品 Schema

```json
{
  "artifact_type": "session_end_reflection",
  "session_id": "RT-2026-0318-A",
  "session_timestamp": "2026-03-18T17:00:00Z",
  "session_type": "initial_decision | follow_up | calibration_review",

  "decision_summary": {
    "problem_statement": "是否应在 Q3 前完成亚太区仓储系统迁移",
    "decision_outcome": "批准迁移，但分两阶段执行",
    "rationale": "成本分析支持迁移，但一次性迁移的运营风险过高",
    "options_considered": [
      "一次性全面迁移",
      "分两阶段迁移",
      "推迟至 Q4"
    ],
    "selected_option": "分两阶段迁移"
  },

  "predictions": [
    {
      "prediction_id": "PRED-2026-0318-01",
      "statement": "第一阶段迁移将在 2026-06-30 前完成",
      "probability": 0.75,
      "key_assumptions": [
        "供应商 A 的硬件交付不延迟",
        "内部 IT 团队可调配 3 名全职工程师"
      ],
      "resolution_criteria": "第一阶段所有节点上线并通过验收测试",
      "scheduled_follow_up": "2026-07-15"
    }
  ],

  "assumptions_register": [
    {
      "assumption": "供应商 A 的硬件交付不延迟",
      "basis": "供应商承诺函 + 历史交付记录",
      "verification_status": "unverified",
      "risk_if_wrong": "项目延期 4-6 周"
    }
  ],

  "evidence_gaps": [
    "尚未获取供应商 B 的兼容性测试报告",
    "亚太区网络延迟基准数据过期（最近一次测量为 2025 年 8 月）"
  ],

  "follow_up_triggers": [
    {
      "trigger_type": "scheduled",
      "date": "2026-07-15",
      "purpose": "比对第一阶段完成预测 vs 实际进展"
    },
    {
      "trigger_type": "conditional",
      "condition": "供应商 A 通知交付延迟",
      "purpose": "重新评估时间线和风险"
    }
  ],

  "importance_score": "high",
  "context_tags": ["infrastructure", "migration", "apac", "supply_chain"]
}
```

这个 Schema 的设计融合了多个来源的最佳实践。`predictions` 数组中的每条预测遵循 Tetlock 的四要素框架（明确陈述、截止日期隐含在 `scheduled_follow_up` 中、概率估计、可追溯到 `assumptions_register`）。`assumptions_register` 借鉴了 AAR/AI 中"分离预期与实际"的原则。`evidence_gaps` 直接服务于跟踪会话的信息补充需求。`follow_up_triggers` 同时支持定期复盘和条件触发复盘两种模式。

---

## 反模式：重量级记忆方案中不推荐的模式

以下模式在学术文献和生产实践中被明确记录为有害或过度投入，RT 应避免采用。

**反模式一：无界记忆增长（Unbounded Memory Growth）。** MemGPT 的 archival storage 被设计为"无限大小"，使用 PostgreSQL + pgvector 存储可能达到百万级条目。对于 RT 这种会话频次有限（每周或每月数次）的决策支持产品，无界存储不仅不必要，而且会导致检索质量随时间退化——向量相似度搜索返回的是"语义相似"的内容，而非"当前相关"或"重要"的内容。多个生产系统（Redis、CrewAI）记录了这一问题。

**反模式二：运行时自主记忆管理（Runtime Self-Directed Memory）。** MemGPT 要求 LLM 在每次推理时都决定什么该存入 core memory、什么该移至 archival storage。这种"热路径记忆推理"消耗了本应用于任务执行的推理能力和延迟预算。LangChain 和 Memory Engineering 文献都将此标记为常见的生产失败模式。RT 的记忆写入应仅发生在会话边界，且由预定义的结构化流程驱动，而非 LLM 自主决策。

**反模式三：递归摘要（Recursive Summarization）。** MemGPT 在上下文溢出时将旧消息递归摘要为摘要的摘要。这种有损压缩过程可能选择性地保留某些类型的信息而丢失其他信息，引入系统性偏差。RT 应直接存储结构化记录，避免依赖叙事性摘要的层层压缩。

**反模式四：连续观察流（Continuous Observation Stream）。** Generative Agents 在每个时间步写入一条观察记录，这是模拟虚拟世界所需的设计。决策支持是离散事件，不是连续流程。RT 只需在决策点和会话边界写入记录。

**反模式五：通过记忆传播偏差（Bias Propagation Through Memory）。** Generative Agents 论文记录了一个具体案例：Isabella 的个人兴趣被其他智能体的记忆化建议逐渐重塑。在决策支持场景中，这意味着早期的错误教训可能通过记忆检索影响所有后续决策。ACC 论文进一步证实：上下文回放会放大噪声和早期猜测。**RT 的对策是：所有经验教训必须有证据计数（pattern_count）和过期策略，单次观察永远不提升为全局教训。**

**反模式六：将 RAG 等同于记忆（Treating RAG as Memory）。** O'Reilly Radar 的多智能体系统研究指出，消息传递不等于共享记忆——多智能体系统在缺乏"发生了什么、什么是真的、做了什么决策"的共享理解时会失败。RT 不需要通用的 RAG 系统，而需要结构化的决策档案。

**反模式七：全套认知科学记忆分类（Full Cognitive Memory Taxonomy）。** CoALA 框架定义了工作记忆 + 情景记忆 + 语义记忆 + 程序性记忆的完整分类。但 CoALA 自身也明确指出"长期记忆模块是可选的——智能体可以仅凭工作记忆完成有界任务"。RT 不需要程序性记忆（不学新技能）、不需要语义记忆（不做知识管理）、不需要连续情景记忆（不记录对话历史），只需要结构化的决策档案和校准日志。

---

## 来自 MemGPT 和 Generative Agents 的部分可借鉴思路 vs. 不可借鉴思路

### 可借鉴并适配到 RT 的思路

来自 Generative Agents 的**重要性评分机制**可以简化后用于决策档案的优先级管理。原始设计是让 LLM 对每条记忆进行 1-10 分评估，RT 可简化为三档（高/中/低），在会话结束反思时由结构化流程自动赋值。**反思生成的两步流程**——先提出高层问题、再基于检索到的记忆提取洞察——可适配为跟踪会话中的校准复盘流程：先对比预测与结果，再提炼模式性教训。**检索函数的三因子加权**（相关性 + 重要性 + 时近性）可用于会话开始时从决策档案中选取最相关的历史记录。

来自 MemGPT 的 **working context block** 概念——一个小型、始终可见、可编辑的关键信息块——直接对应 RT 的会话工作状态。**core_memory_replace** 操作——更新关键事实（如将"男朋友 James"改为"前男朋友 James"）——对应 RT 中假设验证状态的更新。

### 不适用于 RT 的思路

Generative Agents 的**完整反思树**（递归地从反思中生成更高层反思）、**计划模块**（将一天分解为 5-15 分钟的行动块）、**指数衰减的时近性因子**（0.995^游戏小时数）都是为连续世界模拟设计的，与离散决策事件场景无关。MemGPT 的 **FIFO 队列 + 递归摘要**、**心跳函数链**（多步检索的迭代 LLM 调用）、**每个输出都是函数调用的架构**、**A/R Stats 上下文占用**都是为解决"在有限上下文窗口中模拟无限对话"这一特定问题设计的。RT 的会话长度有限、记忆规模有界，这些机制不仅不必要，还会引入不可忽视的工程复杂度和运行成本。

---

## 开放问题

**跨团队校准数据的聚合与隐私边界。** 如果 RT 服务于多个决策团队，不同团队的校准数据是否应该聚合以获得更大的样本量和更可靠的校准曲线？这涉及组织边界、数据隐私和"哪些偏差模式是通用的、哪些是团队特定的"等问题。当前研究未给出明确指导。

**经验教训的最优生命周期。** 本设计建议经验教训在累积一定会话数后自动触发复审（`review_after_sessions`），但最优的复审周期是多少？在快速变化的决策领域（如技术市场），教训可能在 3-6 个月后就过时；在稳定领域（如基础设施规划），教训可能保持数年有效。是否需要按领域设置不同的衰减策略，尚需实证数据。

**非二元预测的 Brier 分数替代方案。** Brier 分数为二元事件设计，而 RT 的许多决策涉及连续值预测（时间线、成本、市场份额等）。连续排名概率评分（CRPS）是一个候选方案，但其计算复杂度和可解释性是否适合 RT 的产品体验仍需评估。

**LLM 辅助的反思质量保障。** 会话结束反思制品由 LLM 从对话中提取生成，但 LLM 的已知幻觉倾向（Generative Agents 中记录的"修饰性幻觉"问题）意味着反思内容可能包含原始对话中不存在的细节。是否需要人工审核每一条反思制品？这在高频使用场景下可能不现实，但在高风险决策中可能是必要的。

**"充分记忆"的定量界定。** 本报告建议 RT 的决策档案上限为 100 条、经验教训上限为 30 条。这些数字基于工程判断（一年 50 次决策会话 × 2 年历史窗口），而非实证验证。ACC 论文证明了有界优于无界，但并未给出特定应用场景的最优边界。RT 应在实际运营中通过 A/B 测试验证这些阈值。

---

## 结论：从"记多少"到"记什么"的范式转换

本研究最核心的发现并非某个具体的 Schema 或架构图，而是一个设计范式的转换：**RT 的记忆问题不是"如何存储和检索大量历史信息"，而是"如何在会话边界精确地提炼出少量高价值结构化记录"**。Generative Agents 用数千美元运行两天模拟的成本结构、MemGPT 的全栈记忆管理复杂度、以及生产系统中反复出现的"记忆越多性能越差"的实证，都指向同一个结论：**对于有界决策工作流，精心设计的会话结束反思制品 + 有界持久化存储 + 会话开始时的定向检索注入，已经构成"充分记忆"**。超出这一范围的任何投入，不仅是过度工程，更可能通过上下文污染、偏差放大和注意力稀释主动损害决策质量。

RT 应当遵循的设计铁律是：**每一条进入持久化存储的记录都必须通过会话结束反思的结构化流程生成；每一条注入到新会话上下文中的历史记录都必须通过确定性的相关性排序选取；经验教训必须有证据基础、适用条件和过期策略；校准追踪必须独立存在并持续积累以支撑跨决策的偏差模式识别。** 这套设计既足以支撑 RT 作为决策支持产品的核心价值主张——跟踪连续性、经验积累和校准改进——又避免了滑入"自主记忆管理"的深渊。

---

## 参考文献

1. Park, J.S., O'Brien, J.C., Cai, C.J., et al. (2023). "Generative Agents: Interactive Simulacra of Human Behavior." *UIST '23, ACM*. arXiv:2304.03442.
2. Packer, C., Wooders, S., Lin, K., et al. (2023). "MemGPT: Towards LLMs as Operating Systems." arXiv:2310.08560.
3. Sumers, T., Yao, S., Narasimhan, K., & Griffiths, T.L. (2023). "Cognitive Architectures for Language Agents." arXiv:2309.02427.
4. Bousetouane, F. (2026). "AI Agents Need Memory Control Over More Context." arXiv:2601.11653.
5. Dodge, J., et al. (2021). "After-Action Review for AI (AAR/AI)." *ACM Transactions on Interactive Intelligent Systems*, 11(3-4), Article 29.
6. Mellers, B., Stone, E., et al. (2015). "Identifying and Cultivating Superforecasters." *Perspectives on Psychological Science*, 10(3), 267-281.
7. Tetlock, P.E. & Gardner, D. (2015). *Superforecasting: The Art and Science of Prediction*. Crown Publishers.
8. Karger, E., Bastani, H., et al. (2025). "ForecastBench: A Dynamic Benchmark of AI Forecasting Capabilities." *ICLR 2025*. arXiv:2409.19839.
9. KalshiBench (2024). "Do Large Language Models Know What They Don't Know?" arXiv:2512.16030.
10. Kang, M., et al. (2025). "ACON: Optimizing Context Compression for Long-horizon LLM Agents." arXiv:2510.00615.
11. MemoBrain (2026). "Executive Memory as an Agentic Brain for Reasoning." arXiv:2601.08079.
12. Focus (2026). "Active Context Compression in LLM Agents." arXiv:2601.07190.
13. DeChant, C. (2025). "Episodic Memory in AI Agents Poses Risks That Should Be Studied and Mitigated." arXiv:2501.11739.
14. Graves, A., et al. (2016). "Hybrid Computing Using a Neural Network with Dynamic External Memory." *Nature*, 538, 471-476 (Differentiable Neural Computer).
15. Anthropic (2025). "Effective Context Engineering for AI Agents." anthropic.com/engineering.
16. Anthropic (2025). "Claude Memory Tool (Beta)." platform.claude.com/docs.
17. LangMem SDK (2025). langchain-ai.github.io/langmem. LangChain.
18. LangChain Blog (2026). "How We Built Agent Builder's Memory System."
19. OpenAI Cookbook. "Context Engineering - Short-Term Memory Management with Sessions."
20. OpenAI Developers. "Context Engineering for Personalization - State Management with Long-Term Memory Notes."
21. Letta Documentation. docs.letta.com/concepts/memgpt.
22. Schoemaker, P.J.H. & Tetlock, P.E. (2016). "Superforecasting: How to Upgrade Your Company's Judgment." *Harvard Business Review*.
23. Liu, S. et al. (2025). "Memory in the Age of AI Agents." arXiv:2512.13564.