# LLM 多智能体系统前沿研究策展与架构评审报告（2023-01 至今）

## 范围与评分方法

本报告聚焦“LLM 驱动的多智能体系统（multi-agent / agent team / swarm）、层级式 agent-subagent、规划与工具使用、协同与通信协议、记忆与反思/自我纠错、编排与路由、可靠性/安全/可观测性/评测框架”。时间范围以 2023-01 至今为主；少量更早工作仅在被后续研究直接依赖时作为背景引用（但不进入 Top 12）。  

**来源优先级严格执行**：一手论文/官方技术报告 > 官方工程文档/技术博客 > 高质量复现与基准项目（代码+实验）> 论坛帖子（仅补充且可验证）。  

### 量化评分（每项 0–5，总分 25，仅保留 ≥18）

- **Novelty（新颖性）**：核心机制/范式是否带来可复用的新结构或显著扩展能力边界。  
- **Empirical Rigor（实验严谨性）**：是否有强对比基线、消融、跨任务/跨环境评测、失败分析（越全面越高）。  
- **Reproducibility（可复现性）**：是否公开代码/数据/环境/配置与脚本；复现实操摩擦越低越高。  
- **Practical Validation（真实落地验证）**：是否对真实系统/真实应用/真实攻击面进行验证，或与生产形态高度一致（例如真实网站、真实 OS、真实应用、真实仓库）。  
- **Architectural Insight（架构可迁移价值）**：是否明确给出可迁移的模块分解、接口收敛、编排模式、观测与评测方法。  

> 说明：有些“安全研究”天然难提供完整可复现代码（涉及商业应用与合规），因此可能在 Reproducibility 维度偏低，但如果其“真实验证”非常强、架构启发显著，仍可能达到总分阈值并被保留（例如 #12）。  

---

## Top 12 核心清单

> 表内 **ID** 即“来源编号”。后文所有结论/原则都会引用这些编号（并给出可点击的原文/代码引用）。  
> “链接（原文+代码）”用两条可点击引用表示；若无公开代码会明确标注。

| ID | 标题 | 年份 | 类型 | 核心问题 | 关键方法（1–2 句） | 证据（实验/生产验证点） | 可借鉴的架构决策（具体到模块） | 风险/边界条件 | 链接（原文 + 代码） | 评分（五维 → 总分/25） |
|---:|---|---:|---|---|---|---|---|---|---|---|
| 1 | AutoGen：多智能体对话编程框架 | 2024 | 论文 + 框架 | 如何用“多 agent 对话”统一表达复杂 LLM 应用，并覆盖工具、人类在环与多种协作模式 | 提出“conversable agents + conversation programming”，支持顺序/群聊/嵌套/层级等对话模式，将复杂流程还原为可组合的对话图。citeturn7view3 | 论文展示多领域 pilot 应用，并强调框架能在多任务上提升完成度与降低开发成本。citeturn7view3turn5view1 | **核心抽象层**：Conversable Agent（统一消息接口）+ 对话模式编排器；**执行分离**：将环境交互封装为 executor agent，把“决策”与“执行/工具”解耦以复用决策 agent。citeturn5view0turn7view3 | 多 agent 对话易出现**无效 chatter**与成本飙升；状态共享与并发一致性需要额外设计（框架本身并不自动解决）。citeturn7view3 | 原文 citeturn7view3<br>代码 citeturn30search0 | N4 / E3 / R5 / P3 / A5 → **20** |
| 2 | AGENTVERSE：多专家组协作编排与涌现行为分析 | 2024 | 论文 + 框架 | 真实任务往往需要多“专家”协作：如何动态组队、选择通信结构并闭环改进 | 将协作拆为四阶段：Expert Recruitment（招募/调整成员）→ Collaborative Decision-Making（横向民主/纵向审阅两类结构）→ Action Execution → Evaluation（反馈驱动迭代）。citeturn8view1 | 论文报告跨文本理解、推理、编码、工具使用与具身任务的“多 agent 优于单 agent”，并分析涌现与风险行为（如 destructive behavior）。citeturn8view1 | **Team Composer**（Recruiter）+ **Comm Topology**（horizontal/vertical）+ **Eval/Feedback** 模块显式化；把“招募/角色分配/拓扑选择”从提示词手工配置提升为运行时机制。citeturn8view1 | 多 agent 涨成本明显；评测多数仍在研究环境，涌现“破坏性行为”是现实风险。citeturn8view1 | 原文 citeturn8view1<br>代码 citeturn31view0 | N4 / E4 / R4 / P2 / A4 → **18** |
| 3 | MetaGPT：SOP 驱动的多角色软件工程流水线 | 2023/2024 | 论文 + 框架 | 多 agent 串联易“级联幻觉”：如何用结构化流程与中间产物把协作导向可控、可验 | 以“标准作业流程（SOP）+ 角色分工（PM/架构/PMO/工程/QA…）+ 结构化输出”替代自由对话；提出基础层（Environment/Memory/Role/Action/Tools）与协作层（Knowledge Sharing + Workflow Encapsulation）。citeturn26view0turn25search3 | 与 AutoGPT/AgentVerse/LangChain 等对比实验，报告在代码质量与流程符合度上更优；并给出多角色消融与成本统计。citeturn26view0 | **双层架构**：Foundation（Env/Memory/Roles/Actions/Tools）+ Collaboration（知识共享、SOP 编排）；**中间产物契约**：PRD/设计/API/测试等标准化 artifact，降低沟通歧义与循环对话。citeturn26view0 | 角色越多越耗 token/时间；“SOP 适配”是迁移成本（非软件工程领域需要重写 SOP 与 artifact 模板）。citeturn26view0 | 原文 citeturn26view0<br>代码 citeturn20view1 | N4 / E4 / R4 / P3 / A5 → **20** |
| 4 | LATS：把推理、行动与规划统一到树搜索 | 2023/2024 | 论文 + 实现 | 贪心 ReAct 容易走进死胡同：如何让 agent 具备“可回溯的规划与探索” | 将 MCTS 引入语言 agent：LLM 既生成候选 action，也充当 value function，并使用自反思与环境反馈指导搜索；强调多样采样缓解随机性。citeturn32view0turn33view2 | 报告 HumanEval pass@1 达到 SOTA（论文中给出 92.7%），WebShop 上 LATS 显著高于 ReAct/Reflexion，并含消融（移除 value 评估会显著掉点）。citeturn33view2 | **Planning Controller**（树搜索）+ **Policy**（LLM proposal）+ **Value/Verifier**（LLM 评估）+ **Reflection Generator** + **Env Feedback Adapter**；显式需要“可回滚/可复现实验环境”。citeturn33view2turn32view2 | 成本高（多轨迹采样）；依赖环境可回滚/可重复执行；作者也指出现有基准相对真实环境仍偏简单。citeturn33view2 | 原文 citeturn32view0<br>代码 citeturn32view2 | N4 / E4 / R4 / P2 / A4 → **18** |
| 5 | Reflexion：语言反馈驱动的自我纠错与记忆 | 2023 | 论文 + 复现 | 不改权重的情况下，agent 如何从失败中学会改进（trial-and-error 学习） | 将环境反馈转写为“语言反思”，存入 episodic memory，在下一次尝试中作为上下文影响策略；支持多种反馈源与反馈类型，并提供消融。citeturn34search1turn34search9 | 报告在决策、推理、编码等任务上显著提升；例如 HumanEval 上达到 91% pass@1，并做了反馈信号/整合方式等分析。citeturn34search1turn34search12 | **Feedback Collector**→**Reflection Writer**→**Episodic Memory Store**→**Policy Context Builder**；把“失败分析”产品化为可插拔模块，而非散落在提示词里。citeturn34search1turn34search0 | 反思内容质量不稳定，可能生成泛泛而谈的“空反思”；记忆膨胀会带来上下文成本与噪声。citeturn33view1turn34search1 | 原文 citeturn34search1<br>代码 citeturn34search0 | N4 / E4 / R4 / P2 / A4 → **18** |
| 6 | ToolBench：开源模型工具调用能力的基准与增强配方 | 2024 | 论文 + 基准 | 工具调用最大痛点是“错 API/错参数/不可执行”：如何系统评测并提升开源 LLM 工具能力 | 先分类工具调用失败模式，再用：程序化数据生成对齐 + system prompt 规范 + in-context demonstration retriever；并构建 ToolBench 基准覆盖多类真实工具任务。citeturn29view0turn29view2 | 报告把开源模型工具成功率提升“最高可到 ~90%”，并在 8 个 ToolBench 任务中有 4 个达到与 GPT-4 相近；同时估算“每个工具平均 1 个开发者日”可完成数据策展。citeturn29view0turn29view2 | **Tool Registry + Schema**（真实 API 面）+ **Demo Retriever**（检索 few-shot）+ **Synthetic Data Generator**（模板填充）+ **Style/Format Regulator**（system prompt）；重点是把“工具使用知识”工程化成可积累资产。citeturn29view1turn29view2 | 论文也指出：高级推理任务（如复杂表格/高级规划）仍低成功率；配方对工具/领域需要持续维护。citeturn29view2 | 原文 citeturn29view0<br>代码/基准 citeturn22view4 | N4 / E4 / R5 / P3 / A4 → **20** |
| 7 | WebArena：高真实度、可复现的 Web 交互评测环境 | 2023/2024 | 论文 + 基准 | 现有 agent benchmark 太“玩具化”：如何构建接近真实互联网使用的可复现评测 | 提供自托管（self-hostable）的多站点 Web 环境（电商/论坛/协作开发/内容管理），并给出程序化 validator 做功能正确性验证。citeturn36search24turn20view4 | 报告：最强 GPT-4 代理端到端成功率仅 14.41%，显著低于人类 78.24%，直接揭示“真实 Web 长链路任务”极难。citeturn36search24 | **Environment Bundler**（可复现实网站）+ **Knowledge/Tools Sites**（地图/手册等）+ **Task Validator**（规则化判分）+ **Trajectory Logger**（便于失败分析）。citeturn20view4turn36search0 | 真实度提高带来：环境搭建成本高、评测不稳定因素增多；同时只覆盖有限领域网站，仍非“开放互联网”。citeturn36search24 | 原文 citeturn36search36<br>代码 citeturn36search0 | N4 / E4 / R5 / P2 / A4 → **19** |
| 8 | OSWorld：真实计算机环境中的多模态 agent 基准 | 2024 | 论文 + 基准 | “会聊天”离“会用电脑”差很远：如何在真实 OS/真实 App 中评测并定位瓶颈 | 提供跨 Ubuntu/Windows/macOS 的真实计算机环境，369 个任务含初始状态配置与**执行式评测脚本**，对 GUI grounding 与操作知识进行压力测试。citeturn27view0turn36search17 | 报告：人类可完成 72.36%，最佳模型仅 12.24%，主要卡在 GUI grounding 与操作知识。citeturn27view0turn36search17 | **Task Setup Config**（初始状态可复现）+ **Exec-based Evaluator**（脚本判分）+ **OS Adapter**（多系统）+ **App Harness**（真实 App 工作流）；对生产级“电脑使用 agent”非常接近。citeturn27view0turn36search5 | 真实环境意味着工程复杂度很高；任务分布与 OS/App 版本演进会引入维护成本与可比性问题。citeturn27view0turn36search5 | 原文 citeturn27view0<br>代码 citeturn36search5 | N5 / E4 / R4 / P2 / A4 → **19** |
| 9 | SWE-agent：以 ACI 收敛动作空间的仓库级编程 agent | 2024 | 论文 + 系统 | 让 LLM 直接用 Linux shell = 灾难：怎样通过“LM 友好界面”提升工具可靠性与闭环效率 | 提出 Agent-Computer Interface（ACI）：把杂乱 shell 动作收敛为少量高层命令（浏览/搜索/编辑），并提供 guardrails 与每步精炼反馈；在 SWE-bench 上端到端求解真实仓库 issue。citeturn20view6turn36search26 | 报告：GPT-4 Turbo 在 SWE-bench 解决率 12.47%，显著高于此前 3.8%；并做 ACI 设计消融（Lite 子集）与跨模型迁移（Claude 3 Opus）。citeturn20view6 | **Action Space Narrowing（ACI）** + **Guardrails** + **Step Feedback Compressor** + **Repo Navigator**；把“工具使用”从自由文本变成受控接口，是面向生产的关键架构点。citeturn20view6 | 解决率仍不高且成本更高（论文对成本有量化）；ACI 需要针对环境不断迭代，否则会把能力锁死在低维动作里。citeturn20view6 | 原文 citeturn20view6<br>代码 citeturn36search2 | N4 / E5 / R5 / P4 / A5 → **23** |
| 10 | AgentBench：跨 8 类环境系统评测 LLM-as-Agent | 2023/2024 | 论文 + 基准 | 单一任务评测无法反映 agent 能力谱系：如何给 LLM-as-Agent 建“多维体检表” | 构建 8 类环境（操作系统、数据库、知识图谱、网页/购物等），对多模型做系统测试并归因失败模式，发布统一评测包。citeturn23search1turn20view7 | 报告对 29 个 API/开源模型做评测，并指出长程推理、决策与指令遵循是主要障碍；同时公开环境与评测包。citeturn23search1turn20view7 | **Benchmark Suite**（多环境适配器）+ **Unified Runner**（统一输入/输出/评分）+ **Failure Taxonomy**（失败归因）；对你自建 agent 的评测体系可直接借鉴。citeturn23search1 | 部分环境仍是“可控沙盒”，与真实世界仍有 gap；分数提升可能来自“对 benchmark 的过拟合”。citeturn23search1 | 原文 citeturn23search1<br>代码 citeturn20view7 | N4 / E4 / R4 / P2 / A4 → **18** |
| 11 | AgentDojo：面向 prompt injection 的动态攻防评测环境 | 2024 | 论文 + 基准 | 工具输出包含不可信数据时，agent 极易被“间接提示注入”劫持：如何可扩展地评测攻防 | 将 agent 安全评测做成可扩展环境（非静态题库）：含 97 个真实风格任务、629 个安全测试用例、可插拔 attack/defense 范式，评测“有用性 + 对抗鲁棒性”。citeturn36search7turn6view12 | 论文与基准说明：SOTA 模型在无攻击下也会失败不少；在攻击下安全属性被破坏；强调需要动态环境持续迭代。citeturn36search7turn6view12 | **Threat Model 明确化**（工具返回=不可信）+ **Attack/Defense Plugin** + **Security Property Checker** + **Task Suite Registry**；把安全评测纳入 CI/回归体系有直接价值。citeturn36search7turn22view5 | 环境再真实也无法覆盖所有工具链/协议；防御策略可能对任务完成率造成明显副作用（需要同时衡量 utility）。citeturn36search7 | 原文 citeturn36search7<br>代码 citeturn36search11 | N4 / E4 / R5 / P3 / A4 → **20** |
| 12 | Prompt Injection attack against LLM-integrated Applications（HouYi）：真实商用应用的注入攻击研究 | 2023 | 论文 | 真实世界里，LLM 应用（含工具/插件/网页内容）如何被 prompt injection 攻破，且厂商是否承认 | 对 10 个商业应用做分析，提出黑盒攻击 HouYi；在 36 个真实 LLM 集成应用部署测试，报告 31 个可被注入，并获得 10 家厂商验证（含 Notion）。citeturn6view13 | 关键是**真实应用规模**与**厂商验证**（不是纯玩具 demo），并揭示严重后果（如提示词窃取、滥用等）。citeturn6view13 | **把“外部内容”视为不可信输入**：需要隔离/净化层 + 上下文分区 + 工具调用权限边界；把安全测试纳入发布门禁（可与 #11 的基准思路结合）。citeturn6view13turn36search7 | **复现门槛**：论文未承诺公开完整 PoC 代码（至少摘要未给出），且不同应用更新频繁导致结果随时间变化。citeturn6view13 | 原文 citeturn6view13<br>代码：未公开（未找到可靠仓库） | N4 / E4 / R2 / P5 / A4 → **19** |

---

## 架构设计提炼

以下提炼分两类：  
- **已验证事实**：可以直接在来源中找到支撑（会标注来源编号）。  
- **推断建议**：在事实基础上做的架构推导（仍会给出其依据来源编号，但明确是“建议”而非论文原句结论）。  

### 系统设计原则（十条，均可落地）

1) **把“协作”当作可编排的程序，而不是放任对话自由生长**  
**已验证事实**：#1 将复杂应用统一为“conversation programming”，并强调可组合对话模式；#2/#3 都把协作过程拆成明确阶段或 SOP 流水线，从而控制协作行为。citeturn7view3turn8view1turn26view0  
**推断建议**：把 orchestration 层写成显式状态机/工作流 DSL（即使很简陋），并把每条边（消息/工具调用）视为可观测事件（为后续评测与回归打底）。基于 #1/#2/#3 的“流程显式化”共同指向这一点。citeturn7view3turn8view1turn26view0  

2) **决策与执行强制解耦：用“执行代理/接口层”收敛动作空间**  
**已验证事实**：#1 明确提到可用 executor agent 处理环境交互，从而复用决策 agent；#9 用 ACI 将 Linux shell 收敛为少量高层动作，并用 guardrails + 精炼反馈显著提升效果。citeturn5view0turn20view6  
**推断建议**：对所有高风险工具（文件写入、支付、外部 API）一律走“窄接口 + 结构化动作 + 逐步反馈”路线：Action schema（参数类型）→ 执行 → 结果摘要 → 决策更新。把 Debug/恢复成本从“LLM 自己瞎试”转成“接口层给可学习信号”。依据 #1/#9。citeturn5view0turn20view6  

3) **中间产物要“可验收”，否则多 agent 只会把幻觉放大**  
**已验证事实**：#3 把 SOP 与标准化文档/结构化输出当作核心，目的就是减少 cascading hallucinations，并用两层架构（基础层+协作层）承载。citeturn26view0  
**推断建议**：在任何多 agent pipeline 中，为每个 stage 定义“验收条件”（schema + lint + unit test + rule check）：例如 PRD 必须包含字段、API 设计必须可解析、生成的补丁必须通过测试。把“产物契约”当作 team 内通信协议的一部分，而不是写在 prompt 的软约束里。依据 #3/#9（ACI+测试）。citeturn26view0turn20view6  

4) **团队拓扑是“可调参数”：横向集成 vs 纵向审阅是两种不同的风险曲线**  
**已验证事实**：#2 给出 horizontal（民主集成）与 vertical（solver+reviewer 迭代审阅）两类通信结构，并说明适用任务类型不同。citeturn8view1  
**推断建议**：把“拓扑选择”作为运行时策略：  
- 高精度单解任务（数学、代码 patch）优先 vertical（审阅收敛）。  
- 多观点/多方案任务（咨询、需求研究）优先 horizontal（信息覆盖）。  
同时加上“最大回合/最大 token”硬上限，防止对话失控。依据 #2/#1。citeturn8view1turn30search1  

5) **规划不是“多写几步思考”，而是把探索做成可回溯的搜索**  
**已验证事实**：#4 将 MCTS 融入语言 agent，并展示在 HumanEval 与 WebShop 等环境上优于 ReAct/Reflexion；同时指出 value 评估对性能关键。citeturn33view2  
**推断建议**：对长链路任务，把 planner 做成“可控的搜索器”（beam/MCTS/graph search），并将成本开销显式预算化（每层采样数、最大轨迹数、价值评估次数）。只有这样你才能在生产里做 token 成本/成功率的 trade-off。依据 #4 的搜索范式与 #7/#8 的长链路困难。citeturn33view2turn36search24turn27view0  

6) **反思/自纠错必须落到“记忆结构与写入策略”，否则就是装饰品**  
**已验证事实**：#5 把反思写入 episodic memory buffer，并用它改善后续决策；#4 也集成 self-reflection 作为搜索增强组件。citeturn34search1turn32view0  
**推断建议**：设计三件事：  
- 写什么：只写“可操作差错原因 + 下一步策略”，拒绝空泛总结。  
- 写到哪：分离短期工作记忆（execution trace）与长期反思记忆（lessons）。  
- 何时写：仅在失败/低置信度/高代价步骤后写入，避免噪声膨胀。  
依据 #5 对 episodic memory 的机制化，以及 #4 对反思在探索中的作用。citeturn34search1turn32view0  

7) **工具使用能力要做成“可积累资产”：schema、示例库、检索器、合成数据生成器缺一不可**  
**已验证事实**：#6 展示了 programmatic data generation（模板+值池）、demo retriever、system prompt 规范等组合可显著提升工具成功率，并量化“每工具 1 开发者日”级别的人类监督成本。citeturn29view1turn29view2  
**推断建议**：把工具资产当作产品：  
- Tool schema 版本化（变更即触发回归）。  
- Demo exemplars 记录真实失败案例（错参/错 API/不可执行），作为检索库。  
- 合成数据只做“覆盖 API 面”，真实数据做“覆盖边界条件”。  
依据 #6 的失败分类与增强配方。citeturn29view0turn29view2  

8) **评测必须“执行式判分”，否则你只是在测语言流畅度**  
**已验证事实**：#7 提供 validators 做功能正确性验证；#8 的任务带执行式评测脚本；#9 在真实仓库 issue/测试中衡量是否 resolve。citeturn36search24turn27view0turn20view6  
**推断建议**：在你自己的 agent 系统里，至少要落地三层评测：  
- 单步（tool call 正确率、参数合法率、执行错误率）  
- 轨迹（回合数、失败恢复次数、重试策略命中率）  
- 结果（端到端成功率、成本、时延）  
并把它们写成自动化回归，不要依赖“人工感觉”。依据 #7/#8/#9 的 execution-based 方向。citeturn36search24turn27view0turn20view6  

9) **用“高真实度基准”压测系统瓶颈：真实网站/真实 OS/真实仓库会暴露你在 toy task 里看不到的问题**  
**已验证事实**：#7 显示 GPT-4 代理在真实 Web 任务成功率仅 14.41% 而人类 78.24%；#8 显示“会用电脑”难度同样巨大（12.24% vs 72.36%）。citeturn36search24turn27view0  
**推断建议**：把 WebArena/OSWorld 这类高真实度环境当作“预生产”压测：只要你的系统改了 router、memory、tool interface，就跑一遍固定子集，跟踪成功率/成本漂移。依据 #7/#8 的巨大差距。citeturn36search24turn27view0  

10) **安全默认假设：工具输出与外部内容都是不可信输入；必须把安全评测纳入持续交付**  
**已验证事实**：#11 将 prompt injection 攻防做成可扩展评测环境；#12 在 36 个真实应用中发现 31 个可被注入，且有厂商验证，说明这不是“理论风险”。citeturn36search7turn6view13  
**推断建议**：落地“三道闸”：  
- 入口：外部内容净化/标注（untrusted）。  
- 边界：工具调用权限与参数白名单（最小权限）。  
- 出口：敏感操作二次确认/策略引擎裁决。  
然后用 #11 一类基准做持续回归；否则安全会在产品迭代中反复倒退。citeturn36search7turn6view13  

### 常见反模式（五个）

1) **Coordinator 过载（中央编排者成单点瓶颈）**  
症状：所有子任务都要 coordinator 重新理解全上下文、反复路由，token/时延爆炸。  
依据：#2/#3 都在结构上“分阶段/分角色”以避免单点承担全部认知负荷；#1 通过对话模式组合支持拆分工作流。citeturn8view1turn26view0turn7view3  
对策：引入“角色/子 agent 的任务边界”和“中间产物契约”（见原则 3、4）。citeturn26view0turn8view1  

2) **Agent Chatter（无效对话回路）**  
症状：多 agent 互相复述/争吵/空反思，产出不前进但成本持续增长。  
依据：#3 直接指出多 agent 的沟通若只是自然语言对话容易产生无益循环，并用 SOP/标准文档替代；#4/#5 也指出反思可能泛化无效，且需要外部反馈约束。citeturn26view0turn33view1  
对策：硬上限（回合/token/时延）+ 进度度量（validator 通过率、patch 是否变更）+ 输出结构化。citeturn36search24turn20view6  

3) **Tool Hallucination（工具幻觉：错 API/错参/不可执行）**  
症状：模型“看起来很对”，但调用错函数、参数颠倒、输出不可执行。  
依据：#6 在摘要与表格中系统列出错误类型，并证明通过对齐数据+示例检索等组合显著改善。citeturn29view0turn29view2  
对策：工具 schema 强约束 + 参数校验 + 失败即生成结构化诊断（写入反思记忆或 demo 库）。citeturn29view1turn34search1  

4) **“自由文本操作真实系统”（未收敛动作空间直接上生产）**  
症状：agent 直接操控 shell/GUI/数据库，导致不可逆破坏或难以定位问题。  
依据：#9 显示 ACI 收敛动作空间并加 guardrails 可显著提升解决率；#8/#7 证明真实环境本身极难，粗暴接口会放大失败与风险。citeturn20view6turn27view0turn36search24  
对策：ACI/Executor 层先行（原则 2），并在真实环境前先用执行式评测子集做门槛。citeturn20view6turn36search24  

5) **把安全当作 prompt 工程（“加几句别泄露信息”就完事）**  
症状：遇到间接注入/恶意内容仍会被劫持，且修一次换个姿势继续被攻破。  
依据：#11/#12 都表明 prompt injection 是系统性问题：需要可扩展评测与现实应用验证，而非一次性提示词。citeturn36search7turn6view13  
对策：威胁模型→策略边界→持续红队/回归（原则 10）。citeturn36search7turn6view13  

### 可复用参考架构（三套）

> 模块图用“文字模块图”；接口用“可实现的最小集合”；指标给出可直接落地的观测面。  

**轻量版：单 orchestrator + 单执行代理（适合 PoC/内部工具）**  
- **模块图（文字）**：  
  用户请求 → Orchestrator（task parser + 轻量 planner） → Executor（工具/环境适配器，窄动作空间） → Tools/Env；旁路：Short Memory（对话+执行摘要）、Metrics Logger。  
- **任务流**：  
  1) Orchestrator 生成分步计划（最多 N 步）→ 2) 每步调用 Executor 动作（结构化参数）→ 3) Executor 返回执行反馈（摘要+错误码）→ 4) Orchestrator 汇总输出；失败时最多重试 K 次并写入轻量反思。依据 #1/#9/#6。citeturn7view3turn20view6turn29view2  
- **关键接口**：  
  - `plan(task) -> [step{intent, tool, args_schema}]`  
  - `exec(action{tool, args}) -> {status, observation, artifacts, error}`（ACI/Executor）  
  - `memory.append(type, content, metadata)`（最小化）  
- **观测指标**：成功率（端到端）、平均时延（p50/p95）、token 成本、工具错误率（按错参/错 API/执行失败分类）、重试次数。依据 #6/#9。citeturn29view0turn20view6  

**中型版：Team + 审阅闭环 + 结构化工作区（适合严肃业务流程/中等复杂度研发）**  
- **模块图（文字）**：  
  Intake → Router（任务分类/路由） → Team Builder（选择拓扑：horizontal/vertical） → Agents（Planner / Worker(s) / Reviewer / Executor） → Shared Workspace（artifact store + versioning） → Evaluator（执行式判分）→ Logger/Trace。  
- **任务流**：  
  1) Router 判定任务类型（多方案 vs 单解）→ 2) Team Builder 组装拓扑（vertical：solver+reviewer；horizontal：多专家汇总）→ 3) Worker 产出结构化 artifact（PRD/patch/test）→ 4) Reviewer 做校验与反馈 → 5) Executor 运行（测试/工具）→ 6) Evaluator 判分，不达标则迭代。依据 #2/#3/#8/#9।citeturn8view1turn26view0turn20view6turn36search24  
- **关键接口**：  
  - `route(task)-> {task_type, risk_level, required_tools}`  
  - `compose_team(task_type)-> {roles, topology, budgets}`  
  - `artifact.write(kind, schema_version, content, provenance)`（强制 provenance：哪个 agent、哪次 run）  
  - `evaluate(artifacts, execution_logs)-> {pass/fail, signals}`（执行式）  
- **观测指标**：成功率、阶段耗时分解（plan/execute/review）、artifact 合格率（schema/lint/test）、沟通成本（消息数/token）、失败恢复（回滚次数、从失败到恢复的步数）。依据 #3/#9/#1。citeturn26view0turn27view0turn7view3  

**生产版：事件驱动编排 + 安全策略引擎 + 持续评测（适合面向不可信数据/高风险工具/多租户）**  
- **模块图（文字）**：  
  API Gateway/Auth → Policy Engine（权限/敏感操作/数据分区） → Orchestration Runtime（事件队列 + 状态机） → Agent Services（Planner / Specialist agents / Reviewer） → Tool Sandbox（ACI/Executor + 审计） → State Store（workspace + memory） → Continuous Evaluation（回归集 + 红队集） → Observability（trace/log/metrics）。  
- **任务流**：  
  1) 入口先做权限与风险分级（Policy）→ 2) runtime 按事件驱动推进状态机（每个 step 可重放）→ 3) tool 调用必须经过 sandbox（参数白名单+速率限制+审计）→ 4) 每次发布/配置变更触发回归：功能基准（#7/#8/#9/#10）+ 安全基准（#11/#12）→ 5) 线上持续监控 drift。依据 #11/#12/#9/#1。citeturn36search7turn6view13turn27view0turn7view3  
- **关键接口**：  
  - `authorize(task, tools, scope)-> decision`  
  - `tool_policy(tool, args)-> allow/deny + redaction`  
  - `event.emit(type, payload)` / `event.replay(run_id)`（可重放）  
  - `security_eval(run)-> {utility_score, security_score, violations}`（双目标）  
- **观测指标**：成功率、p95 时延、token/美元成本、敏感操作拦截率、注入攻击成功率/数据泄露率（安全属性）、回滚/重放成功率、线上告警到修复时长（MTTR）。依据 #11/#12/#7/#8。citeturn36search7turn6view13turn36search24turn27view0  

---

## 证据薄弱与边界条件

1) **“真实世界长链路任务”仍远未解决，不要被 demo 迷惑**：WebArena 与 OSWorld 都给出极低的端到端成功率，对比人类差距巨大，说明目前 agent 距离可靠助理很远。citeturn36search24turn27view0  

2) **多 agent 不等于更强：没有流程/接口约束时，往往只会更贵、更吵**：MetaGPT 明确把 SOP 与标准化中间产物作为对抗级联幻觉与无益沟通的核心；AgentVerse 也提醒存在 destructive 行为。citeturn26view0turn8view1  

3) **规划/搜索类方法（如 LATS）在评价环境上很强，但成本与环境假设是硬限制**：论文指出部分环境不易回滚，且所用基准相对真实交互仍偏简单；同时搜索天然需要更多采样与评估调用。citeturn33view2  

4) **安全证据很强，但“对业务无副作用的防御”证据仍不足**：AgentDojo 强调需同时衡量 utility 与 robustness；现实应用研究表明漏洞普遍存在，但通用防御仍需要系统化评测与权衡。citeturn36search7turn6view13  

---

## 阅读路径

> 目标：7 天内把“可复用架构骨架 + 可跑通的最小系统 + 可量化的评测与安全回归”做出来，而不是只读论文。每天给出读什么、输出什么、以及一个验证任务。

**Day 1：多智能体编排的最小可运行骨架**  
- 读：#1（AutoGen）重点理解“conversable agent + conversation patterns”与执行解耦。citeturn7view3turn5view0  
- 输出：画出你自己的“对话图/状态机”（哪几类 agent、消息如何流、何时终止）。  
- 验证任务：实现一个最小双 agent：Planner → Executor（仅 3 个动作：search/view/edit），跑通 3 个任务并记录成功率与 token 成本（为后续对比留基线）。依据 #9 的 ACI 思路。citeturn20view6  

**Day 2：团队拓扑与 SOP/流水线**  
- 读：#2（AgentVerse）与 #3（MetaGPT），重点看“横向/纵向结构”“SOP 与 artifact”。citeturn8view1turn26view0  
- 输出：为你的目标领域写一个 SOP（至少 4 个阶段），并定义每阶段 artifact schema（字段与验收条件）。  
- 验证任务：做一组消融：①单 agent；②多 agent 但自由对话；③多 agent + SOP + artifact 校验。对比成功率与沟通 token。依据 #3 的动机。citeturn26view0  

**Day 3：工具使用与接口收敛（可靠性第一天）**  
- 读：#6（ToolBench）与 #9（SWE-agent）。citeturn29view0turn20view6  
- 输出：设计你的 Tool Registry：工具 schema、参数类型、错误码、demo exemplars 的存储结构。  
- 验证任务：复刻 ToolBench 的错误类型统计（错 API/错参/不可执行），并用“参数校验 + 错误摘要反馈”让错误率下降（哪怕只在你的小环境里）。citeturn29view0turn20view6  

**Day 4：规划与搜索（把 agent 从贪心变成可回溯）**  
- 读：#4（LATS）。citeturn32view0turn33view2  
- 输出：写一个“预算化 planner 规范”：最大轨迹数、每步采样数、value 评估次数、停止条件。  
- 验证任务：在一个可回滚的小环境（例如迷宫/网页模拟/轻量工具任务）实现简化版 tree search（beam 也可），对比贪心策略的成功率与成本。依据 #4。citeturn33view2  

**Day 5：记忆与反思（自纠错闭环）**  
- 读：#5（Reflexion）。citeturn34search1turn34search0  
- 输出：定义两层记忆：短期执行摘要 & 长期反思（lessons），并写“写入策略”（何时写、写什么、保留多久）。  
- 验证任务：选 20 个固定任务，做“无反思 vs 有反思（仅失败写入）”两轮对比；同时检查反思是否真的被使用（例如出现在 subsequent prompt 中且影响动作）。citeturn34search1  

**Day 6：高真实度评测与失败归因（别在玩具环境自嗨）**  
- 读：#7（WebArena）、#8（OSWorld）、#10（AgentBench）。citeturn36search24turn27view0turn23search1  
- 输出：组装你的评测矩阵：单步指标、轨迹指标、端到端指标；并定义失败 taxonomy（错工具、错规划、错理解、卡界面等）。  
- 验证任务：挑一个高真实度子集（WebArena 1–2 类任务或 OSWorld 5–10 个任务），跑你的系统并做失败归因，写出“最主要 3 个瓶颈”的证据链（日志→失败类别→改动点）。citeturn36search24turn27view0  

**Day 7：安全与对抗回归（上线前必须做的脏活）**  
- 读：#11（AgentDojo）+ #12（真实应用 prompt injection）。citeturn36search7turn6view13  
- 输出：你的系统威胁模型（至少包含：不可信工具输出、网页内容注入、插件描述污染、数据泄露路径）。  
- 验证任务：把“安全回归”接入 CI：每次改 prompt/router/tool schema 都跑一组注入用例（可从 AgentDojo 思路裁剪），同时监控 utility 是否显著下降（不允许只提升安全把可用性打死）。citeturn36search7turn6view13