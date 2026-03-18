# Evidence-Backed 决策系统的 Trust Boundary 与诚实表达研究报告

## Executive Summary

本研究报告系统性地分析了面向产品架构决策的 evidence-backed 决策系统如何定义 trust boundary（信任边界），以及如何诚实表达 extraction（提取）、verification（验证）与 uncertainty（不确定性）之间的本质区别。研究发现，当前 Round Table 类产品的核心风险在于将“提取”混淆为“验证”、将“模型推理”包装为“证据结论”，这种混淆在面向 high-stakes decision support（高风险决策支持）场景中将造成严重的信任滥用。

研究表明，一个完整的 trust boundary 模型应包含五个层级：Web Source（外部网页内容，Trust Level 0）、Browser Capture（浏览器捕获内容，Trust Level 1）、Extracted Signals（提取的信号，Trust Level 2）、Verified Claims（已验证的声明，Trust Level 3）与 Synthesized Summary（综合摘要，Trust Level 4）。每一层级的输入必须被视为潜在不可信内容，系统需建立明确的边界防护机制。

在 verification 与 extraction 的区分上，两者在系统架构、证据要求和 UI 表达上存在本质差异：verification 要求独立的证据验证流程、可追溯的验证依据以及明确的验证状态标签，而 extraction 仅表示从源内容中抽取信息，无需验证其真实性。混淆这两者是当前 AI research 助手产品最严重的 architectural design flaw（架构设计缺陷）。

本报告提出了一套适用于 RT 产品的 trust classification（信任分类）体系、allowed/disallowed claim types（允许/禁止声明类型）表、anti-patterns（反模式）清单，以及当 research 缺失或失败时的最佳降级策略，为产品架构决策提供 evidence-backed 的设计指导。

---

## 1. Verified Findings

本节汇总基于一手论文、官方技术报告和工程文档的核心研究发现。

### 1.1 Prompt Injection 与 Indirect Prompt Injection 的本质威胁

根据 OWASP Top 10 for LLM Applications 1.1 版本的定义，LLM01: Prompt Injection 被列为大型语言模型应用的首要安全风险。Prompt injection 攻击通过构造恶意输入操控 LLM，可能导致未授权访问、数据泄露和决策受损。 Greshake 等人在其开创性论文《Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection》中系统性地定义了 Indirect Prompt Injection（IPI）攻击向量：攻击者通过在可能被检索的数据中策略性地注入提示，使集成 LLM 的应用执行攻击者指定的任务。

IPI 攻击的核心机制在于：当 LLM 集成应用（如 Round Table）通过检索增强生成（RAG）获取外部内容时，被污染的网页、文档或元数据可以携带隐藏的指令，使 LLM 将这些指令视为系统提示的一部分执行。这导致 retrieved content（检索内容）不再是 neutral information source（中立信息源），而是 potential instruction vector（潜在指令载体）。

针对 RAG 系统的安全研究《SecureRAG: End-to-End Secure Retrieval-Augmented Generation》指出，RAG 框架面临三类核心安全威胁：prompt injection（提示注入）、data extraction（数据提取）和 embedding poisoning（嵌入投毒）。 这意味着所有从外部获取的内容在进入 LLM 推理流程之前，必须被视作潜在恶意输入进行处理。

### 1.2 Verification 与 Extraction 的学术区分

在学术研究领域，verification（验证）与 extraction（提取）代表着完全不同的任务定义。FEVER（Fact Extraction and Verification）任务明确定义了三类标注结果：Supported（源内容支持声明）、Refuted（源内容反驳声明）和 Not Enough Info（证据不足，无法判断）。 这一分类框架的核心前提是：extraction（提取证据）和 verification（验证声明）是两个独立且必须分离的子任务。

PrefixNLI 论文进一步指出，自然语言推理（NLI）模型被用于检测 LLM 输出是否从假设的证据中得出 entailment（蕴含）关系。 这一定义揭示了 verification 的本质要求：需要有独立的验证模型或流程来判断声明与证据之间的逻辑关系，而非仅依赖 LLM 的自述。

Bekoulis 等人在 ACM Computing Surveys 上发表的《A Review on Fact Extraction and Verification》明确指出，fact checking 系统的可靠性建立在两个支柱之上：准确提取相关证据，以及严格验证声明与证据的一致性。 缺乏其中任何一个支柱都将导致 verification claim 的可信度大幅下降。

### 1.3 LLM 不确定性的四维分类

根据 arXiv:2503.15850 的综合综述，LLM 中的不确定性可归纳为四个关键维度：

**Aleatoric 不确定性**（随机不确定性）源于训练数据中的噪声（包括不一致性、偏见和矛盾信息）以及自然语言的固有歧义，这种不确定性无法通过更多数据或更复杂模型来消除。**Epistemic 不确定性**（认知不确定性）源于模型知识的缺失，表现为 hallucination（幻觉）或 overconfident incorrect statements（过度自信的错误陈述），理论上可以通过微调或检索增强生成来减少。

四种不确定性维度的具体定义如下：

- **输入不确定性**（Input Uncertainty）：用户提示模糊或信息不足，即使“完美模型”也无法消除歧义（Aleatoric）。
- **推理不确定性**（Reasoning Uncertainty）：多步推理/检索过程中的逻辑错误或歧义（Mixed）。
- **参数不确定性**（Parameter Uncertainty）：训练数据覆盖不足，模型从未见过相关信息（Epistemic）。
- **预测不确定性**（Prediction Uncertainty）：不同采样运行之间的变异性（Mixed）。

### 1.4 置信度校准的技术要求

置信度校准的核心目标是缩小 confidence score（置信度分数）与 expected correctness（预期正确性）之间的差距。完美的校准定义可表示为：E[f(s|x)|C(x,s)=c] = c，即当模型以 c 的置信度做出预测时，实际正确率也应接近 c。

研究表明，当前的校准方法可归纳为三大类：

**单轮生成方法**（最高效率）：包括 Perplexity（困惑度）、Maximum Token Log-Probability（最大 token 对数概率）、Entropy（熵）、SAR（转向相关性注意力）以及 P(True)（询问模型生成内容是否为真）。

**多轮生成方法**：包括 Token-Level Entropy（token 级熵）、Conformal Prediction（共形预测）和 Consistency-Based Methods（一致性方法）。

**外部模型辅助方法**：包括 Semantic Entropy（语义熵）、Kernel Language Entropy（核语言熵）和 Semantic Similarity（语义相似度）。

### 1.5 Overreliance 风险的严重性

OWASP 将 LLM09: Overreliance（过度依赖）定义为未能批判性评估 LLM 输出，可能导致决策受损、安全漏洞和法律后果。 建议的缓解策略包括：对关键 LLM 输出实施人工审查、添加置信度分数和不确定性指标、对 LLM 输出进行交叉验证，以及教育用户关于 LLM 局限性和潜在错误。

更重要的是，Nature 发表的最新研究显示，即使是受过专业训练的商学院学生，在高风险评估场景中识别 AI hallucination 的成功率仅为 20%。 这表明普通用户在识别不可靠 AI 输出方面存在根本性困难，系统层面的诚实表达成为防止过度依赖的最后防线。

### 1.6 FACTS Grounding 基准的设计原则

Google DeepMind 团队发布的 FACTS Grounding 基准测试为评估 LLM 事实准确性提供了科学方法论。 该基准测试的核心设计原则包括：

- 将答案分解为可独立评估的 atomic facts（原子事实）；
- 对每个原子事实进行独立的 grounded evaluation（接地评估）；
- 区分 sufficient response（充分响应）和 factual accuracy（事实准确性）两个评估维度；
- 使用 LLM 作为评委时，采用多模型集成以减少单一模型偏见。

---

## 2. Trust Boundary Model

本节提出一个适用于 Round Table 类产品的五层 Trust Boundary 模型，该模型为每一层内容分配明确的 trust level（信任级别），并规定层间数据流动的安全要求。

### 2.1 Trust Level 层级定义

**Trust Level 0 — Web Source（外部网页内容）**

外部网页内容处于整个 trust chain（信任链）的最底端，其 trust level 最低。所有来自互联网的内容在进入系统时必须被标记为潜在不可信，原因包括：

- 可能包含 IPI 恶意指令；
- 可能包含虚假信息、误导性内容或过时数据；
- 可能包含 SEO 优化导向的低质量内容；
- 可能受限于 robots.txt 或 paywall 而无法完整访问；
- 可能因网络问题而获取失败或内容截断。

系统 UI 应明确告知用户：网页内容是“原始获取内容”，不代表系统认可或验证其准确性。

**Trust Level 1 — Browser Capture（浏览器捕获内容）**

浏览器捕获内容是 Level 0 内容经过初步处理的版本，可能包括 DOM 解析结果、屏幕截图、提取的元数据等。这一层级的信任状态与 Level 0 本质相同，仅代表“原始内容的可读版本”。

关键风险点在于：JavaScript 渲染的动态内容可能与 HTTP 响应内容不同；截图可能包含用户不可见的 UI 元素；DOM 解析可能因页面结构变化而失败或提取错误内容。

**Trust Level 2 — Extracted Signals（提取的信号）**

提取的信号是系统从 Level 0/1 内容中抽取的结构化或半结构化信息。这一层级代表从“内容”到“数据”的转化，但不包含任何关于信号真实性的判断。

提取信号应被标记为“observation（观察结果）”而非“fact（事实）”。例如，“页面声明 X 公司的年收入为 100 亿美元”是 observation；“X 公司的年收入为 100 亿美元”是 potential fact，需要进一步 verification。

**Trust Level 3 — Verified Claims（已验证的声明）**

已验证的声明是经过独立 verification 流程确认的内容。Verification 流程必须满足以下要求才能授予 Trust Level 3：

- 存在可追溯的 verification source（验证来源），与原始 source（来源）分离；
- Verification 过程由独立的 verification model（验证模型）执行，而非原始 LLM；
- 验证结果具有明确的标签：Supported（支持）、Refuted（反驳）或 Inconclusive（不确定）；
- 验证依据（evidence）以可检查的形式呈现。

**Trust Level 4 — Synthesized Summary（综合摘要）**

综合摘要是系统基于多个 Trust Level 3 声明和 Level 2 observations 生成的最终输出。这一层级的信任状态取决于其组成内容的信任级别，以及合成过程中引入的新不确定性。

综合摘要必须明确标注每条信息的 trust level 来源，并分离系统生成内容与来源内容。

### 2.2 层间数据流动的安全要求

```
┌─────────────────────────────────────────────────────────────────┐
│                    Trust Boundary Enforcement                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Web Source] ──────► [Browser Capture] ──────► [Extracted]     │
│   Level 0              Level 1                Level 2            │
│       │                    │                      │              │
│       ▼                    ▼                      ▼              │
│  ⚠️ Input           ⚠️ Content             ⚠️ Observation       │
│  Sanitization       Validation              No Truth Claim        │
│                                                                  │
│                    ┌───────────────────────┐                      │
│                    │  Verification Layer  │                      │
│                    │   (Independent)      │                      │
│                    └───────────────────────┘                      │
│                              │                                   │
│                              ▼                                   │
│  [Verified Claims] ◄──── Cross-Reference                       │
│    Level 3              Multiple Sources                       │
│         │                                                        │
│         ▼                                                        │
│  [Synthesized Summary]                                          │
│    Level 4                                                      │
│         │                                                        │
│         ▼                                                        │
│  User-Facing Output                                             │
│  (Trust Level Labeled)                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键设计原则**：

1. **不可信输入原则**：每一层的输出在进入下一层之前必须经过 sanitization（净化）处理，但 sanitization 不增加信任级别。
2. **Verification 隔离原则**：Trust Level 3 的授予必须经过独立的 verification pipeline，与 extraction pipeline 完全分离。
3. **Trust Level 传递原则**：Trust Level 4 的 trust level 由其组成内容中最低的 trust level 决定（木桶原则）。
4. **溯源原则**：任何 trust level 的提升都必须伴随完整的 provenance trail（溯源链）。

### 2.3 适用于 RT 的 Trust Classification

基于上述五层模型，本报告提出适用于 Round Table 产品的 Trust Classification：

| 分类标识 | 名称 | 定义 | 示例 | UI 表达要求 |
|---------|------|------|------|-------------|
| **TL0** | Raw Content | 外部获取的原始内容 | 网页 HTML、API 响应 | “来源：未经处理的抓取内容” |
| **TL1** | Processed Content | 经过解析/渲染的内容 | 提取的文本、DOM 结构 | “来源：已解析的页面内容” |
| **TL2** | Observation | 从内容中提取的观察结果 | “页面提到 X 公司年收入” | “观察：页面提及（待验证）” |
| **TL3-V** | Verified-Supported | 经独立验证的支持声明 | “来源文件证实 X 公司年收入为 100 亿” | “已验证 ✓” |
| **TL3-R** | Verified-Refuted | 经独立验证的反驳声明 | “来源文件显示 X 公司年收入非 100 亿” | “已证伪 ✗” |
| **TL3-U** | Verified-Uncertain | 经独立验证的不确定声明 | “来源文件无法确认 X 公司年收入” | “证据不足 ⚠” |
| **TL4-S** | Synthesized (Strong) | 基于多个 TL3-V 的综合 | “综合 3 个来源确认 X 公司年收入” | “综合结论（强）” |
| **TL4-W** | Synthesized (Weak) | 包含 TL2 或 TL3-U 的综合 | “综合证据表明可能为 X” | “综合结论（待确认）” |
| **TL5-I** | Model Inference | 模型推理内容，无直接证据 | “基于以上数据，推测 Y” | “模型推测（无直接证据）” |

---

## 3. Evidence Classes and Allowed Claims

本节定义 RT 产品中不同 evidence class（证据类别）所允许的 claim type（声明类型），这是防止“将 extraction 包装为 verification”的核心机制。

### 3.1 Evidence Class 分类体系

**Class A — Direct Source Verification**

直接源验证指存在与原始 source 分离的独立验证来源，且验证过程由独立模型执行。Class A 证据具有以下特征：

- Verification source ≠ Original source；
- Verification model ≠ Original LLM；
- Verification result with explicit label（Supported/Refuted/Inconclusive）；
- Evidence in checkable format。

**Class B — Cross-Reference Verification**

交叉引用验证指存在多个独立来源支持同一声明，这些来源之间无关联性，且来源本身具有可信度评级。Class B 证据要求：

- 至少 2 个独立来源；
- 来源间无明显的引用或派生关系；
- 每个来源具有 credibility rating（可信度评级）；
- 来源覆盖声明的核心要素。

**Class C — Single Source Extraction**

单一来源提取指仅有一个来源支持某一声明，且未经过独立的 verification 流程。Class C 仅允许特定类型的声明，且必须附带明确的置信度标注。

**Class D — Model Inference**

模型推理指声明是基于现有证据进行的逻辑推断或外推，无直接来源支持。Class D 声明必须明确标注为推理内容，并说明推断依据。

**Class E — No Evidence**

无证据指声明缺乏任何可追溯的来源支持，可能是 LLM 基于训练知识的自述。Class E 声明在任何面向 high-stakes decision 的输出中应被禁止。

### 3.2 Allowed Claims 分类表

| Evidence Class | Allowed Claim Types | Disallowed Claim Types | Required Label | Example |
|----------------|--------------------|------------------------|----------------|---------|
| **Class A** | Factual statements with verification source; Quantitative claims with verified data; Definitive conclusions | Hedged factual statements as definitive; Unverified peripheral claims | “Verified ✓” + verification badge | “Source A confirmed Company X's revenue was $10B” |
| **Class B** | Cross-referenced factual statements; Multi-source corroborated claims; High-confidence summaries | Single-source exclusive claims; Contested claims presented as settled | “Cross-referenced” + source count | “3 independent sources confirm Y's market share” |
| **Class C** | Qualified observations; Potential trends; Preliminary findings | Definitive factual claims; Conclusions beyond source scope | “Single source” + confidence indicator | “Page states Z's user count increased (unverified)” |
| **Class D** | Inferential statements; Logical implications; Hypothesis proposals | Direct factual attributions; Confident predictions without basis | “Model inference” + reasoning basis | “Based on the data, Y likely follows pattern X” |
| **Class E** | None in high-stakes outputs | Any factual claim; Quantitative statements; Definitive conclusions | N/A (should be filtered) | N/A |

### 3.3 Claim Type 的强制要求

**必须具备 Evidence 才允许进入 Summary 的 Claim Types**：

1. **事实性陈述**（Factual Statements）：任何涉及具体事实、数据或事件的声明，必须具备 Class A 或 Class B 证据。
2. **量化声明**（Quantitative Claims）：包含具体数字、百分比或统计数据的声明，必须具备 Class A 证据。
3. **归因声明**（Attribution Claims）：将结果或状态归因于特定主体的声明，必须具备可验证的来源。
4. **比较声明**（Comparative Claims）：涉及多个实体之间比较的声明，必须具备交叉验证。
5. **时间性声明**（Temporal Claims）：涉及具体日期、时间线或时间顺序的声明，必须具备来源支持。

**可以不含 Evidence 的 Claim Types**：

1. **方法论说明**：描述系统处理过程的声明，如“我们搜索了 X 个来源”不需要证据支持。
2. **透明度声明**：描述系统能力或限制的声明，如“该系统无法访问实时数据”。
3. **元注释**：关于研究过程本身的观察，如“多个来源讨论了同一主题”。

### 3.4 声明类型强制过滤规则

```markdown
## Declaration Filtering Pipeline

Input: Raw LLM-generated claims
Output: Labeled and filtered declarations

FOR each claim IN input:
  
  IF claim.type == "factual":
    IF claim.has_evidence(Class.A) OR claim.has_evidence(Class.B):
      claim.label = "VERIFIED"
      claim.level = trust_level_of_evidence
    ELSE IF claim.has_evidence(Class.C):
      claim.label = "EXTRACTED"
      claim.level = TL2
    ELSE:
      claim.label = "MODEL_CLAIM"
      claim.require_user_confirmation = TRUE
  
  ELSE IF claim.type == "inference":
    IF claim.has_reasoning_basis:
      claim.label = "MODEL_INFERENCE"
      claim.level = TL5_I
    ELSE:
      claim.filter_out = TRUE
  
  ELSE IF claim.type == "methodology":
    claim.label = "SYSTEM_STATEMENT"
    claim.level = SYS
  
  // High-stakes decision rule
  IF context.stakes == HIGH:
    IF claim.label IN ["MODEL_CLAIM", "EXTRACTED"]:
      claim.require_evidence_upgrade = TRUE
  
  RETURN labeled_claims
```

---

## 4. Verification vs Extraction Guidance

本节详细阐述 verification（验证）与 extraction（提取）在系统架构、UI 表达和数据模型上的严格区分要求。

### 4.1 核心概念定义

**Extraction（提取）** 是指从给定 source（来源）中识别和抽取相关信息的过程。Extraction 的特征包括：

- 输入：单一 source 或多个 sources；
- 输出：Source 中的相关信息片段；
- 状态：Observation（观察结果），非 fact（事实）；
- 验证状态：无需验证，诚实标注为“已提取”；
- 示例：“页面 X 声称 Y 公司的收入增长了 20%”。

**Verification（验证）** 是指独立判断 claim（声明）与 evidence（证据）之间逻辑关系的过程。Verification 的特征包括：

- 输入：Claim + Evidence sources；
- 输出：Entailment（蕴含）、Contradiction（矛盾）或 Neutral（中立）；
- 状态：Verified claim（已验证声明），具有 truth value；
- 验证状态：必须具有 verification badge 和可检查的依据；
- 示例：“来源 A-D 证实 Y 公司的收入在 2023 年增长了 20%（Supported）”。

### 4.2 系统架构要求

**Extraction Pipeline** 的职责边界：

```
┌─────────────────────────────────────────────────────────────┐
│              Extraction Pipeline (TL0 → TL2)                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Raw content (TL0)                                   │
│          │                                                   │
│          ▼                                                   │
│  ┌─────────────────┐                                         │
│  │  Content        │  - HTML parsing                        │
│  │  Extraction     │  - Text normalization                  │
│  │  Module         │  - Structure preservation              │
│  └─────────────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌─────────────────┐                                         │
│  │  Signal         │  - Entity extraction                    │
│  │  Identification │  - Claim candidate detection           │
│  │  Module         │  - Quote preservation                   │
│  └─────────────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  Output: Extracted Signals (TL2)                             │
│          + Extraction metadata (source, method, confidence)  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Verification Pipeline** 必须独立于 Extraction Pipeline 运行：

```
┌─────────────────────────────────────────────────────────────┐
│           Verification Pipeline (TL2 → TL3)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Claims from Extraction + Independent Sources          │
│          │                                                   │
│          ▼                                                   │
│  ┌─────────────────┐                                         │
│  │  Evidence       │  - Source retrieval                    │
│  │  Retrieval      │  - Source credibility scoring           │
│  │  Module         │  - Independence verification            │
│  └─────────────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌─────────────────┐                                         │
│  │  NLI-based      │  - Entailment detection                │
│  │  Verification   │  - Independent from LLM being           │
│  │  Module         │    evaluated                            │
│  └─────────────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌─────────────────┐                                         │
│  │  Verification   │  - Supported / Refuted /                │
│  │  Labeling       │    Inconclusive classification          │
│  │  Module         │  - Confidence calibration               │
│  └─────────────────┘                                         │
│          │                                                   │
│          ▼                                                   │
│  Output: Verified Claims (TL3)                                │
│          + Verification evidence (checkable)                  │
│          + Verification confidence score                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 UI 表达规范

**Extraction 内容的 UI 表达**：

- 使用“提取”或“观察到”等动词，而非“确认”或“验证”；
- 保留来源引用，但明确标注为“原始来源”而非“验证来源”；
- 显示 extraction confidence，但不作为 truth confidence；
- 使用灰色或中性色调，避免使用绿色（验证通过）或红色（证伪）。

正确示例：

- “来源页面**提到** X 公司的收入为 100 亿美元”（TL2）
- “从来源页面**提取**的数据显示 Y 行业的增长率为 5%”（TL2）
- “来源**陈述**了 Z 公司的员工人数，但未经独立核实”（TL2）

错误示例：

- “来源**确认**了 X 公司的收入为 100 亿美元” ← 混淆 extraction 和 verification
- “多个来源**验证**了 Y 行业的增长率” ← 如无独立 verification，不应使用验证语言
- “数据**显示** Z 公司是市场领导者” ← 未区分 observation 和 conclusion

**Verification 内容的 UI 表达**：

- 使用“已验证”、“已证伪”或“证据不足”等明确标签；
- 提供 verification source（与 original source 分离）的可检查链接；
- 使用绿色（Supported）、红色（Refuted）、黄色（Inconclusive）的语义化颜色；
- 显示 verification confidence 和 verification method。

正确示例：

- “**已验证 ✓** 来源 A-C 确认 X 公司的收入为 100 亿美元（置信度 95%）”
- “**已证伪 ✗** 来源 A 显示 X 公司的收入为 80 亿美元，与声称的 100 亿矛盾”
- “**证据不足 ⚠** 未找到关于 Y 公司的公开收入数据”

### 4.4 数据模型要求

```json
{
  "claim": {
    "id": "unique_claim_id",
    "content": "X company's revenue was $10 billion in 2023",
    "type": "factual_statement",
    
    "extraction_metadata": {
      "extracted_from": "source_id_original",
      "extraction_timestamp": "2025-01-15T10:30:00Z",
      "extraction_method": "html_parsing",
      "original_quote": "X company reported revenue of $10 billion",
      "extraction_confidence": 0.85
    },
    
    "verification_status": {
      "is_verified": true,
      "verification_class": "A",
      "verification_timestamp": "2025-01-15T10:31:00Z",
      
      "verification_result": {
        "label": "SUPPORTED",
        "confidence": 0.92
      },
      
      "verification_sources": [
        {
          "source_id": "verification_source_1",
          "source_url": "https://sec.gov/filing/...",
          "source_type": "regulatory_filing",
          "credibility_rating": "high",
          "relevant_excerpt": "X company filed annual report showing $10B revenue"
        }
      ],
      
      "verification_method": "nli_model_verification",
      "verification_model_id": "verifier_v2"
    },
    
    "trust_level": "TL3_V",
    "allowed_in_high_stakes": true
  }
}
```

### 4.5 常见混淆模式识别与纠正

| 混淆模式 | 错误表达 | 正确表达 | 区分依据 |
|----------|----------|----------|----------|
| Extraction-as-Verification | "We verified that the page states..." | "The page states..." | 是否有独立 verification 流程 |
| Quote-as-Evidence | "As the source confirms..." | "The source states..." | Quote 仅表示内容存在，不代表 truth |
| Source-count-as-Confidence | "5 sources agree that..." | "5 sources mention..." | 提及 ≠ 确认 |
| LLM-Summary-as-Verified | "Based on our analysis, X is true" | "Based on retrieved sources, X appears to be true" | 系统分析仍需独立验证 |
| Pattern-as-Fact | "The trend suggests X" | "Sources show a pattern of X" | Trend observation 需标注为 inference |

---

## 5. User-Facing Honesty Guidelines

本节定义面向用户的 honesty guidelines（诚实性准则），确保用户能够正确理解系统输出的可靠性和局限性。

### 5.1 诚实性核心原则

**原则一：Truth Labeling（真伪标注）**

所有面向用户的内容必须明确标注其 truth status（真伪状态），不得将未经 verification 的内容以中性的 factual 形式呈现。

**原则二：Provenance Transparency（溯源透明度）**

用户必须能够追溯任何声明的来源，从最终输出回溯到原始网页内容，包括 extraction 和 verification 的完整链路。

**原则三：Uncertainty Communication（不确定性沟通）**

不确定性必须被主动、透明地传达，而非隐藏在细枝末节或术语中。用户应能轻易识别高不确定性内容。

**原则四：Limit Acknowledgment（局限性承认）**

系统必须主动承认其能力和信息边界，不得通过暗示系统具有超出实际的能力来误导用户。

### 5.2 UI 文案规范

**必须避免的 Misleading UI 文案（误导性文案）**：

| 类别 | 禁止使用的文案 | 问题分析 | 替代方案 |
|------|----------------|----------|----------|
| Verification | "Verified by AI" / "AI确认" | 无法验证 verification 的独立性 | "独立核实流程完成" |
| Source | "Sources confirm..." / "来源确认" | Sources 仅能提及，无法确认 | "来源提及" / "来源陈述" |
| Confidence | "High confidence" / "高置信度" | 无校准的 confidence 不可信 | "基于 N 个来源" |
| Completeness | "Comprehensive analysis" / "全面分析" | 暗示无遗漏 | "分析了 N 个相关来源" |
| Accuracy | "Accurate information" / "准确信息" | 无法保证绝对准确性 | "我们尽力核实" |
| Objectivity | "Unbiased results" / "无偏结果" | 所有来源都可能有偏见 | "多视角呈现" |

**推荐使用的 Honest UI 文案**：

| 场景 | 推荐文案 | 说明 |
|------|----------|------|
| Extraction 未验证 | “我们从来源页面提取了以下信息（未经独立核实）” | 诚实说明 extraction 状态 |
| Verification 支持 | “独立核实流程确认：来源 A、B 支持此声明” | 明确 verification 状态和依据 |
| Verification 反驳 | “独立核实发现：来源 C 与此声明相矛盾” | 主动呈现矛盾证据 |
| 证据不足 | “我们未能找到支持此声明的核实证据” | 明确承认 knowledge gap |
| 模型推理 | “基于现有数据，模型推测 X（无直接证据支持）” | 区分 inference 和 evidence |
| 来源质量 | “来源可信度：中等 | 来源可能存在偏见或过时风险” |
| 研究限制 | “未能获取 | 来源访问受限（如 paywall）” |

### 5.3 Uncertainty Presentation 设计模式

根据 arXiv:2401.05612 的研究，appropriate reliance（适当依赖）的实现需要在 uncertainty presentation（不确定性呈现）上采用以下设计模式：

**模式一：Separated Uncertainty Display（分离不确定性显示）**

不应将 uncertainty 信息嵌入内容文本，而应作为独立的 metadata layer（独立元数据层）呈现，使用户能够同时看到内容和不确定性。

```
┌─────────────────────────────────────────────────────────────┐
│  [Main Content Layer]                                        │
│                                                              │
│  X 公司的年收入为 100 亿美元（Verified ✓）                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [Uncertainty Metadata Layer]                         │    │
│  │                                                       │    │
│  │  Verification Status: 独立核实完成                      │    │
│  │  Verification Sources: 3 个独立来源                     │    │
│  │  Verification Confidence: 95%                          │    │
│  │  Last Verified: 2025-01-15                           │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**模式二：Multi-Level Uncertainty Granularity（多层次不确定性粒度）**

提供从 coarse-grained（粗粒度）到 fine-grained（细粒度）的不确定性信息，使用户能够根据需要深入了解。

**Coarse Level（粗粒度）**：

- 声明级别标签：Verified / Extracted / Inferred
- Trust Level Badge：TL3-V / TL2 / TL5-I

**Fine Level（细粒度）**：

- Verification confidence score
- Number of independent sources
- Source credibility ratings
- Evidence strength assessment

**模式三：Uncertainty-Aware Visual Design（不确定性感知视觉设计）**

使用视觉元素传达不确定性级别：

| 视觉表示 | 不确定性级别 | 使用场景 |
|----------|-------------|----------|
| ✓ (绿色勾号) | 低不确定性 | Verified, TL3-V, 多源支持 |
| ⚠ (黄色警告) | 中不确定性 | TL3-U, Single source, Class C |
| ? (灰色问号) | 高不确定性 | TL5-I, Model inference |
| — (灰色横线) | 未知/未核实 | Extracted, unverified |

### 5.4 误导性 UI 文案识别清单

以下为当前常见 AI research 产品中误导性 UI 文案的系统性识别与纠正：

**误导模式一：“Verified Sources” 滥用**

- 错误：“此答案来自已验证来源”（暗示来源已验证）
- 实际情况：仅表示使用了引用功能，内容未经独立核实
- 纠正：改为“引用来源”或“参考来源”

**误导模式二：“Confidence Score” 混淆**

- 错误：显示“Confidence: 92%”作为高可信度指标
- 实际情况：可能是 extraction confidence 而非 verification confidence
- 纠正：区分显示 extraction confidence 和 verification confidence

**误导模式三：“Comprehensive Research” 夸大**

- 错误：“我们进行了全面研究”
- 实际情况：仅搜索了有限数量的来源
- 纠正：改为“我们分析了 N 个来源”或“研究范围：特定领域”

**误导模式四：“Up-to-date Information” 误导**

- 错误：暗示信息是当前的
- 实际情况：来源内容可能已过时
- 纠正：显示来源的发布日期，并说明信息时效性

**误导模式五：“Expert-Level Analysis” 夸大**

- 错误：暗示分析具有专家级准确性
- 实际情况：仅为模型基于来源内容的推理
- 纠正：改为“基于来源的综合分析”

---

## 6. Recommended Minimum Design for RT

本节提出 Round Table 产品的 Minimum Viable Design（最小可行设计）要求，确保在不牺牲 trust 的前提下实现核心功能。

### 6.1 核心架构组件

**Component 1: Extraction Layer（提取层）**

| 要求 | 规格 |
|------|------|
| 输入处理 | 所有外部内容经过 sanitization 和 parsing |
| 输出格式 | 结构化的 observation + extraction metadata |
| 标注要求 | 明确标注“Extracted Observation”而非“Facts” |
| 安全处理 | HTML sanitization, injection pattern detection |

**Component 2: Verification Layer（验证层）**

| 要求 | 规格 |
|------|------|
| 独立性 | Verification model ≠ Summary generation LLM |
| 证据要求 | 明确的 verification sources（与 extraction sources 分离） |
| 分类标准 | Supported / Refuted / Inconclusive |
| 输出标注 | Verification badge + evidence links |

**Component 3: Synthesis Layer（综合层）**

| 要求 | 规格 |
|------|------|
| 输入控制 | 仅允许 TL3 及以上内容进入 summary |
| TL2 处理 | 必须标注为 observation，包含 uncertainty 说明 |
| 溯源要求 | 每条 summary 声明可追溯到 TL3 source |
| 拒绝规则 | 无 evidence 支持的 claims 必须被过滤或标注 |

**Component 4: Uncertainty Communication Layer（不确定性沟通层）**

| 要求 | 规格 |
|------|------|
| 标签系统 | Trust Level badge (TL0-TL5) |
| 视觉编码 | 颜色/图标表示 uncertainty 级别 |
| 可追溯性 | 链接到详细的 uncertainty 分析 |
| 降级策略 | 缺失数据时的 graceful degradation |

### 6.2 数据模型最小规格

```json
{
  "// Minimum required fields for any claim in RT": "",
  
  "claim": {
    "// REQUIRED: Unique identifier": "",
    "id": "string (required)",
    
    "// REQUIRED: Claim content": "",
    "content": "string (required)",
    
    "// REQUIRED: Trust level classification": "",
    "trust_level": "enum [TL0, TL1, TL2, TL3_V, TL3_R, TL3_U, TL4_S, TL4_W, TL5_I]",
    
    "// REQUIRED for factual claims": "",
    "factuality_metadata": {
      "is_verified": "boolean (required for factual claims)",
      "verification_class": "enum [A, B, C, D, E] (required if is_verified)",
      "verification_result": "enum [SUPPORTED, REFUTED, INCONCLUSIVE] (required if is_verified)",
      "verification_sources": "array of {source_id, url, excerpt, credibility} (required if is_verified)"
    },
    
    "// REQUIRED: Truth claim indicator": "",
    "truth_claim": {
      "// Allowed truth claim types per trust level": "",
      "allowed_types": {
        "TL3_V": ["factual_verified", "quantitative_verified"],
        "TL3_R": ["factual_refuted"],
        "TL3_U": ["observation"],
        "TL4_S": ["summary_verified"],
        "TL4_W": ["summary_qualified"],
        "TL5_I": ["inference", "hypothesis"]
      }
    },
    
    "// REQUIRED: User-facing labels": "",
    "ui_labels": {
      "display_label": "string (must match trust_level semantics)",
      "color_code": "enum [green, yellow, gray, red]",
      "badge_text": "string (e.g., 'Verified', 'Extracted', 'Model Inference')"
    }
  }
}
```

### 6.3 缺失 Research 时的降级策略

当 research 过程缺失或失败时，系统应采用以下降级策略：

**策略一：Source Unavailable（来源不可用）**

当无法获取或解析目标来源时：

1. 显示"无法访问 | 来源页面无法获取"
2. 排除相关 claims 从 summary
3. 如该信息对 query 关键，提示用户手动验证

**策略二：Verification Failure（验证失败）**

当 verification pipeline 无法完成验证时：

1. 如已 extraction，降级为 TL2 标注
2. 显示"验证未完成 | 内容已提取但未经核实"
3. 阻止进入 summary 或作为 qualified observation

**策略三：No Relevant Sources（无相关来源）**

当搜索未返回相关结果时：

1. 明确告知"We couldn't find relevant sources for your query"
2. 提供 alternative approaches（扩大搜索范围、调整 query）
3. 绝不以编造内容填补空白

**策略四：Insufficient Evidence（证据不足）**

当来源不足以支持 claim 验证时：

1. 归类为 TL3-U（Inconclusive）
2. UI 显示"证据不足 | 无法确认"
3. 不以推测填补证据空白

**策略五：Partial Success（部分成功）**

当 research 部分成功但不完整时：

1. 清晰分隔 verified 和 unverified 内容
2. 标注 research coverage："部分声明已核实 | 其他声明未经核实"
3. 量化 research 完成度："核实了 3/7 条声明"

### 6.4 Graceful Degradation 决策树

```
Research Query
      │
      ▼
┌─────────────────┐
│ Sources Found?  │
└─────────────────┘
      │
      ├─── No ───► [No relevant sources] ──► Display "No sources found"
      │                                          + Suggest alternatives
      │
      └─── Yes
            │
            ▼
┌─────────────────────────┐
│ Extraction Successful?   │
└─────────────────────────┘
      │
      ├─── No ───► [Extraction failed] ──► Display partial sources
      │                                          + Note extraction issue
      │
      └─── Yes
            │
            ▼
┌─────────────────────────┐
│ Verification Possible?   │
└─────────────────────────┘
      │
      ├─── No ───► [TL2: Extracted observations]
      │                 + "Not independently verified" badge
      │                 + May appear in summary with qualification
      │
      └─── Yes
            │
            ▼
      [TL3: Verified claims]
      + Verification badge
      + Evidence links
      + Confidence indicator
```

---

## 7. Anti-Patterns

本节系统性地列举 evidence-backed 决策系统中的 anti-patterns（反模式），这些模式会损害系统信任或误导用户。

### 7.1 Verification 反模式

**Anti-Pattern V1: Quote-as-Verification**

将来源引用或 quote 等同于 verification 结果。

- 表现："According to the source, X is true" 当作 "X is verified as true"
- 问题：Quote 仅表示内容存在于来源，不代表内容的真实性
- 后果：用户误认为内容已验证

**Anti-Pattern V2: Source-Count-as-Verification**

以来源数量代替 verification 质量。

- 表现："5 sources mention X, so X is likely true"
- 问题：多个来源可能引用同一不可靠来源；来源提及 ≠ 来源确认
- 后果：虚假共识效应放大不可靠信息

**Anti-Pattern V3: Extraction-as-Verification**

将 extraction 流程标记为 verification。

- 表现："We verified by searching the web"
- 问题：Web search 是 extraction，不是 verification
- 后果：混淆 extraction 和 verification 的本质区别

**Anti-Pattern V4: Self-Verification**

由生成 summary 的同一 LLM 执行 verification。

- 表现：LLM 生成 claims 后，自己验证自己的 claims
- 问题：缺乏独立性，verification 结果不可信
- 后果：Confirmation bias，错误自我强化

### 7.2 Uncertainty 反模式

**Anti-Pattern U1: False Precision**

呈现过于精确的数值或确定性表述。

- 表现："Revenue is $10,000,000,000" 精确到个位数
- 问题：来源数据可能四舍五入；extraction 可能引入误差
- 后果：用户误认为高精度

**Anti-Pattern U2: Buried Uncertainty**

将不确定性信息隐藏在细节或术语中。

- 表现：Uncertainty disclaimer 放在页面底部，小字体
- 问题：用户主要关注内容，不阅读 disclaimer
- 后果：形式上的 honesty，实质上的误导

**Anti-Pattern U3: Binary Confidence**

使用二元 confidence（confident/not confident）而非概率分布。

- 表现："Confidence: High" vs "Confidence: Low"
- 问题：过度简化，隐藏真实 uncertainty 分布
- 后果：用户无法理解 uncertainty 程度

**Anti-Pattern U4: Overconfidence in Extraction**

Extraction confidence 误导性接近 100%。

- 表现："Extraction confidence: 99%"
- 问题：Extraction confidence 仅反映 extraction 可靠性，不代表 content truthfulness
- 后果：用户混淆 extraction reliability 和 content accuracy

### 7.3 Trust Boundary 反模式

**Anti-Pattern T1: Trust Level Obfuscation**

故意模糊或隐藏 trust level 标注。

- 表现：所有内容使用相同的视觉处理
- 问题：用户无法区分 verified 和 unverified 内容
- 后果：过度依赖 unverified 内容

**Anti-Pattern T2: Trust Level Inflation**

不当提升内容的 trust level。

- 表现：将 TL2 observation 呈现为 TL3-V
- 问题：违反 trust level 定义
- 后果：虚假可信度

**Anti-Pattern T3: Boundary Collapse**

Extraction 和 verification 输出使用相同的标签系统。

- 表现："This information is from verified sources" 当 extraction sources = verification sources
- 问题：缺乏概念分离
- 后果：系统性信任混淆

### 7.4 Injection 反模式

**Anti-Pattern I1: Content-Trust Equivalence**

假设来自可信网站的内容天然可信。

- 表现："来源为 NYT，所以内容可信"
- 问题：可信网站可能包含恶意内容、错误信息或过时信息
- 后果：间接 prompt injection 攻击成功

**Anti-Pattern I2: Sanitization-as-Trust**

将 sanitization 等同于 trust提升。

- 表现："HTML 已净化，所以内容安全"
- 问题：Sanitization 仅移除已知恶意模式，不验证内容真实性
- 后果：虚假安全感

**Anti-Pattern I3: Retrieval-as-Truth**

假设检索到的内容是 truth。

- 表现："The web says X"
- 问题：检索仅返回相关性内容，不代表 truth
- 后果：Misinformation amplification

### 7.5 Anti-Pattern 规避检查清单

| 检查类别 | 检查项 | 是/否 |
|----------|--------|-------|
| Verification | Verification 由独立模型执行？ |  |
| Verification | Verification sources 与 extraction sources 分离？ |  |
| Verification | Verification 结果具有明确的 supported/refuted/uncertain 标签？ |  |
| Uncertainty | 不确定性信息是否在主内容层可见？ |  |
| Uncertainty | 是否避免 False Precision？ |  |
| Uncertainty | Confidence score 是否经过校准？ |  |
| Trust Boundary | 每条声明是否标注 trust level？ |  |
| Trust Boundary | Trust level 是否可追溯？ |  |
| Trust Boundary | Extraction 和 verification 标签是否分离？ |  |
| Injection | 外部内容是否经过 sanitization？ |  |
| Injection | 是否存在 IPI 检测机制？ |  |
| Injection | 来源内容是否被显式标记为不可信？ |  |

---

## 8. Open Questions

本节列举在 evidence-backed 决策系统 trust boundary 设计中的开放研究问题，这些问题尚无明确答案，需要进一步研究或产品决策。

### 8.1 Verification 独立性的边界

**问题 8.1.1：Verification 模型的独立性如何定义？**

当前 guidance 要求"Verification model ≠ Summary generation LLM"，但这一定义存在模糊地带：

- 使用同一基础模型的不同实例算"独立"吗？
- Verification prompt 与 generation prompt 的分离是否足够？
- 多阶段 verification（首先 extraction，再 verification）是否满足独立性要求？

**问题 8.1.2：Cross-validation 何时可替代独立 Verification？**

当多个独立来源支持同一 claim 时，是否可以免除 formal verification？

- "Independent sources" 的独立性如何量化？
- 来源间的间接引用关系如何检测？
- 何时可以推断"共识"而不需要 formal verification？

### 8.2 Uncertainty 表达的认知科学问题

**问题 8.2.1：用户如何理解和响应 Uncertainty 信息？**

研究表明 appropriate reliance 的实现需要考虑用户特征， 但以下问题仍需解答：

- 不同用户群体对 uncertainty visualization 的响应差异？
- "Verified" 标签对用户决策的实际影响？
- 如何避免 uncertainty 信息反而降低用户 engagement？

**问题 8.2.2：Verbalized Uncertainty 与 Quantitative Uncertainty 的效果比较？**

- 用户更容易理解"可能"还是"70% confidence"？
- 如何平衡 precision 和 understandability？
- 概率表达是否引入额外的误解风险？

### 8.3 Trust Level 体系的粒度问题

**问题 8.3.1：Trust Level 数量的最优设计？**

当前模型定义了 9 个 trust level（TL0-TL5-I），但：

- 过多 trust level 是否导致认知过载？
- 4 层（Raw/Extracted/Verified/Inferred）是否足够？
- 如何在不同 trust level 之间进行有效的视觉编码？

**问题 8.3.2：Trust Level 的动态更新机制？**

- 当新的 verification 结果推翻旧结论时，如何更新 trust level？
- 是否需要 version control 或 provenance tracking？
- 历史结论的 trust level 如何维护？

### 8.4 Injection 防御的实用性

**问题 8.4.1：Sanitization 的实际效果边界？**

OWASP LLM01 建议实施严格的输入验证和净化， 但：

- 已知 injection pattern 的过滤能防御多少比例的攻击？
- 误报（false positive）对用户体验的影响？
- 是否存在本质上的 defense-in-depth 需要？

**问题 8.4.2：Content Validation 的可行性？**

- 对每个检索来源执行 factuality check 的成本效益？
- 如何处理来源质量的时间衰减？
- Automated validation 和 human review 的边界在哪里？

### 8.5 High-Stakes 决策的特殊要求

**问题 8.5.1：High-Stakes 场景的定义边界？**

- "High-stakes" 的 threshold 如何量化？
- 不同 domain（医疗、法律、金融）的 stakes 如何分级？
- 用户声明的 stakes 与系统评估的 stakes 不一致时如何处理？

**问题 8.5.2：High-Stakes 输出的人工审核要求？**

- 哪些类型的 claims 必须人工审核才能进入 high-stakes 输出？
- 人工审核的 sampling strategy 如何设计？
- 审核人员的培训和资质要求？

---

## 9. Source List

本报告引用的主要一手资料来源：

### 9.1 官方安全标准与框架

| 来源 | 引用标识 | 主要贡献 |
|------|----------|----------|
| OWASP Top 10 for LLM Applications v1.1 | OWASP_LLM01, OWASP_LLM09 | LLM 安全风险分类；Prompt Injection (LLM01) 和 Overreliance (LLM09) 定义；缓解策略建议 |

### 9.2 学术论文

| 来源 | 引用标识 | 主要贡献 |
|------|----------|----------|
| Greshake et al. (2023) arXiv:2302.12173 | Greshake_2023 | Indirect Prompt Injection (IPI) 攻击向量系统性分类；LLM 集成应用的安全威胁分析 |
| FEVER (2018) | FEVER_2018 | Fact Extraction and Verification 任务定义；Supported/Refuted/Not Enough Info 分类框架 |
| PrefixNLI (2025) arXiv:2511.01359 | PrefixNLI_2025 | Natural Language Inference 用于 factual inconsistency 检测 |
| Bekoulis et al. (2021) ACM Computing Surveys | Bekoulis_2021 | Fact Extraction and Verification 综述；系统化梳理 |
| Liu et al. (2025) arXiv:2503.15850 | Liu_2025_UQ | LLM 不确定性量化综述；四维不确定性分类；置信度校准方法 |
| Cao et al. (2024) arXiv:2401.05612 | Cao_2024 | AI uncertainty presentation 对用户适当依赖的影响研究 |
| Kambhamettu et al. (2025) arXiv:2510.00361 | Kambhamettu_2025 | Attribution Gradients；增量展开的引用设计 |
| Dang & Nguyen (2025) arXiv:2506.00050 | Dang_2025 | 学生识别 AI hallucination 能力的实证研究；仅有 20% 成功率 |

### 9.3 官方技术报告与基准

| 来源 | 引用标识 | 主要贡献 |
|------|----------|----------|
| Google DeepMind FACTS Grounding (2024) | FACTS_Grounding_2024 | LLM 事实准确性评估基准；Grounding evaluation 方法论 |
| SecureRAG | SecureRAG | End-to-End Secure RAG 框架；RAG 安全威胁分析 |

### 9.4 工程文档与最佳实践

| 来源 | 引用标识 | 主要贡献 |
|------|----------|----------|
| IBM Uncertainty Quantification | IBM_UQ | 企业级不确定性量化最佳实践 |
| Anthropic Claude Technical Documentation | Anthropic_Docs | AI assistant 可解释性设计原则 |

---

## 10. 核心结论与建议

### 10.1 关于 Trust Boundary 的核心发现

基于本研究的系统分析，Round Table 类产品应采用以下 trust boundary 架构：

1. **五层 Trust Level 模型**是必要的且足够的：TL0（Raw）→ TL1（Processed）→ TL2（Extracted）→ TL3（Verified）→ TL4（Synthesized），并辅以 TL5-I（Model Inference）。

2. **Verification 必须独立于 Extraction**：这是防止"将 extraction 包装为 verification"的核心架构要求。

3. **所有外部内容必须被视为不可信输入**：Browser capture 和 page extraction 不增加 trust level，仅改变内容的可读性。

### 10.2 关于 Extraction vs Verification 的核心发现

Extraction 和 Verification 的本质区别必须体现在：

1. **系统架构**：独立的 verification pipeline，与 extraction pipeline 完全分离。
2. **证据要求**：Verification 需要独立的 verification sources，而非使用 extraction sources。
3. **UI 表达**：Extraction 使用"提取"、"观察到"；Verification 使用"已验证"、"已证伪"、"证据不足"。

### 10.3 关于 Uncertainty Presentation 的核心发现

1. **Calibrated confidence 优于 raw confidence**：未经校准的 confidence 分数可能误导用户。
2. **Uncertainty 必须主动传达**：不应等待用户询问，而应在内容呈现时主动标注。
3. **视觉编码应与语义一致**：绿色 = Supported；红色 = Refuted；黄色 = Inconclusive；灰色 = Unverified/Inference。

### 10.4 关于 Prompt Injection 的核心发现

1. **外部内容是潜在指令**：任何检索获取的内容在进入 LLM 流程前必须经过 sanitization。
2. **Sanitization 不等于 trust**：净化恶意指令不等于内容是真实的。
3. **Defense-in-depth 是必要的**：单层防御无法保证安全，需要多层边界。

### 10.5 行动建议

**Immediate Actions（立即行动）**：

1. 实施 trust level 标注系统，确保所有用户可见内容具有明确的 trust level。
2. 分离 extraction 和 verification 的 UI 标签，禁止使用"Verified"描述 extraction 结果。
3. 实现 graceful degradation 策略，确保 research 失败时正确降级而非掩盖。

**Short-term Actions（短期行动）**：

1. 部署独立的 verification pipeline，使用与 generation LLM 不同的模型。
2. 实现 calibrated confidence 显示，避免 false precision。
3. 实施 IPI 检测机制，将外部内容显式标记为潜在不可信输入。

**Long-term Actions（长期行动）**：

1. 建立 source credibility rating 系统，为 Class B/C 证据提供量化依据。
2. 开发 provenance tracking 系统，支持 claim 级别的完整溯源。
3. 研究用户对 uncertainty information 的实际响应，优化 UI 设计。

---

**Report Author**: MiniMax Agent  
**Date**: 2025-01-15  
**Version**: 1.0

<deliver_assets>
<item><path>extract/raw_content/owasp_org_5131921d.txt</path></item>
<item><path>extract/raw_content/arxiv_org_d69c1854.txt</path></item>
<item><path>extract/raw_content/arxiv_org_d2920d8c.txt</path></item>
</deliver_assets>