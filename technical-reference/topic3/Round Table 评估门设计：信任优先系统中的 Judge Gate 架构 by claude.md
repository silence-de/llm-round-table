# Round Table 评估门设计：信任优先系统中的 Judge Gate 架构

**在信任优先（trust-first）决策系统中，evaluator/judge gate 的核心矛盾不是"能不能评分"，而是"评分本身是否会成为新的伪权威"。** 基于对 7 份一手文献的系统性分析，本报告的核心结论是：Round Table（RT）的 judge gate 应采用**分层诊断架构**——将可确定性检查（deterministic checks）与 LLM 判断严格分离，judge 输出以**结构化诊断信号**而非分数面向用户，同时通过 cross-model evaluation 和 calibration 数据飞轮持续对抗偏差积累。这一设计既满足 QA 拦截与 rewrite 触发的工程目标，又从根本上避免了 judge 分数演变为 authority theater。

---

## 一、为什么"加一个评分"远比看起来危险

RT 的系统定位是**决策摘要/dossier 的信任中介**——用户依赖它做出真实决策。这意味着 judge gate 面临的风险不仅是技术性的（拦截坏摘要），更是认知性的：**任何看起来像"权威评分"的输出，都可能被用户当作决策质量的担保**，即 authority theater。

Anthropic 在 "Building Effective Agents" 中将 evaluator-optimizer 定义为"one LLM call generates a response while another provides evaluation and feedback in a loop"，并明确限定其适用条件为**评估标准清晰且迭代能带来可度量改善**。这个限定词至关重要——它暗示并非所有维度都适合 LLM 评估。Constitutional AI 论文（Bai et al., 2212.08073）更直接地暴露了风险：**过度训练的评估器会产生 Goodharting 行为**，导致模型输出千篇一律的模板化回应（如反复插入"you are valid, valued, and cared for"）。在 RT 场景中，这等价于 judge 将所有摘要打磨成"看起来安全但实质空洞"的标准格式。

CALM 框架（Ye et al., 2410.02736）识别出的 **12 类 LLM judge 偏差**进一步加剧了这一担忧。其中 authority bias（RR 低至 **0.662**）和 bandwagon effect（RR 低至 **0.610**）对 RT 尤其致命——如果 judge 本身容易被权威线索或多数意见左右，它对决策摘要中"证据覆盖度"和"风险披露"的评判就不可信赖。**Judge 的偏差不会消失，只会从生成阶段转移到评估阶段。**

---

## 二、哪些维度最适合 judge 评估

基于 RT 摘要的三重问责标准（brief constraints、evidence coverage、risk disclosure），结合文献中关于 LLM judge 能力边界的实证数据，**适合量化评估的维度具有一个共同特征：存在可验证的参照物（reference）**。

### 高置信评估维度：结构合规与事实锚定

**第一类：Brief 约束符合度（Structural Compliance）。** 这是最适合自动化评估的维度。Zheng et al.（2306.05685）发现 reference-guided grading 将 GPT-4 的数学/推理评判失败率从 **70% 降至 15%**。对 RT 而言，brief 本身就是天然的 reference——字数限制、必须涵盖的议题、输出格式要求等均可通过 deterministic checks 直接验证，无需 LLM 介入。Anthropic 的 "Demystifying Evals for AI Agents"（2026年1月）将此类检查归为"code-based graders"，特点是**快速、廉价、客观、可复现**。

**第二类：证据覆盖完整性（Evidence Coverage）。** 这一维度处于 deterministic 与 LLM 评估的交界处。一方面，可以通过代码检查摘要是否引用了输入 dossier 中的所有关键数据源（类似 Agent-as-a-Judge 中 Zhuge et al. 提出的 Graph Construction + Locate + Read 模块组合）；另一方面，判断"是否遗漏关键证据"需要 LLM 的语义理解能力。**最佳实践是将其拆分为两个子检查**：覆盖率（deterministic：数据源引用计数）和覆盖质量（LLM：是否遗漏了矛盾性或关键少数证据）。

**第三类：风险披露存在性（Risk Disclosure Presence）。** 类似于证据覆盖，可拆分为"是否存在风险章节"（deterministic）和"风险描述是否与摘要中的证据逻辑一致"（LLM）。Anthropic 在 Constitutional AI 中的关键发现直接适用于此：**使用多条宪法原则（constitutional principles）随机采样并 ensemble，比依赖单一评判标准显著更鲁棒**。论文使用 16 条自然语言原则进行 ensemble，实证表明这种方法"led to notably more robust PM behavior"。

### 适中置信维度：内部一致性

**第四类：逻辑一致性（Internal Coherence）。** 检查摘要中的结论是否与所引证据矛盾、不同章节之间是否存在逻辑冲突。Zheng et al. 发现 LLM judge 对逻辑推理的评判**在有 chain-of-thought 提示时准确率有所提升**（失败率从 70% 降至 30%），但仍不如 reference-guided 方式可靠。CALM 论文中 fallacy-oversight bias 的 RR 相对较高（**0.917–0.985**），表明主流模型在识别明显逻辑谬误方面能力尚可。但对于微妙的逻辑不一致，仍需谨慎——judge 应输出"疑似不一致的具体位置"而非一个一致性分数。

---

## 三、哪些维度不适合量化评分及其原因

**并非所有看起来可评估的维度都应该被评分。** 以下维度如果被量化，要么会产生不可靠的分数，要么会直接制造 authority theater。

### "决策质量"是最危险的评分对象

**决策建议的"正确性"或"质量"绝不可由 judge 评分。** 原因有三。首先，Wataoka et al.（ICLR 2025）证明 self-preference bias 的根本机制是 **perplexity 驱动**而非自我识别——LLM 天然偏好与自身生成风格相近的文本。在 RT 的 multi-model mix generator 架构下，judge 模型将系统性偏好与自身风格接近的那一路生成器的输出。GPT-4 的 self-preference bias 高达 **0.520**，意味着它在自身输出被人类偏好时的同意率（94.5%）与不被偏好时的同意率（42.5%）之间存在巨大鸿沟。其次，CALM 发现 sentiment bias 在所有模型上 RR 均低于 **0.804**，judge 会系统性偏好情绪正面的表述——而高质量的风险披露恰恰需要负面情绪的诚实表达。第三，如果 judge 为"决策质量"打分，用户将不可避免地把这个分数理解为"AI 认为这个决策是好的"，**这正是 authority theater 的典型形态**。

### "平衡性"和"公正性"同样不可量化

对决策摘要中不同立场是否得到公平呈现的评判，深度依赖价值观框架。CALM 论文中 **diversity bias**（RR 0.679–0.914）和 **bandwagon effect**（RR 0.610–0.791）的实测数据表明，LLM judge 自身在"平衡"问题上既不平衡也不稳定。Constitutional AI 论文的作者明确承认其宪法原则是"chosen in a fairly ad hoc and iterative way"，强调未来应由"a larger set of stakeholders"参与制定。在 RT 的决策场景中，试图用 LLM judge 评分"平衡性"，等于用一个带有系统偏差的裁判去判定公正——**偏差不会消除，只会被制度化。**

### "可信度"评分会创造循环论证

如果 judge 评估摘要的"可信度"或"trustworthiness"，RT 系统将陷入一个逻辑悖论：一个本身存在已知偏差的 LLM 为另一组 LLM 的输出背书可信度，而用户将 RT 的价值恰恰定位于信任。Zheng et al. 的数据显示，即使是 GPT-4 级别的 judge，其与人类的一致率也仅 **85%**——这在 15% 的不一致区间内，任何"可信度评分"都可能是误导性的。更关键的是，Constitutional AI 论文警告说"scaling supervision could also have downsides and dangers, since it means further automating (and quite possibly obscuring) decision making"。**信任不能由机器自我认证——这是 trust-first 系统的第一原则。**

---

## 四、Judge 输出格式：诊断信号而非权威裁定

Judge 的输出格式是 anti-authority-theater 设计中最关键的工程决策。综合所有文献，推荐采用**三层结构化诊断格式**。

### 第一层：Gate Signal（面向系统）

Gate signal 是纯系统内部信号，**绝不对用户暴露**。采用三值判定：`PASS`、`REWRITE`、`ESCALATE`。这直接对应 Anthropic evaluator-optimizer 模式中 evaluator 的 `PASS/NEEDS_IMPROVEMENT` 二值输出，但增加了 `ESCALATE` 值以应对 judge 自身不确定的情况——Constitutional AI 论文中 40-60% 的 probability clamping 策略启发了这一设计：**当 judge 的置信度落入灰色区间时，不应强制做出判定，而应升级到人工审核**。

关键设计原则：`REWRITE` 信号必须附带具体的诊断信息（哪个维度未通过、具体问题在哪里），而非一个总分。Anthropic cookbook 中的实现模式证实了这一点——evaluator 输出包含结构化的 feedback 字段，生成器在下一轮迭代中将此 feedback 作为上下文输入。LangChain 的实践指南更明确指出："**Binary or low-precision scoring produces more reliable results than high-precision numerical scales**"——LLM 无法稳定维持细粒度分数的一致性。

### 第二层：Diagnostic Trace（面向开发/审计）

诊断追踪记录 judge 的完整推理过程，采用 chain-of-thought 格式。每个评估维度独立记录：检查项名称、判定结果（pass/flag）、具体发现描述、置信度区间（low/medium/high 三档而非数值）。这直接借鉴了 Constitutional AI 的设计哲学——critique 步骤"may provide more transparency into the model's reasoning process"，即使 critique 本身的质量有时参差不齐。

关键约束：**diagnostic trace 仅限开发团队和审计流程访问**。Braintrust 的生产实践表明，每次判定应包含 `{key, score, comment}` 结构，其中 comment 字段的价值往往高于 score 字段。在 RT 中，这意味着 trace 的核心是诊断叙述，而非数字。

### 第三层：User-Facing Provenance（面向用户）

用户看到的不是分数，而是**摘要的来源追溯标记**。例如："本摘要基于 N 个数据源生成，覆盖了 brief 中指定的 M 个议题中的 K 个"——这些是可验证的事实陈述，而非 judge 的主观评判。如果 judge 触发了 rewrite，用户看到的是最终通过的版本，**不应被告知发生了 rewrite**（否则"经过 AI 质检"本身就成为一种 authority signal）。

这一设计与 Google Vertex AI AutoSxS 的透明度方案形成对比——AutoSxS 为每个判定附带 explanation 和 confidence score，但那是面向开发者的工具。在 trust-first 的用户界面中，**透明度应指向证据和过程，而非指向 judge 的存在本身**。

---

## 五、Calibration 数据飞轮：judge 的长期生命线

Judge gate 的三大目标中，**calibration 数据积累是唯一具有长期复利效应的**。拦截和 rewrite 解决当下问题，calibration 解决系统进化问题。

### 构建 calibration 闭环的四个关键机制

**人工抽样校准（Human Spot-Check Calibration）** 是所有文献一致推荐的基石。Google Stax 文档建议"manually rate a small sample set yourself and iterate on your autorater prompt until you agree with the scores"；LangChain 的 Align Evals 功能则将此系统化为"collect human corrections → build few-shot examples → track agreement over time"的持续流程。对 RT 而言，应按 **5-10%** 的比例对 judge 判定进行人工复审，重点关注 `REWRITE` 和 `ESCALATE` 案例。

**Cross-model 交叉评估** 是对抗 self-preference bias 的核心手段。Wataoka et al. 证明 self-preference 的根因是 perplexity 差异——模型对自身生成的文本有更低的 perplexity，因此倾向于给出更高评价。在 RT 的 multi-model mix generator 架构中，这意味着 **judge 模型必须来自不同于所有 generator 模型的模型家族**。更进一步，可以借鉴 Wataoka 提出的 perplexity-weighted ensemble 策略：当 judge 对某段文本的 perplexity 异常低时，降低该 judge 对该段文本评价的权重。

**偏差扰动测试（Perturbation Testing）** 应定期执行。CALM 框架的核心方法论——对 judge 输入施加刻意扰动（如交换答案位置、注入虚假权威引用、改变情绪色彩），然后检测判定是否翻转——可以直接移植为 RT 的 judge 健康度检查。建议每月运行一次 CALM 式扰动测试，追踪 judge 在 position bias、authority bias、sentiment bias 上的 robustness rate 趋势。

**Calibration 数据应驱动 rubric 迭代，而非模型微调。** Constitutional AI 论文展示了一个重要发现：**16 条自然语言原则的 ensemble 可以替代数万条人工偏好标签**。这对 RT 的启示是，calibration 数据的首要用途应该是优化 judge 的 evaluation rubric（即 prompt 中的评估标准描述），而非用于 fine-tuning judge 模型——后者的成本更高、风险更大（可能引入新的 Goodharting 行为）。

---

## 六、Multi-agent judge panel 作为比较方案

多 judge 面板是一个值得了解但不应作为 RT 初始方案的选项。Zheng et al. 测试的 position swapping + conservative voting 方法确实提升了一致性——GPT-4 的判定一致率从单次的 65% 提升至 swap 后的更高水平。Braintrust 将 multi-judge voting 归类为"high-stakes"场景方案。Haize Labs 在安全评估中使用 LlamaGuard + GPT-4 双 judge 架构，配合人工校验。

但 multi-agent panel 对 RT 的**成本和延迟影响显著**。Agent-as-a-Judge（Zhuge et al.）的实测数据显示，即使单个 agent judge 就需要 **118 分钟**处理一个完整评估集（对比 LLM-as-a-Judge 的 11 分钟）。在 RT 的实时决策支持场景中，这不可接受。更务实的策略是：**先部署单 judge + 偏差缓解措施的方案，在 calibration 数据积累到足够量级后，再评估是否需要引入第二 judge**。

Anthropic 的"Swiss Cheese Model"（多层评估，每层捕获不同类型的问题）提供了更适合 RT 的思路——与其使用多个 LLM judge 投票，不如使用**不同类型的评估层**：deterministic checks → single LLM judge → periodic human review。各层分别捕获不同类别的质量问题，互相补位。

---

## 七、面向实施的架构建议

将以上分析转化为 RT 的具体工程方案，推荐以下分层架构：

| 层级 | 类型 | 评估内容 | 输出 | 延迟影响 |
|------|------|----------|------|----------|
| L0 | Deterministic | Brief 格式合规、字数、必含章节 | Hard PASS/FAIL | <100ms |
| L1 | Deterministic | 证据源引用计数、风险章节存在性 | Coverage metrics | <200ms |
| L2 | LLM Judge | 证据遗漏检测、逻辑一致性、风险-证据对齐 | Diagnostic flags + PASS/REWRITE/ESCALATE | 5-15s |
| L3 | Human (async) | 抽样复审 L2 判定，calibration 标注 | Agreement labels → rubric 迭代 | Async |

**L0 和 L1 是"硬门"（hard gate）**——任何未通过的摘要直接回退到生成器，不消耗 LLM judge 资源。这对应 Anthropic prompt chaining 模式中的"programmatic checks (gate)"。

**L2 是"软门"（soft gate）**——LLM judge 输出诊断信号而非分数。Judge 的 prompt 应包含 RT 的评估宪法（constitutional principles），采用 Constitutional AI 论文验证的 ensemble 策略：**每次评估随机采样 3-5 条原则**，避免单一原则导致的过度优化。Judge 模型选择应遵循三条规则：（1）不同于任何 generator 的模型家族；（2）选择 CALM 测试中 robustness 最高的模型（当前实证指向 **Claude 系列**在 7/12 偏差维度上表现最优）；（3）设定最大 rewrite 迭代次数（建议 **2 次**），避免无限循环。

**L3 是 calibration 引擎**——不在实时路径上，但驱动整个 judge 系统的持续进化。

### Judge prompt 的核心设计原则

借鉴 Constitutional AI 的"宪法"模式，RT 的 judge prompt 应遵循以下结构：

- **不要求 judge 给出总体质量分数**——只要求逐项诊断
- **每条诊断原则独立、具体、可操作**——例如"检查摘要是否提及了输入材料中与主要结论矛盾的证据"而非"评估证据覆盖质量"
- **要求 judge 先独立分析再做判定**——Zheng et al. 证实 chain-of-thought 可将推理类任务的评判失败率降低一半
- **明确禁止 judge 评价"决策是否正确"**——在 prompt 中写入显式约束："你的任务是检查结构和过程，而非判断决策内容的优劣"

---

## 结论：信任不能被评分，只能被赚取

RT 的 judge gate 设计的最深层挑战不是技术性的。LLM-as-a-Judge 的偏差可以通过 cross-model evaluation 缓解，Goodharting 可以通过 rubric ensemble 对抗，calibration 可以通过人工抽样校准持续改进。真正的挑战是**认知设计**：如何确保 judge 的存在增强了系统的可问责性，而不是增加了一层新的不透明。

三个关键的 novel insight：**第一**，judge 的最大价值不在于它当下拦截了多少坏摘要，而在于它积累的 calibration 数据能否驱动 rubric 和 generator 的协同进化——这是一个数据飞轮，而非质量关卡。**第二**，在 multi-model mix generator 架构下，self-preference bias 通过 perplexity 机制变得更加隐蔽——judge 不需要"认出"自己的文本就会偏好风格相近的输出，因此 cross-model family 隔离不是可选项，而是必要条件。**第三**，对用户而言，一个没有分数的 judge 比有分数的 judge 更诚实——因为分数暗示精确性，而 LLM 评估的 15% 人类不一致率意味着这种精确性是幻觉。在 trust-first 系统中，**承认不确定性本身就是建立信任的最有效方式**。