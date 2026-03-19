# Topic 4 Cross-Reference Analysis: Trust Boundary 与 Evidence 诚实表达
> 分析者：Claude Sonnet 4.6 | 日期：2026-03-19

---

## 1. 各报告核心主张摘要

### Claude 报告（证据驱动决策系统的信任边界与诚实表达机制）

RT 类产品最大的系统性风险是将"提取"伪装为"验证"，将"模型推断"包装为"证据结论"。报告提出五级信任分类模型（L0–L4），核心原则是"信任只降不升"——从不可信来源提取的信息不能因提取成功而变得可信。报告特别强调 RLHF 对齐训练系统性地恶化了模型校准度，57% 的引用属于事后合理化，因此 UI 层面必须强制区分"来源声称"与"系统确认"。报告还提出了完整的声明数据模型（含 provenanceType、trustLevel、supportStrength、gapReason 等字段）和七类反模式清单。

### GPT-5.4 报告（Evidence-backed 决策系统如何定义 Trust Boundary）

核心主张是：RT 的"可信"必须被定义为一组可审计的边界与流程约束，而非若干句"请忽略注入"的 prompt。报告提出 T0–T4 五级信任分类，强调控制面（policy/权限/流程）必须移出模型，数据面（网页/检索/工具输出）按不可信输入处理。报告对 UI 标签做了三类严格划分（Captured / Extracted / Evidence-backed），并提出"频率式表达优于置信度百分比"的不确定性表达原则。降级策略上主张"宁可输出结构化 gaps，也不要输出看起来完整的总结"。

### MiniMax 报告（Evidence-Backed 决策系统的 Trust Boundary 与诚实表达研究报告）

报告提出最为细粒度的信任分类体系（TL0–TL5-I，共 9 个级别），并将 Verification 独立性作为核心架构要求——Verification model 必须不同于 Summary generation LLM，Verification sources 必须与 extraction sources 分离。报告引入了四维不确定性分类（Aleatoric / Epistemic / Input / Prediction），并提出了完整的声明过滤 pipeline 伪代码。在 anti-patterns 方面，报告系统性地列举了 Verification、Uncertainty、Trust Boundary、Injection 四类共 12 个反模式，是四份报告中最为结构化的一份。

### Gemini 报告（信任边界与证据决策系统）

报告从 LLM 底层架构出发，指出统一词元处理机制从根本上消除了指令与数据的边界，这是所有信任问题的架构根源。报告提出"双模型架构（Dual-LLM）+ 上下文净化（Context Purification）"作为对抗 IPI 的核心工程方案，是四份报告中唯一明确提出具体防御架构的。信任分类采用四级（密码学信任 / 零信任 / 概率性低信任 / 派生信任），并强调最终摘要的信任完全派生自底层证据链，任何一句话脱离确定性支撑则信任瞬间归零。UI 层面主张用"双栏视图 + 字节偏移量高亮"实现提取与验证的物理分离。

---

## 2. 共识点

**共识 1：提取 ≠ 验证，这是最核心的架构原则**
四份报告均将"extraction 与 verification 的混淆"列为 RT 类产品最严重的设计缺陷。Claude 称之为"生死线"，GPT-5.4 称之为"必须强制区分"，MiniMax 称之为"最严重的 architectural design flaw"，Gemini 称之为"最致命的误区"。（Claude / GPT-5.4 / MiniMax / Gemini 均支持）

**共识 2：所有外部检索内容必须被视为不可信输入**
四份报告均认为，Web 检索内容、浏览器捕获、工具输出等外部内容在进入系统时必须默认标记为不可信，不能因来源权威或内容看似合理而提升信任级别。NCSC、OWASP、Greshake et al. 等来源被多份报告共同引用。（Claude / GPT-5.4 / MiniMax / Gemini 均支持）

**共识 3：模型自述置信度不可作为用户可消费的不确定性信号**
四份报告均指出 LLM 的置信度存在系统性校准问题，RLHF 训练奖励自信语气，导致过度自信。Claude 引用 Guo et al. 和 KalshiBench；GPT-5.4 引用 OpenAI 研究；MiniMax 引用 Liu et al. 综述；Gemini 指出 Softmax 概率是"伪精确"。（Claude / GPT-5.4 / MiniMax / Gemini 均支持）

**共识 4：UI 文案中"Verified / 已验证"类词汇在未完成独立验证时属于误导**
四份报告均明确列出了禁止使用的 UI 文案，核心是"Verified"、"Confirmed"、"Sources confirm"等词汇在仅完成提取时不得使用。（Claude / GPT-5.4 / MiniMax / Gemini 均支持）

**共识 5：降级策略应优先输出结构化 gap，而非静默填充**
四份报告均反对在搜索失败或证据不足时以模型参数知识静默填充，主张显式输出 gapReason 并告知用户搜索范围与失败原因。（Claude / GPT-5.4 / MiniMax / Gemini 均支持）

**共识 6：声明必须携带可追溯的来源元数据，且每条声明独立标注**
四份报告均反对在整篇摘要上贴一个总体"可信"标签，主张在声明级别（sentence/claim level）进行独立的信任标注与来源追溯。（Claude / GPT-5.4 / MiniMax / Gemini 均支持）

---

## 3. 分歧点

**分歧 1：Verification 的可操作定义——"支持性检查"还是"确定性字节匹配"**

GPT-5.4 和 MiniMax 将 verification 定义为"claim 与 evidence span 的支持性检查（support check）"，允许使用 NLI 模型判断蕴含关系，接受概率性的验证结果。Gemini 则采取更严格的立场，要求 verification 必须是"确定性的还原过程"，通过精确字节偏移量匹配或 XPath 路径来证明提取结果存在于原始捕获中，明确排斥 NLI 等概率性方法。Claude 的立场居中，提出 NLI 蕴含检测可用于引用正确性验证，但承认这无法检测引用忠实度。

这一分歧在工程实现上影响重大：Gemini 的方案更严格但适用范围窄（仅适用于可精确定位的文本），GPT-5.4/MiniMax 的方案更实用但引入了概率性误差。

**分歧 2：信任层级的粒度设计**

四份报告的信任层级数量不同：Claude 提出 5 级（L0–L4），GPT-5.4 提出 5 级（T0–T4），MiniMax 提出 9 个细分级别（TL0–TL5-I），Gemini 提出 4 级（密码学信任 / 零信任 / 概率性低信任 / 派生信任）。MiniMax 的细粒度设计（区分 TL3-V / TL3-R / TL3-U / TL4-S / TL4-W）在表达能力上最强，但认知负荷最高；Gemini 的四级设计最简洁，但表达力有限。这一分歧反映了"系统完备性"与"用户可理解性"之间的根本张力，四份报告均未给出实证依据支持某一粒度优于其他。

**分歧 3：Verification 独立性的工程实现路径**

MiniMax 明确要求"Verification model ≠ Summary generation LLM"，即必须使用独立的验证模型。Gemini 提出"双模型架构（Dual-LLM）"，用隔离模型处理不可信数据，特权模型只接收净化后的陈述性数据。GPT-5.4 的要求相对宽松，认为"结构化边界"（控制面与数据面分通道封装）是最低要求，未强制要求独立验证模型。Claude 提出了 Self-RAG 的反射令牌机制和 ATTR.FIRST 的"先选证据再生成"范式，但未明确要求独立模型。这一分歧在实现成本上差异显著。

**分歧 4：不确定性表达的首选格式**

GPT-5.4 和 Gemini 均明确支持"频率格式（frequency format）"优于置信度百分比，并引用了 INLG 2024 的用户研究。Claude 主张使用离散等级（高/中/低来源支撑度）加来源数量，未明确支持频率格式。MiniMax 提出了多层次不确定性粒度设计，同时包含粗粒度标签和细粒度数值，但未明确表态频率格式优先。这一分歧在 UI 设计上有直接影响。

---

## 4. 互补点

**互补 1：Gemini 独有——双模型架构与上下文净化的具体工程方案**

Gemini 是四份报告中唯一提出具体防御架构的：隔离模型（Quarantined LLM）运行在沙箱中，被剥夺工具调用权限，仅负责结构化提取；净化引擎通过时间因果诊断剥离执行性指令，仅保留陈述性数据字段；特权规划模型只接收净化后的数据。这一方案将安全防线从语义理解层转移到系统架构层，是其他三份报告未覆盖的工程细节。对 RT 实现有直接参考价值。

**互补 2：MiniMax 独有——四维不确定性分类与声明过滤 pipeline**

MiniMax 引入了 Aleatoric / Epistemic / Input / Prediction 四维不确定性分类，区分了"无法通过更多数据消除的随机不确定性"与"可通过检索增强减少的认知不确定性"。这一分类对于 RT 决定"哪些 gap 值得继续搜索、哪些 gap 是原理上不可填补的"有直接指导意义。此外，MiniMax 提供了完整的声明过滤 pipeline 伪代码，是四份报告中唯一给出可直接参考的算法逻辑的。

**互补 3：Claude 独有——引用忠实度（Citation Faithfulness）与引用正确性（Citation Correctness）的区分**

Claude 引用 Wallat et al. (2024) 提出的关键区分：引用正确性（被引文档是否在事实上支持声明）与引用忠实度（模型是否真正依赖了该文档生成，而非事后附上碰巧支持的引用）。57% 的引用属于事后合理化这一发现，是其他三份报告未明确引用的。这一区分对 RT 的引用系统设计有重要影响：仅验证引用正确性是不够的，还需要验证引用忠实度。

**互补 4：GPT-5.4 独有——"citations 会显著提升用户信任，即使 citations 是随机的"这一用户研究发现**

GPT-5.4 引用了用户实验结果：有 citations 会显著提升信任评分，即使 citations 是随机的；当用户去检查 citations 时，信任会下降。这一发现揭示了 RT 产品的一个特殊风险：引用的存在本身就是一种信任信号，与引用质量解耦。这意味着 RT 的 UI 必须把"有引用"与"被引用支撑"在视觉上明确区分，否则即使引用质量差，用户也会过度信任。其他三份报告未明确引用这一实验结果。

---

## 5. 对 Round Table 实现的综合建议

以下建议按优先级排序，综合四份报告的核心主张：

**建议 1（最高优先级）：在架构层实施控制面与数据面的物理隔离**

不能依赖 prompt 级别的防御。最低要求是将系统策略/指令与外部检索内容分通道处理（GPT-5.4）。推荐实现 Gemini 提出的双模型架构：隔离模型处理外部内容，净化后的陈述性数据才进入规划模型。所有外部内容（网页、工具输出、API 响应）在进入任何推理流程前，默认标记为不可信输入（Claude / GPT-5.4 / MiniMax / Gemini 四份报告一致）。

**建议 2（最高优先级）：在数据模型层强制区分 Extraction 与 Verification，禁止在 UI 层混用**

每条声明必须携带 provenanceType 字段，区分 QUOTED / EXTRACTED / INFERRED / SYNTHESIZED / UNGROUNDED（Claude）。UI 标签严格对应：Captured（T1）/ Extracted（T2）/ Evidence-backed（T3）（GPT-5.4）。在完成独立验证之前，任何声明不得使用"Verified / 已验证 / Confirmed / Sources confirm"等词汇（四份报告一致）。

**建议 3（高优先级）：实现声明级别的来源追溯，而非文档级别的引用**

每条进入摘要的声明必须绑定到可定位的证据 span（含页面内位置/DOM path/字节偏移量），而非仅链接到文档 URL（GPT-5.4 / Gemini）。推荐实现 Gemini 提出的双栏视图：点击引用时展示摘要结论与原始页面快照的对照，并高亮具体段落。这直接对抗了"citations 即使随机也会提升信任"的用户认知偏差（GPT-5.4）。

**建议 4（高优先级）：用结构化 gapReason 替代静默填充，将"未知"作为一等公民输出**

当搜索失败、来源不可访问、证据不足时，系统必须输出包含失败原因、搜索范围、访问状态的 gapReason 对象，而非以模型参数知识静默填充（四份报告一致）。UI 上将"未解析的数据点"与"已验证声明"在视觉上明确区分，并提供 next action 建议（GPT-5.4 / MiniMax）。

**建议 5（中优先级）：采用频率格式表达不确定性，避免未校准的置信度百分比**

不确定性表达优先使用"在检索到的 N 份来源中，有 M 份支持此声明"的频率格式，而非"置信度 X%"（GPT-5.4 / Gemini，引用 INLG 2024 用户研究）。离散等级（强接地 / 单源接地 / 推断性 / 信息不足 / 未搜索）加来源数量是可接受的替代方案（Claude）。禁止将模型 Softmax 概率直接转化为用户可见的置信度数字（四份报告一致）。

**建议 6（中优先级）：实现原子化声明分解与逐条接地验证**

参照 FActScore（Claude）和 FACTS Grounding（MiniMax）的方法，将长文本摘要分解为原子声明，逐一进行来源蕴含验证，而非对整段文本进行整体评估。这是防止"全覆盖假象"反模式的核心机制——摘要中每个要点必须独立标注 coverage 状态（有证据 / 缺证据），缺证据要点强制标注 gapReason（GPT-5.4 / MiniMax）。

---

## 6. 遗留问题

**遗留问题 1：引用忠实度（Citation Faithfulness）的可扩展自动化验证**

四份报告均认可引用正确性验证（NLI 蕴含检测）的可行性，但 Claude 指出引用忠实度（模型是否真正依赖了该来源生成，而非事后附上）的自��化检测尚无成熟方案。Gemini 的字节偏移量匹配方案可以验证"文本存在于来源中"，但无法验证"模型生成时是否真正使用了该来源"。这一问题在生产系统中尚无可扩展的解决方案，四份报告均未给出答案。

**遗留问题 2：Verification 独立性的边界定义与实际效果**

MiniMax 要求 Verification model ≠ Summary generation LLM，但未回答：使用同一基础模型的不同实例是否算"独立"？Verification prompt 与 generation prompt 的分离是否足够？Gemini 的双模型架构在工程上更明确，但其净化引擎的实际 IPI 防御覆盖率未经实证验证。四份报告均未提供关于"独立验证模型在实际系统中能将误验证率降低多少"的量化数据。

**遗留问题 3：不确定性表达强度的个性化与场景适配**

GPT-5.4 引用 FAccT 2024 指出不同措辞会影响 reliance 与信任，且存在 over/under-reliance tradeoff。MiniMax 提出了多层次不确定性粒度设计，但未给出"何种粒度适合何种用户/场景"的实证依据。四份报告均未解决：如何根据任务风险等级、用户专业背景、监管要求动态调整不确定性表达策略，以及"拒答也是价值"的交互范式如何在不损害用户留存的前提下落地。
