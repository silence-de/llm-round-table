# Trust-first 决策系统中 Summary 之后的 Evaluator/Judge Gate 设计研究

## Executive Summary

在 trust-first 的决策系统里，把 “summary 后加一个 judge 打分” 当成可靠性升级，风险很高：LLM judge 本身有系统性偏差，并且会被格式、权威腔、伪引用等“表面特征”诱导，最终把“分数”变成新的伪权威（authority theater）。已有研究明确观察到：位置偏差、冗长偏好、权威偏好（甚至对伪引用的偏好）、自我偏好/同源偏好、以及“看到 refined 版本就更愿意给高分”等现象。citeturn19view0turn7view2turn16view1turn18view0

因此，RT 的 judge gate 不应被设计成“给 summary 一个精确分数”，而应被设计成“契约式验收（contract-based acceptance）+ 风险控制式升级（trust-or-escalate）+ 可审计的缺陷清单（issue codes）”。也就是说：judge 的核心职责是发现可验证的失败模式（constraints 不满足、证据覆盖缺失、风险披露缺失、伪引用/不支持的断言、引用与证据不对齐等），并在必要时触发受控 rewrite；而不是替用户宣称“这份 summary 可信度 92/100”。citeturn7view3turn8view0turn17view0turn22view0

对 RT 来说最稳妥的 judge 输出形态不是单一分数，而是组合信号：**强制门禁的布尔/三态结论（PASS / REWRITE / ESCALATE）+ 多维 issue flags（每一维只做粗粒度等级或通过/不通过/弃权）+ 可追溯的证据指针 + rewrite 指令**。多维 rubric 的好处是把“评价拆成多个可诊断项”，并允许在内部做校准/监控；但前提是：这些信号只作为 internal QA 与 ops 资产使用，而不是对用户展示成“精确评分”。citeturn7view3turn24view2turn22view0

rewrite 循环建议最多 1–2 轮（最多 2 次重写、总计 3 次产出：初稿 + 1–2 次改稿），超出应升级到更强 judge、tool-augmented verification、或人审。原因是：1) agentic loop 需要明确停止条件来避免失控与累积错误；2) 过多轮会把系统推向“为了过 rubric 而写”的过拟合轨道（甚至出现 rubric 诱导的偏好漂移/暗中劣化）。citeturn5view0turn17view0turn22view0

同源偏差（judge 与 generator 同家族/同训练分布）要靠结构性手段降风险：**模型去同源（不同家族/不同供应商）、匿名化与顺序扰动、点式而非强对比式评价、multi-judge 共识、以及 tool-grounded 的可执行验证**。这些做法分别对应已观测到的自我偏好、位置偏差、pairwise 放大偏差、以及“无验证导致幻觉式评估”的问题。citeturn18view0turn16view0turn21view0turn14view2

## Verified Findings

这部分只陈述能被一手论文/官方文档直接支持的结论（或在明确标注为“推断”时给出支撑依据）。

Anthropic 的 “evaluator–optimizer” 工作流明确描述了：一轮生成、另一轮评估与反馈，形成可控的迭代改写循环；它适用于“评价标准清晰、迭代能显著提升质量”的场景，同时需要明确的停止条件与门控（gate）以控制成本与风险。citeturn5view0

Anthropic 在 agent eval 工程文档中把评估拆成 task / trial / grader：由于输出非确定性，需要多次 trial；grader 可以是 code-based、model-based 与 human，并且可以多 grader 组合（binary、weighted、hybrid）；关键点是 model-based grader 需要用 human graders 做校准（calibration），而不是把模型分数当作天然真理。citeturn7view3

在“研究/检索类 agent”评估上，Anthropic 明确提出了几类对 RT 特别相关的检查：groundedness（断言是否被检索到的来源支持）、coverage（关键事实是否覆盖）、source quality（来源是否权威而非“检索到的第一个”）。这就是把 judge 从“主观质量感受”拉回到“证据契约”的工程化路径。citeturn7view3

论文与系统性研究反复表明 LLM-as-a-judge 存在多种偏差。除了早期工作总结的 position bias、verbosity bias、自我/自增强偏差与推理能力限制外，后续更系统的分类还包括 authority bias（对权威/引用的偏好、即便是伪造引用）、refinement-aware bias（被告知“这是 refined 版本”就更易给高分）等。citeturn16view1turn19view0

“权威偏差”不是抽象担忧：在人类与 LLM judge 的对比研究中，向文本插入伪引用会系统性影响判断；并且研究者展示了 LLM judge 可以被 prompt-based 方法“hack”，说明 judge gate 必须被当作安全边界（attack surface）来设计。citeturn7view2turn7view0turn19view0

同源/自我偏好也有可量化证据：一项专门研究提出了自我偏好指标，并在多个模型上测量到 GPT-4 等模型存在显著自我偏好；研究还指出 judge 更倾向于给“低困惑度/更像自己风格”的文本更高评价，并建议用多模型 ensemble 作为缓解策略之一。citeturn18view0turn18view2

pairwise 评价协议会放大偏差：在对抗样本上，pairwise setup 更容易被“表面特征/干扰因素”诱导；pointwise（独立打分）更能抵御此类“比较陷阱”，因为它减少了比较时对可利用特征的注意力漂移。对 RT 这种“单个 summary 的验收”任务，这强烈支持优先采用 pointwise + 结构化 rubric，而不是 A/B 式胜负判断。citeturn21view0

即使采用 rubric-based judge，也会出现 rubrics 自身的“位置/顺序偏差”：研究指出评分选项或 rubric 条目的排序会诱发系统性的偏置，提出 balanced permutation 可揭示并缓解这种偏差，同时强调该技术也可能被滥用去操纵评估结果。citeturn6view5

更严重的工程风险是：rubric 本身可以成为攻击面。最新研究提出“Rubric-Induced Preference Drift”：看似“benchmark 通过”的自然语言 rubric 改动，可能在目标域上系统性漂移 judge 偏好；这种漂移还能沿着“judge 产偏好标签 → 下游对齐/训练”的管线传播并固化。关键结论之一是：漂移可跨 judge 模型迁移，意味着“换 judge”也未必能消除由 rubric 结构引发的偏置。citeturn17view0turn17view3

“Trust or Escalate” 系列工作给出了一条避免“伪权威打分”的形式化路径：不要无条件相信 judge，而是引入置信度与弃权（abstention），在校准集上选择阈值，以在给定风险容忍度下提供对“与人类一致性”的概率保证；同时可做级联（cascade），用便宜模型先判、低置信度再升级到更强模型，以控制成本并保持风险界限。citeturn22view0turn22view1turn22view2

多维 rubric 与校准的工程可行性也有直接证据：LLM-Rubric 提出先用 LLM 对每个 rubric 问题输出分布，再用校准网络学习个体人类评审风格，并显式讨论了“把 ordinal 当 interval”的风险、以及通过分布建模输出不确定性的价值；更重要的是，它在摘要就承认“LLM 预测往往与人类不一致，人类之间也不完全一致”，这从根上否定了“单精确分数可作为权威”的叙事。citeturn24view1turn24view2

生产侧的模式同样明确：AWS 的 GenAIOps 指南把“离线评估”作为 CI/CD 的关键阶段，用 versioned evaluation dataset 运行 LLM-as-a-judge 指标并在低于阈值时 fail build；同时强调 prompt、模型配置、评估集都要版本化，并把线上反馈回流成新的测试用例，形成持续校准与防回归的闭环。citeturn8view0

## Judge Design Space

下面把“在 RT 决策 summary/dossier 后做 judge gate”拆成可落地的设计空间，并直接回答你提出的 6 个问题（以小标题形式嵌入）。

### RT summary 的 judge 最适合评估哪些维度

对 RT 的 decision summary，最适合让 judge 承担的是**“契约可验证”的维度**，即：只要给定 brief、证据包（evidence set）、以及 summary 本身，就能较高一致性地判定“是否满足要求”。这与 Anthropic 对研究 agent eval 的 groundedness/coverage/source quality 思路一致：用 grader 去验证“是否被证据支持”“是否覆盖关键点”“来源是否合格”，而不是评判宏观正确性。citeturn7view3

在 RT 语境里，建议把可判定维度分成三层：

第一层是结构/格式/约束满足（尽量 code-based）：是否包含 required sections、是否回答了 brief 的约束项、是否出现禁止内容、是否输出了必要的风险披露段落等。Anthropic 也强调一项任务可以有多个 grader，并且可以采取 binary 或 hybrid 的组合方式。citeturn7view3turn5view0

第二层是证据对齐（model-based + tool-augmented）：对每条“事实性断言/关键结论”，检查它是否能在 evidence set 中找到支持，且引用指针不伪造。这里应把 judge 从“语言直觉”拉向“可执行验证”：Agent-as-a-Judge 综述强调了 tool-augmented evidence collection 与 correctness verification，把评估锚点从模型内知识转向客观验证。对 RT 来说，这对应“引用解析 + 证据检索/交叉引用 + 断言-证据映射”的 judge 子任务。citeturn14view2turn7view3

第三层是风险与不确定性披露（model-based，但应允许弃权/升级）：summary 是否明确区分确定事实、推断、假设；是否列出关键风险、反例、已知未知（known-unknowns）。由于 LLM judge 对权威腔、refined 标签、冗长等有偏好，把“风险披露充分性”做成单分数非常容易出戏：更合理的是让 judge 输出“缺失项列表 + 是否达到最低披露门槛”。authority bias 与 refinement-aware bias 的证据说明：judge 很可能把“看起来更像审计报告”的文本误当成“更诚实”。citeturn19view0turn7view2

综合起来，RT judge 最适合评估的维度可以概括为：

- brief/约束 adherence（是否遗漏硬约束、是否违反禁止项）
- evidence grounding（断言—证据映射、引用真实性）
- evidence coverage（关键证据点是否覆盖）
- uncertainty & risk disclosure（是否披露关键风险/限制，而不是装作确定）

这四类恰好对应你列出的“brief 约束、evidence coverage、risk disclosure 负责”。citeturn7view3turn8view0

### 哪些维度不适合量化打分，为什么

不适合量化成单分或细粒度分值的维度，核心特征是：**缺少稳定 ground truth、或者容易被表面特征 hack**。

第一类是不应量化的“总体质量/总体可信度”。LLM-Rubric 的摘要就强调了：LLM 预测与人类不一致，人类之间也不完全一致；在这种基础上对用户输出“精确质量分”几乎必然变成伪权威。citeturn24view1turn24view2

第二类是“说服力/表达质量”相关的总体分。冗长偏好、权威偏好、refinement-aware 偏好、beauty/排版偏好等研究证据表明：judge 容易把“更长、更像引用论文、更像 refined 文案”的输出判成更好，即使这些属性并不对应真实正确或真实覆盖。citeturn16view1turn19view0turn7view2

第三类是“策略正确性/最终决策好坏”。RT 的 summary 是对决策过程的 dossier，而不是客观真理题；judge 缺少外部环境反馈时，最多能审查“这份 summary 是否忠实于证据、是否披露风险”，而无法为“这是不是正确的架构决策”背书。Agent-as-a-Judge 综述批评了静态 LLM judge 只能基于语言模式做“看起来正确”的评估，会产生“hallucinated correctness”。把这种维度量化会把系统推向危险的权威幻觉。citeturn14view2turn17view0

第四类是不建议细粒度量化的“rubric 内部子项排序权重”。Rubrics-as-an-Attack-Surface 指出自然语言 rubric 改写能在维持 benchmark 表现的同时诱导目标域漂移，并可跨模型迁移；这意味着“把评分权重优化到更稳定”本身也可能成为攻击/漂移入口，最终让分数越来越像内部偏好的投影。citeturn17view0turn17view3

简言之：RT judge 应该量化的是“硬失败的可验证项”（如引用伪造、未覆盖关键证据、违反约束），而不是量化“总体可信度”和“决策正确性”。

### judge 输出应是什么格式

单一标量分数最容易走向 authority theater，也最容易被 rubrics 与偏差污染。已有工作提供了更稳的输出形态：多 grader + 可弃权 + 可校准。

Anthropic 的工程文档明确：一个任务可以有多个 grader，每个 grader 有多个 checks；组合方式可以是 weighted、binary 或 hybrid。citeturn7view3

Trust or Escalate 进一步强调：可靠评估不应无条件依赖判断结果，而应评估置信度并在不确定时弃权/升级，并可用校准集选择阈值来控制风险。citeturn22view0turn22view1

LLM-Rubric 则展示了“多维 rubric → 分布输出 → 校准/聚合”的路线，并指出建模分布能输出不确定性而不是只给均值分。citeturn24view2

因此对 RT，推荐的 judge 输出是组合格式：

- 顶层：三态 gate（PASS / REWRITE / ESCALATE），其中 ESCALATE 表示“judge 不确信或发现高风险失败，需要更强验证或人审”。这一点来自 selective evaluation 的弃权思想（虽然原论文多用于 pairwise，但风险控制逻辑可迁移到 pointwise gate——这是推断，依据是该框架对“何时信任模型判断”的抽象定义与阈值校准机制）。citeturn22view1turn22view2
- 中层：多维 rubric 的粗粒度状态（PASS / WARN / FAIL / ABSTAIN），每个维度附带 issue codes 与 evidence pointers（例如引用到 evidence set 的具体条目或段落标识）。
- 底层：rewrite 指令（只允许“针对缺陷补证据、补披露、修正引用映射、删掉无证断言”，不允许“重写结论让它更像对的”）。

这个结构的关键是：**把 judge 的“主观分”降级成“内部质量信号”与“可行动缺陷清单”**。

### judge 低分后如何触发 rewrite，最多几轮合适

Anthropic 在 evaluator–optimizer 模式中强调迭代改进的适用条件是“评价标准清晰”；在 agent loop 更一般的讨论中也强调要有 stopping conditions（例如最大迭代次数）来维持控制。citeturn5view0

Rubric-Induced Preference Drift 的证据说明：在多轮“按 rubric 改写”与“rubric 迭代”中，存在把系统推向偏好漂移/代理目标的路径，且这种漂移能穿透到下游训练与行为。对 RT 而言，多轮 rewrite 会增加“为了过 gate 而写”的可能性。citeturn17view0

因此，建议的 rewrite 轮数上限是：

- 默认：最多 1 次 rewrite（初稿 → judge → 改稿），满足大部分“遗漏披露/引用映射错误/覆盖缺口”问题。
- 对高风险或 evidence set 大、且 judge 仍 ABSTAIN 的 case：最多 2 次 rewrite；若仍未 PASS，则进入 ESCALATE（更强 judge / tool-based verification / human review）。

这个上限属于工程推断：核心依据是 Anthropic 对停止条件的建议与 RIPD 对“持续优化 rubric/输出可导致系统性漂移”的实证风险。citeturn5view0turn17view0

### judge 的结果如何进入 ops / calibration，而不是变成用户侧精确分数

这里必须把 internal QA signals 与 user-facing trust signals 分离。

internal：AWS 的 GenAIOps 指南明确把离线 eval、版本化评估集、CI/CD gate（低于阈值 fail build）、以及线上反馈→新增测试用例的闭环当作生产质量基建；Anthropic 的 eval 文档也强调 model-based grader 需要用 human grader 校准，并且由于非确定性要做多 trial。citeturn8view0turn7view3

Trust or Escalate 则提供了“用校准集选择阈值并给出风险控制保证”的形式化框架，适合把 judge 输出转化为 ops 里的风险界限与升级策略，而不是前台数值。citeturn22view1turn22view2

因此，judge 结果进入 ops/calibration 的推荐方式是：

- 存储结构化日志：每个维度的 PASS/WARN/FAIL/ABSTAIN、issue codes、引用指针、以及是否触发 rewrite/升级。
- 在版本化 eval set 上跑 regression：把“通过率、重写率、升级率、关键 issue 的发生率”作为监控指标；当这些指标回退时阻断发布（CI/CD gate）。citeturn8view0turn7view3
- 用抽样人审做校准：对 ABSTAIN/边缘样本做人类判定，将结果用于阈值调整与 rubric 更新；这和“selective evaluation 需要校准集”以及“model-based grader 需 human 校准”的思想一致。citeturn22view1turn7view3
- 不把单次判定分数当 KPI：把它当作 noisy sensor；趋势与分布（按任务类型/证据规模/风险等级切片）才是 ops 资产（推断，依据是 AWS 强调可观测性与趋势监控，以及 Anthropic 强调多 trial 与校准）。citeturn8view0turn7view3

user-facing：只输出“可核验的透明度线索”，例如“使用了哪些来源、哪些断言被标注为推断、有哪些已知限制与风险”。不要输出“judge 分数/通过率/模型置信度”。authority bias 与 refinement-aware bias 研究显示：用户会把这类分数当作权威背书，而它本身可能被格式与伪引用诱导。citeturn19view0turn7view2

### 如何降低 judge 与 generator 同源模型带来的偏差

同源偏差的证据链包括：自我偏好/自增强偏差、对自家风格的偏好，以及对低困惑度（更“像自己写的”）文本的偏好。citeturn18view0turn16view1

可落地的缓解手段应覆盖三条路径：

- 模型去同源：用不同家族/不同供应商 judge；或用多模型 ensemble，并在样本级别做一致性/分歧检测。自我偏好研究直接建议 ensemble 作为降低偏差的方法之一；Anthropic 也把 multi-judge consensus 列为 model-based grader 方法。citeturn18view2turn7view3
- 机制去同源：匿名化（不让 judge 知道 generator 身份）、顺序扰动（对 candidate 或 rubric 选项顺序做 balanced permutation）、点式评价而非强对比式 pairwise（pairwise 会放大偏差）。citeturn6view5turn21view0turn16view0
- 证据去同源：把 judge 绑定到 evidence set 与工具验证（Agent-as-a-Judge 的 tool-augmented verification），让它“必须引用证据”而不是“凭风格给分”。权威偏差与伪引用攻击的存在，意味着必须做引用真实性检查。citeturn14view2turn7view2turn19view0

## Recommended Rubric for RT

这一节给出一个“最小但够用”的 RT rubric（满足你的额外要求），并明确 judge 不应该直接做什么。

### RT 最小 rubric

最小 rubric 目标是：覆盖你关心的三大责任（brief 约束、evidence coverage、risk disclosure），并把“伪权威”风险最小化。rubric 设计遵循 Anthropic 的多 grader 思路：能 code-based 的尽量 code-based；语义项才用 model-based judge；组合方式用 hybrid（硬门禁 + 软信号）。citeturn7view3turn5view0

我建议把最小 rubric 固化为 4 个硬门禁维度 + 2 个软维度（共 6 维），其中硬门禁只允许 PASS/FAIL/ABSTAIN：

硬门禁维度（FAIL 必触发 REWRITE 或 ESCALATE）  
维度 A：Brief 合规性（Constraints Adherence）  
判定：summary 是否逐条响应 brief 的硬约束（包含必须回答的点、不可越界的点、输出结构要求）。依据：Anthropic 推荐在 prompt chaining 中加入 gate，并用 checks 确保过程没跑偏；也允许多 assertions。citeturn5view0turn7view3

维度 B：证据真实性与引用对齐（Groundedness & Citation Integrity）  
判定：  
1) summary 中的关键事实断言是否被 evidence set 支持（允许 judge 对断言做抽取）；  
2) 若有 citations/引用标识，它们是否指向真实 evidence（防伪引用）；  
3) 严禁“引用看起来像论文但 evidence set 里不存在”。权威偏差研究表明伪引用会诱导 judge，本维度必须优先做“引用真实性检查”，否则 judge 自己也会被骗。citeturn7view2turn19view0turn7view3

维度 C：证据覆盖（Evidence Coverage of Key Points）  
判定：与其给“覆盖率分数”，更稳的是让 product 定义“关键证据清单”（golden checklist / key facts list），让 judge 逐项判定是否在 summary 中被准确覆盖，并允许 ABSTAIN（表示 evidence 过于分散或表述太隐含，需要升级）。这直接映射到 Anthropic 对 coverage checks 的描述。citeturn7view3turn8view0

维度 D：风险与不确定性披露（Risk & Uncertainty Disclosure）  
判定：summary 是否明确列出：前提假设、已知不确定性、潜在负面影响/失败模式，以及哪些结论是推断而非事实。注意：这里不做细粒度打分，而做“最低披露门槛是否达标”。原因是 judge 易受文风/冗长/权威腔影响，把“写得像风险披露”误判为“真的披露充分”。citeturn19view0turn16view1turn24view1

软维度（只输出 WARN，不参与硬门禁，但进入 internal dashboard）  
维度 E：论证结构与可审计性（Argument Traceability）  
判定：结论—证据—反例/备选项的链条是否清晰；是否出现“结论跳跃”。这类检查可以作为 issue codes（例如 “missing tradeoff rationale”），但不建议量化成 1–10 分。原因同上：分数容易变成新权威，且会被文风 hack。citeturn21view0turn19view0

维度 F：行动性（Actionability for Decision-making）  
判定：是否明确区分：建议、需要验证的假设、下一步数据/实验、以及决策点。这个维度更多是运营信号，不应作为对用户的“可信度背书”。AWS 强调把线上失败转化为新的测试用例与反馈闭环；行动性维度适合指导这个闭环。citeturn8view0

### judge 不应该直接做什么

这部分是硬要求：明确“judge 不应该直接做什么”，并用研究证据解释为什么。

不应该对外输出单一分数或精确概率（如 “Trust Score = 93/100”、“Coverage = 0.87”）。原因：LLM judge 存在 authority bias、verbosity bias、refinement-aware bias 等，分数会被表面特征驱动；而且人类评审本身也不一致，精确分数没有客观含义，只会制造伪权威。citeturn19view0turn24view1

不应该“替用户做架构决策裁判”，特别是不能给出“最终决策正确/错误”的权威结论。judge 的上限是审查 summary 是否忠实于证据与约束；在缺少环境验证时，静态 judge 会产生“看起来正确”的幻觉式评估。citeturn14view2turn7view3

不应该在证据不足时强行给结论。应当支持 ABSTAIN/ESCALATE：Trust or Escalate 的核心就是置信度不足时弃权、并在校准框架下控制风险。citeturn22view0turn22view1

不应该把 rubric 优化当作“持续提高分数”的游戏。Rubric-Induced Preference Drift 表明自然语言 rubric 的优化可在 benchmark 不变的情况下让目标域偏好系统性漂移，并且可跨模型迁移；如果 RT 把“过 gate”当成主要目标，迟早会走向 reward hacking 的同类问题。citeturn17view0turn17view3

## Rewrite Loop Design

这一节回答“低分如何触发 rewrite、最多几轮”并给出可直接落地的控制逻辑。

### 触发条件与分流

用 Anthropic 的“多 grader + hybrid 组合”可以把 rewrite 触发逻辑设计成可解释的分流树：先做 deterministic checks（结构与引用解析），再做 model-based judge（语义与证据链），最后才允许进入 rewrite 或升级。citeturn7view3turn5view0

建议的分流如下（概念性流程）：

1) Code-based precheck：结构/必填项/引用格式是否可解析。失败 → REWRITE（由 generator 修正格式）；重复失败 → ESCALATE（通常是模板/解析器问题）。citeturn7view3  
2) Citation integrity precheck：若发现引用指向不存在的 evidence 或出现“看似学术但 evidence 集合里没有”的引用 → 直接 REWRITE，且在 rewrite 指令中强制删除伪引用或改为证据内引用。authority bias 研究表明伪引用会诱导 judge 与人类；所以必须优先做这一项。citeturn7view2turn19view0  
3) Model-based judge（按最小 rubric）：A–D 任一 FAIL → REWRITE；任一 ABSTAIN → ESCALATE（更强 judge / tool verification / 人审），或允许最多一次“补证据请求”式 rewrite（让 generator 只补缺口，不得重写结论）。citeturn22view1turn14view2

### rewrite 内容的约束

rewrite 必须是“缺陷驱动的外科手术”，而不是“整体润色”。原因是：verbosity bias、refinement-aware bias 会让系统逐步把文本写得更长、更像 refined 文案，从而更容易“骗过 judge”。citeturn16view1turn19view0

因此，rewrite 指令应强制约束为：

- 只能：补齐遗漏的关键证据点、修正引用映射、删除无证断言、补充风险披露/假设列表、明确哪些是推断。
- 禁止：为了提高观感而扩写、为了“看起来更权威”而增加引用、为了迎合 rubric 而改变结论立场（除非结论本身被证据否定）。

这属于工程推断，但直接受“冗长偏好 + 权威偏好 + refined 偏好”以及“rubric 可被利用/诱导漂移”的实证结果支撑。citeturn16view1turn19view0turn17view0

### 最大轮数与停止条件

推荐最多 2 轮 rewrite（初稿 + 2 次改稿）。超过就 ESCALATE。理由分两层：

- Anthropic 建议 agentic loop 需要 stopping conditions，例如最大迭代次数来维持控制。citeturn5view0  
- Rubric-Induced Preference Drift 说明持续“在标准流程内优化 rubric/文本”可能让系统在目标域发生方向性漂移；更多轮数意味着更大的“为过 gate 而优化”的空间。citeturn17view0  

如果你希望把“最多几轮”做成可学习参数，应该放在 ops 校准层面（基于失败类型与风险等级动态调节），而不是写死给用户侧解释（见下一节）。这一点与 AWS 强调持续评估与反馈闭环相一致。citeturn8view0

## How Judge Signals Should and Should Not Be Exposed

这一节专门区分 internal QA signals 与 user-facing trust signals，并回答“judge 结果是否适合进入 calibration、若适合以什么形式”。

### Internal QA signals 应该是什么

internal QA signals 的目标是：让工程团队能定位缺陷、做回归、做漂移监测与校准，而不是给用户提供“可信度分数”。

结合 Anthropic 的 grader 框架与 AWS 的 CI/CD eval gate，internal signals 推荐采用：

- 多维状态：每个 rubric 维度输出 PASS/WARN/FAIL/ABSTAIN。citeturn7view3turn22view1  
- issue codes：例如 `missing_constraint_x`、`unsupported_claim_y`、`fake_or_unverifiable_citation`、`missing_risk_disclosure_z`。这些是 ops 里最有用的“可聚合类别”。（推断，但符合 AWS 强调“将失败转成测试用例并持续硬化”的方式：需要稳定的失败分类才能自动化回流。）citeturn8view0  
- evidence pointers：对每个 FAIL，必须附“缺口在哪里”（缺失的证据条目 ID / 引用位置 / 断言抽取结果），以便可审计与复现。Agent-as-a-Judge 强调用工具与证据收集把评估锚到客观验证。citeturn14view2  
- 不确定性信号：不是给用户的概率，而是给 ops 的 ABSTAIN 率与分布。Trust or Escalate 的核心是弃权与风险控制；LLM-Rubric 也强调分布建模可报告不确定性（entropy/variance）。citeturn22view1turn24view2  

### judge 结果是否适合进入 calibration

适合，但必须以“**可校准的风险控制参数与多维误差画像**”进入，而不是以“单分数越高越好”的目标进入。

直接依据有三条：

- Anthropic 明确指出 model-based grader 需要用 human graders 校准。citeturn7view3  
- Trust or Escalate 以校准集选择阈值来控制与人类一致性的风险，并在不确定时弃权/升级。citeturn22view1turn22view2  
- LLM-Rubric 说明 LLM 原始预测与人类不一致、人类也不一致，因此需要校准/聚合，并且应建模分布与不确定性。citeturn24view1turn24view2  

对 RT 的具体落地形式：

- 校准对象不是“分数”，而是：每个维度的 FAIL/ABSTAIN 触发阈值、以及 ESCALATE 策略（例如 ABSTAIN 率超过某阈值，自动升级到 tool-based verification 或人审）。
- 校准数据来自：版本化评估集（离线）+ 线上失败回流用例（在线），符合 AWS 版本化评估集与反馈闭环的建议。citeturn8view0
- 校准指标不是“平均分”，而是：在关键维度上对人审一致性的精度/覆盖（precision/coverage），这是 selective evaluation 框架的语言。citeturn22view1

### User-facing trust signals 应该是什么

用户侧的 trust-first 目标是“让用户能自己核验、知道系统哪里不确定”，而不是“让用户相信一个外部权威分数”。

结合 authority bias 与伪引用可诱导 judge 的证据，用户侧应该避免任何“权威打分/认证式徽章”，尤其不要展示 judge 的 numeric 分数或 pass-rate。citeturn7view2turn19view0

更合适的 user-facing signals 是：

- 透明度：明确列出使用的 evidence 列表（或证据包摘要）与引用映射方式（例如每条关键断言都可展开看到对应证据）。
- 不确定性披露：明确标注哪些结论是推断、依赖哪些假设、有哪些尚未覆盖的证据空白（如果存在）。
- 风险披露：把“已知风险/限制”放到用户可见层，而不是只在内部打分。

这些不是“judge 背书”，而是“让用户自己做信任判断”的材料；其设计理念与 Anthropic 针对 research agents 强调 groundedness/coverage/source quality 的方向一致。citeturn7view3

### Recommended Minimum Design for RT

这里给出一个最小可行（MVP）架构，满足：加入独立 judge 做验收与必要 rewrite，但不制造新的伪权威。

最小架构组件：

- Summary Generator：一次生成 decision summary/dossier（现状）。  
- Deterministic Gates（代码门）：结构校验、必填项校验、引用格式与 evidence-ID 可解析性校验。依据：Anthropic 的“多 assertions 的 grader”思路与 prompt chaining 的 gate 概念。citeturn7view3turn5view0  
- Evidence Verifier（工具/规则优先）：断言抽取 → 在 evidence set 内检索/匹配 → 输出“支持/不支持/不确定”。这一步尽量不靠 LLM 直觉，借鉴 Agent-as-a-Judge 的“从直觉到执行/验证”的原则。citeturn14view2  
- Judge（点式、多维、可弃权）：按最小 rubric A–F 输出 PASS/REWRITE/ESCALATE + issue codes + evidence pointers。点式优先的依据来自“pairwise 会放大偏差”的结论。citeturn21view0turn7view3  
- Rewrite（受控 1–2 轮）：采用 evaluator–optimizer 的 loop，但限制 rewrite 为缺陷修复；超过两轮直接 ESCALATE。停止条件依据 Anthropic；对“按 rubric 优化会漂移”的风险依据 RIPD。citeturn5view0turn17view0  
- Ops Layer：版本化 eval set、CI/CD gate 与监控仪表盘；把 failure 回流为新测试样本。依据 AWS 指南。citeturn8view0  
- Exposure Policy：用户侧不显示分数，只显示证据与不确定性披露（内部与外部信号隔离）。依据 authority bias 与“伪引用诱导”风险。citeturn7view2turn19view0  

这个最小设计的关键点是：judge 的角色是“内部验收器与缺陷定位器”，而不是“对用户的可信认证机构”。

### Anti-Patterns

下列模式几乎必然走向“新伪权威”或质量漂移，建议在架构决策上明确禁止：

把 judge 分数直接展示给用户，或把它包装成“可信度徽章”。这会放大用户对数字权威的依赖，而这些数字本身受 authority/verbosity/refinement 等偏差影响。citeturn19view0turn24view1

把单一标量分数作为核心优化目标（无论是 prompt 优化、policy 训练、还是“多轮 rewrite 直到分数达标”）。Rubric-Induced Preference Drift 直接展示了 rubrics 可在“benchmark 合规”的外衣下诱导目标域偏好漂移，并可传播到下游对齐。citeturn17view0turn17view3

generator 与 judge 同源、且没有任何去同源或顺序扰动/共识机制。自我偏好与自增强偏差提示 judge 会偏好自己或同风格输出，导致“同源自证”。citeturn18view0turn16view1

只用 pairwise 胜负判断来做 gate（例如“把当前 summary 与上版对比，让 judge 选更好”）。pairwise 会放大对冗长/权威腔等可利用特征的偏好，在对抗样本上更脆弱。citeturn21view0turn16view1

不允许弃权/升级，强迫 judge 在不确定时也必须给结论。Trust or Escalate 的核心观点就是：可靠评估应在置信不足时弃权，并通过校准阈值控制风险。citeturn22view0turn22view1

不对伪引用/提示注入做防护，把 judge 当成“不会被攻击的评审”。权威偏差与“可被 prompt hack”的证据说明 judge 需要被当作攻击面。citeturn7view0turn7view2turn19view0

## Open Questions

RT 的场景有一些关键问题，在现有文献中只能得到部分答案；这些应当被当成产品架构的待验证假设。

RT 的“关键证据清单”如何构建与维护：是由人维护、由系统从 evidence 中自动抽取、还是混合？Anthropic 提到 coverage checks 但没有规定 checklist 的来源工程。citeturn7view3

当 evidence set 本身存在冲突或质量参差时，judge 如何识别“来源质量”而不回到权威偏差（例如“看到更像论文的就更信”）？source quality checks 被提出，但如何防止它退化为“看起来权威”的启发式，需要专门的设计与对抗测试。citeturn7view3turn19view0

如何在 pointwise 的 summary 验收中引入 “selective evaluation/置信校准” 的形式化保证：Trust or Escalate 主要在 pairwise 偏好框架下定义风险与覆盖；RT 需要把同样的风险控制思想迁移到“多维门禁 + 证据核验”的组合信号上，这需要新的校准协议（推断）。citeturn22view1turn7view3

如何度量并抑制“rewrite 轮数增长 → 更像对的写作风格”带来的偏差：冗长偏好与 refined 偏好说明文本会越来越“像审计报告”；而 RIPD 说明 rubric 可成为漂移入口。RT 需要把“写得更像”与“证据更充分”严格区分。citeturn16view1turn19view0turn17view0

judge 的 shelf life 与分布漂移：随着 generator 模型与写作风格迭代，judge 的偏差结构也可能变化；AWS 强调持续评估与版本化回归，但对 judge 本身的“寿命管理”还需要专门策略（推断，依据是持续评估/回归的必要性）。citeturn8view0

## Source List

Building effective agents (Engineering at Anthropic, 2024-12-19). citeturn5view0

Demystifying evals for AI agents (Engineering at Anthropic, 2026-01-09). citeturn5view1turn7view3

Hardening the generative AI application through a GenAIOps framework (AWS Prescriptive Guidance). citeturn8view0

A Survey on Agent-as-a-Judge (arXiv:2601.05111, 2026). citeturn14view0turn14view1turn14view2

Agent-as-a-Judge: Evaluate Agents with Agents (OpenReview). citeturn6view0

Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (arXiv:2306.05685, 2023). citeturn15view0turn16view1turn16view2

Humans or LLMs as the Judge? A Study on Judgement Bias (arXiv:2402.10669, EMNLP 2024). citeturn7view0turn7view2

Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge (arXiv:2410.02736, 2024). citeturn19view0turn19view1

Self-Preference Bias in LLM-as-a-Judge (arXiv:2410.21819, 2024). citeturn18view0turn18view2

Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge (arXiv:2406.07791, 2025). citeturn6view4

Am I More Pointwise or Pairwise? Revealing Position Bias in Rubric-Based LLM-as-a-Judge (arXiv:2602.02219, 2026). citeturn6view5

The Comparative Trap: Pairwise Comparisons Amplifies Biased Preferences of LLM Evaluators (arXiv:2406.12319, 2024/2025). citeturn21view0turn21view1

Rubrics as an Attack Surface: Stealthy Preference Drift in LLM Judges (arXiv:2602.13576, 2026). citeturn17view0turn17view3

Trust or Escalate: LLM Judges with Provable Guarantees for Human Agreement (arXiv:2407.18370, ICLR 2025). citeturn22view0turn22view1turn22view2

LLM-Rubric: A Multidimensional, Calibrated Approach to Automated Evaluation of Natural Language Texts (arXiv:2501.00274, ACL 2024). citeturn24view1turn24view2