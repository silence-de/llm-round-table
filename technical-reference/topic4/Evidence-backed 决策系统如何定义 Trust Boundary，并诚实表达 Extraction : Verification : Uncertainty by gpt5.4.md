# Evidence-backed 决策系统如何定义 Trust Boundary，并诚实表达 Extraction / Verification / Uncertainty

## Executive Summary

面向“卖点是 trust，而不是 autonomy”的 RT 类 research 产品，**trust boundary 的核心不是“模型更聪明”，而是“系统明确承认：模型与外部内容之间没有天然的指令/数据边界，且任何 tool / retrieval / browser 内容都可能携带可执行意图”**。citeturn6view0turn7view7turn23view14

英国entity["organization","英国国家网络安全中心（NCSC）","uk government agency"]明确指出：当前 LLM **“不在 prompt 内部强制执行 instructions 与 data 的安全边界”**，因此把“应用指令 + 不可信内容”拼在一起再让模型决定，属于架构层面的误区。citeturn6view0turn6view1 这意味着：**RT 的“可信”必须被定义为一组可审计的边界与流程约束**，而不是若干句“请忽略注入”的 prompt。citeturn6view0turn7view7

本报告给出一个适用于 RT 的 **trust classification（信任分级）**，并回答你提出的六个问题，重点落在：  
- **Research results / browser capture / page extraction / final summary** 各自的 trust level 与“可信含义”的严格定义。citeturn6view3turn23view14turn15view4  
- **Verification vs extraction** 在系统与 UI 上必须强制区分：verification 只能指“对 captured evidence 的可重复核验”，不能指“模型读过网页并生成回答”。citeturn23view7turn23view1turn6view3  
- **证据门禁（evidence gating）**：哪些 claim 没有 evidence 绝不进入 summary；哪些必须降级成 gap / unresolved / model inference。citeturn23view7turn15view4turn23view10  
- **uncertainty 的表达**：避免 fake precision；对 high-stakes 决策支持，优先用“reference class + 频率式表达 + 明确定义的 coverage/consistency 指标”，而不是“AI 90% confident”这种在用户侧会被误解、且模型侧往往未校准的数值。citeturn23view6turn23view10turn23view11turn6view7  
- **当 research 缺失或失败时的最佳降级策略**：宁可输出结构化 gaps，也不要输出“看起来完整”的总结；并在 UI 上把失败状态从“内容缺失”与“系统失败”区分开。citeturn23view11turn23view12turn23view4

## Verified Findings

LLM 应用里“prompt injection”不只是提示词技巧问题，而是**架构上把不可信内容（网页/邮件/文档/工具返回）并入同一上下文后，误以为模型会像 SQL 引擎那样区分 data vs instruction**。NCSC 直说：LLM 不会在 prompt 内部执行该边界。citeturn6view0turn6view1 这直接要求 RT 把“控制面（policy/权限/流程）”移出模型，把“数据面（网页文本/检索内容/工具输出）”按不可信输入处理。citeturn7view7turn23view17

“间接注入（indirect prompt injection）”在 RT 场景尤其危险，因为 RT 的核心能力就是“把第三方内容拉进来再回答”。在《Not what you’ve signed up for…》中，作者指出 retrieval 会**模糊 data 与 instructions 的边界**，对“LLM-integrated applications”而言，攻击者可把 prompt 埋进将被检索到的内容里，从而在推理时控制模型输出，甚至影响 API 调用。citeturn23view14turn23view15 这解释了为什么“我们抓取了网页并引用它”并不等于“我们验证了网页”。citeturn23view14turn6view3

RAG/检索系统把 attack surface 扩展到“知识库/向量库/检索器/排序器”。USENIX Security 的 PoisonedRAG 直接把“knowledge database”视为新的实用攻击面，攻击者可注入少量恶意文本就诱导模型生成攻击者指定答案。citeturn6view5 而在“retrieval poisoning”研究中，攻击者甚至能制作**对人类看起来完全正常**的文档，但在 RAG 过程中仍能诱导模型输出错误/恶意结果；论文明确指出现有框架对外部内容风险考虑不足。citeturn15view4 因此，RT 必须把“retrieval 结果”视为不可信输入，并把“检索到 ≠ 可信”。citeturn6view5turn15view4

“citation”既是必要机制，也是高风险误导源。ALCE 基准指出：让 LLM 生成带引用的文本以提升可验证性，但**即便最好的系统仍会频繁出现 citation 不完全支持**（例如 ELI5 上“缺乏完整引用支持”的情况仍很常见）。citeturn23view7 更关键的是，人类会被 citation 的存在显著影响信任：一项用户实验发现**有 citations 会显著提升信任评分，即使 citations 是随机的；当用户去检查 citations 时，信任会下降**。citeturn23view0turn23view1 这意味着 RT 的 UI 文案一旦把“有引用/抓取网页”包装成“已验证”，会系统性诱导用户过度信任。citeturn23view1turn6view3turn23view11

在 high-stakes 决策支持里，另一条硬约束是：**模型会幻觉且不完全可靠**。entity["company","OpenAI","ai research company"]在 GPT-4 Technical Report 里强调：模型仍会“hallucinate”与推理出错，高风险场景必须谨慎并使用配套协议（比如人工复核、grounding、或避免高风险用途）。citeturn23view11 同时，OpenAI 的研究指出，训练与评测往往奖励“在不确定时猜测”，从而导致过度自信的错误输出持续存在。citeturn23view12 这直接要求 RT 在产品层面**支持“合格的拒答/不确定表达/证据不足降级”**，而不是一味输出完整叙事。citeturn23view12turn23view4

不确定性表达本身也有科学证据：FAccT 2024 的大规模实验表明，自然语言的不确定表达（尤其第一人称措辞）可以在一定程度上降低用户对错误答案的过度依赖，但并不能完全消除 overreliance，且语言设计需要实证验证。citeturn23view3turn23view4 另一个关键发现是，面向用户的数值不确定性表达并非“越精确越好”：在 INLG 2024 的用户研究里，**frequency-based 表达（带 reference class 的频率）总体被认为比单纯 confidence 百分比更好**。citeturn23view5turn23view6 同时，多篇研究指出 LLM 往往存在“表达出来的 confidence 与正确率不校准”的问题。citeturn23view10turn23view12

## Trust Boundary Model

### 适用于 RT 的 trust classification

RT 需要的不是“统一置信度分数”，而是**对不同产物（artifact）的“可信含义”分层**。以下给出一个可落地、可审计、且能直接映射到 UI 文案的分级（T0–T4）。其设计原则来自：LLM 不会在 prompt 内区分指令/数据（因此必须由系统做边界），以及 RAG/检索/外部内容引入新增攻击面。citeturn6view0turn23view14turn6view5

- **T0 控制面可信（Control-plane Trusted）**：系统策略、权限、工具封装、审核与日志策略。其可信来自“工程控制/安全审计”，不来自模型。citeturn6view0turn7view7turn23view17  
- **T1 采集物可审计（Captured Artifact, Auditable）**：browser page capture（HTML snapshot / screenshot / HTTP 元数据 / 时间戳 / hash）。**可信的是“当时捕获到的内容确实如此”**，而不是“内容为真”。WebGPT 的环境设计就体现了这种“可审计引用”：模型在浏览时可“quote”页面片段并记录页面 title、domain 与摘录作为 reference。citeturn6view3  
- **T2 提取信号不可信（Extracted Signals, Untrusted Derivative）**：page extraction、DOM->text、结构化字段、NER、表格解析、检索片段摘要等。它们是便捷信号，但可能被解析错误、被注入 payload、或被模型误读；必须可回链到 T1。citeturn15view4turn23view17turn23view15  
- **T3 证据支撑的声明（Evidence-backed Claim）**：claim 对应到一个或多个 **可定位的 T1 span**，并经过“支持性检查（support check）/冲突检测（conflict check）”。注意：这仍不等于“事实真”，仅等于“来源确实这么说，且我们能把 claim 与证据对齐”。citeturn23view7turn23view8turn23view1  
- **T4 模型推断/观点（Model Inference / Judgment）**：跨证据推理、归因、预测、策略建议、缺失信息补全等。它们可以对决策有价值，但必须被显式标注为推断，且不得用“verified/confirmed”类语言包装。citeturn23view12turn23view11turn23view4  

### 回答问题一：research results、browser capture、page extraction、final summary 的 trust level

在 RT 类产品里，四类产物应被放在不同的 trust level，并且“可信含义”必须写进 data model（而不是只写进用户提示词）：

- **Research results（搜索结果列表/检索命中/候选来源）应归为 T2（不可信提取信号）**：它们通常只是“可能相关”的链接与片段，既可能被 SEO/对抗文本/检索投毒影响，也可能携带间接注入载荷；RAG 研究对“公共来源数据导致间接操控入口”有系统性评估。citeturn16view2turn15view4turn6view5  
- **Browser capture（页面快照/截图/抓取包）应归为 T1（可审计采集物）**：它解决“可追溯性”，不解决“真实性”。把 capture 称为 verification 会误导用户把“我看到了”当成“我验证了”。citeturn6view3turn23view1  
- **Page extraction（页面抽取出的正文/结构化字段/关键信号）应归为 T2（不可信派生物）**：retrieval poisoning 研究强调“对人类看似正常的内容仍可在 RAG 中操控输出”，因此抽取后的文本同样属于攻击面。citeturn15view4turn23view15  
- **Final summary（最终总结）默认应视为 T3+T4 的混合物**：只有那些在 summary 内被逐条对齐到证据 span 的句子可以提升到 T3；其余归为 T4，并且 UI 必须在句级/段级显式标注。否则会落入“把模型推理说成证据结论”的最大产品风险。citeturn23view7turn23view11turn23view12  

## Evidence Classes and Allowed Claims

### RT 的 evidence classes

RT 若要卖“trust”，必须把 evidence 设计成一等公民：不仅能展示 citations，还能表达 evidence 的**类型、粒度、可复核性与局限**。ALCE 与后续工作强调 “citation quality/可定位证据”是系统能力核心，否则用户难以核对。citeturn23view7turn23view9

建议至少定义以下 evidence classes（E0–E4），并在 data model 中强制记录：

- **E0 运行与采集元数据（Provenance Metadata）**：URL、访问时间、HTTP 状态、抓取方式（live/cached）、hash、重定向链、robots/权限失败原因等。它不证明内容为真，但证明“你们做过什么、何时做的、是否成功”。citeturn7view7turn23view11turn23view17  
- **E1 不可变页面采集物（Immutable Capture）**：HTML snapshot + screenshot（或等价的可重复渲染形式）。其作用是让用户或审计方能复核“来源写了什么”。citeturn6view3turn23view7  
- **E2 可定位证据片段（Locatable Evidence Span）**：从 E1 中锚定的文本 span（含页面内位置/DOM path/字符偏移/高亮引用），防止“泛引用”。FRONT 明确指出仅引用文档标识会让用户难以定位支撑点，因此需要细粒度引用。citeturn23view9  
- **E3 多来源交叉支撑（Cross-source Support）**：同一 claim 至少两条独立来源支持，且冲突被显式记录（不是“投票式抹平”）。RAG 安全研究显示知识库/公共来源可被操控，因此单来源在高风险场景脆弱。citeturn6view5turn15view4  
- **E4 权威/规范类来源（Authoritative Source Type）**：官方技术报告、标准、政府机构指南等。它并不自动保证“事实正确”，但在 high-stakes support 场景提供更可依赖的依据层级。citeturn6view7turn23view17turn23view11  

### Allowed / Disallowed claim types 表

下表把“claim 类型”与“是否允许进入 summary”绑定到证据等级与表达方式。其目标是：**把“提取”与“验证”在语义上拆开，把“推断”显式放到独立通道**；同时，考虑到 citations 会显著推高用户信任（甚至随机 citations 也会），因此门禁必须严格。citeturn23view0turn23view1turn23view7

| Claim 类型（面向 summary） | Allowed（可作为“结论性陈述”进入 summary） | Disallowed（不得以结论口吻进入 summary） |
|---|---|---|
| 来源陈述类：“某页/某报告写了 X” | **允许**，但必须提供 E1+E2（可定位引用），并标注“这是来源陈述，不等于事实”。citeturn6view3turn23view8 | 把“来源写了 X”改写成“X 就是真的/已证实”。citeturn23view1turn6view0 |
| 具体事实类（日期/数值/阈值/定义/接口行为） | **允许**，最低 E1+E2；高风险建议 E3；若来源是官方报告/标准则标注 E4。citeturn23view7turn23view11turn23view17 | 只有 citation label、无可定位 span 的“泛引用”；或用模型记忆补数字。citeturn23view7turn23view12 |
| 归纳总结类（从多段文字压缩出要点） | **有条件允许**：每个要点必须能回链到证据片段（E2），并显示 coverage（哪些要点缺证据）。citeturn23view7turn23view9 | “看起来合理”的总结但没有可定位证据；或把缺证据部分混入同段落不标注。citeturn23view7turn23view1 |
| 比较/结论类（A 优于 B、风险更高、更可信） | **有条件允许**：至少 E3（两独立来源）+ 明确比较维度；否则只能作为推断。citeturn6view7turn23view4 | 单来源比较、或把主观权重当作客观结论。citeturn6view7turn23view4 |
| 因果/机制解释类（因为…所以…） | **通常不作为结论**；除非来源本身是权威技术报告/同行评审论文且直接陈述该因果，并提供 E2。citeturn23view12turn23view17 | 模型自行补因果链、或把相关性当因果。citeturn23view12turn6view7 |
| 预测/趋势/对未来判断 | **不允许**以 verified 口吻进入；只能进 “Model inference / Scenario” 通道，并要求写明假设与缺证据点。citeturn23view12turn23view11 | 用“将会/必然/已经验证”表达预测。citeturn23view11turn23view1 |
| 否定性断言（“没有证据表明…/未发现…”） | **极其严格**：仅当 E0 显示检索范围、时间、失败原因与覆盖度；否则只能说“在本次捕获范围内未看到”。citeturn7view7turn23view11 | 把“没搜到/工具失败”说成“不存在/已证伪”。citeturn7view7turn23view11 |
| 安全/漏洞结论（“系统存在漏洞/可被攻击”） | **有条件允许**：必须引用一手安全论文/官方机构报告（E4 或同行评审），并明确适用范围与假设。citeturn23view14turn6view5turn6view0 | 把模型推断当安全结论；或把“可能”写成“已确认”。citeturn6view0turn23view11 |

### 回答问题三：哪些 claim 必须有 evidence 才允许进入 summary

对“面向产品架构决策”的 RT，建议把 summary 定义为 **“可追溯要点（traceable takeaways）”**，因此以下 claim **没有 evidence 不得进入 summary**：

- **任何可被外部世界检验的事实断言**（数值、日期、阈值、是否存在、定义、接口行为、已发生事件），最低要求 E1+E2。citeturn23view7turn23view11  
- **任何带强语气的比较/结论**（更安全、更可靠、已解决、最佳实践），最低要求 E3；否则必须降级为推断。citeturn6view7turn23view4  
- **任何“验证/确认/证实”类表述**：必须先在系统层完成“claim ↔ evidence span 对齐”，否则 UI 和文案不得出现 verification 语义。citeturn23view7turn23view1turn6view3  

之所以要这么严，是因为 citations 及其呈现方式会显著推高用户信任，即便 citations 与内容匹配度不高，用户也往往不会逐条检查。citeturn23view0turn23view1

### 回答问题四：哪些信息只能以 gap / unresolved / model inference 形式呈现

下列信息即便“看起来合理”，也应默认只能以 **gap / unresolved / model inference** 呈现（或进入单独的“推断”区，而不是 summary 主体）：

- **来源之间冲突且无法解释冲突原因**（定义不同、版本不同、时间点不同、样本不同）。此时 summary 应输出“冲突存在 + 各自证据”，而不是选边站。citeturn6view7turn23view4  
- **外部证据缺失或抓取失败导致的空白**：比如 paywall/登录/robots/工具错误。必须标注 gapReason，并把 E0 暴露给用户（至少“失败原因 + 已尝试范围”）。citeturn7view7turn23view11  
- **需要专业判断的建议**（高风险安全建议、合规结论、医疗/法律建议）。除非引用权威指南/官方技术报告并明确范围，否则只能以“基于有限证据的建议”呈现。citeturn23view11turn23view17  
- **任何模型自行“补全缺失信息”的内容**：OpenAI 指出评测机制会奖励在不确定时猜测，导致过度自信的错误输出持续存在，因此缺证据补全必须显式标为推断。citeturn23view12turn23view10  

## Verification vs Extraction Guidance

### 系统定义：严格区分 verification 与 extraction

**Extraction（提取）**：从来源中抽取/压缩信息形成结构化信号或摘要，本质是 **T1→T2 的派生**。它能提高可用性，但不构成“已验证”。retrieval poisoning 研究甚至表明：外部内容在“对人类看似正常”的前提下仍可操控 RAG 输出，因此 extraction 的结果必须默认不可信。citeturn15view4turn23view15

**Verification（核验）**：只能指对“可审计采集物（T1）”进行的、可重复的检查，目标是回答两类问题：  
1) **引用存在性**：你标注的证据片段是否在 capture 中真实存在、位置是否一致（E1+E2）。WebGPT 式“quote 并记录页面/摘录”属于支持这一点的机制。citeturn6view3  
2) **支持性（support）而非真实性（truth）**：证据片段是否足以支撑该 claim（可用规则/NLI/人审）；但这仍不等于“事实真”。ALCE 把“citation quality”作为核心维度之一，就是在强调“被引用内容是否支持生成文本”。citeturn23view7turn23view8  

因此，RT 的“verification”若要成立，至少需要一个 **claim-centric 数据结构**：claim 是被验证对象，evidence span 是验证依据，verification action 是验证过程记录（自动或人工）。否则“verification”只是营销词。citeturn6view0turn23view1

### UI 约束：哪些标签可用，哪些必然误导

结合“citations 会显著抬升信任、甚至随机 citations 也会抬升”的用户研究结果，RT 的 UI 必须避免把弱信号包装成强语义。citeturn23view0turn23view1

建议把 UI 标签拆成三类（这些词本身就定义边界）：

- **“Captured / 采集到”**：只对应 T1（我们抓取并保存了页面/截图）。  
- **“Extracted / 已提取”**：只对应 T2（我们从页面提取了这段文字/字段）。  
- **“Evidence-backed / 有证据支撑”**：只对应 T3（该句主张能定位到证据 span，且通过支持性检查）。  

反之，下列 UI 文案/标签在 RT 中应视为高风险误导，除非你能满足更强的系统语义：

- “Verified”、“Confirmed”、“Fact-checked”、“Validated”、“Sources confirm …”——这些词会让用户把“我们看过网页”误解成“事实核验完成”。citeturn23view1turn6view3turn6view0  
- “Based on verified sources”——ALCE 显示 citation 支撑并不稳定，“有引用”不等于“引用支持完整”，用这种总括性表述会把局部缺口藏起来。citeturn23view7turn23view8  

### 验证流程的最低工程化要求

把 prompt injection / untrusted content 风险内化成系统边界，意味着 verification 不能只靠“再问一次模型”。最低要求应包括：

- **结构化边界**：控制面（策略/指令）与数据面（网页/检索/工具输出）分通道封装；因为 LLM 不会在 prompt 内部强制区分。citeturn6view0turn7view7turn23view14  
- **证据对齐**：claim 必须绑定到可定位 span（E2），否则该 claim 只能进入“推断/未核验”。citeturn23view9turn23view7  
- **冲突显式化**：当证据冲突时，verification 的结果应该是“冲突存在”，而不是“选一个更像真的”。NIST 指出指标与测量方法可能被过度简化或失去关键细节，过早输出单一分数会掩盖风险。citeturn6view7  

## User-Facing Honesty Guidelines

### 如何表达 uncertainty 而不落入 fake precision

high-stakes decision support 的不确定性表达，最怕两件事：  
1) **给出数字但没有 reference class/校准定义**；  
2) **把系统内部启发式（retrieval top-k、模型自评）包装成“概率真值”**。citeturn23view10turn23view12turn6view7  

证据支持的最佳实践可以总结为三条 UI+data model 联动原则：

**原则一：优先给“可审计的结构化不确定性”，再给“可解释的数值”。**  
- 可审计的不确定性：coverage（多少句有证据）、consistency（来源是否一致）、recency（采集时间）、access（是否因权限/抓取失败缺失）。citeturn7view7turn23view7turn6view7  
- 数值不确定性只有在“reference class 明确且校准”时才应出现。INLG 2024 的用户研究显示，**frequency-based（如“在 200 个类似案例中有 180 个正确”）通常优于仅给 confidence 百分比**，因为它暴露了 reference class。citeturn23view5turn23view6  

**原则二：把 uncertainty 绑定到具体原因（gapReason），而不是“我不太确定”。**  
FAccT 2024 的研究显示用户会尝试解释系统为何不确定（找不到答案、信息冲突、不可靠、系统能力限制等），这提示 RT 应把不确定性结构化成可解释的原因码，而不是纯文本模糊表达。citeturn23view3turn23view4  

**原则三：避免用模型“自信语气”作为可靠信号。**  
OpenAI 的研究指出训练/评测会奖励“在不确定时猜测”，从机制上导致过度自信错误持续存在；另有工作直接指出 RLHF 后语言模型存在 overconfidence 与校准问题。citeturn23view12turn23view10 因此，RT 若没有严格校准管线，不应把模型输出的 confidence 当作用户可消费的概率。citeturn23view10turn6view7  

### 明确指出哪些常见 UI 文案会误导用户

结合“citations 会显著提升信任、甚至随机 citations 也会提升”的实验结果，以下 UI 文案在 RT 中属于**典型误导**（除非你能满足更强语义并在 UI 上解释“verified 的定义”）：citeturn23view0turn23view1

- **“Verified”/“已验证”**：如果仅做了 extraction 或仅展示 citations，这就是把“提取”说成“验证”。citeturn23view7turn6view3  
- **“Facts”/“事实”**：在 high-stakes 场景尤其危险，因为 capture 只能证明“来源写了什么”，不能证明“世界事实为真”。citeturn6view3turn23view11turn6view0  
- **“Sources confirm … / 多方证实 …”**：如果只有单一来源或来源间存在冲突但未展示，这属于把模型推理说成证据结论。citeturn6view7turn23view1  
- **“Hallucination-free / 不会幻觉”**：与 OpenAI 等技术报告对“仍会 hallucinate、需高风险协议”的公开表述相冲突；对 trust 产品是灾难级风险。citeturn23view11turn23view13  

更安全的替代措辞应把语义降到事实：  
- “Captured from source（已采集来源内容）”  
- “Extracted from page（从页面提取）”  
- “Evidence-backed by quoted span（由可定位引用支撑）”  
- “Inference（推断）/ Unresolved（未解决）/ Gap（缺口）”citeturn23view7turn23view4  

### 当 research 缺失或失败时，summary 与 UI 的最佳降级策略

**结论先说透：对卖 trust 的 RT，research 缺失时“输出一个完整 summary”通常比“不输出 summary”更危险**，因为它会制造“系统已覆盖证据”的错觉。citeturn23view11turn23view1turn7view7

推荐的降级策略是一个明确状态机（UI 与 data model 同步）：

- **状态 A：No Evidence（未获得任何可用证据）**  
  - UI：不展示“结论段落”，只展示“尝试了什么（E0）+ 为什么失败（gapReason）+ 可以提供的 next action”。citeturn7view7turn23view11  
  - Summary：只允许输出“未能完成研究”的声明（带失败原因），不允许输出外部事实断言；如必须提供背景，仅能在“Model inference（无证据背景）”区给出，并默认折叠。citeturn23view12turn23view11  

- **状态 B：Partial Evidence（证据部分缺失/覆盖不足）**  
  - UI：对每个要点显示 coverage（有证据/缺证据）；缺证据要点强制标注 gapReason。citeturn23view7turn23view4  
  - Summary：只允许证据支撑的要点进入主 summary；其余进入“Unresolved”。citeturn23view7turn23view8  

- **状态 C：Conflicted Evidence（证据冲突）**  
  - UI：把冲突作为一等信息展示（不隐藏）；提供各方证据片段，并输出“冲突解释假设”的推断区。citeturn6view7turn23view4  
  - Summary：主 summary 只能说“存在冲突 + 冲突点是什么”，不能说“已确认”。citeturn6view7turn23view1  

该降级策略与 OpenAI 对 high-stakes 使用“需要配套协议”的措辞一致：当系统无法保障证据链时，要么引入人工复核、要么降低输出承诺。citeturn23view11

## Recommended Minimum Design for RT

### 体系结构最小集合

RT 要“可被信任”，最小设计不是更多 agent 行为，而是**把证据链与风险控制做成硬结构**：

- **采集层（Capture）**：生成 T1（E1）并存证：HTML snapshot + screenshot + E0（时间戳、hash、状态码、访问模式）。WebGPT 的设计说明了为什么“引用收集”是评估事实性的必要基础：没有可追溯引用，人类难以评估。citeturn6view3turn23view7  
- **抽取层（Extraction）**：生成 T2（E2），但必须保留“可回链到 capture 的定位信息”，并把 extraction 输出标记为 untrusted derivative。citeturn23view9turn15view4  
- **声明层（Claims）**：所有输出先被拆成 claim objects，再进入 summary。ALCE 指出 citation 支撑不完整是常态，因此必须在 claim 层做门禁，而不是在最终文本上打一个总标签。citeturn23view7turn23view8  
- **核验层（Verification）**：至少包含“span 存在性验证 + 支持性验证 + 冲突检测”。把 verification 的产物写入数据模型（而非只写自然语言）。citeturn23view7turn6view7  
- **输出层（Presentation）**：UI 以句级/要点级标注 T3/T4，并强制展示 gaps/conflicts。考虑到 citations 会显著抬升信任，UI 必须把“有 citation”与“被 citation 支撑”区分开。citeturn23view0turn23view1turn23view7  

法国entity["organization","法国国家信息系统安全局（ANSSI）","french cybersecurity agency"]的 generative AI 安全建议提供了一个很贴近工程落地的“最小控制集”：在系统架构里显式放置 input/output filters、对与外部业务系统的交互与 plugins 做约束与记录，并把这些交互视为潜在漏洞来源。citeturn23view16turn23view17

### 数据模型最小集合

为了让 UI 文案“说到做到”，建议最小数据模型包含以下实体（用概念描述，不绑定具体实现）：

- **Source**：id、来源类型（权威/论文/其他）、domain、采集时间、采集方式、sourceQuality 维度（不是单分数）。citeturn6view7turn23view17  
- **CaptureArtifact（T1/E1）**：sourceId、snapshotRef、screenshotRef、hash、httpMeta、renderMeta。citeturn6view3turn7view7  
- **EvidenceSpan（E2）**：captureId、start/end（或 DOM path）、quotedText、confidence（仅指“定位置信度”，不是“事实置信度”）。citeturn23view9turn23view7  
- **Claim**：claimText、claimType（见上表）、stance（assert/deny/compare）、requiredEvidenceClass、status（T3/T4）、gapReason（可空）。citeturn23view7turn7view7turn23view4  
- **ClaimSupport**：claimId、evidenceSpanIds、supportCheck（rule/NLI/human）、supportOutcome（supported/insufficient/conflict）、notes。citeturn23view7turn6view7  

这样做的目的，是把“verification”变成系统态，而不是 UI 语气。

### 把 prompt injection / untrusted content 风险内化为系统边界

最低要求不是“提示词里写：忽略网页指令”，而是把风险当作输入通道属性：

- **默认不可信输入集**：用户输入、检索结果、网页内容、插件返回、工具返回都进入 data plane；因为间接注入正是把指令埋入第三方内容并在检索时执行。citeturn23view14turn6view0turn15view4  
- **权限与动作隔离**：即使你不追求 autonomy，只要存在 browser/网络访问或工具调用，就必须承认“prompt injection 可能诱导系统去获取并遵循不可信指令”。OpenAI 的工程文档在 agent 场景中明确提示：启用网络/搜索要谨慎，因为 prompt injection 可能导致 agent 获取并遵循不可信指令；并强调对工具参数与输出的敏感性处理。citeturn7view7  
- **防御纵深（defense-in-depth）**：ANSSI 明确建议在架构中设置 input/output filters，并把与其他业务系统/插件的交互纳入安全控制与日志。citeturn23view17turn23view16  

在 RT 的产品定位下，一个务实的结论是：**把“可执行影响”降到最低**（例如不自动写入系统、不自动执行动作、不自动信任工具输出），把“可审计证据链”抬到最高优先级。citeturn23view11turn6view0turn7view7

### Anti-Patterns

**把 extraction 说成 verification**：例如按钮/徽章写“Verified”，但底层只有“抓取了网页 + 模型总结”。这会把用户对 citation 的社会证明效应放大成错误依赖。citeturn23view1turn23view0turn6view3  

**用整段“可信标签”覆盖细节缺口**：例如“Based on verified sources”贴在整篇总结上，但内部存在缺证据句子或冲突未披露。ALCE 显示“citation 支撑不完整”很常见，把它盖住会制造虚假确定性。citeturn23view7turn23view8  

**把 citations 当作事实证明而不是可复核线索**：用户研究表明 citations 会抬升信任，即使 citations 是随机的；因此“有引用”不能作为“已验证”的代理指标。citeturn23view0turn23view1  

**给出未校准的数值 confidence**：模型在训练/评测机制下倾向于在不确定时猜测；且研究指出 LLM 置信度常不校准。给“90%”会产生 fake precision，尤其在 high-stakes 场景。citeturn23view12turn23view10turn23view11  

**把“没搜到/抓取失败”写成“已证伪/不存在”**：这是把系统失败伪装成事实结论。正确做法是输出 gapReason 与 E0。citeturn7view7turn23view11  

### Open Questions

**自动化“支持性验证”能被信任到什么程度**：ALCE 等工作推动 citation quality 度量与自动指标，但“自动判定 evidence 是否支持 claim”仍可能受到模型偏置与对抗文本影响；在 prompt injection/检索投毒环境下，这个问题更尖锐。citeturn23view7turn15view4turn6view5  

**在不牺牲可用性的前提下，如何把“冲突”呈现为用户能行动的信息**：NIST 提醒测量方法可能被过度简化，现实系统中的风险会随生命周期与场景变化；但 UI 若过载冲突信息也会降低可用性。citeturn6view7turn23view4  

**不确定性表达的“合适强度”如何个性化**：FAccT 2024 显示不同措辞会影响 reliance 与信任，且存在 over/under-reliance tradeoff；如何把这些结果变成可配置策略（按任务风险/用户偏好/监管要求）仍需更多研究。citeturn23view4turn23view3  

**“证据不足时不输出”是否会被市场惩罚，以及如何通过产品机制抵消**：OpenAI 强调高风险应采用合适协议，但用户期待“总有答案”。RT 若坚持 trust，可能需要在产品层建立“拒答也是价值”的交互范式。citeturn23view11turn23view12  

## Source List

- Prompt injection is not SQL injection (it may be worse)（entity["organization","英国国家网络安全中心（NCSC）","uk government agency"]，PDF）。citeturn6view0turn6view1  
- WebGPT: Browser-assisted question-answering with human feedback（entity["company","OpenAI","ai research company"]，论文 PDF）。citeturn6view2turn6view3  
- Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks（NeurIPS 2020 论文 PDF）。citeturn6view4  
- PoisonedRAG: Knowledge Corruption Attacks to Retrieval-Augmented Generation of Large Language Models（USENIX Security 论文 PDF；entity["organization","USENIX Association","computing nonprofit"]）。citeturn6view5  
- Human-Imperceptible Retrieval Poisoning Attacks in LLM-Powered Applications（论文 HTML）。citeturn15view4  
- Rag ’n Roll: An End-to-End Evaluation of Indirect Prompt Manipulations in LLM-based Application Frameworks（论文 HTML）。citeturn16view2turn16view0turn16view3  
- Not what you’ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection（论文 PDF）。citeturn23view14turn23view15  
- Prompt Injection attack against LLM-integrated Applications（论文 HTML）。citeturn11view0  
- Enabling Large Language Models to Generate Text with Citations（EMNLP 2023，ACL Anthology PDF；entity["organization","Association for Computational Linguistics","academic society"]）。citeturn23view7turn23view8  
- Learning Fine-Grained Grounded Citations for Attributed Large Language Models（Findings of ACL 2024，ACL Anthology PDF）。citeturn23view9  
- Citations and Trust in LLM Generated Answers（论文 PDF）。citeturn23view0turn23view1  
- “I’m Not Sure, But…”: Examining the Impact of Large Language Models’ Uncertainty Expression on User Reliance and Trust（FAccT 2024 论文 PDF）。citeturn23view2turn23view3turn23view4  
- Communicating Uncertainty in Explanations of the Outcomes of Machine Learning Models（INLG 2024，ACL Anthology PDF）。citeturn23view5turn23view6  
- Calibrating the Confidence of Large Language Models by Eliciting Fidelity（EMNLP 2024，ACL Anthology PDF）。citeturn23view10  
- GPT-4 Technical Report（entity["company","OpenAI","ai research company"]，官方技术报告 PDF）。citeturn23view11  
- GPT-4 System Card（官方技术报告 PDF）。citeturn23view13  
- Why Language Models Hallucinate（entity["company","OpenAI","ai research company"]，官方研究论文 PDF）。citeturn23view12  
- Artificial Intelligence Risk Management Framework (AI RMF 1.0)（entity["organization","美国国家标准与技术研究院（NIST）","us standards agency"]，官方框架 PDF）。citeturn6view7  
- Security recommendations for a generative AI system（entity["organization","法国国家信息系统安全局（ANSSI）","french cybersecurity agency"]，官方工程指南 PDF）。citeturn23view16turn23view17  
- Agent approvals & security（OpenAI 工程文档）。citeturn7view7