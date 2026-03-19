# **从叙事到工件：在信任优先的多智能体决策系统中实现回复结构化的架构框架研究报告**

## **Executive Summary**

随着大语言模型（LLM）从简单的问答交互演进为复杂的多智能体协作系统（MAS），智能体回复的形态正经历从“自由文本回复”向“结构化工件（Structured Artifacts）”的根本性转变。对于类似 Round Table（RT）这类面向高风险决策、强调证据链与人工调优的系统，传统的基于自然语言的通信模式已表现出显著的局限性，包括逻辑漂移（Logical Drift）、级联幻觉（Cascading Hallucinations）以及难以进行的自动化验证 1。

本研究通过对 MetaGPT、ChatDev 及 Anthropic 发布的生产级智能体构建指南进行深入分析，结合工业界在智能体输出契约（Artifact Contracts）领域的最新实践，系统性地探讨了智能体回复结构化的技术路径。研究表明，在高风险决策场景下，回复不应仅被视为一段信息，而应被视为一份受版本控制、逻辑自洽且具备认识论保障的“合同” 4。

核心结论指出，结构化回复能够通过强制性的字段验证，显著改善主持人（Moderator）的聚合效率，支持高可靠的会话恢复（Resume）与回放（Replay），并降低高达 40% 的幻觉率 3。对于 RT 系统，建议采用“逻辑字段”与“UI 叙事字段”严格分离的架构，并优先实现以证据绑定（Evidence Binding）为核心的最小可行设计。本报告将详细论述三种不同复杂度的 Schema 设计，识别导致多智能体协作崩溃的反模式，并为产品架构决策提供具备实操性的验证准则 7。

## **Verified Findings**

### **1\. 结构化协作的范式起源：MetaGPT 与 ChatDev**

在现有的多智能体框架中，MetaGPT 最早将人类社会中的标准作业程序（SOP）引入 LLM 协作，其核心哲学是“代码 \= SOP(团队)”。MetaGPT 并非让智能体在无约束的聊天室中对话，而是模拟了一家软件公司的流水线，每个智能体（如产品经理、架构师）产生的回复必须是符合特定 Schema 的工件，如 PRD 文档、API 规范或系统设计蓝图 10。这种做法的验证效果是显著的：在复杂的软件工程任务中，通过强制要求生成结构化中间产物，逻辑一致性得到了大幅提升，从而克服了简单链式调用产生的幻觉级联 1。

与此相对，ChatDev 则利用“聊天链（Chat Chain）”将复杂过程拆解为原子任务。其回复的结构化体现在阶段性的共识标志上。例如，在“通信去幻觉（Communicative Dehallucination）”机制中，智能体被要求在回复中包含特定的反馈模式（如 Role Flip），迫使助手角色在没有获取足够细节前不得生成代码，这种回复结构有效地将幻觉控制在了对话的局部范围内 14。

### **2\. 生产级智能体的工作流模式**

Anthropic 在其《构建高效智能体》指南中明确区分了“工作流（Workflows）”与“智能体（Agents）”。工作流是通过预定义、结构化步骤实现的确定性路径，而智能体则是具备动态决策能力的自主循环 15。在信任优先的系统中，将智能体回复从纯文本提升为结构化工件是实现上述模式的基础 17。

| 协作模式 | 回复结构要求 | 对信任的影响 |
| :---- | :---- | :---- |
| 提示词链 (Chaining) | 强类型输入/输出，步骤间状态传递 19 | 高，通过分解任务降低单一环节错误率 |
| 路由 (Routing) | 明确的意图分类标签与参数集 7 | 中，确保专家模型处理特定领域的任务 |
| 并行化 (Parallelization) | 独立的投票结果或切片数据块 20 | 高，通过多视角冗余校准减少随机幻觉 |
| 协调者-执行者 (Orchestrator-Worker) | 包含子任务列表与执行状态的计划书 17 | 极高，提供透明的执行路径供 Moderator 审计 |

### **3\. 结构化输出的技术演进与准确性收益**

现实中的高可靠系统已普遍放弃了简单的正则表达式提取，转而采用 JSON Schema 或 Pydantic 模型定义的输出契约（Artifact Contracts） 21。在 Bedrock 与 OpenAI 的最新实践中，通过“受限解码（Constrained Decoding）”技术，可以确保 LLM 生成的 token 序列 100% 符合定义的语法规则 9。研究数据显示，结构化生成不仅显著降低了解析错误的开销，甚至在某些分类任务中提高了 42% 的准确率，因为约束解码缩小了模型的输出搜索空间，使其更专注于逻辑判断而非修辞 23。

### **4\. 幻觉与失效模式的数学界限**

Vishal Sikka 等人的研究指出，纯 LLM 在处理超过一定复杂度的计算与自主任务时，存在数学上的可靠性上限，幻觉是其生成本质的固有属性 26。因此，降低幻觉表面的唯一路径不是更好的提示词，而是通过结构化的“验证层”将模型输出绑定到独立的事实源上 4。在多智能体场景中，协作失败往往源于“协调税（Coordination Tax）”，即智能体之间传递的非结构化上下文过多，导致模型在 token 级注意力中迷失了关键的逻辑约束 28。

## **Best Candidate Schemas**

为了满足 RT 系统对高风险决策支持的要求，本节提出了三种不同深度的 Schema 候选方案。这些 Schema 均基于 Pydantic 设计思想，将智能体回复解构为机器可验证的逻辑部分与人类可读的叙事部分 9。

### **方案一：最小化认识论 Schema（认识论保障版）**

该版本旨在解决最核心的“信任”问题：智能体必须证明其回复是基于证据的。

| 字段名称 | 类型 | 验证级别 | 描述与用途 |
| :---- | :---- | :---- | :---- |
| intent | Enum | 强制 (Strict) | 回复的意图（如：提案、质疑、补充、确认） 7 |
| conclusion | String | 业务 (Semantic) | 核心主张或建议的摘要 |
| citations | List\[Object\] | 强制 (Reference) | 每个主张必须关联的证据 ID、文本偏移量及标签 32 |
| thought\_trace | String | 无 (Narrative) | 内在的思维过程，仅供 Moderator 在审计时阅读 34 |

### **方案二：平衡型协作 Schema（状态机驱动版）**

该版本适用于需要多次 Follow-up 和校准的复杂决策链路，引入了任务状态与信心评分。

| 字段名称 | 类型 | 验证级别 | 描述与用途 |
| :---- | :---- | :---- | :---- |
| role\_id | String | 强制 (ID) | 智能体在 RT 语义中的角色标识符 10 |
| status | Enum | 强制 (State) | 任务状态（DONE, PENDING, BLOCKED, NEED\_CALIBRATION） 36 |
| confidence | Float (0-1) | 强制 (Range) | 智能体对其判断的自评得分，低于阈值触发自动校准 37 |
| evidence\_bundle | List\[Object\] | 强制 (Structural) | 包含 source\_id、quote\_span 以及 gapReason（如信息缺失的具体分类） 39 |
| proposed\_plan | String | 业务 (Narrative) | 智能体建议的后续步骤，用于主持人生成 follow-up 41 |

### **方案三：过设计型/递归 Schema（科研/超大型Mas版）**

该版本试图对回复的所有维度进行极致结构化，但在 RT 环境中可能导致性能损失。

| 字段名称 | 类型 | 验证级别 | 描述与用途 |
| :---- | :---- | :---- | :---- |
| metadata | Map | 强制 (System) | 包含时间戳、模型版本、幂等键（Idempotency Key） 4 |
| sub\_task\_graph | Graph | 强制 (Graph) | 智能体内部将任务拆解为的 DAG 结构及其各节点执行状态 42 |
| probabilistic\_outcomes | Map | 强制 (Math) | 不同选择下的概率分布预测（由模拟得出） 44 |
| data\_contracts | List | 强制 (Spec) | 本次回复遵循的数据协议版本号 |

## **Implications for Round Table**

将智能体回复升级为结构化工件（Artifact）对 RT 系统的核心功能模块将产生深远的架构影响。

### **1\. 改善主持人聚合 (Moderator Aggregation)**

在自由文本模式下，主持人必须通过另一层 LLM 来“总结”各方意见，这带来了二次幻觉风险。结构化回复允许主持人通过代码逻辑直接进行统计学聚合 38。

* **事实一致性检查：** 主持人可以提取所有智能体回复中的 evidence\_ids。如果智能体 A 引用文档 D 证明“利好”，而智能体 B 引用同一段落证明“风险”，系统能立即识别冲突点并高亮显示，而不是让冲突埋没在冗长的文字叙述中 33。  
* **加权共识决策：** 利用 confidence 字段，主持人可以实现贝叶斯加权聚合。高信心得分且引用了多个权威来源（Primary Sources）的意见将被赋予更高权重 45。

### **2\. 会话恢复与回放 (Resume & Replay)**

结构化工件是“状态的可序列化快照”。在长程决策中，RT 系统需要处理大量的中间步骤 47。

* **按需上下文注入：** 借助 Google ADK 式的“编译器视角”，系统可以不存储原始对话，而是存储 strongly-typed 的事件对象。当需要恢复会话时，只需将关键 Artifact 重新载入上下文，避免了因会话过长导致的“上下文腐败（Context Rot）” 48。  
* **决策溯源（Audit Trail）：** 每个 Artifact 都可以携带其生成时的依赖项版本。决策过程的回放不再是看一段录像，而是在受控环境中重构逻辑推演的每一个环节 4。

### **3\. 自动化 Follow-up 与校准 (Follow-up & Calibration)**

结构化回复将“模糊的不确定性”转化为“明确的缺失字段”。

* **Gap-Driven Follow-up：** 如果智能体在 evidence\_bundle 中标记了 gapReason: MISSING\_QUALIFIER（如：虽然找到了合规条款，但缺少具体的截止日期），主持人可以精准地提出 follow-up：“请智能体 C 重点搜索该合同的签署日期”，而不是笼统地要求“提供更多细节” 39。  
* **触发式校准：** 当 confidence 低于系统设定的安全阈值（如 0.6）时，RT 系统可以自动触发“校准协议”，调动另一个具备独立知识源的智能体进行交叉审查（Maker-Checker 模式） 3。

### **4\. 系统测试与性能基准 (Testing)**

结构化工件使“不变性测试（Invariant Testing）”成为可能 8。

* **契约测试：** 开发者可以为 RT 系统编写单元测试，验证“在收到退款请求意图时，智能体输出的 JSON 必须包含 order\_id 字段且格式正确”。这使得 MAS 的开发从“拼手感”转变为现代软件工程模式 4。  
* **回归监控：** 当更换底层模型（如从 GPT-4 升级到 GPT-5）时，系统可以通过对比 Artifact 的字段准确率来评估性能增减，而不是依赖主观的对比测试 36。

## **Recommended Minimum Design for RT**

根据对“信任优先”决策需求的优先级排序，本研究建议 RT 系统的首个结构化升级应聚焦于以下设计方案。

### **如果只做一件事：证据绑定 (Evidence Binding)**

**必须首先设计的字段：grounding\_evidence**

这是降低幻觉表面、建立可验证性的最高杠杆点。回复中任何包含事实性陈述的句子片段，都必须强制性地绑定到一个结构化的证据对象上。该对象应包含：

1. source\_id: 指向 RT 内部知识库的唯一键。  
2. verbatim\_quote: 直接引用的原文片段。  
3. rhetorical\_label: 该证据与结论的关系（支持/反对/提及） 32。

这种设计将“信任”从对智能体智力的崇拜转移到对证据链的审核上，这也是高风险行业（如法律、医药）对 AI 的核心诉求 27。

### **哪些设计不适合 RT 及其原因**

| 不适用的设计模式 | 原因分析 |
| :---- | :---- |
| **无约束的 P2P Swarm 协作** 7 | 在 P2P 模式下，智能体自由交换上下文，缺乏明确的所有权划分。这会导致“硅基会议陷阱”，即智能体为了共识而趋向于产出平庸、规避风险且不可审计的叙事 28。RT 必须坚持“主持人-专家”的层级结构。 |
| **智能体自我报告状态 (Self-Reported State)** 5 | 允许智能体自行标记任务为“已完成（DONE）”会产生循环论证。智能体会优化回复以满足“完成”的格式，而不论实际工作是否达标。验证权必须保留在主持人或独立的审计智能体手中 5。 |
| **执行代码块作为回复核心** 15 | RT 的目标是人类决策支持，而非自动化运维。执行代码会增加系统的非确定性表面积，且对于非技术团队决策者来说，代码是“黑盒中的黑盒”，违背了 trust-first 的透明原则 15。 |

### **逻辑字段与 UI 叙事字段的严格分离**

为了实现稳定性，必须在 Schema 定义层实施严格的准则：

**1\. 逻辑字段 (The Logic Layer):**

* **处理方式：** 必须使用 Pydantic 或 JSON Schema 进行严格的 strict: true 验证。任何校验失败必须立即拒绝并触发重试 9。  
* **目的：** 供代码逻辑、状态机、主持人聚合算法消费。  
* **字段示例：** intent, action\_node\_id, evidence\_ids, confidence\_score 42。

**2\. UI 叙事字段 (The Narrative Layer):**

* **处理方式：** 接受 Markdown 格式，不进行类型强制，仅进行基本的安全性扫描（如脱敏） 7。  
* **目的：** 直接展示给人类用户，解释决策逻辑，建立心理安全感。  
* **字段示例：** thought, analysis\_summary, caveats 34。

通过这种分离，即便智能体在 thought 叙事中出现了修辞性的小错误，只要其 intent 和 evidence\_ids 正确，系统的逻辑链路就不会崩溃 7。

## **Anti-Patterns**

在从自由文本升级为 Artifact 的过程中，架构师必须警惕以下已被生产环境证伪的“坑”。

### **1\. “格式即真理”陷阱 (Circular Justification)**

这是最隐蔽的反模式。系统可能过于依赖 JSON 格式校验器的绿灯。如果一个回复完全符合 Schema，解析器会很高兴地将其传入下游，即便里面的数据是编造的 5。

* **预防措施：** 必须实施“独立认识论验证”，即验证回复中的字段是否与外部事实源（如数据库中的真实条目）锚定 5。

### **2\. 协调税过载 (Coordination Tax & Token Bloat)**

试图让智能体生成过于复杂的 Schema（如 Tier 3 方案）会导致模型将 50% 以上的注意力分配到管理嵌套括号和重复的 key 名上，而不是核心逻辑推理 29。

* **失效模式：** 智能体可能会在长对话后期开始遗忘字段，或者由于 syntactic noise 导致逻辑推理能力下降 28。

### **3\. 负向补丁提示词 (Negative Patching)**

开发者发现模型输出的 Artifact 有误时，倾向于添加“千万不要在 JSON 中包含 X”或“一定要记得加上 Y”等指令。这种“负向补丁”会迅速使提示词膨胀到 10,000 token 以上，降低整体推断质量 7。

* **正确做法：** 使用“正向规范定义”。如果模型记不住字段，说明 Schema 设计过深，应通过拆分智能体（Supervisor \+ Specialists）来简化单个回复的结构 4。

### **4\. 忽略 token 级优化 (The JSON Gap)**

LLM 本质上处理的是 token 序列，而非 JSON 对象。如果重要的逻辑字段分散在 JSON 的头部和尾部，中间夹杂着巨大的叙事字段，模型可能会丢失它们之间的语义关联 29。

* **优化建议：** 将所有高频被代码消费的逻辑字段集中在 Schema 的开头，或者使用 XML 标签（Anthropic 偏好的模式）来包裹核心元数据，这在长文本环境中比 JSON 具备更强的结构稳定性 56。

## **Open Questions**

本研究识别了以下仍需进一步工程探索的领域：

1. **Schema 的动态演进：** 随着决策上下文的深入，固定的 Schema 可能无法涵盖突发的调查需求。如何实现 Schema 的安全、动态扩展且不破坏下游聚合逻辑？ 58。  
2. **小模型对复杂协议的适配性：** 为了降低成本，RT 系统可能需要引入 7B-13B 级的小型模型。如何在极小的“注意力窗口”内维持对多字段 Artifact 合约的忠实执行？ 59。  
3. **叙事字段的语义校验：** 逻辑字段易于校验，但如何自动检测“叙事字段”（如 thought trace）与“逻辑字段”（如 intent）之间的内部一致性？避免智能体“想一套，做一套”的推理-行为不匹配风险 61。

## **Source List**

.1

#### **引用的著作**

1. MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework \- ar5iv, 访问时间为 三月 17, 2026， [https://ar5iv.labs.arxiv.org/html/2308.00352](https://ar5iv.labs.arxiv.org/html/2308.00352)  
2. Agentic Code Generation Papers Part 1 | cbarkinozer \- Cahit Barkin Ozer, 访问时间为 三月 17, 2026， [https://cbarkinozer.medium.com/agentic-code-generation-papers-part-1-05546d0d5d23](https://cbarkinozer.medium.com/agentic-code-generation-papers-part-1-05546d0d5d23)  
3. Why Multi-Agent LLM Systems Fail (and How to Fix Them) | Augment Code, 访问时间为 三月 17, 2026， [https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them](https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them)  
4. Orchestrating AI Agents in Production: The Patterns That Actually Work \- HatchWorks AI, 访问时间为 三月 17, 2026， [https://hatchworks.com/blog/ai-agents/orchestrating-ai-agents/](https://hatchworks.com/blog/ai-agents/orchestrating-ai-agents/)  
5. Your AI Agent Says “Tests Passed.” Did They? | by Oleg Romanchuk | Jan, 2026 | Medium, 访问时间为 三月 17, 2026， [https://medium.com/@romoleg/your-ai-agent-says-tests-passed-did-they-e0cbeb595c61](https://medium.com/@romoleg/your-ai-agent-says-tests-passed-did-they-e0cbeb595c61)  
6. Agent Behavioral Contracts: Formal Specification and Runtime Enforcement for Reliable Autonomous AI Agents \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/pdf/2602.22302](https://arxiv.org/pdf/2602.22302)  
7. From Prompt Spaghetti to Structured Multi-Agent Systems: Lessons from Refactoring a Production AI Agent Architecture | AWS Builder Center, 访问时间为 三月 17, 2026， [https://builder.aws.com/content/3AfCno58Bsm4AbKaFKYiaDgeOkK/from-prompt-spaghetti-to-structured-multi-agent-systems-lessons-from-refactoring-a-production-ai-agent-architecture](https://builder.aws.com/content/3AfCno58Bsm4AbKaFKYiaDgeOkK/from-prompt-spaghetti-to-structured-multi-agent-systems-lessons-from-refactoring-a-production-ai-agent-architecture)  
8. How to build an AI agent: from prototype to production \- Logic, 访问时间为 三月 17, 2026， [https://logic.inc/guides/how-to-build-an-ai-agent](https://logic.inc/guides/how-to-build-an-ai-agent)  
9. Structured outputs on Amazon Bedrock: Schema-compliant AI responses \- AWS, 访问时间为 三月 17, 2026， [https://aws.amazon.com/blogs/machine-learning/structured-outputs-on-amazon-bedrock-schema-compliant-ai-responses/](https://aws.amazon.com/blogs/machine-learning/structured-outputs-on-amazon-bedrock-schema-compliant-ai-responses/)  
10. metagpt: meta programming for multi-agent collaborative framework \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/pdf/2308.00352v2.pdf?utm\_campaign=Conversational+AI+Thought+Leadership+2022\&utm\_source=hs\_email\&utm\_medium=email&\_hsenc=p2ANqtz-9JcG6Wy\_HZbhcYz-Mq5j8JxhLcZNGMzrrPmqaV7pJ5DEGVNTwc5BkmudOu3\_V2lf0QSkb2](https://arxiv.org/pdf/2308.00352v2.pdf?utm_campaign=Conversational+AI+Thought+Leadership+2022&utm_source=hs_email&utm_medium=email&_hsenc=p2ANqtz-9JcG6Wy_HZbhcYz-Mq5j8JxhLcZNGMzrrPmqaV7pJ5DEGVNTwc5BkmudOu3_V2lf0QSkb2)  
11. MetaGPT in Action: Multi-Agent Collaboration \- Business Thoughts \- WordPress.com, 访问时间为 三月 17, 2026， [https://bizthots.wordpress.com/metagpt-in-action-multi-agent-collaboration/](https://bizthots.wordpress.com/metagpt-in-action-multi-agent-collaboration/)  
12. MetaGPT \- ThirdEye Data, 访问时间为 三月 17, 2026， [https://thirdeyedata.ai/technologies/metagpt](https://thirdeyedata.ai/technologies/metagpt)  
13. METAGPT: META PROGRAMMING FOR A MULTI-AGENT COLLABORATIVE FRAMEWORK \- ICLR Proceedings, 访问时间为 三月 17, 2026， [https://proceedings.iclr.cc/paper\_files/paper/2024/file/6507b115562bb0a305f1958ccc87355a-Paper-Conference.pdf](https://proceedings.iclr.cc/paper_files/paper/2024/file/6507b115562bb0a305f1958ccc87355a-Paper-Conference.pdf)  
14. ChatDev: Communicative Agents for Software Development \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2307.07924v5](https://arxiv.org/html/2307.07924v5)  
15. Building Effective AI Agents: Insights from Anthropic | by Priyanshu Khandelwal | Medium, 访问时间为 三月 17, 2026， [https://medium.com/@priyanshukhandelwal/building-effective-ai-agents-insights-from-anthropic-cc0862e118d7](https://medium.com/@priyanshukhandelwal/building-effective-ai-agents-insights-from-anthropic-cc0862e118d7)  
16. Building AI Agents with Composable Patterns \- AIMultiple, 访问时间为 三月 17, 2026， [https://aimultiple.com/building-ai-agents](https://aimultiple.com/building-ai-agents)  
17. https://www.anthropic.com/engineering/building-effective-agents \- NAITIVE AI Consutling Agency Blog, 访问时间为 三月 17, 2026， [https://blog.naitive.cloud/building-effective-agents/](https://blog.naitive.cloud/building-effective-agents/)  
18. Get structured output from agents \- Claude API Docs, 访问时间为 三月 17, 2026， [https://platform.claude.com/docs/en/agent-sdk/structured-outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)  
19. Workflow Patterns \- Agents \- AI SDK, 访问时间为 三月 17, 2026， [https://ai-sdk.dev/docs/agents/workflows](https://ai-sdk.dev/docs/agents/workflows)  
20. Building Effective AI Agents \- Anthropic, 访问时间为 三月 17, 2026， [https://www.anthropic.com/research/building-effective-agents](https://www.anthropic.com/research/building-effective-agents)  
21. Structured Output Specification \- Agentic Patterns, 访问时间为 三月 17, 2026， [https://agentic-patterns.com/patterns/structured-output-specification/](https://agentic-patterns.com/patterns/structured-output-specification/)  
22. Pydantic AI: Build Type-Safe LLM Agents in Python, 访问时间为 三月 17, 2026， [https://realpython.com/pydantic-ai/](https://realpython.com/pydantic-ai/)  
23. Generate structured output from LLMs with Dottxt Outlines in AWS | Artificial Intelligence, 访问时间为 三月 17, 2026， [https://aws.amazon.com/blogs/machine-learning/generate-structured-output-from-llms-with-dottxt-outlines-in-aws/](https://aws.amazon.com/blogs/machine-learning/generate-structured-output-from-llms-with-dottxt-outlines-in-aws/)  
24. Does Prompt Formatting Have Any Impact on LLM Performance? \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2411.10541v1](https://arxiv.org/html/2411.10541v1)  
25. The Impact of Format Restrictions on Large Language Models | by Hass Dhia | Medium, 访问时间为 三月 17, 2026， [https://medium.com/@has.dhia/the-impact-of-format-restrictions-on-large-language-models-765030600f71](https://medium.com/@has.dhia/the-impact-of-format-restrictions-on-large-language-models-765030600f71)  
26. New Research Claims AI Agents Are Mathematically Doomed to Fail | The Tech Buzz, 访问时间为 三月 17, 2026， [https://www.techbuzz.ai/articles/new-research-claims-ai-agents-are-mathematically-doomed-to-fail](https://www.techbuzz.ai/articles/new-research-claims-ai-agents-are-mathematically-doomed-to-fail)  
27. Redefining AI Agent Trust For Production: An Input/Output-First Approach \- Monte Carlo, 访问时间为 三月 17, 2026， [https://www.montecarlodata.com/blog-redefining-agent-trust-input-output](https://www.montecarlodata.com/blog-redefining-agent-trust-input-output)  
28. Why Multi-Agent Systems Fail at Scale (And Why Simplicity Always Wins) | by Bijit Ghosh, 访问时间为 三月 17, 2026， [https://medium.com/@bijit211987/why-multi-agent-systems-fail-at-scale-and-why-simplicity-always-wins-7490f9002a9b](https://medium.com/@bijit211987/why-multi-agent-systems-fail-at-scale-and-why-simplicity-always-wins-7490f9002a9b)  
29. Why JSON Is Not Enough for LLMs: Thinking in Tokens, Not Objects \- Medium, 访问时间为 三月 17, 2026， [https://medium.com/@umairamin2004/why-json-is-not-enough-for-llms-thinking-in-tokens-not-objects-911d1a97557d](https://medium.com/@umairamin2004/why-json-is-not-enough-for-llms-thinking-in-tokens-not-objects-911d1a97557d)  
30. Exploring How to Produce Structured Output with AI Agents | by Sai Nitesh Palamakula, 访问时间为 三月 17, 2026， [https://medium.com/@sainitesh/exploring-how-to-produce-structured-output-with-ai-agents-5d35a0b0d195](https://medium.com/@sainitesh/exploring-how-to-produce-structured-output-with-ai-agents-5d35a0b0d195)  
31. AI Agent Specification Template \- GSA-TTS/devCrew\_s1 \- GitHub, 访问时间为 三月 17, 2026， [https://github.com/GSA-TTS/devCrew\_s/blob/master/docs/templates/AI%20Agent%20Specification%20Template.md](https://github.com/GSA-TTS/devCrew_s/blob/master/docs/templates/AI%20Agent%20Specification%20Template.md)  
32. Ten Failure Modes of RAG Nobody Talks About (And How to Detect Them Systematically), 访问时间为 三月 17, 2026， [https://dev.to/kuldeep\_paul/ten-failure-modes-of-rag-nobody-talks-about-and-how-to-detect-them-systematically-7i4](https://dev.to/kuldeep_paul/ten-failure-modes-of-rag-nobody-talks-about-and-how-to-detect-them-systematically-7i4)  
33. Scite MCP Brings Evidence-Backed Literature to AI Assistants \- Windows Forum, 访问时间为 三月 17, 2026， [https://windowsforum.com/threads/scite-mcp-brings-evidence-backed-literature-to-ai-assistants.403334/](https://windowsforum.com/threads/scite-mcp-brings-evidence-backed-literature-to-ai-assistants.403334/)  
34. Effective context engineering for AI agents \- Anthropic, 访问时间为 三月 17, 2026， [https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)  
35. Agentic Software Engineering: Foundational Pillars and a Research Roadmap \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2509.06216v1](https://arxiv.org/html/2509.06216v1)  
36. artifact-contract-auditor | Skills M... \- LobeHub, 访问时间为 三月 17, 2026， [https://lobehub.com/skills/neversight-skills\_feed-artifact-contract-auditor](https://lobehub.com/skills/neversight-skills_feed-artifact-contract-auditor)  
37. Best practices for building agents \- UiPath Documentation, 访问时间为 三月 17, 2026， [https://docs.uipath.com/agents/automation-cloud/latest/user-guide/best-practices-for-building-agents](https://docs.uipath.com/agents/automation-cloud/latest/user-guide/best-practices-for-building-agents)  
38. Enhancing Text Classification with a Novel Multi-Agent Collaboration Framework Leveraging BERT \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2502.18653v1](https://arxiv.org/html/2502.18653v1)  
39. (PDF) Replace, Don't Expand: Mitigating Context Dilution in Multi-Hop RAG via Fixed-Budget Evidence Assembly \- ResearchGate, 访问时间为 三月 17, 2026， [https://www.researchgate.net/publication/398601667\_Replace\_Don't\_Expand\_Mitigating\_Context\_Dilution\_in\_Multi-Hop\_RAG\_via\_Fixed-Budget\_Evidence\_Assembly](https://www.researchgate.net/publication/398601667_Replace_Don't_Expand_Mitigating_Context_Dilution_in_Multi-Hop_RAG_via_Fixed-Budget_Evidence_Assembly)  
40. Learning to Plan and Generate Text with Citations | Request PDF \- ResearchGate, 访问时间为 三月 17, 2026， [https://www.researchgate.net/publication/384213301\_Learning\_to\_Plan\_and\_Generate\_Text\_with\_Citations](https://www.researchgate.net/publication/384213301_Learning_to_Plan_and_Generate_Text_with_Citations)  
41. Customize agent workflows with advanced orchestration techniques using Strands Agents | Artificial Intelligence \- AWS, 访问时间为 三月 17, 2026， [https://aws.amazon.com/blogs/machine-learning/customize-agent-workflows-with-advanced-orchestration-techniques-using-strands-agents/](https://aws.amazon.com/blogs/machine-learning/customize-agent-workflows-with-advanced-orchestration-techniques-using-strands-agents/)  
42. Standardised Operating Procedure (SOP) Overview \- Emergent Mind, 访问时间为 三月 17, 2026， [https://www.emergentmind.com/topics/standardised-operating-procedure-sop](https://www.emergentmind.com/topics/standardised-operating-procedure-sop)  
43. Agent-Based Software Artifact Evaluation, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2602.02235v1](https://arxiv.org/html/2602.02235v1)  
44. Multi-Agent Code-Orchestrated Generation for Reliable Infrastructure-as-Code \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2510.03902v1](https://arxiv.org/html/2510.03902v1)  
45. Free-MAD: Consensus-Free Multi-Agent Debate \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2509.11035v1](https://arxiv.org/html/2509.11035v1)  
46. Exposing Citation Vulnerabilities in Generative Engines \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/pdf/2510.06823](https://arxiv.org/pdf/2510.06823)  
47. A Practical Approach to Optimize Multi-Agent Systems \- AI Sweden, 访问时间为 三月 17, 2026， [https://www.ai.se/sites/default/files/2025-12/A%20Practical%20Approach%20to%20Optimize%20Multi-Agent%20Systems%20v.0.9.pdf](https://www.ai.se/sites/default/files/2025-12/A%20Practical%20Approach%20to%20Optimize%20Multi-Agent%20Systems%20v.0.9.pdf)  
48. Architecting efficient context-aware multi-agent framework for production \- Google for Developers Blog, 访问时间为 三月 17, 2026， [https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)  
49. Traditional Forms vs. Conversational Interactions | by Lana Holston | Bootcamp \- Medium, 访问时间为 三月 17, 2026， [https://medium.com/design-bootcamp/agentic-ux-in-enterprise-when-to-use-conversational-agents-vs-traditional-forms-93cf588eac21](https://medium.com/design-bootcamp/agentic-ux-in-enterprise-when-to-use-conversational-agents-vs-traditional-forms-93cf588eac21)  
50. Multi-Agent System Patterns: Architectures, Roles & Design Guide | Medium, 访问时间为 三月 17, 2026， [https://medium.com/@mjgmario/multi-agent-system-patterns-a-unified-guide-to-designing-agentic-architectures-04bb31ab9c41](https://medium.com/@mjgmario/multi-agent-system-patterns-a-unified-guide-to-designing-agentic-architectures-04bb31ab9c41)  
51. From Zero to Hero: AgentOps \- End-to-End Lifecycle Management for Production AI Agents, 访问时间为 三月 17, 2026， [https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/from-zero-to-hero-agentops---end-to-end-lifecycle-management-for-production-ai-a/4484922](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/from-zero-to-hero-agentops---end-to-end-lifecycle-management-for-production-ai-a/4484922)  
52. A Framework to Assess Clinical Safety and Hallucination Rates of LLMs for Medical Text Summarisation \- medRxiv.org, 访问时间为 三月 17, 2026， [https://www.medrxiv.org/content/10.1101/2024.09.12.24313556v1.full-text](https://www.medrxiv.org/content/10.1101/2024.09.12.24313556v1.full-text)  
53. JSON schema concerns: annotations and descriptions sometimes ignored \#2405 \- GitHub, 访问时间为 三月 17, 2026， [https://github.com/pydantic/pydantic-ai/issues/2405](https://github.com/pydantic/pydantic-ai/issues/2405)  
54. Transparent and Robust RAG: Adaptive-Reward Reinforcement Learning for Decision Traceability \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2505.13258v2](https://arxiv.org/html/2505.13258v2)  
55. Everything You Need to Know About Text Field Design, 访问时间为 三月 17, 2026， [https://lollypop.design/blog/2026/january/text-field-design/](https://lollypop.design/blog/2026/january/text-field-design/)  
56. instruction-engineering | Skills Mar... \- LobeHub, 访问时间为 三月 17, 2026， [https://lobehub.com/skills/axiomantic-spellbook-instruction-engineering](https://lobehub.com/skills/axiomantic-spellbook-instruction-engineering)  
57. Anthropic's Official Take on XML-Structured Prompting as the Core Strategy \- Reddit, 访问时间为 三月 17, 2026， [https://www.reddit.com/r/ClaudeAI/comments/1psxuv7/anthropics\_official\_take\_on\_xmlstructured/](https://www.reddit.com/r/ClaudeAI/comments/1psxuv7/anthropics_official_take_on_xmlstructured/)  
58. A Self-Reflective Multi-Agent Collaboration Framework for Dynamic Software Engineering Tasks \- Preprints.org, 访问时间为 三月 17, 2026， [https://www.preprints.org/manuscript/202603.0129](https://www.preprints.org/manuscript/202603.0129)  
59. Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2408.02442v1](https://arxiv.org/html/2408.02442v1)  
60. RAP-RAG: A Retrieval-Augmented Generation Framework with Adaptive Retrieval Task Planning \- MDPI, 访问时间为 三月 17, 2026， [https://www.mdpi.com/2079-9292/14/21/4269](https://www.mdpi.com/2079-9292/14/21/4269)  
61. Why Do Multi-Agent LLM Systems Fail? \- arXiv, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2503.13657v3](https://arxiv.org/html/2503.13657v3)  
62. Why Do Multi-Agent LLM Systems Fail? \- OpenReview, 访问时间为 三月 17, 2026， [https://openreview.net/forum?id=fAjbYBmonr\&referrer=%5Bthe%20profile%20of%20Matei%20Zaharia%5D(%2Fprofile%3Fid%3D\~Matei\_Zaharia1)](https://openreview.net/forum?id=fAjbYBmonr&referrer=%5Bthe+profile+of+Matei+Zaharia%5D\(/profile?id%3D~Matei_Zaharia1\))  
63. METAGPT: Meta Programming for a Multi-Agent Collaborative Framework \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/pdf/2308.00352](https://arxiv.org/pdf/2308.00352)  
64. Communicative Agents for Software Development \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2307.07924v4](https://arxiv.org/html/2307.07924v4)  
65. Building Effective AI Agents \- Anthropic, 访问时间为 三月 17, 2026， [https://resources.anthropic.com/building-effective-ai-agents](https://resources.anthropic.com/building-effective-ai-agents)  
66. Use ChatDev ChatChain for agent communication on IBM watsonx.ai, 访问时间为 三月 17, 2026， [https://www.ibm.com/think/tutorials/chatdev-chatchain-agent-communication-watsonx-ai](https://www.ibm.com/think/tutorials/chatdev-chatchain-agent-communication-watsonx-ai)  
67. How to Build a Deep-Research Multi‑Agent System | Langflow | Low-code AI builder for agentic and RAG applications, 访问时间为 三月 17, 2026， [https://www.langflow.org/blog/how-to-build-a-deep-research-multi-agent-system](https://www.langflow.org/blog/how-to-build-a-deep-research-multi-agent-system)  
68. (PDF) Risk Analysis Techniques for Governed LLM-based Multi-Agent Systems, 访问时间为 三月 17, 2026， [https://www.researchgate.net/publication/394427532\_Risk\_Analysis\_Techniques\_for\_Governed\_LLM-based\_Multi-Agent\_Systems](https://www.researchgate.net/publication/394427532_Risk_Analysis_Techniques_for_Governed_LLM-based_Multi-Agent_Systems)  
69. MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework \- arXiv.org, 访问时间为 三月 17, 2026， [https://arxiv.org/html/2308.00352v7](https://arxiv.org/html/2308.00352v7)  
70. Creating reliable agents with structured outputs in Elasticsearch, 访问时间为 三月 17, 2026， [https://www.elastic.co/search-labs/blog/structured-outputs-elasticsearch-guide](https://www.elastic.co/search-labs/blog/structured-outputs-elasticsearch-guide)  
71. MetaGPT: META PROGRAMMING FOR MULTI-AGENT COLLABORATIVE FRAMEWORK \- deepsense.ai, 访问时间为 三月 17, 2026， [https://deepsense.ai/wp-content/uploads/2023/10/2308.00352.pdf](https://deepsense.ai/wp-content/uploads/2023/10/2308.00352.pdf)