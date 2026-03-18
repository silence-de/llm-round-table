## 一、Memory Types Relevant to RT

### 1.1 四种记忆类型的理论基础

根据认知科学和 AI Agent 研究，记忆系统可划分为四种基本类型：情景记忆（Episodic Memory）、语义记忆（Semantic Memory）、程序性记忆（Procedural Memory）和工作记忆（Working Memory）。

**情景记忆**负责存储个体过去经历的具体事件，包括发生了什么、在何时发生、与谁相关等细节。在 AI Agent 领域，情景记忆通常通过向量数据库存储对话记录或操作历史，支持语义相似性检索。其优势在于保留了决策过程的完整上下文，劣势在于随着时间积累会导致存储膨胀，且难以提取通用模式。

**语义记忆**存储抽象化的知识和事实，而非具体经历。它代表的是从多次经验中提取的一般性知识，而非具体的个例细节。语义记忆的优势在于高度结构化、易于检索，且自然地避免了特定个例带来的偏见。

**程序性记忆**存储"如何做"的规则性信息，包括系统提示词结构、可调用工具列表、模型使用边界等。对于 RT 而言，程序性记忆主要指决策流程模板、calibration 方法等相对稳定的规则。

**工作记忆**是短期的、临时的信息整合机制，将长期记忆与当前任务信息结合用于即时任务完成。在 LLM 语境下，工作记忆通常体现为注入到 prompt 中的上下文信息，其容量受限于模型的上下文窗口。

### 1.2 各记忆类型在 RT 中的适用性分析

对于 RT 这一决策产品而言，四种记忆类型的适用性存在显著差异。

| 记忆类型 | RT 适用性 | 建议策略 |
|---------|----------|---------|
| 情景记忆 | 中等（有争议） | 采用"选择性情景记忆"，仅存储关键节点而非完整对话 |
| 语义记忆 | 高度适用 | 存储决策上下文、假设列表、预测内容等结构化信息 |
| 程序性记忆 | 低需求 | 通过静态配置管理，无需复杂的动态记忆机制 |
| 工作记忆 | 至关重要 | 采用"核心字段优先"策略，控制加载信息量 |

### 1.3 分层内存管理观点

参考 MemGPT 的分层内存管理思想，RT 可采用简化的三层架构：主上下文（Main Context）对应 LLM 的固定上下文窗口，存储当前 session 的完整信息；外部上下文（External Context）对应持久化存储，保存历史 session 的决策记录和 lessons learned；选择层（Selection Layer）决定哪些信息应从外部上下文加载到主上下文。

与 MemGPT 的主动分页机制不同，RT 的选择层应采用**预定义规则驱动**的方式，根据 session 类型（初始决策、follow-up、retrospective）决定加载哪些历史信息。这种设计避免了自主记忆管理的复杂性，同时保证了信息传承的可控性。

---

## 二、Follow-up Continuity Model

### 2.1 继承内容的选择标准

Follow-up session 的核心价值在于基于先前决策进行连续思考和验证。因此，继承内容的选择需要遵循三个基本原则：

**决策相关性原则**：所继承的信息应与当前决策问题有直接关联。这一原则要求区分"决策上下文"与"决策过程"。决策上下文包括问题陈述、约束条件、可用选项等，这些信息必须继承以保证 follow-up session 能够理解前序决策的背景。决策过程则包括讨论中的临时想法、探索性的分析尝试等，这些信息虽然可能包含有价值的见解，但大量继承会增加认知负担且可能引入噪声。

**可验证性原则**：RT 的核心需求。Calibration 机制要求能够将 prior prediction 与 actual outcome 进行对比，因此预测内容、预测依据、预期时间线等必须被完整记录并在 follow-up session 中继承。未能明确记录的预测无法进行有效的 calibration。

**简洁性原则**：在满足前两个原则的前提下，应尽可能减少加载的信息量。建议通过结构化的"Decision Record"替代原始对话记录，实现信息的高度压缩和结构化。

### 2.2 应继承内容的具体列表

| 类别 | 具体内容 | 继承原因 |
|-----|---------|---------|
| **决策上下文** | 问题陈述、约束条件、可用选项 | 构成 follow-up 的基础背景 |
| **决策结果** | 最终选择、决策理由、反对意见 | 为 retrospective 和 lessons learned 提供素材 |
| **明确假设列表** | 假设内容、来源、置信度评估、支持/反驳证据 | 必须被检验，是 calibration 的基础 |
| **预测内容** | 预测描述、时间线、置信度、预测依据 | 用于与实际结果对比，计算 calibration 指标 |
| **证据缺口标注** | 缺失信息、重要性、获取方式 | Follow-up 可基于此设计信息收集计划 |

### 2.3 不继承内容的明确列表

| 类别 | 具体内容 | 不继承原因 |
|-----|---------|-----------|
| **临时情绪和过程性状态** | 讨论中的情绪波动、挫折感、热情 | 不具有决策相关性，可能对后续讨论产生不当影响 |
| **未成形的想法和探索性分析** | 不成熟的想法、被证伪的分析尝试 | 可能不完整或错误，增加认知负担 |
| **具体措辞和表达方式** | 讨论中的具体措辞、表述方式 | 决策的核心是内容而非形式 |
| **外部环境细节** | 会议时间、参与者姓名等（除非与决策直接相关） | RT 目标是传承决策知识而非情景重现 |

### 2.4 传递机制设计

Follow-up continuity 的实现采用**"Decision Record + Session Summary"的组合模式**。

**Decision Record** 是结构化的决策文档，在 session 结束时自动生成，包含上述继承内容列表中的核心字段。Decision Record 采用固定 schema，便于解析和检索，并按决策主题标签进行索引，支持跨 session 的语义检索。

**Session Summary** 是对单个 session 的简洁概述，包括参与者列表、讨论主题、关键结论等。Session Summary 用于帮助参与者快速了解 session 间的脉络，但不作为 follow-up 的主要信息来源。

**Follow-up session 启动流程**：系统自动检索相关 Decision Records，并根据决策主题标签和时间线重建决策上下文。系统向参与者呈现"决策进度仪表盘"，包括：当前决策状态（进行中/待验证/已完成）、待验证预测列表、待确认假设列表、待填补证据缺口列表。

---

## 三、Lessons Learned Schema

### 3.1 最小 Schema 设计原则

Lessons Learned 的 schema 设计需要在完整性和简洁性之间取得平衡。根据软件工程中架构决策记录（Architecture Decision Records, ADR）的最佳实践，schema 设计应遵循以下原则：

**增量性原则**：schema 支持从简单到复杂的渐进演化。初始版本应包含最少的必要字段，随着使用经验积累再扩展可选字段。

**必要性原则**：每个字段必须回答一个在后续决策中会被问到的具体问题。如果某个字段在可预见的未来不会被查询，则不应作为必须字段。

**可验证性原则**：lessons learned 中的每项内容都能被验证或评估，避免空洞的总结性陈述。

### 3.2 最小 Schema（四个必须字段）

| 字段名 | 描述 | 回答的问题 | 格式要求 |
|-------|-----|----------|---------|
| **Problem** | 本次决策试图解决的核心问题及上下文背景 | "这个决策是在什么情况下做出的" | 自然语言，100-200字 |
| **Decision Rationale** | 做出该决策的关键理由和支持论据 | "为什么做出这个决定而不是其他方案" | 包含选项评估、各选项优缺点、选择原因 |
| **Outcome** | 决策的实际执行结果 | "这个决定产生了什么结果" | 尽可能量化，避免模糊定性描述 |
| **Lesson** | 从本次决策中提取的可应用于未来决策的经验教训 | "从这次经历中学到了什么" | 具体、可操作，明确适用条件和潜在反例 |

### 3.3 扩展字段（可选）

| 字段名 | 描述 |
|-------|-----|
| **Assumption Check** | 决策时所依据的假设是否被验证，包括被验证的假设、未被验证的假设、新识别的假设 |
| **Prediction Accuracy** | 预测与实际结果的对比，包括预测内容、实际结果、偏差幅度、偏差原因分析 |
| **Alternative Review** | 对未被选择方案的重新评估，记录是否有更好选择被发现 |
| **Related Decisions** | 建立与其他相关决策的链接关系，支持追溯特定问题的决策历史 |
| **Boundary Conditions** | Lessons learned 的适用条件，明确在什么条件下适用/不适用 |

### 3.4 完整 Schema 示例

```json
{
  "session_id": "RT-2024-Q4-042",
  "decision_topic": "production_strategy_Q1",
  "problem": "需要决定 2024 年 Q1 的产品发布策略，面临两个选项：激进发布（12月发布所有功能）vs 保守发布（分两阶段，1月和3月各发布部分功能）",
  "decision_rationale": {
    "options_considered": ["激进发布", "保守发布", "第三选项：进一步延期"],
    "pros_cons": {
      "激进发布": {"pros": ["抢先占领市场", "开发团队士气"], "cons": ["质量风险高", "支持压力大"]},
      "保守发布": {"pros": ["质量可控", "预留缓冲时间"], "cons": ["可能被竞争对手超越"]}
    },
    "final_decision": "保守发布",
    "reason": "考虑到上次发布的质量问题，用户信任需要修复，团队建议采用保守策略"
  },
  "outcome": {
    "status": "executed",
    "results": {
      "按时交付率": "85%（原计划 90%）",
      "用户满意度": "4.2/5.0（原基线 3.8/5.0）",
      "市场份额变化": "+2%（竞争对手同期 +5%）"
    }
  },
  "lesson": {
    "content": "保守发布策略在质量可控性方面表现良好，但未能有效应对竞争对手的快速跟进。未来需要在决策中更充分地考虑竞争因素",
    "applicability": {
      "when_to_apply": "当质量风险是主要关注点时",
      "when_not_to_apply": "当竞争窗口期极短时",
      "counter_example": "Q2 的发布日期决策因竞争压力选择了激进策略"
    }
  },
  "assumption_check": {
    "verified": ["团队有能力执行分阶段发布"],
    "failed": ["竞争对手不会大幅提前"],
    "new": ["用户对分阶段功能的价值感知可能低于预期"]
  },
  "prediction_accuracy": [
    {
      "prediction": "市场份额将保持不变",
      "actual": "市场份额增长 2%",
      "deviation": "低估了保守策略对用户信任的正面影响"
    }
  ]
}
```

---

## 四、Calibration Traceability Implications

### 4.1 预测-结果对比机制

Calibration 的核心目标是评估预测的可靠性，并通过系统性分析提升未来预测的准确性。

**预测生成阶段**：需要明确记录预测的三个要素：预测内容（What）—— 必须是具体的、可验证的陈述；预测时间线（When）—— 定义结果验证的截止日期；预测依据（Why）—— 支持该预测的关键理由。

示例对比：
- ❌ 模糊预测："市场份额将保持稳定"
- ✅ 具体预测："Q1 末市场份额将维持在 15%-17% 区间"

**结果验证阶段**：建立预测到期提醒机制。当预测时间线到期时，系统自动触发验证流程，要求参与者记录实际结果。结果记录应尽可能采用与预测相同的度量标准。

**对比分析阶段**：计算预测准确性指标。基础指标包括：偏差方向（高估/低估/准确）、偏差幅度（百分比或绝对值）、完全准确率（预测区间是否覆盖实际值）。

### 4.2 Calibration 数据积累方式

每个 Decision Record 应关联一个 **"Prediction Log"**，记录该决策相关的所有预测。Prediction Log 条目包含预测 ID、预测内容、创建时间、置信度、验证状态、实际结果、偏差幅度等字段。

**Calibration Dashboard** 汇总展示 calibration 指标：
- 总体准确率（所有预测的准确比例）
- 分 topic 准确率（按决策主题分类的准确率）
- 分置信度准确率（不同置信度水平下的实际准确率）
- 平均偏差幅度

**定期 Calibration Review**：建议每个季度进行一次 Calibration Review，分析预测准确性趋势，识别显著偏差及原因，更新决策者的先验信念。

### 4.3 系统性 Calibration Improvement 支持

**反馈循环机制**：当系统识别到某类预测存在系统性偏差时，应自动提醒决策者在未来类似决策中注意这一偏差模式。

**归因分析框架**：区分可改进的偏差（信息获取不完整、认知偏见干扰）和不可控的随机误差。

**校准方法指导**：考虑基础率（base rate）、分解复合概率、记录置信度理由等方法可提升概率预测的准确性。

---

## 五、Recommended Minimum Design for RT

### 5.1 最小 Memory Architecture

RT 的推荐最小设计采用**"三层+一引擎"**的简洁架构：

```
┌─────────────────────────────────────────────────────────────┐
│                    Selection/Loading Engine                  │
│         (预定义规则驱动，根据 session 类型加载信息)           │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Session     │    │   Decision    │    │  Calibration  │
│   Context     │    │    Record     │    │     Data      │
│    Layer      │    │    Layer      │    │    Layer      │
│  (工作缓冲区)  │    │  (持久化存储) │    │  (预测-结果)  │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 5.2 核心组件列表

| 组件 | 职责 |
|-----|-----|
| **Decision Record Generator** | 在 session 结束时自动运行，从 session 上下文提取关键信息，生成结构化的 Decision Record |
| **Decision Record Store** | 持久化存储组件，建议采用关系型或文档数据库，支持版本管理 |
| **Prediction Tracker** | 管理预测的完整生命周期，包括创建、到期提醒、结果记录 |
| **Retrieval Engine** | 在 session 启动时加载相关历史信息，采用"核心字段优先"策略 |
| **Calibration Analyzer** | 定期分析 Prediction Log 数据，生成统计指标和偏差模式 |

### 5.3 数据流描述

**Session 进行时**：所有对话内容保留在 Session Context Layer 的工作缓冲区中。此时不进行任何持久化写入，保证 session 的流畅性。

**Session 结束时**：Decision Record Generator 自动触发，从工作缓冲区提取信息生成 Decision Record。Generator 的输出经过参与者确认后写入 Decision Record Store。预测信息同步写入 Prediction Tracker，设置相应的到期提醒。

**Follow-up Session 启动时**：Retrieval Engine 根据决策主题标签检索相关的 Decision Records。如果存在待验证的预测，相关的 Prediction Log 条目也会被加载。检索结果呈现为决策进度仪表盘。

**Retrospective Session 进行时**：Calibration Analyzer 生成该决策的预测-结果对比分析。分析结果与 Decision Record 关联存储，并更新 Calibration Dashboard。

### 5.4 复杂度边界

| 维度 | 边界 |
|-----|-----|
| **存储复杂度** | Decision Record 平均 <5KB；每个 session 结构化数据 <50KB；总体存储与 session 数量呈线性关系 |
| **检索复杂度** | 任何历史信息加载 <1 秒；follow-up 加载 Decision Records ≤10 个 |
| **认知复杂度** | session 启动信息加载在 5 分钟内可理解；Decision Record 阅读时间 <10 分钟 |
| **系统复杂度** | 核心组件 ≤5 个；不引入持续运行的自主 agent 机制；不依赖向量数据库 |

---

## 六、Anti-Patterns（不建议借鉴的重型 Memory 模式）

### 6.1 六种反模式清单

| 反模式 | 描述 | 对 RT 的影响 |
|-------|-----|------------|
| **自主记忆写入** | Agent 自主决定何时写入记忆（MemGPT 模式） | 引入非确定性，可能在不适当时候写入或遗漏重要信息 |
| **全量对话存储** | 将所有对话内容无差别地持久化存储 | 存储膨胀、检索效率下降、大量无关信息干扰决策 |
| **开放式反思机制** | Agent 主动反思自己行为并生成新见解（Generative Agents 模式） | 输出不可控，难以保证质量，可能产生空洞见解 |
| **向量数据库依赖** | 依赖向量数据库进行语义检索 | 增加系统复杂度和运维成本，对结构化检索需求过度 |
| **动态 Memory 整合** | Agent 在运行时动态更新 memory | 破坏可追溯性，使 calibration 分析变得不可能 |
| **多层 Memory 分页** | 类似操作系统虚拟内存的分页机制（MemGPT 模式） | 对 RT 规模而言不必要的复杂性 |

### 6.2 替代方案建议

| 反模式 | 替代方案 |
|-------|---------|
| 自主记忆写入 | **Session-end trigger 模式**：在 session 正常结束时触发 Record 生成 |
| 全量对话存储 | **结构化 Record 替代**：Decision Record 模板精确定义需保存字段 |
| 开放式反思 | **模板驱动 Reflection**：使用预定义 Reflection Questions 引导分析 |
| 向量数据库依赖 | **关系型/文档数据库**：标签检索、字段匹配已足够 |
| 动态 Memory 整合 | **版本化 Record**：更新时创建新版本而非修改旧版本 |
| 多层 Memory 分页 | **固定策略加载规则**：根据 session 类型预定义加载逻辑 |

---

## 七、Open Questions（开放问题）

### 7.1 尚未解决的设计问题

**Decision Record 生成的质量控制**：如何确保 Generator 提取的信息准确且完整？LLM 可能遗漏重要细节或产生幻觉。可能的解决方案包括：引入参与者确认机制、人工审核抽样、多 Generator 交叉验证等。

**Lessons Learned 的适用性边界判断**：当 lesson 可能在某些条件下适用、某些条件下不适用时，如何在 schema 中表达这种不确定性？

**Calibration 指标的标准化**：对于不同类型的预测（概率预测、点预测、区间预测），如何计算可比较的准确性指标？ECE、MSCE、Brier Score 等指标各有优缺点。

**多参与者场景下的记忆归属**：当多个参与者对决策有不同贡献时，如何在 memory 中正确归属？涉及知识管理和归属伦理问题。

### 7.2 需要用户决策的问题

- **Memory 的默认可见性**：Decision Records 默认对所有参与者可见，还是需要明确授权？
- **Calibration 数据的用途**：仅用于个人提升，还是会用于评估参与者的预测能力？
- **Lessons Learned 的引用方式**：当决策中引用某条 lesson 时，是否需要显式标注这一引用？

---

## 八、Session-End Reflection Artifact Schema

### 8.1 完整 Schema 定义

```json
{
  "artifact_metadata": {
    "session_id": "string (required) - 唯一标识符，格式：RT-YYYY-QN-XXX",
    "session_type": "enum (required) - [initial_decision, follow_up, retrospective]",
    "created_at": "datetime (required) - artifact 生成时间",
    "duration_minutes": "integer (required) - session 持续时间",
    "participant_count": "integer (required) - 参与人数",
    "decision_topic": "string (required) - 决策主题标签"
  },
  "decision_context": {
    "problem_statement": "string (required) - 要解决的核心问题",
    "constraints": ["string array (optional) - 约束条件列表"],
    "options_considered": [
      {
        "option_id": "string (required)",
        "description": "string (required)",
        "pros": ["string array (optional)"],
        "cons": ["string array (optional)"]
      }
    ]
  },
  "decision_outcome": {
    "final_decision": "string (required) - 最终决定",
    "decision_rationale": "string (required) - 决策理由",
    "dissenting_opinions": [
      {
        "opinion": "string (required)",
        "reason": "string (optional)"
      }
    ]
  },
  "assumptions": [
    {
      "assumption_id": "string (required)",
      "content": "string (required)",
      "source": "string (optional)",
      "confidence": "enum (optional) - [high, medium, low]",
      "status": "enum (required) - [pending_verification, verified, falsified]"
    }
  ],
  "predictions": [
    {
      "prediction_id": "string (required)",
      "content": "string (required) - 具体预测内容",
      "expected_timeline": "string (required) - 预期结果时间",
      "confidence": "float (optional) - 置信度 0.0-1.0",
      "basis": "string (optional) - 预测依据",
      "verification_status": "enum (required) - [pending, verified, falsified]",
      "actual_result": "string (optional) - 验证时的实际结果"
    }
  ],
  "evidence_gaps": [
    {
      "gap_id": "string (required)",
      "description": "string (required)",
      "importance": "enum (required) - [critical, important, minor]",
      "how_to_fill": "string (optional)"
    }
  ],
  "lessons_learned": {
    "key_lesson": "string (required) - 核心教训，一句话总结",
    "detailed_analysis": "string (optional) - 详细分析",
    "applicability": {
      "when_applies": "string (optional)",
      "when_does_not_apply": "string (optional)"
    },
    "related_previous_lessons": ["string array (optional) - 相关的历史 lesson IDs"]
  }
}
```

### 8.2 核心设计决策总结

| 决策 | 选择 | 理由 |
|-----|-----|-----|
| **Memory 架构选择** | 三层架构 + Selection Engine | 满足 RT 三大核心需求，避免 MemGPT/Generative Agents 的过度复杂性 |
| **Follow-up 继承内容** | 继承决策上下文、假设、预测、证据缺口；不继承临时情绪、未成形想法 | 遵循决策相关性、可验证性、简洁性三原则 |
| **Lessons Learned Schema** | 四个必须字段：problem、decision_rationale、outcome、lesson | 满足记录需求的同时避免过高的记录负担 |
| **Calibration 机制** | Prediction Log + Dashboard + 定期 Review | 支持系统性 improvement，避免实时干预复杂度 |
| **Memory 写入时机** | Session 结束时一次性生成 | 避免运行时自主写入的不确定性和复杂性 |

---

## 九、Source List（来源列表）

| 来源 | 类型 | 关键贡献 | 与 RT 的相关性 |
|-----|-----|---------|--------------|
| [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560) | 同行评审论文（伯克利大学） | 分层内存管理架构、分页调度机制 | 提供 memory architecture 分层设计的参考，但需避免过度复杂性 |
| [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) | 同行评审论文（斯坦福大学） | 记忆流（Memory Stream）架构、反思机制 | 提供 episodic memory 思路，但反思机制过于开放需避免 |
| [LangChain Memory Documentation](https://docs.langchain.com/oss/python/concepts/memory) | 官方工程文档 | Memory 存储和检索的设计模式 | 提供 Memory 实现的具体模式参考 |
| [Truthfulness of Calibration Measures](https://arxiv.org/abs/2407.13979) | 同行评审论文 | Calibration measures 理论分析 | 为 calibration 指标选择提供理论依据 |
| [Calibration through the Lens of Indistinguishability](https://machinelearning.apple.com/research/lens-of-indistinguishability) | 官方技术报告（Apple ML） | Calibration 概念的深入理论分析 | 支持 calibration 机制设计 |
| [LDM^2: Large Decision Model with Dynamic Memory Enhancement](https://arxiv.org/abs/2312.08402) | 同行评审论文 | 动态记忆增强决策模型 | 提供决策场景下 memory 设计的参考 |

---

## 附录：核心问题直接回答

### Q1: Follow-up session 最应该继承的内容是什么？最不该继承的内容是什么？

**应继承**：决策上下文（问题陈述、约束条件、可用选项）、决策结果（最终选择、理由、反对意见）、明确假设列表（假设内容、来源、置信度）、预测内容（描述、时间线、置信度、依据）、证据缺口标注。

**不该继承**：临时情绪和过程性状态、未成形的想法和探索性分析、具体措辞和表达方式、非决策相关的外部环境细节。

### Q2: Lessons learned 的最小 schema 是什么？

**四个必须字段**：
1. **Problem** - 本次决策试图解决的核心问题
2. **Decision Rationale** - 做出该决策的关键理由
3. **Outcome** - 决策的实际执行结果
4. **Lesson** - 从本次决策中提取的可应用于未来决策的经验教训

### Q3: Retrospective / Calibration / Follow-up 三者应如何互相连接？

三者通过**统一的 session ID 和决策主题标签**实现互联：
- Retrospective Session 生成 Lessons Learned 和 Calibration 分析
- Calibration 数据积累在 Prediction Log 中
- Follow-up Session 通过检索机制加载 Retrospective 输出和 Calibration Dashboard

### Q4: 哪些 memory 写入应该在 session 结束时生成，而不是运行中持续生成？

**应在 session 结束时一次性生成**：
- Decision Record（从工作缓冲区提取结构化信息）
- Prediction Log 条目（设置到期提醒）
- Session Summary（帮助理解 session 间脉络）

**不建议在运行中持续生成**：
- 任何自主记忆写入（避免非确定性）
- 反思性内容（应在 Retrospective Session 中结构化生成）

### Q5: 什么是"够用的 memory"，什么是明显过度设计？

**够用**：三层架构（Session Context + Decision Record + Calibration Data）+ Selection Engine；Decision Record 平均 <5KB；核心组件 ≤5 个；不依赖向量数据库。

**过度设计**：自主记忆写入、全量对话存储、开放式反思、多层 Memory 分页、动态 Memory 整合。

### Q6: 如何让 memory 帮助下一次决策，而不是把旧偏见机械复制过去？

**设计策略**：
- Lessons Learned 包含适用边界（when applies / when doesn't apply）和反例
- Calibration Dashboard 帮助识别系统性偏差
- 明确区分"有用的模式识别"和"偏见复制"：前者基于可验证的预测-结果对比，后者缺乏验证基础
- 引入"偏差提醒"机制，当引用历史 lesson 时自动标注适用条件

---

**Summary**: 决策产品Memory设计研究  
**Description**: 针对Round Table类决策产品的Memory Architecture深度研究，涵盖follow-up continuity、lessons learned、calibration traceability三大核心功能的轻量化设计方案，包含完整schema定义和反模式分析。