# 证据驱动决策系统的信任边界与诚实表达机制

**核心结论：** 类似 Round Table（RT）的研究型产品，其最大系统性风险在于将"提取"（extraction）伪装为"验证"（verification），将"模型推断"包装为"证据结论"。学术文献与官方安全框架一致表明：**检索到的 Web 内容在安全模型中等同于不可信的任意代码执行环境**（Greshake et al., 2023）；当前最佳 LLM 系统中**高达 57% 的引用实际上是事后合理化**（Wallat et al., 2024）；RLHF 对齐训练系统性地降低了模型校准度，使其产出"听起来自信但实际不准确"的内容。本报告基于 40+ 篇同行评审论文与官方技术文档，构建了一套适用于 RT 类产品的完整信任分级模型、允许/禁止声明类型表、以及 UI 诚实指南。

---

## 一、执行摘要

RT 类产品（具备 Web 研究、浏览器采集、信号提取、引用标注能力）的价值主张是**信任**（Trust），而非自主性。这意味着系统的每一层操作都必须在用户可感知的信任边界内运行。本研究基于以下核心框架展开分析：

- **提示注入与代理安全**：Perez & Ribeiro (2022), Greshake et al. (2023), OWASP LLM Top 10 (2025), NIST AI 600-1
- **RAG 忠实度与引用归因**：RAGAS (Es et al., 2023), AIS 框架 (Rashkin et al., 2023), ALCE 基准 (Gao et al., 2023), Wallat et al. (2024)
- **不确定性校准与 UI 诚实**：Guo et al. (2017), Kadavath et al. (2022), van der Bles et al. (2020), Steyvers et al. (2025)
- **监管框架**：NIST AI RMF 1.0, EU AI Act, Anthropic RSP, OpenAI Preparedness Framework, DeepMind FSF
- **验证与提取的系统区分**：FEVER (Thorne et al., 2018), FActScore (Min et al., 2023), Self-RAG (Asai et al., 2024)

**三个不可妥协的设计原则：**

1. **提取 ≠ 验证**：从网页中找到一段文字不等于证实了该文字的真实性。系统必须在架构层面将这两种操作分离。
2. **接地性 ≠ 正确性**：一个回答可以完全基于检索文档生成（高接地性）但依然是错误的（低正确性），因为源文档本身可能有误。反之亦然。
3. **不确定性必须传导**：信息从"原始网页"到"提取信号"到"摘要声明"每经过一次转换，不确定性只能增加，不能减少。

---

## 二、经过验证的核心发现（Verified Findings）

### 2.1 检索内容等同于不可信输入——这不是比喻，而是安全模型

Greshake et al. (2023) 在 ACM AISec Workshop（CCS 2023）发表的论文中正式提出间接提示注入（Indirect Prompt Injection）的安全模型：**"当用检索增强 LLM 时，处理不可信的检索数据等同于执行任意代码（arbitrary code execution），数据与代码（即自然语言指令）之间的边界变得模糊。"** 该论文成功攻击了 Bing Chat（GPT-4 驱动），通过在网页中嵌入隐藏指令实现了数据窃取、对话操纵和跨会话持久化攻击。

OWASP LLM Top 10 (2025) 将提示注入列为 **LLM01（首要威胁）**，明确声明："提示注入漏洞的存在源于生成式 AI 的本质。鉴于模型运作核心的随机性影响，**目前尚不清楚是否存在万无一失的预防方法。**" OWASP 建议的信任模型是："在 LLM、外部来源和可扩展功能之间建立信任边界。将 LLM 视为不可信用户。"

Anthropic (2025) 在其关于浏览器使用提示注入防御的官方研究中坦承："**没有任何浏览器代理对提示注入免疫**……1% 的攻击成功率虽然是显著改进，但仍代表实质性风险。"

**关键推论：** RT 类产品中，从 Web 检索的所有内容——包括网页正文、结构化数据、嵌入式元数据——必须在系统信任模型中被标记为**不可信层**（Untrusted Tier），而非仅通过提示词进行防御。

### 2.2 当前引用系统存在严重的忠实度缺陷

Wallat et al. (2024, ACM SIGIR ICTIR 2025) 提出了"引用正确性"与"引用忠实度"的关键区分。**引用正确性**指被引文档是否在事实上支持该声明；**引用忠实度**指模型是否真正依赖了该文档进行生成，而非从参数记忆中生成后再事后附上"碰巧支持"的引用。研究发现：**当前系统中高达 57% 的引用属于事后合理化（post-rationalization）**——模型先生成答案，再回溯性地找到匹配的文档作为引用。

Gao et al. (2023, EMNLP) 的 ALCE 基准测试显示：**即使是最好的模型，在 ELI5 数据集上也有 50% 的时间缺乏完整的引用支持。** 封闭域模型加事后引用的方式"引用质量远差于检索增强方式"。

Min et al. (2023, EMNLP) 的 FActScore 框架将长文本分解为原子事实进行逐一验证，发现 **ChatGPT 在原子事实级别仅有 58% 的事实精确度**。

**关键推论：** RT 的引用系统不能假设"有引用 = 可信"。每条引用都需要独立的接地性验证机制，且必须向用户透明地展示引用的可信度等级。

### 2.3 LLM 校准度被 RLHF 系统性地恶化

Guo et al. (2017, ICML) 奠定了神经网络校准研究的基础：现代深度网络的**预期校准误差（ECE）通常在 4–10%**，且更深、更宽的模型校准更差。这一发现直接适用于 LLM：BioData Mining (2026) 的研究表明，**预训练模型的校准相对合理，但 RLHF 对齐过程系统性地恶化了校准——训练奖励了自信的回答风格，制造了一代"说话优雅、行为得体、但系统性过度自信"的对齐模型。**

Kadavath et al. (2022, Anthropic) 发现大语言模型在结构化任务（如多选题）上"大致知道自己知道什么"，但 RLHF 策略在朴素评估下校准极差。KalshiBench (2024) 在预测市场任务上测试五个前沿模型，**所有模型均表现出普遍的过度自信，ECE 从 0.12 到 0.40 不等**。

Steyvers et al. (2025, *Nature Machine Intelligence*) 进一步发现：**用户在面对 LLM 默认解释时会系统性地高估 LLM 准确度；更长的解释会增加用户信心，即使额外的长度并未提高准确度。**

### 2.4 接地性与正确性是独立维度

Stolfo et al. (2024) 的实证研究跨 4 个模型家族和 3 个数据集发现："**生成句子中有相当比例始终是不接地的（ungrounded），即便这些句子包含正确的事实答案。**" 这意味着三个维度——**检索相关性、生成接地性、事实正确性**——可以独立地为高或为低，产生八种组合。只有三者同时为高的情况才代表理想的系统行为。

RAGAS 框架 (Es et al., 2023, EACL 2024) 将这三个维度正式化为独立评估指标：忠实度（Faithfulness）、答案相关性（Answer Relevance）、上下文相关性（Context Relevance）。**一个回答可以与问题高度相关但对上下文不忠实（幻觉），或者对上下文忠实但与问题无关。**

### 2.5 监管框架对"决策支持型 AI"提出了明确的透明度与反自动化偏见要求

**EU AI Act 第 14(4)(b) 条**针对"为自然人决策提供信息或建议"的高风险 AI 系统，要求监督者"对**自动依赖或过度依赖**高风险 AI 系统输出的可能倾向（**自动化偏见**）保持警觉"。第 13(1) 条要求系统"足够透明，以使部署者能够解释系统的输出并适当地使用它"。

**NIST AI RMF 1.0** 定义了可信 AI 的七个特征（有效可靠、安全、安全韧性、可问责透明、可解释可解读、隐私增强、公平无偏），并特别指出"不可审视的 AI 系统会使风险度量复杂化"。NIST AI 600-1 将幻觉/虚构识别为生成式 AI 的核心风险，并要求高完整性信息"区分事实与虚构、观点与推断；承认不确定性；对审核水平保持透明"。

---

## 三、信任边界模型（Trust Boundary Model）

基于上述研究，本文提出适用于 RT 类产品的五级信任分类模型（**L0–L4**），该模型遵循 NIST SP 800-53 SA-8(10) 的**层级信任原则**："安全依赖关系必须形成偏序关系；更可信的组件不得依赖于更不可信的组件。"

### 信任层级架构

| 信任层级 | 名称 | 内容描述 | 信任来源 | 典型示例 |
|:--------:|:----:|:--------:|:--------:|:--------:|
| **L0** | 系统公理层 | 产品系统指令、安全策略、硬编码规则 | 开发者直接控制 | 系统提示、权限边界、输出格式规范 |
| **L1** | 用户意图层 | 用户的查询、偏好设置、交互历史 | 经认证的用户输入 | 搜索查询、筛选条件、用户反馈 |
| **L2** | 检索原文层 | 从 Web 检索的原始页面快照与文本 | 外部来源（不可信） | 网页 HTML、PDF 全文、API 返回数据 |
| **L3** | 提取信号层 | 从 L2 中由模型提取/解析的结构化信息 | 模型处理不可信数据的输出 | 实体识别结果、关键数据点、摘要片段 |
| **L4** | 综合推断层 | 跨源综合、模型推理、填补空白的内容 | 模型参数知识+推理 | 跨来源对比、趋势分析、预测性结论 |

**核心设计原则：**

1. **信任只降不升**：L3 的信任度不能超过 L2（从不可信来源中提取的信息不能因为"提取成功"而变得可信）。L4 的信任度是所有输入信号中最低者（最弱链原则，Dubois & Prade 的可能性逻辑）。

2. **层间操作必须显式标记**：从 L2 到 L3 的转换是"提取"操作——必须标注为 `[EXTRACTED]`；从 L3 到 L4 的转换是"推断/综合"操作——必须标注为 `[INFERRED]` 或 `[SYNTHESIZED]`。任何声明的信任层级取决于其最低来源层级。

3. **L2 层是安全边界**：所有从 Web 检索的内容进入系统时，必须经过隔离处理（参照 Anthropic 的分类器扫描与 OWASP 的"分离并明确标记不可信内容"建议）。L2 内容可能包含间接提示注入攻击载荷。

4. **跨层级的"验证"定义**：只有当 L3 中的提取信号通过**独立于原始来源的证据链**确认时，才能升级为"已验证"（verified）。仅从同一来源的不同部分确认不构成验证——这仍然是提取。

### RT 各组件的信任定位

| RT 组件 | 信任层级 | 理由 |
|:-------:|:--------:|:----:|
| 研究结果（搜索返回的 URL 列表） | L2 | 搜索引擎排序可被 SEO 操纵；URL 本身不代表内容质量 |
| 浏览器截图/页面捕获 | L2 | 是原始页面的忠实记录，但页面内容本身不可信 |
| 页面提取（结构化信号） | L3 | 模型从不可信来源中提取的信息；继承 L2 的不可信性，且引入提取误差 |
| 最终摘要 | L3–L4 | 取决于内容：直接源引为 L3，跨源综合/推断为 L4 |
| gapReason（缺失原因标注） | 元信息 | 不属于信任层级，而是信任系统本身的诚实度指标 |
| 来源质量评分 | 元信息 | 是对 L2 来源可靠性的元评估，本身属于 L4（模型判断） |

---

## 四、证据等级与允许声明类型

### 声明类型分类表

本分类基于 FEVER 框架 (Thorne et al., 2018)、AIS 框架 (Rashkin et al., 2023)、FActScore (Min et al., 2023) 和 NabaOS 的认识论分类 (2026) 综合设计：

| 声明类型 | 定义 | 信任层级 | 是否允许进入摘要 | UI 标注要求 | 验证方式 |
|:--------:|:----:|:--------:|:----------------:|:-----------:|:--------:|
| **直接引用** | 逐字引用来源原文 | L2→L3 | ✅ 允许 | `[引用]` + 精确来源定位 | 与原始页面快照比对 |
| **源内提取** | 从单一来源中提取并改写的事实陈述 | L3 | ✅ 允许 | `[提取]` + 来源链接 | NLI 蕴含验证；回溯检查源段落 |
| **单源推断** | 从一个来源的提取事实中逻辑推导的结论 | L3→L4 | ⚠️ 有条件允许 | `[推断]` + 推理前提标注 | 前提存在于来源中；推理链可审计 |
| **跨源综合** | 整合多个来源信息形成的判断 | L4 | ⚠️ 有条件允许 | `[综合]` + 所有来源标注 | 各来源提取结果独立可验证 |
| **模型知识** | 来自模型参数记忆，无检索来源支撑 | L4（无接地） | ❌ 禁止直接进入 | 必须标为 `[未验证/模型推断]` | 无法验证；必须作为 gap 处理 |
| **推测/预测** | 前瞻性判断或未证实的假设 | L4（无接地） | ❌ 禁止直接进入 | 必须标为 `[推测]` | 不可验证；仅作参考呈现 |
| **空缺声明** | 声称未找到某信息 | 元信息 | ✅ 允许 | `[缺失]` + gapReason | 验证搜索确实返回空结果 |

### 必须有证据才能进入摘要的声明类型

基于 AIS 框架"可归因于已识别来源"的标准，以下类型的声明**必须**有至少一个 L2 来源支撑才能出现在最终摘要中：

- **数值型声明**（价格、日期、统计数据、百分比）
- **事件性声明**（某事发生了、某人做了什么）
- **因果性声明**（X 导致了 Y）
- **比较性声明**（A 大于/优于 B）
- **存在性声明**（某物存在/不存在）
- **权威引述**（某人/机构说了什么）

### 只能作为 gap / 未解决 / 模型推断呈现的信息

- **未找到来源支持的事实性声明**
- **模型从训练数据中"回忆"但无法通过检索确认的信息**
- **前瞻性预测和趋势推断**
- **价值判断和主观评估**（如"最好的""最重要的"）
- **跨源综合形成的新论点**（如果各来源本身没有明确提出该论点）
- **反事实推理**（"如果……就会……"）

---

## 五、验证与提取的严格区分

### 为什么这个区分是 RT 类产品的生死线

FEVER 基准 (Thorne et al., 2018) 将事实核查流程分解为三个**明确分离**的阶段：(1) 文档检索，(2) 证据句选择，(3) 声明分类（SUPPORTED / REFUTED / NOT ENOUGH INFO）。前两步是**提取**操作——从语料库中找到相关段落；第三步才是**验证**操作——判断声明是否被证据支持。

Wallat et al. (2024) 的研究标题"正确性不等于忠实度"精确地揭示了核心问题：一个系统可以生成正确的答案但该答案并非忠实于检索证据（模型从参数记忆中提取），也可以生成忠实于来源的答案但该答案在事实上是错误的（来源本身有误）。

### 提取（Extraction）的精确定义

提取是从一个已识别的来源中获取信息的操作。它回答的问题是："**这个来源说了什么？**" 其产出继承来源的可靠性——如果来源有误，提取结果同样有误，且这不是提取系统的错误。AI 系统在提取任务中的准确度约为 **90–96%**（与人类双人提取基线相比，Gartlehner et al., 2025），但这衡量的是**对来源的忠实度**，而非对世界的真实度。

### 验证（Verification）的精确定义

验证是判断一个声明相对于外部证据或世界知识是否为真的操作。它回答的问题是："**这件事是否属实？**" 真正的验证需要：(1) 获取独立于原始来源的证据；(2) 评估证据与声明的一致性/矛盾性；(3) 得出 SUPPORTED / REFUTED / NOT ENOUGH INFO 的结论。

### 系统层面的区分要求

| 维度 | 提取（Extraction） | 验证（Verification） |
|:----:|:------------------:|:--------------------:|
| 操作本质 | 信息检索与结构化 | 真值判断 |
| 回答的问题 | "来源说了什么？" | "这是否属实？" |
| 信任继承 | 继承来源可靠性 | 需要独立证据链 |
| 独立证据要求 | 不需要 | **必须**有独立于原始来源的证据 |
| 失败模式 | 提取不准确（可检测） | 虚假确认、过度自信（难检测） |
| 可达到的自动化程度 | 高（NLI 蕴含检测） | 低（需跨源对比+领域知识） |
| UI 标签 | "来自 [来源]" / "根据 [来源]" | "经 [独立来源] 证实" / "多源交叉验证" |

### UI 层面的区分要求

**绝不可以做的事：**
- 将"在网页上找到这段文字"描述为"已验证"（verified）
- 将单一来源的提取结果标注为"证实"（confirmed）
- 将模型对提取结果的高置信度呈现为"验证成功"

**必须做的事：**
- 使用"根据 [来源名]"而非"经验证"来标注单源提取
- 明确区分"来源声称"（source states）与"系统确认"（system confirms）
- 当多个独立来源的提取结果一致时，才可使用"多源一致"（cross-source consistent）标签——但仍非"已验证"

---

## 六、用户界面诚实指南

### 常见误导性 UI 文案识别

基于 Steyvers et al. (2025)、van der Bles et al. (2020)、Goddard et al. (2012) 的自动化偏见研究以及 Evans et al. (2021) 的诚实 AI 框架，以下是 RT 类产品中**常见的误导性 UI 文案**及其修正：

| 误导性 UI 文案 | 问题 | 推荐替代 |
|:--------------:|:----:|:--------:|
| "✅ 已验证" / "Verified" | 暗示经过独立事实核查；实际仅为提取 | "📄 来自 [来源名]" 或 "提取自 [URL]" |
| "确认无误" / "Confirmed" | 暗示交叉验证；可能仅单源提取 | "来源声称" 或 "单源提取" |
| "AI 研究发现……" | 将模型推断伪装为研究发现 | "根据检索到的来源……" 或 "基于 [N] 个来源的提取……" |
| "置信度 95%" | 虚假精度；LLM 自述置信度与实际校准严重不符 | "高/中/低 来源支撑度" + 来源数量 |
| "基于证据的结论" | 将综合推断升级为证据结论 | "基于 [N] 个来源的综合推断" |
| "无结果"（不带上下文） | 暗示该信息不存在；实际可能是搜索策略问题 | "在 [搜索范围] 内未找到" + gapReason |
| "来源可靠" | 来源质量评估本身是模型推断（L4） | "来源类型：[官方/学术/新闻/个人]" |
| 省略号或空白（不显示不确定性） | 创造虚假确定性印象 | 显式标注"不确定"或"信息不足" |
| "综合多方来源"（不列来源） | 掩盖综合推断的不确定性 | 逐条列出每个来源的贡献及一致/矛盾情况 |

### 不确定性表达的五级框架

基于 van der Bles et al. (2019) 的不确定性传播框架和 NIST 的"区分事实、虚构、观点与推断"要求：

| 确定性级别 | 含义 | UI 表现 | 适用场景 |
|:----------:|:----:|:-------:|:--------:|
| **强接地** | 多个独立高质量来源的提取结果一致 | 实心标记 + 来源数量 | 跨源一致的事实性声明 |
| **单源接地** | 单一来源的提取，未经独立确认 | 半实心标记 + "来自 [来源]" | 单源提取结果 |
| **推断性** | 基于提取事实的逻辑推导 | 虚线标记 + "推断" | 单源/跨源推理结论 |
| **信息不足** | 搜索进行了但证据不足以判断 | ⚠️ 标记 + gapReason | 搜索返回矛盾/稀疏结果 |
| **未搜索/不可知** | 该问题未纳入搜索范围或原理上不可验证 | ❓标记 + 明确说明 | 预测性/价值性问题 |

### 核心 UI 原则

van der Bles et al. (2020, *PNAS*) 通过五项实验（n=5,780）发现：**传播认识论不确定性仅导致对数字和来源信任的小幅下降**；数值化的不确定性格式比口头表述对信任的损害更小。这意味着**诚实地表达不确定性不会灾难性地侵蚀用户信任**——相反，隐瞒不确定性才会在长期中摧毁产品信誉。

Cash et al. (2025, CMU, *Memory & Cognition*) 发现 LLM 与人类都存在前瞻性过度自信，但**只有人类能在回顾中调整预期**——LLM 无法从错误中学习，甚至变得更加过度自信。这进一步支持了在 UI 层面强制校准的必要性：不能依赖模型自身的"自信度"作为不确定性信号。

---

## 七、RT 最低设计规范建议

### 7.1 信任架构（Trust Architecture）

**强制要求 1：分层隔离**

- L0（系统指令）与 L2（检索内容）之间必须有架构级别的隔离，参照 Anthropic 的多层防御（训练级防御 + 分类器扫描 + 红队测试）和 OWASP 的"分离并明确标记不可信内容"。
- 所有 L2 内容进入处理管线前必须经过安全扫描（间接提示注入检测）。
- L2 → L3 的提取结果必须携带不可篡改的来源元数据（参照 NabaOS 的 HMAC 签名工具执行回执）。

**强制要求 2：每声明追踪**

- 最终输出中的每一条声明必须携带以下元数据：
  - `provenanceType`: QUOTED / EXTRACTED / INFERRED / SYNTHESIZED / UNGROUNDED
  - `sourceIds`: 关联的 L2 来源标识符列表
  - `trustLevel`: L2 / L3 / L4
  - `supportStrength`: STRONG / MODERATE / WEAK / NONE
  - `gapReason`: 若为空缺，说明空缺原因

**强制要求 3：最弱链传播**

声明的整体信任等级等于其所有输入中最低者。如果一条综合声明基于两个来源（一个 L2 高质量学术源，一个 L2 低质量博客），整体信任等级取较低者。这遵循 Dubois & Prade 的可能性逻辑中的最弱链原则。

### 7.2 提取管线设计

- **原子化分解**：参照 FActScore (Min et al., 2023) 和 RAGAS 的忠实度评估方法，将长文本分解为原子声明，逐一进行来源蕴含验证。
- **反射令牌机制**：参照 Self-RAG (Asai et al., 2024) 的 ISREL / ISSUP / ISUSE 令牌设计，在生成过程中嵌入段落级别的"是否有来源支持"判断。Self-RAG 将未接地生成从 ~20% 降低到 2%。
- **属性优先生成**：参照 ATTR.FIRST (Slobodkin et al., 2024) 的"先选证据，再生成"范式，将接地作为生成的前提条件而非事后检查。

### 7.3 降级策略

当研究缺失或失败时，系统应按以下优先级降级：

1. **搜索成功但提取失败** → 展示原始页面链接 + "自动提取失败，请直接查看来源"
2. **搜索返回结果但无高质量来源** → 展示结果 + 来源质量标注 + "未找到高置信度来源"
3. **搜索返回空结果** → 明确告知 "在 [搜索范围] 内未找到相关信息" + 搜索策略说明 + 建议替代搜索
4. **搜索执行失败（技术故障）** → "搜索服务暂时不可用" + 展示基于已有信息的部分结果（明确标注为不完整）
5. **部分搜索成功** → 展示成功部分 + 明确标注哪些方面的搜索未完成 + gapReason

**绝不允许的降级行为：** 以模型参数知识静默填充搜索缺口；将搜索失败呈现为"没有相关信息"（隐瞒搜索失败的技术原因）；降低已展示信息的不确定性标注以"弥补"其他信息的缺失。

### 7.4 数据模型最低要求

```
Claim {
  text: string                     // 声明文本
  provenanceType: enum             // QUOTED | EXTRACTED | INFERRED | SYNTHESIZED | UNGROUNDED
  trustLevel: enum                 // L2 | L3 | L4
  sources: [{
    sourceId: string               // 来源唯一标识
    url: string                    // 原始 URL
    snapshotId: string             // 页面快照标识（不可变）
    sourceType: enum               // ACADEMIC | OFFICIAL | NEWS | PERSONAL | UNKNOWN
    relevantPassage: string        // 支持该声明的具体段落
    entailmentScore: float         // NLI 蕴含评分
  }]
  supportStrength: enum            // STRONG | MODERATE | WEAK | NONE
  gapReason: string | null         // 空缺原因
  uncertaintyType: enum | null     // EPISTEMIC | ALEATORIC | null
  isVerified: boolean              // 仅当有独立来源交叉确认时为 true
  crossSourceConsistency: enum     // CONSISTENT | CONFLICTING | SINGLE_SOURCE | NO_SOURCE
}
```

---

## 八、反模式清单（Anti-Patterns）

### 反模式 1："提取即验证"谬误
**表现：** 系统从网页提取一个数据点后标注为"✅ 已验证"。
**危害：** 用户误以为该数据经过独立事实核查。实际上系统仅完成了提取（L2→L3），未进行任何验证。Wallat et al. 的研究表明 57% 的引用都是事后合理化。
**修正：** 标注为"提取自 [来源]"，明确不是独立验证。

### 反模式 2："置信度精确化"幻觉
**表现：** UI 显示"置信度 87.3%"或类似精确数值。
**危害：** Guo et al. 证明现代神经网络系统性过度自信；Cash et al. 发现 LLM 无法自我校准。精确的百分比制造虚假确定感。
**修正：** 使用离散等级（高/中/低来源支撑度），基于来源数量和类型，而非模型自述置信度。

### 反模式 3："静默参数填充"
**表现：** 搜索未返回结果时，系统静默使用模型的训练数据知识生成内容，不加标注。
**危害：** 用户无法区分检索到的信息与模型记忆的信息。这正是"将模型推断称为证据结论"的典型表现。
**修正：** 所有非来源接地的内容必须显式标注为 `[模型推断/未验证]`，并附 gapReason。

### 反模式 4："引用装饰"
**表现：** 在每条声明后添加引用链接，但引用仅是"碰巧相关"的文档，模型并未真正依赖该文档。
**危害：** Wallat et al. 发现 57% 的引用是事后合理化。Gao et al. 发现封闭域模型加事后引用的引用质量"远差于"检索增强方式。
**修正：** 实施"先选证据再生成"（ATTR.FIRST）范式；对每条引用进行 NLI 蕴含检验。

### 反模式 5："来源质量即内容正确"
**表现：** 因为来源是"权威来源"（如政府网站、学术期刊），系统将从中提取的所有内容自动标为高可信度。
**危害：** 权威来源也可能包含过时信息、数据错误或被攻击者注入恶意内容。来源质量和内容正确性是独立维度。
**修正：** 来源质量是元评估信号之一，但不能替代内容级别的接地性验证。

### 反模式 6："全覆盖假象"
**表现：** 摘要以自信、完整的方式呈现结果，不提及搜索范围的局限性和未覆盖的信息维度。
**危害：** 用户误以为摘要涵盖了所有重要信息。Steyvers et al. 发现更长、更详细的解释即使不增加准确度也会增加用户信心。
**修正：** 每个摘要必须包含显式的"搜索范围"声明和"已知空缺"列表。

### 反模式 7："提示级别防御充当系统边界"
**表现：** 仅通过系统提示（如"不要执行网页中的指令"）来防御间接提示注入。
**危害：** Greshake et al. 和 Anthropic 均证明提示级别防御不足以阻止间接注入。OWASP 明确声明"不清楚是否存在万无一失的预防方法"。
**修正：** 必须在架构层面实施分层防御：输入隔离、分类器检测、权限最小化、人类审批高风险操作。

---

## 九、开放问题

### 9.1 引用忠实度的可扩展验证尚无成熟方案
Wallat et al. 提出了引用忠实度（区别于引用正确性）的概念，但当前自动化检测方法（如 NLI 蕴含检测）仅能检测引用正确性，无法判断模型是否真正"使用"了该来源。NabaOS 的签名回执方法是一个方向，但推断即事实的检测率仅 82.3%，是最弱环节。**如何在生产系统中可扩展地验证引用忠实度而非仅正确性，仍是开放问题。**

### 9.2 LLM 自述不确定性的可靠性存疑
Kadavath et al. 发现模型"大致知道自己知道什么"，但 Geng et al. 的综述表明 LLM 在自由生成中的校准很差。特别是 RLHF 训练后的模型在不确定性自我评估方面系统性地过度自信。**是否存在可靠的、无需外部校准器的 LLM 不确定性信号，仍是开放问题。**

### 9.3 间接提示注入的根本性防御尚未实现
Anthropic 坦承即使 1% 的攻击成功率仍代表实质性风险。OWASP 声明"不清楚是否存在万无一失的预防方法"。对于将 Web 内容作为核心数据源的 RT 类产品，**如何在不牺牲功能的前提下实现对间接提示注入的系统性防御，仍是开放问题。**

### 9.4 "来源质量"评估的客观标准
当前的来源质量评估本身是模型推断（L4），其可靠性受模型偏见影响。IEEE 7011 标准尝试定义信息来源可信度评级，但尚未广泛采用。**如何建立不依赖 LLM 判断的来源质量客观评估体系，仍是开放问题。**

### 9.5 跨来源综合的信任上限
当多个来源的信息被综合为单一声明时，综合过程本身引入了模型判断。即使每个来源的提取都是忠实的，综合结论的正确性取决于综合逻辑——而这一逻辑是不可审计的模型推断。**如何为跨源综合设定可审计的信任上限，仍需进一步研究。**

### 9.6 EU AI Act 对 RT 类产品的分类尚不明确
EU AI Act 的高风险分类是否涵盖通用研究型 AI 工具取决于具体使用场景。如果 RT 被用于金融、法律或医疗决策支持，可能触发高风险条款（Art. 6），要求完整的透明度、人类监督和自动化偏见警示机制。**RT 类产品在不同使用场景下的 EU AI Act 合规路径需要个案分析。**

---

## 十、主要来源清单

**同行评审学术论文：**

- Perez, F. & Ribeiro, I. (2022). "Ignore Previous Prompt: Attack Techniques For Language Models." NeurIPS ML Safety Workshop (Best Paper Award). arXiv:2211.09527.
- Greshake, K. et al. (2023). "Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection." ACM AISec Workshop, CCS 2023. DOI:10.1145/3605764.3623985.
- Es, S. et al. (2023). "RAGAS: Automated Evaluation of Retrieval Augmented Generation." EACL 2024, pp. 150–158. arXiv:2309.15217.
- Bohnet, B. et al. (2022). "Attributed Question Answering: Evaluation and Modeling for Attributed Large Language Models." Google Research. arXiv:2212.08037.
- Rashkin, H. et al. (2023). "Measuring Attribution in Natural Language Generation Models." *Computational Linguistics* 49(4): 777–840. MIT Press.
- Gao, T. et al. (2023). "Enabling Large Language Models to Generate Text with Citations." EMNLP 2023, pp. 6465–6488. arXiv:2305.14627.
- Wallat, J. et al. (2024). "Correctness is not Faithfulness in RAG Attributions." ACM SIGIR ICTIR 2025, pp. 22–32. arXiv:2412.18004.
- Asai, A. et al. (2024). "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection." ICLR 2024 (Oral). arXiv:2310.11511.
- Min, S. et al. (2023). "FActScore: Fine-grained Atomic Evaluation of Factual Precision." EMNLP 2023.
- Thorne, J. et al. (2018). "FEVER: a Large-scale Dataset for Fact Extraction and VERification." NAACL-HLT 2018.
- Guo, C. et al. (2017). "On Calibration of Modern Neural Networks." ICML 2017, PMLR 70:1321–1330.
- Kadavath, S. et al. (2022). "Language Models (Mostly) Know What They Know." Anthropic. arXiv:2207.05221.
- Steyvers, M. et al. (2025). "What Large Language Models Know and What People Think They Know." *Nature Machine Intelligence*.
- van der Bles, A.M. et al. (2019). "Communicating Uncertainty About Facts, Numbers and Science." *Royal Society Open Science*.
- van der Bles, A.M. et al. (2020). "The Effects of Communicating Uncertainty on Public Trust." *PNAS*.
- Evans, O. et al. (2021). "Truthful AI: Developing and Governing AI That Does Not Lie." arXiv:2110.06674.
- Goddard, K. et al. (2012). "Automation Bias: A Systematic Review." *JAMIA/PMC*.
- Slobodkin, A. et al. (2024). "ATTR.FIRST: Attribute First, Then Generate." ACL 2024.
- Bekoulis, G. et al. (2021). "A Review on Fact Extraction and Verification." *ACM Computing Surveys*. DOI:10.1145/3485127.

**官方技术报告与监管文件：**

- NIST (2023). AI Risk Management Framework 1.0 (AI 100-1). U.S. Department of Commerce.
- NIST (2024). AI 600-1: Generative Artificial Intelligence Profile. DOI:10.6028/NIST.AI.600-1.
- European Parliament & Council (2024). Regulation (EU) 2024/1689 (EU AI Act). Official Journal of the European Union.
- OWASP Foundation (2025). OWASP Top 10 for Large Language Model Applications 2025.
- ISO/IEC 42001:2023. Artificial Intelligence — Management System.
- IEEE 7001-2021. Transparency of Autonomous Systems.

**AI 实验室官方文档：**

- Anthropic (2023–2026). Responsible Scaling Policy (v1.0–v3.0). https://www.anthropic.com/responsible-scaling-policy
- Anthropic (2025). "Mitigating the Risk of Prompt Injections in Browser Use." Official research publication.
- OpenAI (2023). GPT-4 System Card. https://cdn.openai.com/papers/gpt-4-system-card.pdf
- OpenAI (2026). GPT-5.4 Thinking System Card. https://deploymentsafety.openai.com/gpt-5-4-thinking
- Google DeepMind (2025). Frontier Safety Framework v3.
- Google DeepMind (2025). "Lessons from Defending Gemini Against Indirect Prompt Injections."
- Microsoft (2022). Responsible AI Standard v2.