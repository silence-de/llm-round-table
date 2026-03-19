# Topic 3 Cross-Reference Analysis: Judge Gate 设计
> 分析者：Claude Sonnet 4.6 | 日期：2026-03-19

## 1. 各报告核心主张摘要

**Claude（Round Table 评估门设计）**
Judge gate 的核心矛盾是"评分本身是否会成为新的伪权威"。推荐分层诊断架构：L0/L1 deterministic checks → L2 LLM judge（输出结构化诊断信号而非分数）→ L3 人工抽样校准。Judge 输出三层格式：Gate Signal（PASS/REWRITE/ESCALATE）、Diagnostic Trace（面向开发）、User-facing Provenance（面向用户，只展示来源追溯，不展示分数）。Calibration 数据飞轮是唯一具有长期复利效应的机制。

**GPT-5.4（Trust-first 决策系统中 Summary 之后的 Evaluator/Judge Gate 设计研究）**
Judge 不应被设计成"给 summary 精确分数"，而应是"契约式验收 + 风险控制式升级 + 可审计缺陷清单"。最稳妥输出形态：强制门禁的布尔/三态结论（PASS/REWRITE/ESCALATE）+ 多维 issue flags + 可追溯证据指针 + rewrite 指令。Rewrite 循环最多 1-2 轮，超出应升级。同源偏差需通过模型去同源、机制去同源、证据去同源三条路径降风险。

**MiniMax 2.5（Trust-First 决策系统中 Judge Gate 的设计原则与反伪权威机制）**
必须从 LLM-as-a-Judge 转向工具增强的 Agent-as-a-Judge，Judge 不能依赖参数化语感打分，必须通过检索与文本比对进行细粒度证据溯源验证。Judge 输出应是"布尔值（叶节点）+ 多维离散信号（中间节点）+ 机器状态码（根节点）"的树状层级组合。Rewrite 上限 2-3 轮，超出触发熔断。引入 AutoCal-R（均值保留保序回归）将 Judge 信号校准为统计学无偏指标。

**Gemini（决策摘要评估与重写设计���**
Judge 最适合评估的维度：Brief 约束符合度、证据覆盖完整性、风险披露存在性、逻辑一致性。不适合量化的维度：决策质量/正确性、平衡性/公正性、可信度总分。推荐三层输出格式：Gate Signal、Diagnostic Trace、User-facing Provenance。Multi-agent judge panel 成本过高，推荐"Swiss Cheese Model"（不同类型评估层互补）。

---

## 2. 共识点

**共识 1：Judge 绝不能输出单一标量分数**（四份报告一致）
所有报告均明确反对将 Judge 结果包装为精确数字分数（如 92/100）。核心原因：LLM judge 存在系统性偏差（authority bias、verbosity bias、self-preference），分数会被表面特征驱动，对用户形成伪权威。

**共识 2：Judge 输出应为三态门禁 + 多维诊断信号**（四份报告一致）
PASS / REWRITE / ESCALATE 三态结构被所有报告采纳。ESCALATE 对应 judge 不确信或高风险失败时的升级路径。多维 issue flags/codes 附带证据指针是标准配置。

**共识 3：Rewrite 循环上限为 2-3 轮**（四份报告一致）
超过此限度会出现边际收益递减、上下文爆炸、问题漂移（为过 gate 而写）。Anthropic 的停止条件原则和 RIPD（Rubric-Induced Preference Drift）研究均支持此上限。

**共识 4：Judge 适合评估的三个核心维度**（四份报告一致）
Brief 约束符合度、证据覆盖/溯源性、风险披露完整性。这三个维度有可验证的参照物，适合自动化评估。

**共识 5：同源偏差必须通过跨模型家族隔离解决**（四份报告一致）
Judge 模型必须来自不同于 Generator 的模型家族。Self-preference bias 的根因是 perplexity 驱动，不是自我识别，因此跨家族隔离是必要条件而非可选项。

**共识 6：Judge 信号必须在 internal QA 与 user-facing 之间严格隔离**（四份报告一致）
用户侧只展示证据来源追溯、不���定性披露、风险警告，不展示任何 judge 分数或通过率。

---

## 3. 分歧点

**分歧 1：是否需要 Agent-as-a-Judge（工具增强）**
- MiniMax 2.5 强烈主张必须从 LLM-as-a-Judge 升级到 Agent-as-a-Judge，Judge 必须通过检索工具进行硬性证据验证，不能依赖参数化语感。引用 DevAI 基准数据：AaaJ 与人类专家对齐率 90% vs 传统 LLM-as-a-Judge 的 70%。
- Claude 和 GPT-5.4 将工具增强作为 L2 judge 的增强选项，但未将其作为强制前提，认为 deterministic checks（L0/L1）已能覆盖大部分可验证项。
- Gemini 未明确讨论 Agent-as-a-Judge，更侧重 rubric 设计和 calibration 机制。

**分歧 2：Calibration 机制的具体方案**
- MiniMax 2.5 明确引入 AutoCal-R（均值保留保序回归）将 Judge 离散判定映射为统计学无偏预期质量，并维持 5% Oracle 数据集。
- Claude 推荐人工抽样校准（5-10% 比例）+ 偏差扰动测试（每月 CALM 式测试）+ rubric 迭代，不涉及统计学校准函数。
- GPT-5.4 采用 Trust or Escalate 框架，用校准集选择阈值控制风险，强调弃权机制。
- Gemini 推荐 cross-model 交叉评估 + perplexity-weighted ensemble，侧重偏差缓解而非统计校准。

**分歧 3：Rewrite 指令的约束范围**
- GPT-5.4 明确规定 rewrite 只能"补齐遗漏证据点、修正引用映射、删除无证断言、补充风险披露"，禁止"为了提高观感而扩写"或"为了迎合 rubric 而改变结论立场"。
- MiniMax 2.5 允许在 rewrite 中保留无法完全证实的推论，以警告标记形式呈现，不强制删除。
- Claude 和 Gemini 对 rewrite 内容约束的描述相对宽泛。

**分歧 4：Multi-judge panel 的可行性**
- Gemini 明确评估了 multi-agent judge panel，认为成本和延迟影响显著（Agent-as-a-Judge 需 118 分钟 vs LLM-as-a-Judge 的 11 分钟），推荐"Swiss Cheese Model"替代。
- 其他三份报告未对 multi-judge panel 做系统性评估，GPT-5.4 提到 multi-judge ensemble 作为同源偏差缓解手段之一。

---

## 4. 互补点

**互补 1：AutoCal-R 统计校准框架（MiniMax 2.5 独有）**
引入因果裁判评估（CJE）和 AutoCal-R 算法，将 Judge 原始离散判定通过保序回归映射为统计学无偏的预期质量分布。这是其他三份报告未覆盖的统计学严谨性路径，对需要 ops 层面量化监控的场景有独特价值。

**互补 2：Rubric-Induced Preference Drift 风险（GPT-5.4 独有深度）**
GPT-5.4 详细分析了 RIPD（Rubric-Induced Preference Drift）：自然语言 rubric 的改写可在 benchmark 合规的外衣下诱导目标域偏好漂移，且可跨模型迁移。这意味着"换 judge"也未必能消除由 rubric 结构引��的偏置，是其他报告未充分警示的风险。

**互补 3：用户侧"接缝"暴露的 UX 设计（MiniMax 2.5 独有）**
提出具体的 UI 设计方案：溯源气泡（Attribution Seams）、风险雷达与认知边界警告、未解冲突透明化（红色虚线下划线 + 旁注声明）。将 Judge 从"打分裁判"转化为"透明审查助手"的具体交互设计，其他报告未涉及。

**互补 4：Swiss Cheese Model 分层评估架构（Gemini 独有）**
明确提出 L0（deterministic，<100ms）→ L1（deterministic，<200ms）→ L2（LLM judge，5-15s）→ L3（human async）的四层架构，并给出每层的延迟预算和评估内容边界。这是最具工程落地细节的分层方案。

---

## 5. 对 Round Table 实现的综合建议

**建议 1（最高优先级）：实施四层评估架构，严格分离 deterministic 与 LLM 评估**
按 Gemini 的 Swiss Cheese Model 落地：L0 结构/格式检查（代码，<100ms）→ L1 引用格式与证据 ID 可解析性（代码，<200ms）→ L2 LLM judge（语义，5-15s）→ L3 人工抽样（异步）。L0/L1 失败直接回退 generator，不消耗 LLM 资源。

**建议 2（最高优先级）：Judge 输出固定为三态门禁 + issue codes + evidence pointers**
根节点：PASS / REWRITE / ESCALATE。中间节点：每个维度输出 PASS/WARN/FAIL/ABSTAIN + issue code（如 `missing_risk_disclosure`、`unsupported_claim`）。底层：rewrite 指令仅限"补证据、补披露、修正引用映射、删无证断言"，禁止整体润色。

**建议 3（高优先级）：Judge 模型强制跨家族隔离**
若 Generator 使用 Claude，Judge 必须路由至 Gemini 或 GPT 家族。这是消除 self-preference bias 的必要条件，不可妥协。

**建议 4（高优先级）：Rewrite 循环硬上限 2 轮，超出触发 ESCALATE**
编排层用非 LLM 状态机控制循环计数器。第 2 轮结束后仍有 FAIL，将当前最佳版本 + 未解缺陷列表打包，转人工审核队列，不再触发 LLM rewrite。

**建议 5（中优先级）：建立 Calibration 数据飞轮**
维持 5-10% 人工抽样复审（重点关注 REWRITE 和 ESCALATE 案例）。每月运行偏差扰动测试（position bias、authority bias、verbosity bias）。Calibration 数据用于优化 rubric prompt，而非 fine-tune judge 模型。中期可引入 AutoCal-R 将 Judge 信号映射为统计学无偏指标。

**建议 6（中优先级）：用户侧只暴露"接缝"，不暴露分数**
为每条核心断言挂载交互式引用标记（悬停展示原始证据切片）。对推断性结论注入不确定性声明。对 rewrite 后仍未解决的缺陷，用特殊 UI 样式（警告底纹 + 旁注）标记，不删除，让用户自行判断。

---

## 5b. GPT 分析补充：代码现状与开发指引

> 来源：`cross-reference-analysis-by-gpt5.4.md`，提取其中对 RT 当前实现最有价值的工程判断。

**当前代码缺口（GPT 视角）**
- `JudgeDimension` 仍以 `score` 为一等字段，缺少 `ESCALATE` 状态——当前 judge 是"分数化、弱边界"状态，需升级为分层 QA gate。
- 当前规则偏字符串匹配，尚不足以支持复杂证据对齐与逻辑一致性检查。
- 缺少偏差监测与人工抽样校准协议。

**P0 开发优先级（GPT 视角）**
- 将 gate 结果升级为三态：`PASS` / `REWRITE` / `ESCALATE`。
- 重构 judge 输出结构：保留维度级别结果，增加 `actionableFixes[]`，`score` 降级为内部可选字段。
- UI/PDF 中移除任何会被解读为"权威认证"的 judge 表达。

**P1 开发优先级（GPT 视角）**
- 加入 deterministic pre-check 层：evidence refs 是否存在、risk section 是否存在、required fields 是否完整。
- 建立人工抽样闭环：优先复核 `REWRITE` 与 `ESCALATE`，记录 judge-human agreement。

**P2 开发优先级（GPT 视���）**
- 构建偏差扰动测试集（位置交换、冗长度扰动、虚假权威词注入）。
- 在供应链允许时引入跨模型族 judge。

**验收指标（GPT 视角）**
- 代码测试：judge 三态输出、rewrite 最大轮次、deterministic hard gate。
- 产品验收：用户界面不出现 judge 权威标签，judge 失败能给出维度级修复建议。
- 运营指标：`rewrite_trigger_rate`、`escalate_rate`、`judge_human_agreement`。

---

## 6. 遗留问题

**问题 1：关键证据清单（golden checklist）的构建与维护机制**
四份报告均提到 evidence coverage 需要对照"关键证据清单"逐项验证，但均未解决该清单的来源工程：是由人工维护、由系统从 evidence set 自动抽取、还是混合？当 evidence set 本身存在冲突或质量参差时，如何防止 judge 退化为"看起来权威"的启发式评估？

**问题 2：Rubric 的 shelf life 与分布漂移管理**
随着 Generator 模型迭代和写作风格变化，Judge 的偏差结构也会变化。RIPD 研究表明 rubric 本身可成为漂移入口，且漂移可跨模型迁移。如何在不引入新偏置的前提下持续更新 rubric，以及如何检测 rubric 老化，目前没有成熟方案。

**问题 3：Pointwise 门禁中 selective evaluation 的形式化保证**
GPT-5.4 引用的 Trust or Escalate 框架主要在 pairwise 偏好框架下定义风险控制与覆盖保证。RT 需要将同样的风险控制思想迁移到"多维门禁 + 证据核验"的 pointwise 组合信号上，目前缺乏对应的校准协议和形式化保证。
