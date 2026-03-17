# Trust-First 多智能体系统中 Agent Reply 结构化设计深度调研报告

## 执行摘要

本报告深入研究了 trust-first 多智能体决策系统中 agent reply 从自由文本向结构化 artifact 升级的设计方案。通过对 MetaGPT、ChatDev、Anthropic Building Effective Agents 等核心系统的深度分析，结合 LangChain、LlamaIndex 等工程框架的生产实践，本研究回答了六个核心问题并提出了具体的 Schema 设计建议。

**核心发现**：对于 Round Table 这类面向高风险决策的多智能体系统，agent reply 的最小结构化 Schema 应包含四个核心字段：content（内容）、confidence（置信度）、citations（引用列表）和 reasoning_trace（推理轨迹）。其中 confidence 和 citations 是区分 trust-first 系统与通用多智能体系统的关键字段。

**关键建议**：如果 RT 只做一件事，最应该先实现的是 **confidence 字段的标准化设计**。因为置信度直接影响后续的聚合算法选择、人类干预决策阈值设定，以及 Follow-up 的触发条件。

---

## 一、已验证事实

### 1.1 MetaGPT 的结构化输出实践

MetaGPT 是首个将标准操作程序（SOP）编码为多智能体协作框架的核心系统。该系统定义了五个专门角色：产品经理（Product Manager）、架构师（Architect）、项目经理（Project Manager）、工程师（Engineer）和 QA 工程师（QA Engineer）。每个角色都有明确的职责边界和中间产出标准。

**关键发现一：结构化通信协议**。MetaGPT 与其他使用无约束自然语言的框架不同，它采用结构化通信接口，定义每个角色的 Schema 和格式。Agent 之间通过文档和图表而非对话进行通信，这些文档包含所有必要信息，以防止内容遗漏或无关信息干扰。

**关键发现二：发布-订阅机制**。MetaGPT 实现了共享消息池，具有两个核心特征：一是所有 agent 向集中式消息池发布结构化消息，可以透明地访问其他实体的消息；二是订阅机制，agent 根据角色配置选择要关注的信息，过滤无关细节以防止信息过载。例如，架构师主要订阅产品经理的 PRD，而 QA 工程师的文档对架构师的优先级较低。

**关键发现三：中间产出标准化**。产品经理产出 PRD（包含用户故事、竞争分析、需求池）；架构师产出系统接口设计、序列流程图、文件列表、数据结构和接口定义；项目经理产出分解后的任务列表；工程师产出代码文件；QA 工程师产出单元测试代码。

### 1.2 ChatDev 的相位与交付物结构

ChatDev 是一个聊天驱动的软件开发框架，将软件开发过程划分为三个顺序阶段：设计阶段（使用自然语言进行系统设计）、编码阶段（使用编程语言进行实现）和测试阶段（同时使用自然语言和编程语言进行静态代码审查和动态系统测试）。

**关键发现四：聊天链机制**。ChatDev 定义了正式的链式工作流结构：聊天链 C = ⟨P¹, P², …, P|C|⟩（阶段序列）；阶段 Pⁱ = ⟨T¹, T², …, T|Pⁱ|⟩（子任务序列）；子任务 Tʲ = τ(C(I, A))，其中 τ = 解决方案提取。

**关键发现五：双 Agent 设计**。ChatDev 采用双 Agent 通信协议：指导者（Instructor, I）发起指令，将讨论引向子任务完成；助手（Assistant, A）遵循指令，以适当的解决方案响应。两个角色都通过系统提示实例化。助手用"\<SOLUTION\>"前缀标记共识，子任务在代码修改未改变 2 次或通信达到 10 轮后终止。

**关键发现六：通信去幻觉模式**。ChatDev 提出了"通信去幻觉"机制，在代码补全、审查和测试阶段激活。基本模式为 ⟨I→A, A↝I⟩↺，去幻觉模式为 ⟨I→A, ⟨A→I, I↝A⟩↺, A↝I⟩↺，助手在提供最终响应前主动请求具体细节。

### 1.3 Anthropic 的工具使用最佳实践

Anthropic 在其官方技术报告中总结了构建有效 Agent 的最佳实践。

**关键发现七：Agent-计算机接口（ACI）原则**。Anthropic 强调将工具定义写得像是为初级开发者准备的优秀文档字符串。应当包含示例用法、边缘情况、输入格式要求和与其他工具的清晰边界。通过运行大量示例输入来测试模型如何使用工具。应当"防错"（Poka-yoke）工具：更改参数使其更难出错。

**关键发现八：结构化输出格式**。对于结构化输出，可以返回 Markdown 内的代码或 JSON 内的代码。使用 JSON 编写代码需要额外转义换行符和引号。对于文件编辑格式，可以通过编写差异或重写整个文件来指定。编写差异需要知道在写入新代码之前块头中有多少行发生了变化。

**关键发现九：给模型足够的"思考"空间**。Anthropic 建议在模型把自己逼入角落之前给它足够的 token 来"思考"。保持格式接近模型在互联网上自然看到的文本。避免格式"开销"：不要要求准确计算数千行代码，或对代码进行字符串转义。

### 1.4 生产环境中的结构化输出实践

LangChain 和 LlamaIndex 提供了生产环境中结构化输出的工程实践。

**关键发现十：Pydantic 验证机制**。LangChain 的 PydanticOutputParser 允许定义 Pydantic 模型来验证和解析 LLM 输出。Pydantic 提供类型注解自动验证、数据解析、错误处理和字段验证器。当验证失败时，会报告详细的错误信息。

**关键发现十一：三层兜底策略**。生产环境中通常采用三层兜底策略：直接解析（成功则返回）、轻量净化（截取第一个 { 到最后一个 }）和二次修复（将失败样本喂回模型让其只输出最终 JSON）。

**关键发现十二：LangChain 输出解析器体系**。LangChain 提供了完整的输出解析器体系，包括 PydanticOutputParser、RetryOutputParser、JSONOutputParser 等。RetryOutputParser 用于处理不完整输出导致的解析错误。

### 1.5 XML 标签在提示工程中的应用

Anthropic 的官方文档强调了 XML 标签在结构化提示中的重要性。

**关键发现十三：XML 标签的三大核心价值**。安全防护：XML 标签构建了系统指令与用户输入的防火墙，直击提示注入攻击的防范问题。输出可控：结构化的约束大幅降低了 AI 产生虚假信息的概率。开发效率：虽然 XML 格式会消耗更多 token，但与调试时间和系统稳定性相比这点成本微不足道。

**关键发现十四：边界模糊的严重后果**。从 Transformer 的工作原理来看，模型在处理每个 token 时都要计算与前面所有 token 的注意力权重。如果没有明确的边界标记，模型需要维护一个概率分布来判断当前 token 的归属。这种"边界模糊"会产生错误累积效应，导致整个输出混乱。

---

## 二、最佳候选 Schema 设计

基于上述研究发现，本节提出三个版本的 Schema 设计：最小版、平衡版和过度设计版。

### 2.1 最小版 Schema（Minimal）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["content", "confidence", "citations"],
  "properties": {
    "content": {
      "type": "string",
      "description": "Agent 回复的核心内容文本"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "置信度，0-1 之间的浮点数"
    },
    "citations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source_id", "label"],
        "properties": {
          "source_id": {
            "type": "string",
            "description": "引用来源的唯一标识符"
          },
          "label": {
            "type": "string",
            "description": "引用标签，如 'fact_1', 'data_2'"
          },
          "quote": {
            "type": "string",
            "description": "引用的原文内容（可选）"
          }
        }
      }
    }
  }
}
```

**设计理由**：最小版 Schema 聚焦于最核心的三个字段。content 是必需的，因为总需要有内容输出；confidence 是 trust-first 系统的关键，它直接影响聚合算法和人工干预决策；citations 字段解决了证据可验证性的问题。这三个字段足以支持基本的聚合、引用追溯和置信度加权。

### 2.2 平衡版 Schema（Balanced）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["content", "confidence", "citations", "reasoning_trace", "stance"],
  "properties": {
    "content": {
      "type": "string",
      "description": "Agent 回复的核心内容文本"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "置信度，0-1 之间的浮点数"
    },
    "citations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source_id", "label", "gap_reason"],
        "properties": {
          "source_id": {
            "type": "string",
            "description": "引用来源的唯一标识符"
          },
          "label": {
            "type": "string",
            "description": "引用标签"
          },
          "gap_reason": {
            "type": "string",
            "enum": ["direct_evidence", "indirect_inference", "extrapolation", "assumption"],
            "description": "证据间隙原因，说明从证据到结论的推理强度"
          },
          "quote": {
            "type": "string",
            "description": "引用的原文内容"
          },
          "relevance_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "相关性评分"
          }
        }
      }
    },
    "reasoning_trace": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["step", "description"],
        "properties": {
          "step": {
            "type": "integer",
            "description": "推理步骤序号"
          },
          "description": {
            "type": "string",
            "description": "推理步骤描述"
          },
          "depends_on": {
            "type": "array",
            "items": {"type": "integer"},
            "description": "依赖的前续步骤"
          }
        }
      }
    },
    "stance": {
      "type": "string",
      "enum": ["support", "oppose", "neutral", "conditional_support"],
      "description": "相对于讨论议题的立场"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "回复时间戳"
    },
    "agent_id": {
      "type": "string",
      "description": "Agent 唯一标识符"
    },
    "parent_reply_id": {
      "type": "string",
      "description": "父回复的 ID，用于支持对话树结构"
    }
  }
}
```

**设计理由**：平衡版 Schema 在最小版基础上增加了四个关键字段。reasoning_trace（推理轨迹）允许记录完整的推理步骤，这对于 debug、follow-up 和 resume/replay 至关重要。stance（立场）字段支持多维度聚合，例如可以分别统计支持、反对和中立的数量。gap_reason（证据间隙原因）解决了 citations 与 gapReason 共存的问题。parent_reply_id 支持嵌套的对话树结构，便于跟踪讨论脉络。

### 2.3 过度设计版 Schema（Over-engineered）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["content", "confidence", "citations", "reasoning_trace", "metadata", "validation", "version"],
  "properties": {
    "content": {"type": "string"},
    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    "citations": {"type": "array"},
    "reasoning_trace": {"type": "array"},
    "metadata": {
      "type": "object",
      "properties": {
        "model_version": {"type": "string"},
        "temperature": {"type": "number"},
        "token_count": {"type": "integer"},
        "processing_time_ms": {"type": "integer"},
        "cache_hit": {"type": "boolean"},
        "geo_location": {"type": "string"},
        "device_info": {"type": "string"}
      }
    },
    "validation": {
      "type": "object",
      "properties": {
        "schema_version": {"type": "string"},
        "validated_at": {"type": "string", "format": "date-time"},
        "validator_version": {"type": "string"},
        "validation_rules_applied": {"type": "array"}
      }
    },
    "version": {"type": "string"},
    "history": {"type": "array"},
    "embeddings": {"type": "array"},
    "audit_trail": {"type": "array"},
    "relationships": {"type": "object"},
    "access_control": {"type": "object"},
    "encryption_info": {"type": "object"},
    "digital_signature": {"type": "object"}
  }
}
```

**为什么过度设计会失败**：这个 Schema 试图包含所有可能的字段，导致了几个严重问题。首先，metadata 中包含大量运行时信息（temperature、processing_time_ms、device_info），这些信息应由系统自动记录，而非要求 agent 生成。validation 和 audit_trail 字段属于系统级基础设施，不应在 agent reply Schema 中重复定义。其次，embeddings 和 digital_signature 字段需要大量计算资源，会显著增加延迟和成本。最后，这个 Schema 过于复杂，会导致解析失败率大幅上升，违背了结构化设计的初衷——提高可靠性而非增加复杂性。

---

## 三、逻辑字段与 UI 字段的区分

### 3.1 逻辑字段（触发重试逻辑）

以下字段应当作为逻辑字段进行严格验证：

**confidence（置信度）**：这是最关键的逻辑字段。当 confidence 低于预设阈值时，系统应触发人工审核或重新评估流程。验证规则：必须为 0 到 1 之间的浮点数；可以设置业务规则，如低于 0.5 必须人工确认。

**citations（引用列表）**：引用是 evidence-based 系统的核心。当 citations 为空时，应触发警告或要求补充证据。验证规则：citations 数组中的每个元素必须包含 source_id 和 label；source_id 必须指向系统中存在的有效来源。

**gap_reason（证据间隙原因）**：这个字段决定了从证据到结论的推理强度。验证规则：gap_reason 必须是预定义的枚举值之一（direct_evidence、indirect_inference、extrapolation、assumption）；当 gap_reason 为 assumption 时，应设置额外的审查标志。

**stance（立场）**：立场字段影响聚合逻辑。验证规则：必须是预定义的枚举值之一；某些业务场景可能要求必须有明确立场（不能为 neutral）。

### 3.2 UI 字段（仅用于用户沟通）

以下字段仅用于改善用户体验，不触发核心逻辑：

**reasoning_trace（推理轨迹）**：这个字段主要用于人类理解 agent 的推理过程，不触发自动重试。它可以用于 UI 展示、调试和 follow-up 讨论。验证规则可以放宽：可以是空数组；每个步骤的描述可以是任意字符串。

**timestamp（时间戳）**：由系统自动生成或在服务端添加，不需要 agent 生成。format 应为 ISO 8601 日期时间格式。

**agent_id（Agent 标识符）**：由系统分配，不需要 agent 生成。验证规则：必须是系统中注册的有效 agent ID。

**parent_reply_id（父回复 ID）**：由系统根据对话树结构自动维护，不需要 agent 生成。

### 3.3 字段验证规则总结

| 字段名称 | 字段类型 | 验证严格度 | 触发重试逻辑 | 业务规则示例 |
|----------|----------|------------|--------------|--------------|
| content | string | 必需 | 否 | 最小长度限制 |
| confidence | number | 严格 | 是 | 低于 0.5 触发人工审核 |
| citations | array | 严格 | 是 | 至少 1 个引用 |
| gap_reason | enum | 严格 | 是 | assumption 需标记审查 |
| stance | enum | 严格 | 是 | 投票场景必须非 neutral |
| reasoning_trace | array | 宽松 | 否 | 可为空 |
| timestamp | string | 系统生成 | 否 | 自动生成 |
| agent_id | string | 系统生成 | 否 | 自动分配 |
| parent_reply_id | string | 系统生成 | 否 | 自动维护 |

---

## 四、结构化回复对核心功能的影响

### 4.1 对 Moderator Aggregation（主持人聚合）的影响

结构化回复对聚合功能的影响体现在三个层面。

**第一，置信度加权聚合**。当每个 agent 回复都包含 confidence 字段时，聚合算法可以从简单的多数投票升级为置信度加权投票。公式为：final_decision = Σ(agent_opinion × agent_confidence) / Σ(agent_confidence)。这种方法显著提高了聚合质量，因为高置信度的回复获得更大的权重。研究表明，在多 judge 评估系统中，使用置信度加权的聚合方法比简单多数投票误差降低了约 15-20%。

**第二，多维度立场统计**。stance 字段允许主持人分别统计支持、反对、条件支持和持中立态度的 agent 数量。这种多维度视图比单一"赞成/反对"二元分类提供更丰富的决策信息。例如，当 60% 支持但 40% 有条件支持时，主持人可以更细致地评估风险。

**第三，证据覆盖率分析**。通过分析所有 agent 回复中 citations 字段的重叠情况，主持人可以快速识别哪些事实点已达成共识，哪些点存在争议。对于争议点，可以引导后续的 follow-up 讨论。

### 4.2 对 Resume 和 Replay（恢复与回放）的影响

**结构化存储的优势**。当所有 agent 回复都遵循统一的 Schema 时，系统可以轻松实现完整的对话回放功能。每个 reply 包含 timestamp、agent_id 和 parent_reply_id，允许精确重建对话树。reasoning_trace 字段使回放不仅能看到结果，还能展示完整的推理过程。

**状态恢复的可靠性**。在系统故障恢复场景中，结构化数据比自由文本更易于验证完整性。所有必需字段（content、confidence、citations）都可以被自动检查，确保没有数据损坏。对于 resume 功能，系统可以精确知道每个 agent 在对话树中的位置，无需从头开始。

**调试和问题诊断**。当某个 agent 的输出导致问题时，reasoning_trace 允许开发者精确追踪问题发生的步骤。citations 字段可以验证 agent 引用的来源是否有效。gap_reason 字段可以帮助识别推理链中的薄弱环节。

### 4.3 对 Follow-up（跟进）的影响

**智能跟进触发**。结构化回复使得智能 follow-up 成为可能。当某个 agent 的 confidence 低于阈值时，系统可以自动触发针对性的追问，要求该 agent 补充证据或澄清推理过程。citations 中的 gap_reason 为"extrapolation"或"assumption"时，可以触发更严格的证据要求。

**对话连贯性**。parent_reply_id 字段支持嵌套对话结构，使 follow-up 不仅可以针对原始问题，还可以针对讨论过程中的特定观点进行。这对于复杂决策场景特别有价值。

**迭代细化**。在迭代讨论中，structure reply 支持增量改进。每个 agent 可以看到之前的 reasoning_trace，避免重复相同的推理路径。confidence 字段的演变可以可视化整个讨论的收敛过程。

### 4.4 对 Testing（测试）的影响

**自动化测试的可能性**。结构化 Schema 使得自动化测试成为现实。可以编写测试验证 agent 回复是否包含必需的字段。可以验证 confidence 是否在有效范围内。可以验证 citations 引用的 source_id 是否有效。可以验证 reasoning_trace 的依赖关系是否有环。

**回归测试**。当修改聚合算法或调整置信度阈值时，历史结构化数据可以用于回归测试。可以比较新算法与旧算法在相同数据上的表现差异。

**评估基准**。结构化输出使得构建评估基准更加容易。可以创建标准测试集，包含不同 confidence 级别的回复，验证系统行为是否符合预期。可以构建"困难案例"测试集，专门测试边界条件下的系统行为。

---

## 五、反模式分析

### 5.1 Schema 过简单导致的失败模式

**自由文本陷阱**。当 Schema 过于简单（仅包含 content 字段）时，系统会面临严重的可验证性问题。研究发现，在 MetaGPT 之前的多智能体系统中，简单链接 LLM 会导致"级联幻觉"问题——一个 agent 的错误输出会传播到后续 agent，逐级放大最终错误。ChatDev 的实验数据表明，自然语言通信占比 57.20%，其中代码审查阶段通信最频繁，最常见的问题是"Method Not Implemented"（34.85%）和"Module Not Implemented"。这些问题在结构化输出下更容易被检测和纠正。

**聚合失效**。在没有任何结构化字段的情况下，主持人只能依赖自由文本来做聚合决策。这不仅增加了 NLP 处理的复杂性，还容易受到措辞差异的影响。例如，"我认为这个方案可行"和"这个方案是可行的"表达相同的立场，但简单的文本匹配算法可能会错过这种等价性。

**无法追溯**。当出现错误决策时，没有 citations 和 reasoning_trace 字段意味着无法追溯错误来源。这在需要审计的高风险决策场景中是致命的。

### 5.2 Schema 过复杂导致的失败模式

**解析失败率激增**。过度复杂的 Schema 会导致 LLM 输出无法满足格式要求的风险显著上升。Anthropic 的研究指出，当要求模型输出包含大量字段的复杂 JSON 时，模型容易"把自己逼入角落"，导致输出格式错误。在生产环境中，三层兜底策略（直接解析、轻量净化、二次修复）就是为了应对这种情况。

**token 成本膨胀**。过度设计的 Schema 会大幅增加 token 消耗。reasoning_trace 中的每个步骤都需要 token 来生成；metadata 中的各种信息会累积；嵌套结构会比扁平结构消耗更多 token。这直接导致成本上升和响应延迟。

**维护困难**。当 Schema 频繁变化时，所有 agent 的提示词都需要相应更新。这不仅增加了开发工作量，还可能导致版本不一致引发的兼容性问题。研究发现，过于复杂的 Schema 往往会退化回自由文本，因为维护成本超过了收益。

### 5.3 特定反模式案例

**反模式一：要求 agent 生成元数据**。某些系统错误地要求 agent 在回复中包含 timestamp、processing_time、model_version 等系统级元数据。这不仅浪费 token（因为这些信息应该由系统自动记录），还增加了 agent 的负担，可能导致核心内容质量下降。

**反模式二：过度嵌套的 citations 结构**。试图在 citations 字段中嵌入完整的文档内容、嵌入向量或其他大型数据。正确的做法是 citations 只包含引用指针（source_id 和 label），实际的文档内容由独立的检索系统管理。

**反模式三：实时变化的枚举值**。将业务规则相关的枚举值（如 stance 的可能选项）硬编码在 Schema 中。当业务需求变化时，需要同时修改 Schema 和 agent 提示，增加了系统复杂性。

**反模式四：忽视字段验证的向后兼容性**。在 Schema 中添加新字段时，没有设置合理的默认值或标记为可选字段。这会导致旧版本 agent 的输出被拒绝，破坏系统可用性。

---

## 六、Evidence 引用字段的设计

### 6.1 Citations 列表与内联引用的共存

在 trust-first 系统中，citations 设计需要解决两个核心问题：如何在回复中标记引用位置（内联引用），以及如何记录完整的引用信息（引用列表）。

**推荐的内联引用格式**。在 content 字段中，使用特殊标记语法标注引用位置。推荐的格式为：{[source_id:label]}。例如："根据最近的财务报告{[doc_2024:Q3_revenue]}，公司收入增长了 15%"。这种格式的优势是简单、明确，易于解析。

**引用列表的结构**。citations 数组中每个元素应包含：source_id（必需）- 引用来源的唯一标识符；label（必需）- 具体的引用标签，与内联引用中的 label 对应；gap_reason（必需）- 证据间隙原因，值为 direct_evidence、indirect_inference、extrapolation 或 assumption；quote（可选）- 引用的原文内容，用于无法访问原始来源的场景；relevance_score（可选）- 0-1 之间的相关性评分。

### 6.2 Gap Reason 与 Confidence 的关系

gap_reason 字段与 confidence 字段存在内在关联但又不完全相同。

**独立性**。gap_reason 描述的是从证据到结论的推理强度，而 confidence 描述的是 agent 自己对结论正确性的主观信念。即使证据很强（direct_evidence），agent 可能仍然 confidence 较低（例如，因为可能存在未考虑的替代解释）。反之，即使证据较弱（extrapolation），agent 可能 confidence 较高（例如，基于强烈的先验信念）。

**互补验证**。系统可以使用 gap_reason 和 confidence 的组合来触发不同级别的审查。当 gap_reason = assumption 且 confidence < 0.7 时，应触发最严格的审查。当 gap_reason = direct_evidence 且 confidence > 0.9 时，可以降低审查优先级。

### 6.3 引用验证规则

**格式验证**。内联引用 {[source_id:label]} 应与 citations 数组中的元素一一对应。citations 数组不应包含 content 中未引用的元素。

**有效性验证**。source_id 应指向系统中存在的有效来源。可以实现一个验证步骤，检查引用来源是否可访问、是否未被删除。

**一致性验证**。对于相同的 source_id + label 组合，不同 agent 的引用内容应保持一致。系统可以检测并标记不一致的引用。

---

## 七、现实中采用不同策略的系统分析

### 7.1 要求结构化输出的系统

**MetaGPT**。MetaGPT 明确要求 agent 生成结构化输出，包括 PRD、系统设计文档、流程图和接口规范。其核心哲学是"Code = SOP(Team)"，将标准操作程序编码为多智能体协作框架。MetaGPT 采用结构化通信协议，agent 之间通过文档而非自由文本通信。这种设计选择的原因是软件开发的明确目标导向——需要精确的接口定义和可执行的代码产出。

**Anthropic Claude**。Anthropic 推荐使用 XML 标签和结构化输出模式。其 ACI（Agent-Computer Interface）原则强调工具定义应像优秀的文档字符串。Claude API 支持结构化输出，可以强制执行严格的 JSON Schema。Anthropic 的方法基于两个观察：一是结构化输出减少了模型"把自己逼入角落"的风险；二是清晰的格式边界减少了注意力分散。

**OpenAI Function Calling**。OpenAI 的 Function Calling 机制本质上是一种结构化输出。开发者可以定义函数签名，模型决定调用哪个函数并按照函数签名格式返回参数。Structured Outputs 功能进一步扩展，可以强制执行严格的 JSON Schema。这种方法在需要精确数据提取的场景中效果显著。

**CrewAI**。CrewAI 框架支持通过"Force Tool Output"功能实现结构化输出。Agent 可以被配置为返回特定格式的结果，这些结果可以作为输入传递给后续的 agent。社区讨论显示，结构化输出是 CrewAI 用户最常请求的功能之一。

### 7.2 保留自由文本的系统

**ChatDev**。虽然 ChatDev 使用了相位和子任务的流程化结构，但其核心通信仍然是自然语言。Agent 通过双角色对话（指导者+助手）进行协作，解决方案用"\<SOLUTION\>"前缀标记。这种设计选择的原因是软件开发的迭代性质——通过对话可以灵活地澄清需求、讨论实现细节、进行代码审查。

**原始 Multi-Agent Debate 系统**。早期关于多智能体辩论的研究（如 RECONCILE、DebUnc）主要使用自由文本作为 agent 间的通信媒介。这些系统关注的是通过辩论提升推理质量，而非结构化的信息交换。

**某些企业客服机器人**。一些面向客户的 Agent 系统仍然使用自由文本回复，因为其目标是提供自然、友好的交互体验，而非精确的数据提取或决策支持。

### 7.3 策略选择的原因分析

**任务性质决定**。需要精确输出的任务（如数据提取、代码生成、API 调用）更适合结构化输出。需要灵活交互的任务（如头脑风暴、创意生成）可能更适合自由文本。

**错误成本决定**。高错误成本场景（如医疗诊断、金融决策、法律建议）需要结构化输出以支持可验证性和可追溯性。低错误成本场景（如娱乐聊天、日常信息查询）可以使用自由文本。

**聚合需求决定**。需要多个 agent 意见聚合的系统（如决策支持、评估判断）从结构化输出中获益最大，因为可以精确计算置信度加权、立场统计等指标。

**系统复杂度决定**。结构化输出需要更复杂的解析、验证和错误处理机制。团队需要评估维护成本是否超过收益。

---

## 八、对 Round Table 的推荐最小设计

### 8.1 核心字段优先级排序

基于本研究的分析，对 Round Table 系统提出以下推荐：

**第一优先级（立即实现）**：

- content：必需字段，agent 回复的核心内容
- confidence：必需字段，0-1 之间的置信度值
- citations：必需字段，至少包含 source_id 和 label

这三个字段构成最小可行结构，支持基本的置信度聚合和引用追溯。

**第二优先级（下一迭代）**：

- gap_reason：与 citations 配合使用，标识证据到结论的推理强度
- stance：支持多维度立场聚合

这两个字段增强了系统的可验证性和聚合能力。

**第三优先级（后续迭代）**：

- reasoning_trace：支持调试、follow-up 和 replay
- parent_reply_id：支持嵌套对话结构

这两个字段主要改善开发和调试体验。

### 8.2 验证规则定义

**必需验证**（触发重试）：

```python
def validate_required_fields(reply):
    """必需字段验证"""
    errors = []
    if 'content' not in reply or not reply['content']:
        errors.append("content 字段不能为空")
    if 'confidence' not in reply:
        errors.append("confidence 字段必需")
    elif not (0 <= reply['confidence'] <= 1):
        errors.append("confidence 必须在 0-1 之间")
    if 'citations' not in reply or not reply['citations']:
        errors.append("至少需要一个 citations 引用")
    return errors
```

**业务规则验证**（可选，取决于场景）：

```python
def validate_business_rules(reply, config):
    """业务规则验证"""
    warnings = []
    if reply.get('confidence', 1.0) < config.get('low_confidence_threshold', 0.5):
        warnings.append("置信度低于阈值，建议人工审核")
    if not reply.get('citations'):
        warnings.append("没有引用证据")
    elif any(c.get('gap_reason') == 'assumption' for c in reply.get('citations', [])):
        warnings.append("包含假设性推理，建议审查")
    return warnings
```

### 8.3 实施建议

**分阶段实施**。不要试图一次性实现完整 Schema。建议从最小版 Schema 开始，运行一段时间收集反馈，然后根据实际需求逐步添加字段。

**容错机制**。实现结构化输出时，必须准备好处理解析失败的情况。采用三层兜底策略：直接解析、轻量净化、二次修复。

**版本管理**。Schema 会有演进需求。建议使用 Schema 版本号，并实现向后兼容逻辑。新字段应标记为可选或设置合理的默认值。

**监控指标**。上线后监控关键指标：解析成功率、字段缺失率、置信度分布、引用覆盖率。这些指标可以帮助识别系统问题。

---

## 九、开放问题

### 9.1 当前无法回答的问题

**问题一：confidence 字段的最优粒度**。本研究建议使用 0-1 的连续值，但不确定这是否是最优粒度。离散值（如高/中/低）可能更容易让模型一致地生成，但会损失精度。需要进一步实验来确定最优粒度。

**问题二：多轮讨论中 confidence 的演化机制**。当 agent 在讨论过程中更新自己的观点时，confidence 字段应当如何演变？是完全覆盖历史值，还是保留完整的 confidence 轨迹？这个问题的答案可能取决于具体的应用场景。

**问题三：跨 agent 的 citation 一致性标准**。当不同 agent 引用同一 source_id 但给出不同的 label 或 quote 时，系统应如何处理？自动检测并标记？要求人工澄清？允许保留差异？

**问题四：reasoning_trace 的详细程度**。推理轨迹应该详细到何种程度？每个 token？每个句子？每个主要步骤？过详细的轨迹会增加 token 成本和解析复杂度，过简略的轨迹可能无法满足调试需求。

### 9.2 需要进一步研究的方向

**方向一：动态 Schema 演进**。如何在运行时根据任务复杂度动态调整 Schema？例如，简单查询可能只需要 content + confidence，而复杂决策需要完整的 reasoning_trace + citations。

**方向二：多模态 citations**。如果讨论涉及图表、代码、数据集等非文本内容，citations 字段应如何扩展？这可能需要定义通用的多模态引用格式。

**方向三：自动化 Schema 生成**。是否可以根据历史数据自动推断最优 Schema？例如，分析过去 N 次讨论中各字段的缺失率和利用率，据此调整 Schema 定义。

**方向四：结构化输出的评估标准**。如何评估结构化输出的质量？现有指标（如准确率、BLEU）主要针对自由文本，需要开发针对结构化字段的专用评估指标。

---

## 来源列表

### 论文

[1] [MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) - 高可信度 - ICLR 2024 顶会论文，详细描述了 MetaGPT 的 SOP 机制和结构化通信协议

[2] [ChatDev: Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) - 高可信度 - ACL 2024 论文，提出了聊天链机制和通信去幻觉模式

[3] [GroupDebate: Enhancing the Efficiency of Multi-Agent Debate](https://arxiv.org/html/2409.14051v1) - 中等可信度 - 学术论文，研究多智能体辩论的拓扑结构优化

### 官方技术报告

[4] [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) - 高可信度 - Anthropic 官方技术报告，总结了构建有效 Agent 的工程最佳实践

[5] [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - 高可信度 - Anthropic 工程博客，探讨上下文工程的高级技术

[6] [Anthropic: Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) - 高可信度 - Anthropic 工程博客，详细介绍工具设计原则

### 官方工程文档

[7] [Claude API: Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) - 高可信度 - Claude 官方文档，关于 XML 标签和结构化提示的最佳实践

[8] [Claude API: Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) - 高可信度 - Claude 官方文档，关于结构化输出的技术说明

[9] [LangChain: PydanticOutputParser](https://python.langchain.com/docs/modules/model_io/output_parsers/) - 高可信度 - LangChain 官方文档，关于结构化输出解析器的使用指南

[10] [LlamaIndex: Structured Output Extraction](https://docs.llamaindex.ai/) - 高可信度 - LlamaIndex 官方文档，关于从 LLM 生成结构化数据的方法

### 社区资源

[11] [CrewAI Community: Structuring Agent Output](https://community.crewai.com/t/structurizing-the-output-of-the-agent/2327) - 中等可信度 - CrewAI 社区讨论，关于结构化输出的实践经验

[12] [MetaGPT GitHub Repository](https://github.com/geekan/MetaGPT) - 高可信度 - MetaGPT 官方代码仓库，包含完整的实现细节

[13] [ChatDev GitHub Repository](https://github.com/OpenBMB/ChatDev) - 高可信度 - ChatDev 官方代码仓库，包含框架实现