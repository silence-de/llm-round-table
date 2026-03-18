# **evidence-backed 决策系统架构设计与信任边界研究报告**

## **Executive Summary**

在面向高风险决策支持（High-Stakes Decision Support）的智能化产品演进中，系统设计的核心诉求正在从“生成式自治（Generative Autonomy）”向“证据驱动的信任（Evidence-Backed Trust）”发生根本性转移。对于类似 Round Table（RT）的决策辅助系统而言，其产品的核心卖点建立在对外部信息的严谨溯源与真实表达之上。此类系统面临的最大架构风险，在于将基于概率的自然语言“提取（Extraction）”过程误导性地包装为确定性的“验证（Verification）”，以及将大语言模型（LLM）的“参数化推理（Model Inference）”等同于“证据结论”。  
本研究报告针对 RT 类系统的产品架构决策进行了深度剖析。研究表明，大语言模型在处理外部数据时存在固有的架构缺陷，即统一的词元（Token）处理机制抹除了系统指令与外部数据之间的信任边界。这种“命令-数据边界（Command-Data Boundary）”的消失，使得传统的提示词工程（Prompt Engineering）在面对间接提示词注入（Indirect Prompt Injection, IPI）时彻底失效。为此，系统必须从架构层面进行隔离，引入基于双模型（Dual-LLM）模式的沙箱隔离与上下文净化（Context Purification）机制，将外部工具输出严格视为不可信输入。  
同时，本报告明确界定了研究结果、浏览器捕获、页面提取与最终摘要的四级信任模型，并从系统和用户界面（UI）两个维度提出了严格区分提取与验证的最佳实践。在面对不确定性表达时，本研究指出必须摒弃基于模型 Softmax 概率的“伪精确（Fake Precision）”，转而采用基于频率格式（Frequency Format）和溯源密度的表达方式，以激活用户的分析型认知（System 2 Thinking），避免确认偏误与责任推诿。通过将不确定性与系统降级策略内化为产品体验的一部分，RT 类系统能够在提供深度研究能力的同时，坚守诚实、透明的产品底线。

## **Verified Findings**

### **统一词元处理导致的命令与数据边界消失**

大语言模型在底层架构上缺乏类似传统冯·诺依曼架构中指令与数据严格分离的机制。所有的输入——无论是系统级的安全指令，还是通过网络搜索工具抓取的外部网页文本——均被转化为统一维度的词元序列送入注意力机制进行计算。这种架构特性决定了模型无法在内部通过自发机制验证某一段文本的来源是否可靠。因此，当系统通过检索增强生成（RAG）或浏览器工具引入外部工件（如电子邮件、PDF 文档、网页）时，系统的信任边界不可避免地被迫向外扩张，覆盖了完全不受控的外部语境2。这种结构性脆弱为间接提示词注入（IPI）提供了温床。攻击者无需直接与系统对话，只需将恶意指令隐写于系统可能检索的外部公开网页或文档中，一旦模型读取这些工具输出，恶意上下文便会劫持模型的规划与工具调用逻辑，引发时间因果上的控制权接管（Temporal Causal Takeover）3。研究明确指出，仅靠系统提示词（System Prompt）中的防御声明无法抵御此类攻击，必须依赖确定性的架构级干预。

### **复杂代理工作流中引用溯源能力的衰退**

在单轮对话或简单的问答任务中，当代大语言模型表现出了尚可接受的引用准确率。然而，在多步骤、长周期的代理（Agentic）研究工作流中，多模态对齐能力与引用溯源（Citation Grounding）能力往往呈现出背离的趋势4。深度研究（Deep Research）基准测试（如 MMDeepResearch-Bench）的评估结果显示，当系统需要跨越多个信息源进行证据聚合与交叉验证时，实体级别的失效（Entity-Level Failures）显著增加。这种失效表现为系统在早期检索阶段正确提取了实体信息，但在最终生成综合报告时，将该信息错误地归因到了不相关的文献或网页上4。此外，主流开源与闭源的深度研究代理在“引用完整性（Citation Integrity）”指标上普遍得分极低，大量生成的声明缺乏具体的证据支撑，或者所引用的来源根本无法逻辑推导出该声明5。这一发现证实，将信息聚合与证据验证交由单一生成过程处理是高度不可靠的。

### **认知负荷与高风险决策中的适度依赖**

在医疗诊断、金融合规或战略规划等高风险决策支持（High-Stakes Decision Support）场景中，人类用户的认知负荷极大。人机交互（HCI）领域的实证研究表明，当决策者面临高认知压力时，极易产生“推诿（Buckpassing）”行为，即过度依赖人工智能的建议，放弃独立思考，从而导致人机协作的整体表现受限于模型的性能上限6。研究发现，仅仅向用户展示模型经过校准的不确定性概率（例如“模型有 85% 的信心认为该结论成立”）是无效且有害的。这种基于概率的表达方式容易引发确认偏误（Confirmation Bias），使用户产生算法迷恋或算法厌恶7。相反，将模型的不确定性转化为频率格式（Frequency Format，例如“在检索到的 10 份相似文档中，有 7 份支持此结论”），能够有效迫使决策者启动分析型推理，根据初始决策动态调整对 AI 的依赖程度，从而实现真正的适度依赖（Appropriate Reliance）8。

## **Trust Boundary Model**

在 RT 这类以“信任”为核心卖点的决策系统中，研究结果、浏览器捕获、页面提取与最终摘要不能被视为具有同等价值的信息实体。系统架构必须建立一个严格的、多层级的信任分类模型（Trust Classification），并根据该模型对数据流进行隔离与管控。这种分类不仅是数据结构的划分，更是系统安全与认知诚实的基础。大语言模型应用的安全威胁模型必须将模型自身视为一个不可信的中间人，而不是系统信任的核心9。  
为了满足 RT 的产品定位，系统的内部数据流动被严格划分为以下四个信任级别，并映射到相应的系统组件中：  
第一级别为密码学信任（Level 0: Cryptographic Trust），对应系统中的“浏览器捕获（Browser Capture / Page Capture）”。这一级别包含了无头浏览器直接抓取的原始 HTML、DOM 树结构、渲染截图以及 TLS 证书数据。其信任度来源于密码学和网络协议的客观属性，系统可以绝对确信目标服务器在特定时间戳提供了这些数据9。然而，这种信任仅限于“溯源的真实性”，对于捕获内容本身的安全性或事实准确性，系统不提供任何背书。这就意味着，捕获的内容虽然在物理层面上是真实的，但其中可能包含极其危险的恶意指令或虚假陈述。  
第二级别为零信任（Level 1: Zero Trust），对应系统中的“研究结果（Research Results / Tool Outputs）”。当外部网页文本、API 响应或 PDF 文档内容被送入系统时，它们构成了间接提示词注入（IPI）的直接攻击面。在系统架构中，所有的工具输出必须默认被视为不可信输入（Untrusted Input）10。这一级别的数据绝对不允许直接流入负责高级推理和规划的特权模型上下文中，否则将导致系统权限被窃取或决策逻辑被篡改。  
第三级别为概率性低信任（Level 2: Probabilistic Trust），对应系统中的“页面提取（Page Extraction）”。这一过程通常由大语言模型执行，将无结构的网络文本转化为结构化的 JSON 或候选声明（Candidate Claims）。由于自然语言处理的本质是基于概率的序列生成，提取过程具有不可避免的损失性和幻觉倾向11。因此，页面提取的结果只能被视为“待验证的假设”，在经过确定性的逻辑交叉比对之前，它们在系统中处于低信任状态，不能作为最终证据呈现给用户13。  
第四级别为派生信任（Level 3: Derived Trust），对应系统中的“最终摘要（Final Summary）”。最终摘要本身不具备任何原生信任，其可信度完全派生自底层证据链的完整性。只有当 Level 2 的提取结果经过严格的确定性验证（如精确的字节偏移量匹配），并牢固绑定到 Level 0 的密码学捕获上时，基于这些验证结果合成的摘要才具备派生信任14。如果摘要中的任何一句话脱离了这种确定性的底层支撑，其信任级别将瞬间跌落至零。  
针对如何将提示词注入与不可信内容风险内化为系统边界，而非仅仅依赖系统提示词（Prompt）的问题，RT 的架构必须实施物理层面的隔离。鉴于指令与数据的混淆特性，系统应采用“双模型架构（Dual-LLM Architecture）”与“上下文净化（Context Purification）”相结合的纵深防御策略16。在这一架构中，专门设置一个“被隔离模型（Quarantined LLM）”负责处理 Level 1 的零信任外部数据。该模型运行在严格的沙箱环境中，被剥夺了任何调用外部工具、访问用户私有状态或执行文件操作的权限。其唯一职责是对脏数据进行结构化提取16。  
在被隔离模型输出提取结果后，系统并非直接将其转交，而是引入上下文净化管线。净化机制通过因果归因与结构保留技术，从提取结果中剥离所有带有执行意图的动词、强制优先级覆盖指令（如“忽略之前所有设定”）以及与用户初始目标无关的附属要求，仅保留纯粹的陈述性数据字段（如数值、日期、实体名词）3。最终，核心的“特权规划模型（Privileged Planner）”仅接收经过净化的、无执行能力的陈述性数据。这种设计将安全风险的防线从脆弱的语义理解层转移到了强硬的系统架构层，从根本上消除了不可信内容导致越权操作的系统性风险。

## **Evidence Classes and Allowed Claims**

在构建高风险决策辅助产品时，系统必须对进入最终摘要的声明（Claims）实行极其严格的准入控制。如果系统允许大语言模型自由发挥，将不可验证的模型推理与从文档中提取的坚实证据混为一谈，产品的信任基石将被彻底摧毁。借鉴自动事实核查领域（如 FEVER 框架）的分类标准，系统必须建立一套非黑即白的证据类别分类法，明确界定哪些信息必须有确凿证据才能作为结论输出，哪些信息只能以认知缺口或模型推理的形式呈现14。  
进入摘要的声明必须满足“强逻辑蕴含”的标准，即该声明必须能够通过形式化或确定性的机制，直接映射到源文档的某个确切位置13。这要求系统在提取与生成之间建立一道过滤网。以下表格详细规定了 RT 类系统中被允许与被禁止进入事实摘要的声明类型：

| 声明分类 (Claim Classification) | 定义与场景示例 | RT 系统的处置策略 | 所需的最低证据标准 (Evidence Requirement) |
| :---- | :---- | :---- | :---- |
| **显式事实 (Explicit Factual)** | 文本中直接陈述的数值、日期、地点、专有名词或特定属性。例如：“A公司于2025年第一季度实现了3000万美元的净利润。” | **完全允许 (Fully Allowed)**。可作为核心证据整合入最终摘要，但必须附带强引用的跳转链接。 | 必须在 Level 0 的浏览器捕获 DOM 树中存在精确的子串重叠（Substring Overlap）或字节级匹配。 |
| **直接关系 (Direct Relational)** | 源文本中明确定义的实体间关联。例如：“John Doe 目前担任 Acme Corp 的首席执行官。” | **完全允许 (Fully Allowed)**。 | 必须证明关系的主体与客体在源文档的同一语义节点或相邻的 HTML 区块中共同出现（Co-occurrence）。 |
| **综合聚合 (Synthesized Aggregation)** | 对显式列表或数据点进行简单的数学汇总或盘点。例如：“该政策文件共列出了 4 项合规豁免条件。” | **条件性允许 (Conditionally Allowed)**。必须向用户展示具体的列表明细，禁止单独抛出孤立的聚合数字。 | 必须成功检索并定位到构成该聚合数字的全部 4 个独立事实锚点。 |
| **隐式语气/情感 (Implicit Tone / Sentiment)** | 源文本未明确表述，需要通过语境揣摩的主观标签。例如：“管理层在财报电话会议中对下半年的市场预期显得非常悲观。” | **严格禁止 (Strictly Disallowed)**。主观评价无法进行密码学溯源，必须降级处理。 | 不适用。此类声明缺乏确定性锚点。 |
| **前瞻性预测 (Predictive / Forecasting)** | 基于当前数据点对未来状态的主观外推。例如：“根据目前的供应链延误趋势，预计该产品的第四季度交付量将下降 20%。” | **严格禁止 (Strictly Disallowed)**。超出文本事实提取的边界，属于过度推断。 | 不适用。超出了源文档的时间与语义范畴。 |
| **跨文档推断 (Cross-Document Inference)** | 将不同文档中的孤立事实进行因果关联，而原作者并未建立此关联。例如：文档 A 显示某化学品泄漏，文档 B 显示某地患病率上升。模型生成：“泄漏导致了患病率上升。” | **严格禁止 (Strictly Disallowed)**。这构成了生成原始研究假设，而非事实提取。 | 不适用。系统只能陈述 A 和 B 分别存在，不能代为推导因果。 |

对于上述表格中被归类为“严格禁止”的声明类型，如果它们对于回答用户的初始查询具有高度的相关性或启发性，系统绝对不能将它们混入经过验证的证据摘要中。相反，这些信息只能以知识缺口（Gap）、未决问题（Unresolved）或明确标注的“模型推理（Model Inference）”的形式呈现。  
当用户查询涉及前瞻性预测或跨文档因果推断时，系统应当在 UI 的侧边栏或摘要下方的隔离区域展示这些推论，并强制添加诸如“基于检索数据的逻辑推演，尚未得到直接文献证实”的显式警告20。同样，当检索到的文档中缺失用户请求的关键参数时，模型不能利用其在预训练阶段记忆的参数化知识进行填补。系统必须生成一个 gapReason 对象，在 UI 中将此缺失部分渲染为显式的“未解析的数据点（Unresolved Parameter）”。这种将“未知”和“推断”进行物理隔离和视觉降级的做法，是防止将大语言模型的泛化能力包装为确凿证据的根本手段。

## **Verification vs Extraction Guidance**

在构建 RT 这种以信任为核心诉求的系统时，产品设计与工程实现中最致命的误区，是将“信息提取（Extraction）”与“证据验证（Verification）”混为一谈。在系统架构和用户界面中，这两个概念必须被视为两种截然不同、甚至相互对立的操作模式，并在物理和视觉层面进行严格区分。  
从认识论与计算机科学的底层逻辑来看，提取与验证属于两种完全不同的计算范式。信息提取是一个基于自然语言处理（NLP）的概率性生成过程。它的目标是从嘈杂、非结构化或半结构化的机器可读文档中，利用语言模型的上下文理解能力，猜测并识别出相关的结构化实体和关系11。由于依赖深度神经网络的采样和概率分布，提取过程不可避免地具有一定程度的不可靠性，容易出现格式偏差、实体混淆或幻觉12。相反，验证是一个确定性的还原过程。它的核心任务不是生成任何新的文本或信息，而是通过算法（如精确字符串匹配、正则表达式或受限的句法依存分析）来证明提取出的结构化数据毫无偏差地存在于原始的密码学捕获（Level 0）数据中13。如果提取是“大胆假设”，那么验证就是“小心求证”。  
为了在系统中严格区分这两种状态，底层的数据模型（Data Model）必须被设计为一个状态机，确保任何信息在经历确定性验证之前，无法进入最终的摘要渲染管线。在系统层面上，一条数据流的生命周期必须包含分离的元数据结构。首先，系统生成一个“候选声明（Candidate Claim）”对象，该对象包含被提取的文本内容，并被强制标记为“未验证（UNVERIFIED\_CANDIDATE）”。随后，独立的验证模块——通常是不包含大型生成模型的正则引擎或基于精准子串匹配的脚本——接收该候选声明，并尝试在原始 DOM 树或 PDF 字节流中寻找完全匹配的锚点。只有当验证模块成功捕获目标文本的起始和结束字节偏移量（Byte Offset），或精确的 XPath 路径时，该数据对象的状态才会翻转为“已验证（VERIFIED）”，并附加上包含文档 ID 和页面坐标的密码学锚点数据15。如果验证失败，该提取结果将被直接丢弃或退回到提取模型进行修正重试21。  
在用户界面（UI）的表达上，这种系统级的隔离必须被直接映射为视觉上的隐喻。如果在处理过程中系统需要向用户展示实时进度，任何仍处于“提取”阶段的文本必须具有临时性或不确定性的视觉特征。例如，可以使用浅色字体、斜体、波浪形虚线边框，或者在文本旁保留加载动画，明确向用户传达这些内容只是系统正在进行的处理中间态，尚未成为定论。一旦该声明通过验证模块，其视觉样式必须瞬间转变为永久性特征，如深色实体文本或实线边框。  
更为关键的是验证状态的交互设计。对于进入摘要的每一条声明，UI 必须禁止使用“孤立引用（Orphaned Citations）”——即仅仅在段落末尾添加一个无法互动的 \`\` 或单纯链接到原网页 URL 的做法。真正的验证在 UI 上的体现，要求用户点击引用标签时，界面能够无缝展开一个双栏视图（Side-by-side View）。在视图的一侧是生成的摘要结论，另一侧则呈现由系统截获的静态网页快照或文档原件。系统必须利用验证阶段获取的准确字节偏移量和 XPath 路径，在原件的静态视图上高亮显示出具体的段落或句子15。这种让用户通过视觉直观地确认摘要与原始证据之间连线的交互设计，是 RT 系统在产品层面将提取与验证彻底分离的最高体现。

## **User-Facing Honesty Guidelines**

在高风险的决策支持场景中，系统如何向用户呈现不确定性，直接决定了人机协作的成败。如果 UI 设计不当，不仅无法提示风险，反而可能由于“伪精确（Fake Precision）”而诱导用户产生危险的自动化偏见（Automation Bias）6。RT 类系统必须制定并恪守严格的面向用户的诚实准则（User-Facing Honesty Guidelines），确保系统的不确定性表达能够真正促进用户的批判性思考。  
在数据模型与 UI 表达不确定性时，最应避免的陷阱就是落入基于系统底层置信度得分的“伪精确”。工程团队经常倾向于捕获大模型输出时的词元概率（Log-probabilities）或归一化后的 Softmax 分数，并将其直接转化为 UI 上的百分比，例如显示“系统对该摘要的置信度为 87.4%”。在真实的业务决策环境中，这种数字毫无意义，并且极其危险22。由于现代深度学习模型普遍存在校准不良（Uncalibrated）的问题，高置信度得分并不能真实反映事实的准确性。更重要的是，心理学与 HCI 研究指出，非专业决策者会盲目锚定这一精确的百分比，导致过度信任，放弃了对原始证据的审查6。  
为了避免伪精确，UI 应当采用“频率格式（Frequency Format）”结合“溯源密度（Provenance Density）”的策略来表达不确定性7。这种方法将不确定性的度量从模型内部不可知的数学黑盒，转移到了外部可验证的证据分布上。与其向用户报告系统自身的信心，不如客观描述证据的丰度。例如，不要使用“有 90% 的把握认为市场份额下降”，而应当表述为“在检索到的 12 份行业分析报告中，有 9 份指出了市场份额下降的趋势”。这种频率格式的设计起到了认知强制函数（Cognitive Forcing Function）的作用，成功将用户的思维模式从依赖直觉的“系统 1”切换到需要理性分析的“系统 2”，迫使他们评估证据的权重，而非盲目接受机器的裁决24。对于证据不足的情况，UI 可以明确标注“声明仅建立在单一信息源之上，未发现交叉验证支撑”，从而诚实地揭示单一来源可能带来的偏差风险。  
此外，为了纠正业界普遍存在的过度拟人化和过度承诺，RT 系统必须对常见的误导性 UI 文案进行全面整改。以下表格指出了当前产品中常见的误导性文案，并提供了符合证据驱动原则的替换建议：

| 当前常见 UI 文案 (Misleading) | 误导用户的本质原因 | RT 系统推荐文案 (Honest & Evidence-backed) |
| :---- | :---- | :---- |
| **“大量证据证明了...”** (The evidence proves that...) | 人工智能系统无法“证明”客观物理现实，它们只能验证某段文本是否存在于某份截获的文档中。使用“证明”一词僭越了系统的认知边界。 | **“捕获的源文档指出...”** (The captured documents state that...) 或 **“记录显示...”** |
| **“经 AI 验证确认”** (AI Verified) | 赋予了 AI 模型超越其能力的客观真理裁判权，暗示 AI 具有全知全能的背景知识，掩盖了验证本质上是字符串匹配的操作。 | **“已进行原文交叉核对”** (Cross-referenced with Source) 或 **“文本匹配成功”** |
| **“系统正在分析深层数据...”** (Analyzing the data...) | 对简单的自然语言提取过程进行过度拟人化包装，暗示系统正在进行复杂的数理统计或高级逻辑推演，提高用户的不合理期望。 | **“正在从文本中提取相关陈述...”** (Extracting statements from text...) |
| **“未找到相关结果”** (No results found) | 语义极其模糊。用户无法判断是搜索查询构建错误、目标网站使用了反爬虫技术屏蔽了抓取，还是目标实体确实不存在。 | **“目标域名拒绝捕获请求”** 或 **“检索未命中匹配的关键词”**，并附带具体的 gapReason。 |

通过强制使用描述系统实际机械动作（如“提取”、“交叉核对”）的客观词汇，替代带有主观裁判色彩（如“证明”、“分析”）的词汇，RT 能够在长期的用户交互中重塑用户的心智模型，确立起一个边界清晰、诚实可靠的专业辅助工具形象。

## **Recommended Minimum Design for RT**

基于前述的理论框架与信任边界分析，为了实现一个真正以证据为支撑、并严格防范不可信内容注入的决策辅助系统，本报告为 Round Table 提出了一套推荐的最小可行系统架构设计（Recommended Minimum Design）。该设计涵盖了从接收用户指令到最终渲染结果的端到端管线，并着重探讨了当外部研究缺失或失败时，系统和 UI 的最佳降级策略。

### **确定性的“先验证，后综合”核心工作流**

RT 的核心工程管线必须贯彻“特权隔离”与“确定性验证”的原则，其基本处理流程可划分为以下六个阶段：

1. **查询分解与意图隔离（Decomposition & Isolation）：** 用户的长文本查询首先被拆解为多个独立的原子级事实目标（Atomic Factual Targets）。这一步由可信的特权模型完成，以明确系统需要寻找的具体数据类型。  
2. **隔离检索与密码学捕获（Quarantined Retrieval）：** 系统利用网络检索工具在外部互联网寻找信息源。对于高价值目标，系统启动无头浏览器进行深度捕获。所有抓取的网页源代码、PDF 文档流和 TLS 证书均作为“Level 0 密码学信任”工件，被封存在零信任的独立内存沙箱中。  
3. **上下文因果净化（Causal Context Purification）：** 在提取之前，零信任沙箱内的原始文本需经过净化引擎处理。该引擎采用时间因果诊断（Temporal Causal Diagnostics）或类似的语义脱水技术，强行剔除文本中潜在的执行性指令、动词和逻辑控制符，彻底破坏间接提示词注入（IPI）的有效载荷，仅保留事实数据3。  
4. **沙箱架构下的模式提取（Schema Extraction）：** 仅具有受限权限的被隔离模型（Quarantined LLM）对净化后的文本进行扫描，将原子目标映射为标准化的 JSON 结构（即候选声明）16。  
5. **确定性逻辑验证（Deterministic Verification）：** 提取管线终止。系统启用基于规则或脚本的验证器，对提取出的候选声明进行硬性校验，通过计算文本字节偏移量或 XPath 路径，确保 JSON 中的字段完全包含在原始捕获的 DOM 树中15。只有通过这一步，提取物才被授予系统级信任。  
6. **特权综合与渲染（Privileged Synthesis）：** 核心特权规划模型接管工作。它只能读取被标记为“已验证”的陈述性 JSON 节点，将其组合成符合用户要求、阅读流畅的最终报告，并生成精确到行的前端 UI 引用标签。

### **渐进式降级策略（Graceful Degradation Strategy）**

在实际运行中，Web 检索充满变数。目标网站可能宕机、反爬虫机制可能拦截捕获，或者相关信息根本未被公开。传统架构往往在此时通过大模型的参数化记忆进行“幻觉填补”，或者抛出硬编码的错误页面。对于标榜信任的 RT 系统而言，面对研究缺失或组件失败时的反应，是建立长期信任的关键。系统必须将“失败的检索”转化为“有价值的负向证据”，采取包含具体反馈的渐进式降级策略（Graceful Degradation Strategy）25。  
当检索遇到障碍时，UI 应当按以下四个层级进行透明的降级展示：  
**层级一：最优状态（Multi-Source Verification）**

* **系统状态：** 矢量搜索与网络检索均成功，获取到多个独立的数据源，且提取的声明通过了确定性验证，完美重叠。  
* **UI 降级策略：** 无降级。正常展示综合摘要。引用标签呈现为绿色或实线样式，支持精准的侧边栏高亮对应展示。

**层级二：单源或降级检索（Degraded Retrieval）**

* **系统状态：** 深度搜索未能获取多个交叉验证源，或者来源之间存在矛盾。系统启用备用检索机制（如基于关键词的词法搜索，或提取语义缓存的历史结果）26，最终仅找到一个可用的合法来源。  
* **UI 降级策略：** 摘要照常生成，但整个证据模块周围添加视觉警告边界。UI 顶部出现基于频率的警告提示：“注意：本段结论仅建立在 1 个独立信息源之上，缺乏其他来源的交叉验证支持。”

**层级三：捕获受阻（Component Blocked）**

* **系统状态：** 目标域部署了强力的 WAF 或反爬虫规则，导致系统的无头浏览器无法完成高质量的 Level 0 捕获，只能获取搜索引擎的零散摘要（Snippets）或受限元数据。  
* **UI 降级策略：** 系统从“验证模式”降级为“启发式探索模式”。摘要区不再进行肯定性陈述，UI 明确抛出特定的拦截原因（如 \`\`）。文案调整为：“无法获取原始文档。基于搜索引擎片段提取了初步线索，但这些信息未经验证程序确认，请谨慎参考。”

**层级四：信息彻底缺失（Total Knowledge Gap）**

* **系统状态：** 经过多轮计划扩展与同义词泛化搜索，互联网上确实不存在与用户查询严格匹配的数据。  
* **UI 降级策略：** 这是与普通大模型表现出最大差异的环节。系统绝对禁止输出空泛的安慰性废话，而是将“未能找到”这一过程转化为工作成果25。UI 输出一份详尽的《检索审计日志（Investigation Audit Log）》，列出系统所尝试的所有特定查询词、遍历的 15 个特定数据域以及耗时。最终抛出结论：“经过深度耗竭性检索（Exhaustive Search），未能发现支持该声明的公开证据。”将失败本身包装为严谨系统边界的体现，反向巩固用户对产品能力的信任。

## **Anti-Patterns**

为确保系统始终运行在受控的信任边界内，工程开发与产品设计过程中必须绝对避免以下四种常见的架构与体验反模式（Anti-Patterns）：

1. **直接透传 RAG 反模式（The "Pass-Through" RAG Anti-Pattern）：** 这是最普遍的架构失误。系统在检索引擎返回相关文档后，直接将原始网页的全文连同用户的提问一起扔进主模型的上下文窗口。这种做法瞬间压垮了特权模型的信任边界，为外部网页中潜藏的间接提示词注入（IPI）打开了后门，是导致系统被远程接管的元凶。  
2. **隐形降级反模式（Invisible Failure Anti-Pattern）：** 当外部 API 超时或某个关键 PDF 文档解析失败时，系统没有在数据流中显式抛出异常，而是悄悄利用大模型底层权重的先验知识生成了一个“听起来合理”的答案，并在界面上呈现给用户。这种绕过事实库的填补行为打破了数据溯源链条，是导致幻觉的最快途径。  
3. **基于相似度的伪验证反模式（Similarity-Threshold Verification）：** 部分系统使用向量余弦相似度（Cosine Similarity）比较大模型生成的句子与检索文档的段落，若相似度大于 0.85 便判定为“已验证”。这是一个严重的逻辑缺陷。余弦相似度只能衡量语义主题的相近性，不能衡量事实的蕴含关系。大模型完全可以生成一个相似度高达 95% 但逻辑完全相反的句子（例如偷偷加入了一个“不”字）。验证必须基于确定性的符号推演或精确文本覆盖。  
4. **幽灵引用反模式（Orphaned Citations）：** 仅在摘要的句末随意贴上一个 \`\`，点击后仅仅打开目标网页的首页 URL。由于没有记录源文本精确的字节偏移量或 DOM 节点位置，当用户面对一篇长达几十页的研报时，根本无法快速定位证据15。如果用户无法进行“一瞥即得”的验证，这个引用标签对于高风险决策支持系统而言便形同虚设。

## **Open Questions**

尽管本报告提出的双模型沙箱、因果净化以及确定性验证管线能够有效建立起 RT 产品的信任边界，但随着技术演进，仍有一些亟待解决的工程与认知难题：

1. **净化延迟与安全性平衡：** 实施时间因果诊断（Temporal Causal Diagnostics）和复杂的上下文净化会在模型推理前引入显著的计算延迟。如何在不牺牲对零日（Zero-day）IPI 变种检测精度的前提下，优化这套串行管线以满足实时互动的性能需求？  
2. **动态渲染 DOM 的防伪验证：** 随着现代网页越来越依赖于客户端 JavaScript 进行重度渲染与图表绘制（如 WebGL 数据可视化大屏），如何确保 Level 0 的密码学捕获能够深层渗透并准确验证嵌藏在交互式 Canvas 元素内部的数据资产，而不被站点的防指纹技术所欺骗？  
3. **认知强制函数的疲劳阈值：** 频率格式提示和持续的溯源交互（Side-by-side verification）虽然能唤醒决策者的系统 2 思维，但高频的警示性干预极易导致“警告疲劳（Warning Fatigue）”。若用户因操作繁琐重新退回到麻木的点击接受状态，产品如何在专业严谨与流畅体验之间确立最优的交互干预频率？

## **Source List**

18 Temporal Causal Diagnostics for LLM Agents: AgentSentry mechanisms enabling safe continuation through causally guided context purification. 11 Information extraction (IE) fundamental task definition: Processing human language texts by means of probabilistic NLP techniques. 4 MMDeepResearch-Bench (arXiv:2601.12346): Multimodal alignment divergence and marked rise in entity-level citation grounding failures in deep research agents. 29 AgentFence (arXiv:2602.07652): Architecture-centric security evaluation spanning planning, memory, retrieval, and 14 trust-boundary attack classes. 25 Graceful Degradation Strategy implementation: Transforming tool execution failures into reasoning inputs and manageable exceptions. 20 Agent-Fence Vulnerability Mapping: Trace-auditable conversation breaks highlighting unauthorized tool use and state integrity violations. 3 AgentSentry Inference-time framework: Mitigating multi-turn IPI as a temporal causal takeover without relying on heuristic detection. 7 Designing for Appropriate Reliance in AI-Assisted Decision-Making (2401.05612): The critical role of presenting model uncertainty in a frequency format to reduce confirmation bias. 14 FEVER (Fact Extraction and VERification) Benchmark: Distinct separation of generating claims and the verifiable judgment against textual sources. 4 Deep Search and Agentic Reasoning: The challenge of multi-step search and cross-checking leading to mis-attributed evidence aggregation. 8 High-Stakes Human-AI Collaboration: The inadequacy of showing calibrated model uncertainty alone and the influence of cognitive heuristics. 24 Predictive Decision Making (OzCHI): High-stakes decisions, System 1 vs. System 2 thinking, and appropriate reliance presentation formats. 26 Single points of failure in RAG-based agents: The necessity of multi-source retrieval, circuit breakers, and semantic caching for consistent reliability. 30 Agentic Retrieval Techniques: Utilizing failure feedback loops to route queries to backup data sources rather than hallucinating missing information. 28 RAG Architecture Patterns: Implementing timeouts and fallback mechanisms to maintain partial functionality during document processing component failures. 27 Designing Graceful Degradation into Complex Systems: Addressing technological and human operator causation of degradation in preventative strategies. 11 Information Extraction NLP processing: Automatically extracting structured data and semantic domains from electronically represented sources. 29 Deep Agents and Trajectory Failures (AgentFence): State manipulation and trust boundary variations in LangGraph vs. AutoGPT models. 31 LLM Trust Boundaries and Attack Surface: The fundamental merging of trusted system instructions and untrusted user input without inherent delimiters. 15 Precise line-level citations for source attribution: Overcoming the approximate retrieval limits via mechanical verification checks for exact line references. 6 AI Uncertainty Presentation (CSCW1): High cognitive load, buckpassing behavior, and formatting recommendations to mitigate decision stress. 10 Guardrails in Depth: Redacting sensitive fields and actively tagging tool outputs (web/RAG) as untrusted inputs prior to LLM processing. 16 Clawdbot SecOps Zero Trust: Dual-LLM Architecture separating a Privileged LLM from a Quarantined LLM to mitigate prompt injection via symbolic dereferencing. 9 Threat Models for LLM Applications: Architectural defenses treating the model as an untrusted intermediary rather than relying on system prompt boundaries. 15 Mechanical verification in Citation Grounding: Utilizing line-level overlap to substantiate evidence in analytical and code comprehension domains. 5 DREAM framework evaluation (arXiv:2602.18940): Critically low Citation Integrity scores and negligible claim attribution rates in open-source deep research agents. 19 Fact Extraction and Verification framework: Utilizing document extraction and verdict assignment for credible information retrieval against informal posts. 32 AI as a Research Assistant: The strict demarcation between automated fusion-in-decoder retrieval and human-only interpretive judgment/construct definition. 3 Multi-turn IPI trajectories: Utilizing counterfactual re-executions to localize takeover points and block high-risk actions. Trustworthy Agentic AI (arXiv:2602.09947): The structural flaw of uniform token processing erasing command-data boundaries and enabling Lethal Trifecta exploits. 8 AI-Assisted Medical Decision Making: Designing frequency formats to calibrate user reliance compared to probability-based uncertainty metrics. 33 Indirect prompt injection mitigation: The futility of prompt engineering against content sanitization breaks, necessitating explicit delimiters and strict least-privilege. 10 Treating tool outputs as untrusted: Strict output filtering protocols applied prior to re-entering LLM context paths. 13 Cascaded NLP Clinical Extraction: The separation of probabilistic term classification and boundary recognition from lexical verification. 8 Synergistic human-AI collaboration: Mitigating over-reliance via frequency-formatted uncertainty presentation in skin cancer screening tasks. 2 AgentDojo Stress-tests: Multi-step trajectories where injected context reliably triggers unsafe actions via seemingly legitimate tool results. 22 Cost of Delay and Fake Precision: Quantifying uncertainty with ranges and explicit visual baselines rather than arbitrary precision scores. 23 AI Tools for Product Managers: The danger of scoring systems creating fake precision that leads cross-functional teams in the wrong direction. 2 Inference-time defenses against IPI: AgentSentry's temporal causal diagnostic protocols analyzing context-mediated influence on user goals. 9 Authentication Authorization Layer Security: Ensuring retrieved content is explicitly framed as data, possessing near-zero trust in open-web contexts. 21 Schema-guided extraction pipeline: Multi-turn JSON generation with post-processing recovery to counteract LLM hallucination and formatting limitations. 12 Relation Extraction Automation (arXiv:2412.07289): Overcoming LLM relational biases through automated feedback, verification, and rationale-supervised corrections. 5 Temporal Knowledge Volatility: Deficiencies in current agent models regarding dynamic retrieval and maintaining rigorous citation faithfulness. 34 Document Validation Methodologies: The discrete systemic steps of document collection, data extraction, and subsequent authenticity validation. 6 Decision-making demographics: Incorporating cognitive forcing functions to deter buckpassing in algorithmic decision systems. 24 System 1 vs. System 2 cognitive processing: Exploring human confidence presentations in ambiguous predictive decision environments. 35 Self-confidence alignment in human-AI interactions: Utilizing real-time feedback and uncertainty visualizations to modify downstream reliance. 17 Willison's Dual LLM Pattern: Preventing feedback loops via a constrained execution environment that quarantines untrusted external web data from core planners. 8 Confirmational bias in AI aids: How users ignore raw probability indices without clear, frequency-based environmental context.

#### **引用的著作**

1. AgentSentry: Mitigating Indirect Prompt Injection in LLM Agents via Temporal Causal Diagnostics and Context Purification \- arXiv.org, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2602.22724v1](https://arxiv.org/html/2602.22724v1)  
2. AgentSentry: Mitigating Indirect Prompt Injection in LLM Agents via Temporal Causal Diagnostics and Context Purification \- arXiv.org, 访问时间为 三月 18, 2026， [https://arxiv.org/pdf/2602.22724](https://arxiv.org/pdf/2602.22724)  
3. MMDeepResearch-Bench: A Benchmark for Multimodal Deep Research Agents \- arXiv, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2601.12346v1](https://arxiv.org/html/2601.12346v1)  
4. DREAM: Deep Research Evaluation with Agentic Metrics \- arXiv, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2602.18940v1](https://arxiv.org/html/2602.18940v1)  
5. How Individuals' Decision-Making Patterns Affect Reliance on AI \- arXiv.org, 访问时间为 三月 18, 2026， [https://arxiv.org/pdf/2505.01537](https://arxiv.org/pdf/2505.01537)  
6. Designing for Appropriate Reliance: The Roles of AI Uncertainty Presentation, Initial User Decision, and User Demographics in AI-Assisted Decision-Making \- Emergent Mind, 访问时间为 三月 18, 2026， [https://www.emergentmind.com/articles/2401.05612](https://www.emergentmind.com/articles/2401.05612)  
7. Designing for Appropriate Reliance: The Roles of AI Uncertainty Presentation, Initial User Decision, and User Demographics in AI-Assisted Decision-Making | Request PDF \- ResearchGate, 访问时间为 三月 18, 2026， [https://www.researchgate.net/publication/380189804\_Designing\_for\_Appropriate\_Reliance\_The\_Roles\_of\_AI\_Uncertainty\_Presentation\_Initial\_User\_Decision\_and\_User\_Demographics\_in\_AI-Assisted\_Decision-Making](https://www.researchgate.net/publication/380189804_Designing_for_Appropriate_Reliance_The_Roles_of_AI_Uncertainty_Presentation_Initial_User_Decision_and_User_Demographics_in_AI-Assisted_Decision-Making)  
8. Securing LLM Apps: Prompt Injection and Credential Theft Risks \- Kiteworks, 访问时间为 三月 18, 2026， [https://www.kiteworks.com/cybersecurity-risk-management/prompt-injection-credential-theft-ai-trust/](https://www.kiteworks.com/cybersecurity-risk-management/prompt-injection-credential-theft-ai-trust/)  
9. Agentic AI Systems in the Cloud: LLM Workflows with Tools, Memory & Guardrails, 访问时间为 三月 18, 2026， [https://softwareinterviews.com/articles/agentic-ai-systems-in-the-cloud-llm-workflows-with-tools-memory-guardrails/](https://softwareinterviews.com/articles/agentic-ai-systems-in-the-cloud-llm-workflows-with-tools-memory-guardrails/)  
10. Information extraction \- Wikipedia, 访问时间为 三月 18, 2026， [https://en.wikipedia.org/wiki/Information\_extraction](https://en.wikipedia.org/wiki/Information_extraction)  
11. Enhancing Relation Extraction via Supervised Rationale Verification and Feedback \- arXiv, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2412.07289v1](https://arxiv.org/html/2412.07289v1)  
12. A knowledge discovery and reuse pipeline for information extraction in clinical notes \- PMC, 访问时间为 三月 18, 2026， [https://pmc.ncbi.nlm.nih.gov/articles/PMC3168325/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3168325/)  
13. FEVER: a large-scale dataset for Fact Extraction and VERification \- Amazon Science, 访问时间为 三月 18, 2026， [https://www.amazon.science/publications/fever-a-large-scale-dataset-for-fact-extraction-and-verification](https://www.amazon.science/publications/fever-a-large-scale-dataset-for-fact-extraction-and-verification)  
14. Citation-Grounded Code Comprehension: Preventing LLM Hallucination Through Hybrid Retrieval and Graph-Augmented Context \- arXiv.org, 访问时间为 三月 18, 2026， [https://arxiv.org/pdf/2512.12117](https://arxiv.org/pdf/2512.12117)  
15. Clawdbot SecOps: The 10 Threats You Didn't Know Existed (And How to Stop Them), 访问时间为 三月 18, 2026， [https://solafide.ca/blog/clawdbot-secops-agentic-zero-trust](https://solafide.ca/blog/clawdbot-secops-agentic-zero-trust)  
16. Design Patterns for Securing LLM Agents against Prompt Injections \- arXiv, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2506.08837v2](https://arxiv.org/html/2506.08837v2)  
17. \[2602.22724\] AgentSentry: Mitigating Indirect Prompt Injection in LLM Agents via Temporal Causal Diagnostics and Context Purification \- arXiv.org, 访问时间为 三月 18, 2026， [https://arxiv.org/abs/2602.22724](https://arxiv.org/abs/2602.22724)  
18. A FACT EXTRACTION AND VERIFICATION FRAMEWORK FOR SOCIAL MEDIA POSTS ON COVID-19 \- CEUR-WS.org, 访问时间为 三月 18, 2026， [https://ceur-ws.org/Vol-3406/paper5\_jot.pdf](https://ceur-ws.org/Vol-3406/paper5_jot.pdf)  
19. Agent-Fence: Mapping Security Vulnerabilities Across Deep Research Agents | Request PDF \- ResearchGate, 访问时间为 三月 18, 2026， [https://www.researchgate.net/publication/400604476\_Agent-Fence\_Mapping\_Security\_Vulnerabilities\_Across\_Deep\_Research\_Agents](https://www.researchgate.net/publication/400604476_Agent-Fence_Mapping_Security_Vulnerabilities_Across_Deep_Research_Agents)  
20. Efficient and Verified Extraction of the Research Data Using LLM \- Preprints.org, 访问时间为 三月 18, 2026， [https://www.preprints.org/manuscript/202511.2140](https://www.preprints.org/manuscript/202511.2140)  
21. Cost of Delay: How to calculate delay cost per week, use WSJF \- Selleo, 访问时间为 三月 18, 2026， [https://selleo.com/blog/cost-of-delay-cod-how-to-calculate-delay-cost-per-week-use-wsjf-and-decide-if-buying-time-is-worth-it](https://selleo.com/blog/cost-of-delay-cod-how-to-calculate-delay-cost-per-week-use-wsjf-and-decide-if-buying-time-is-worth-it)  
22. AI Tools for Product Managers in 2026: A Practical Guide by Use Case, 访问时间为 三月 18, 2026， [https://bagel.ai/blog/ai-tools-for-product-managers-in-2026-a-practical-guide-by-use-case/](https://bagel.ai/blog/ai-tools-for-product-managers-in-2026-a-practical-guide-by-use-case/)  
23. Impact of uncertainty visualizations on multi-criteria decision-making \- Department of Industrial and Manufacturing Systems Engineering \- Iowa State University, 访问时间为 三月 18, 2026， [https://www.imse.iastate.edu/files/2024/07/Newendorp\_iastate\_0097M\_21458.pdf](https://www.imse.iastate.edu/files/2024/07/Newendorp_iastate_0097M_21458.pdf)  
24. Building an AI Review Article Writer: The Reactive Agent Deep Dive \- reckoning.dev, 访问时间为 三月 18, 2026， [https://reckoning.dev/posts/ai-review-writer-04-reactive-agent](https://reckoning.dev/posts/ai-review-writer-04-reactive-agent)  
25. Ensuring AI Agent Reliability in Production Environments: Strategies and Solutions, 访问时间为 三月 18, 2026， [https://www.getmaxim.ai/articles/ensuring-ai-agent-reliability-in-production-environments-strategies-and-solutions/](https://www.getmaxim.ai/articles/ensuring-ai-agent-reliability-in-production-environments-strategies-and-solutions/)  
26. Designing Graceful Degradation into Complex Systems, 访问时间为 三月 18, 2026， [https://ntrs.nasa.gov/api/citations/20180006863/downloads/20180006863.pdf](https://ntrs.nasa.gov/api/citations/20180006863/downloads/20180006863.pdf)  
27. RAG Architecture Patterns: Building Reliable AI Applications \- Tetrate, 访问时间为 三月 18, 2026， [https://tetrate.io/learn/ai/rag-architecture-patterns](https://tetrate.io/learn/ai/rag-architecture-patterns)  
28. Agent-Fence: Mapping Security Vulnerabilities Across Deep Research Agents \- arXiv.org, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2602.07652v1](https://arxiv.org/html/2602.07652v1)  
29. Agentic Retrieval Techniques for Complex Codebases | Augment Code, 访问时间为 三月 18, 2026， [https://www.augmentcode.com/learn/agentic-retrieval-techniques-for-complex-codebases](https://www.augmentcode.com/learn/agentic-retrieval-techniques-for-complex-codebases)  
30. Prompt Injection Attacks in Large Language Models and AI Agent Systems: A Comprehensive Review of Vulnerabilities, Attack Vectors, and Defense Mechanisms \- MDPI, 访问时间为 三月 18, 2026， [https://www.mdpi.com/2078-2489/17/1/54](https://www.mdpi.com/2078-2489/17/1/54)  
31. Inventing with Machines: Generative AI and the Evolving Landscape of IS Research, 访问时间为 三月 18, 2026， [https://pubsonline.informs.org/doi/10.1287/isre.2025.editorial.v36.n4](https://pubsonline.informs.org/doi/10.1287/isre.2025.editorial.v36.n4)  
32. What is Indirect Prompt Injection? Risks & Prevention \- SentinelOne, 访问时间为 三月 18, 2026， [https://www.sentinelone.com/cybersecurity-101/cybersecurity/indirect-prompt-injection-attacks/](https://www.sentinelone.com/cybersecurity-101/cybersecurity/indirect-prompt-injection-attacks/)  
33. Complete Guide to Document Verification: Process, Benefits & Compliance | Persona, 访问时间为 三月 18, 2026， [https://withpersona.com/blog/document-verification-understanding-the-whole-process](https://withpersona.com/blog/document-verification-understanding-the-whole-process)  
34. As Confidence Aligns: Exploring the Effect of AI Confidence on Human Self-confidence in Human-AI Decision Making \- arXiv, 访问时间为 三月 18, 2026， [https://arxiv.org/html/2501.12868v1](https://arxiv.org/html/2501.12868v1)