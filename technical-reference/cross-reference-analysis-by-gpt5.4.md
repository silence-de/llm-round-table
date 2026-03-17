# Deep Research Reports × Round Table Final Review by GPT-5.4

> 目标：只保留对 Round Table 当前产品边界有直接价值的架构结论。
> 立场：Round Table 是 trust-first 的决策工作流，不是通用 agent framework，也不是开放世界 autonomous system。

---

## 结论摘要

四份 deep research report 的共同指向是正确的：对 Round Table 来说，最重要的不是增加 agent 数量，而是继续强化受约束的编排、结构化中间产物、工具边界、执行式评测与信任表述。

Round Table 当前最值得坚持的方向是：

1. 保持 moderator-mediated 的中心化协调
2. 保持 brief-first、claim-first、evidence-linked 的产品骨架
3. 把“trust”落实为 typed state、artifact contracts、validator 和 UI honesty，而不是更多 autonomy

从系统设计角度看，Round Table 已经做对了核心方向，但还没有把这些方向推进到“可验证的工程约束”层面。

---

## RT 已经做对的

### 1. 中心化 moderator 架构是对的

Round Table 当前不是去中心化 swarm，而是 moderator 收敛、agent 受控发言。这与多份报告对“自由多 agent 对话容易放大错误和 chatter”的结论一致。对决策场景来说，这比开放式 handoff 或 agent 自由互聊更合适。

这不是保守，而是产品目标使然：决策产品需要收敛、问责、可回顾，而不是探索式自治。

### 2. 结构化 Analysis 已经证明你们理解了正确的问题

你们已经要求 Analysis 阶段输出结构化 JSON，而不是只保留自然语言讨论文本。这说明系统已经在向“artifact-driven orchestration”靠拢。

这比很多多 agent 系统强，因为它把 moderator 从“聊天参与者”部分升级成了“聚合器和裁判”。

### 3. Evidence-Citation 链路是系统差异化核心

四份报告里，真正能与 Round Table 产品差异化形成强耦合的，不是拓扑论文，而是“证据锚定”和“评测诚实性”。

Round Table 的 citation labels、gapReason、source quality posture，本质上已经是 trust architecture 的一部分，而不是 UI 附件。

### 4. User Interjection 和 degrade 机制是很好的生产化信号

允许用户在阶段中注入约束，以及对超时 agent 做降级，而不是硬等全部成功，这说明系统已经接受“真实运行时不完美”这一前提。

这比追求理想化全成功流程更接近可运营系统。

---

## 最高价值的改进方向

### P0-1. Agent 输出结构化，而不是只让 moderator 结构化

当前最值得优先做的改进，是把 agent reply 从自由文本升级为“显示层 + 逻辑层”双轨输出。

建议 agent 输出统一 schema：

```json
{
  "stance": "support | oppose | mixed | unsure",
  "keyPoints": [
    {
      "claim": "string",
      "reasoning": "string",
      "evidenceCited": ["R1", "R2"],
      "confidenceBand": "high | medium | low"
    }
  ],
  "caveats": ["string"],
  "questionsForOthers": ["string"],
  "narrative": "给 UI 展示的自然语言版本"
}
```

原因不是“结构化看起来更高级”，而是：

- moderator 不必反复解析自由文本
- downstream aggregation 更稳定
- disagreement extraction 更可测试
- resume/replay 更容易
- 可直接做字段级 validator

这件事的收益会明显高于新增 agent 或改拓扑。

### P0-2. 把当前历史消息流升级为 Task Ledger

当前系统已经有 phases，但状态载体仍偏消息驱动。下一步不一定要上完整 DAG runtime，但至少应该引入一个显式 `TaskLedger`。

建议 `TaskLedger` 至少包含：

- decision brief normalized summary
- non-negotiables
- accepted claims
- rejected claims
- unresolved disagreements
- evidence gaps
- next questions for current round
- stop conditions / convergence conditions

然后让每一轮 prompt 主要消费：

1. `TaskLedger`
2. 当轮 agent structured replies
3. 必要的引用 evidence snippets

而不是反复吞整段历史。

这件事的核心收益是：

- 降 token
- 降 lost-in-the-middle 风险
- 降 prompt 漂移
- 强化 follow-up / resume 的一致性

### P0-3. 给决策摘要增加独立 evaluator，但先用于验收，不要先用于对用户说教

Evaluator-Optimizer 很适合 Round Table，但落点应当谨慎。

我建议第一阶段不要把 judge 直接变成“多一个会说话的 agent”，而是把它做成 summary QA gate：

- 是否覆盖 brief 的关键约束
- 是否覆盖主要分歧
- 是否存在 recommendation 与 evidence mismatch
- 是否把 gap 当成了结论
- 是否遗漏 red lines / revisit triggers

judge 输出应该先服务于：

- 自动重试
- 内部评分
- ops 可观测性
- calibration 辅助信号

而不是直接把一个“judge 分”展示成新的权威数字。

---

## 中期值得做，但不要抢在前面

### P1-1. 单轮 Reflection 可以做，但要限制为“纠错回合”

Reflexion 有价值，但在 Round Table 里不应演化成多轮自我讨论。

更合适的形式是：

- Analysis 后
- 只允许一轮
- 只回答“是否修正/补充/撤回先前观点”
- 必须基于结构化 disagreement 或新证据

这会更像“纠错回合”，而不是再开一场 debate。

### P1-2. 基于 decisionType 的 agent 子集选择值得做

这不是 GNN routing，而是更朴素也更适合你们的 runtime policy。

例如：

- 投资/职业/搬迁：风险与约束导向 agent 必选
- 创意/命名/方案探索：发散型 agent 权重更高
- 明确比较型问题：两两对比优于全员自由发言

这比“所有 agent 全上”更符合成本和信任目标。

### P1-3. Follow-up 应继承 ledger 摘要，而不是只继承 action items

当前 follow-up 已经是一等能力，但继承粒度还不够。

真正应该跨 session 延续的是：

- 上次结论
- 当时的关键假设
- 触发 revisit 的条件
- 未解决的证据空白
- 后来被现实证伪/证实的点

这比引入重型长期记忆系统更符合产品价值。

---

## 不建议现在做的事

### 1. 不建议上 MCTS / LATS

决策任务不是可低成本回滚环境，树搜索的试探式扩展在这里成本太高，也很难定义可靠 value function。

### 2. 不建议为了“先进”迁移到复杂图编排框架

Round Table 现在的瓶颈不是缺少图框架，而是：

- typed artifact 不够深入
- validation 不够系统
- UI / persistence / recovery 边界还不够稳

在这些问题解决前，迁移到重型 graph runtime 很可能只是把复杂度前置。

### 3. 不建议上重型长期记忆

MemGPT / Generative Agents 对开放世界持续自治很有启发，但不适合优先套到 Round Table。

你们更需要的是：

- follow-up continuity
- lessons learned
- calibration traceability

而不是让 agent 自主维护庞大记忆层。

### 4. 不建议把“安全审计”抽象得过大

Round Table 的安全重点首先不是代码执行沙箱，而是：

- 外部 research 内容不可信
- browser extraction 不等于 verification
- 高风险建议必须显式暴露不确定性

先把这几个 trust boundary 做扎实，比引入通用 safety framework 更有价值。

---

## 对系统设计最关键的判断

### 1. Round Table 的核心不是“多 agent”

Round Table 的核心其实是：

- structured brief
- moderated synthesis
- evidence-backed claims
- follow-up and retrospective
- calibration over time

多 agent 只是其中的实现手段之一，不应该反过来主导产品和架构。

### 2. 下一阶段最重要的是把“信任模型”变成“工程约束”

Round Table 现在最大的问题不是方向错，而是“信任”还没有完全落到硬约束：

- 哪些字段必须有 evidence
- 哪些结论只能以 gap 呈现
- 何时必须降级表述
- 何时 summary 需要被 judge 打回
- 何时 UI 必须提示“仅模型推理，无研究支持”

只要这些没有被 validator、typed schema、policy gates 固化，trust 仍然主要依赖 prompt discipline。

### 3. 你们应继续坚持“受约束的 decision workflow”，不要转向通用 agent platform

这是我看完所有报告后最明确的判断。

对 Round Table 最危险的误区，不是“做得不够 multi-agent”，而是被 MAS 论文牵着走，去做不符合产品目标的自治、拓扑、长期记忆和探索式规划。

真正的演进方向应该是：

从可运行的多 agent 讨论器
走向
可验证、可恢复、可校准、可审计的决策系统。

---

## 建议的实际优先级

### 立即做

1. agent structured reply schema
2. task ledger state object
3. summary evaluator gate
4. trust-focused validators and event metrics

### 接着做

1. single reflection round
2. decisionType-based agent subset routing
3. follow-up ledger inheritance

### 暂不做

1. graph runtime migration
2. MCTS / tree search
3. GNN topology
4. heavy autonomous memory

---

## 最后的判断

如果只用一句话总结：

> 对 Round Table 最有价值的研究借鉴，不是“让 agent 更聪明”，而是“让系统更收敛、更有边界、更能证明自己没有胡说”。

这也是我认为下一版架构应该坚持的方向。
