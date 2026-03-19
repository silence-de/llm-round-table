# Topic3 Cross Reference Analysis (Judge Gate)

## 1) Scope
本文件用于把 topic3 的四份研究报告压缩成可执行的 RT 架构判断。目标不是复述论文，而是回答：哪些 Judge Gate 结论足够稳，可以作为下一阶段开发依据；哪些只是可选工程策略；哪些暂不该采纳。

输入材料：
- Claude: `Round Table 评估门设计：信任优先系统中的 Judge Gate 架构 by claude.md`
- GPT: `Trust-first 决策系统中 Summary 之后的 Evaluator:Judge Gate 设计研究 by gpt5.4.md`
- Gemini: `决策摘要评估与重写设计 by gemini.md`
- Minimax: `Trust-First 决策系统中 Judge Gate 的设计原则与反伪权威机制 by minimax2.5.md`

## 2) Source Weighting
- 高权重：Claude / GPT
  - 原因：topic 对齐度最高，讨论的是 Judge Gate 本体，不是外围 schema；来源以 Anthropic、MT-Bench、CALM、Constitutional AI 等一手研究为主。
- 中权重：Gemini
  - 原因：主题对齐，结论总体一致，但论证密度和边界约束不如 Claude/GPT。
- 低权重：Minimax
  - 原因：文档主体实际偏向 agent reply schema 与结构化回复，不是 Judge Gate 本体；可借用部分 schema/validation 思路，但不应主导架构决策。

## 3) Consensus / Disagreement Matrix

### 共识
- Judge 应是内部 QA gate，不应成为用户侧权威评分器。
- 适合 Judge 的维度应是“有外部锚点可校验”的维度。
- Rewrite 应有固定上限，通常最多 2 次。
- Judge 输出应以结构化诊断为主，不应向用户暴露精确质量分。
- Judge 结果应进入 calibration / ops 闭环。

### 分歧
- 是否保留数值分数：
  - Claude/GPT 倾向弱化甚至隐藏分数。
  - Minimax 倾向保留 `confidence` 作为算法输入。
- 是否需要多 judge panel：
  - 各报告承认有助于降偏差。
  - 但实时成本与时延代价都高。
- Judge 与 deterministic checks 的边界：
  - Claude 更强调分层 gate。
  - 其他报告也支持，但实现细节不如 Claude 完整。

## 4) Adoption Decisions

### 采纳
- Judge 定位为内部质量门，不对用户暴露“质量认证”。
- Rubric 限定为：
  - brief constraints
  - evidence coverage
  - risk disclosure
  - internal consistency
- Rewrite 上限 2 次。
- Judge 结果进入 calibration / ops，而不是用户信任 UI。

### 部分采纳
- 数值分数：
  - 仅保留为内部诊断字段，不做用户表达，也不做“决策正确性” proxy。
- 多 judge panel：
  - 只作为离线评测或高风险场景备选，不进入默认实时路径。

### 不采纳
- 把 Judge 输出包装成 “AI 认证通过 / 可信度 8.7/10 / Quality A”。
- 让 Judge 直接评价“这个决策是不是正确”。

## 5) RT-Specific Constraints
- RT 是 trust-first 决策支持系统，不是开放聊天产品；任何“看起来客观”的分数都极易变成 authority theater。
- RT 当前已有 judge/rewrite 的代码雏形，因此下一阶段重点不是“要不要 judge”，而是“如何把已有 judge 从分数化、弱边界状态，改成分层 QA gate”。
- RT 当前摘要与 ledger 已有 evidence / risk 基础字段，这使 topic3 可以直接和 topic2、topic4 联动，而不是停留在理论层。

## 6) Current Code Review
- 已具备：
  - 四维 judge：[`judge.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/decision/judge.ts)
  - 最多两轮 rewrite：[`rewrite-loop.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/decision/rewrite-loop.ts)
  - judge evaluation 持久化表：[`schema.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/db/schema.ts)
- 核心缺口：
  - `JudgeDimension` 仍以 `score` 为一等字段，缺少 `ESCALATE` 状态。
  - 当前规则偏字符串匹配，尚不足以支持复杂证据对齐与逻辑一致性检查。
  - 缺少偏差监测与人工抽样校准协议。

## 7) Development Guidance

### P0
- 将 gate 结果升级为三态：
  - `PASS`
  - `REWRITE`
  - `ESCALATE`
- 重构 judge 输出结构：
  - 保留维度级别结果
  - 增加 `actionableFixes[]`
  - `score` 降级为内部可选字段
- UI/PDF 中移除任何会被解读为“权威认证”的 judge 表达。

### P1
- 加入 deterministic pre-check 层：
  - evidence refs 是否存在
  - risk section 是否存在
  - required fields 是否完整
- 建立人工抽样闭环：
  - 优先复核 `REWRITE` 与 `ESCALATE`
  - 记录 judge-human agreement

### P2
- 构建偏差扰动测试集：
  - 位置交换
  - 冗长度扰动
  - 虚假权威词注入
- 在供应链允许时引入跨模型族 judge。

## 8) Validation Plan
- 代码测试：
  - judge 三态输出测试
  - rewrite 最大轮次测试
  - deterministic hard gate 测试
- 产品验收：
  - 用户界面不出现 judge 权威标签
  - judge 失败能给出维度级修复建议
- 运营指标：
  - rewrite trigger rate
  - escalate rate
  - judge-human agreement

## 9) Bottom Line
topic3 最稳的结论不是“Judge 能提高多少准确率”，而是：Judge 在 RT 中只能作为内部 QA 与 rewrite 驱动器存在，绝不能作为用户信任锚。这个结论证据充分、与当前代码兼容、且对下一阶段开发直接可操作。
