# Deep Research Reports × Round Table 交叉分析（修订版）

> 四份报告（Claude / ChatGPT-5.4 / MiniMax2.5 / Gemini）的共识发现与 Round Table 当前架构的对照分析。
> 本版采纳 GPT-5.4 Final Review 的产品判断框架：**RT 是 trust-first 的决策工作流，不是通用 agent framework**。
> 仅保留对本系统有实际借鉴意义的条目，按可落地优先级排列。

---

## 核心定位判断

> 对 Round Table 最有价值的研究借鉴，不是"让 agent 更聪明"，而是"让系统更收敛、更有边界、更能证明自己没有胡说"。

Round Table 的核心是：

- structured brief
- moderated synthesis
- evidence-backed claims
- follow-up and retrospective
- calibration over time

多 agent 只是其中的实现手段之一，不应该反过来主导产品和架构。

---

## 一、四份报告的核心共识

| 共识 | 来源 |
|------|------|
| **架构比模型选择更重要**——拓扑（集中/去中心）比换模型对结果的影响大 | Claude(DeepMind)、ChatGPT、Gemini |
| **非结构化自由对话放大错误 17.2×**，结构化中间产物是唯一出路 | Claude(DeepMind)、ChatGPT(MetaGPT)、Gemini(ChatDev) |
| **agent 数量收益在 ≤4 时饱和**；45% 规则：单 agent 准确率 >45% 时多 agent 通常退化 | Claude(DeepMind) |
| **Reflection 在 2-3 轮后边际递减**，必须硬性限制迭代次数 | Claude、ChatGPT、Gemini(Reflexion) |
| **确定性骨架 + agent 智能注入点** 是生产级唯一可行模式 | Claude(Anthropic)、Gemini(LangGraph) |
| **五大反模式**达成高度一致：Coordinator Overload / Agent Chatter / Tool Hallucination / Context Dumping / Premature Multi-Agent | 全部四份 |

---

## 二、Round Table 已做对的

| 模式 | RT 实现 | 为什么对 |
|------|---------|----------|
| **Moderator-Mediated（集中协调）** | agents 不直接对话，全部经 moderator 中转 | 决策需要收敛、问责、可回顾，不是探索式自治。中心化将错误放大控制在 4.4× |
| **结构化 Analysis 输出** | Analysis 阶段要求 JSON（agreements/disagreements/shouldConverge） | 把 moderator 从"聊天参与者"升级为"聚合器和裁判" |
| **Evidence-Citation 链路** | 决策摘要要求 sourceIds 或 gapReason | 是 trust architecture 的一部分，不是 UI 附件。这是系统差异化核心 |
| **Convergence Detection** | `shouldConverge` 由 moderator 输出控制辩论终止 | 避免无限 agent chatter |
| **Agent 降级机制** | 连续超时后自动排除 degraded agents | 接受"真实运行时不完美"，比追求全成功更接近可运营系统 |
| **User Interjection** | 用户可在任意阶段注入约束 | human-in-the-loop 作为一等架构元素 |

这些方向是对的，但还没有推进到"可验证的工程约束"层面。

---

## 三、改进方向（按优先级排列）

### 立即做

**1. Agent 输出结构化——显示层 + 逻辑层双轨**

- **现状**：agent 回复是自由文本 `content: string`，moderator 用 LLM 去解析。
- **研究共识**：MetaGPT、ChatDev 均证明自由文本是 79% 多 agent 失败的根因。
- **建议 schema**：
  ```json
  {
    "stance": "support | oppose | mixed | unsure",
    "keyPoints": [
      { "claim": "string", "reasoning": "string", "evidenceCited": ["R1"], "confidenceBand": "high | medium | low" }
    ],
    "caveats": ["string"],
    "questionsForOthers": ["string"],
    "narrative": "给 UI 展示的自然语言版本"
  }
  ```
- **收益不是"结构化看起来更高级"，而是**：moderator 不必反复解析自由文本、downstream aggregation 更稳定、disagreement extraction 可测试、resume/replay 更容易、可做字段级 validator。
- **这件事的收益会明显高于新增 agent 或改拓扑。**

**2. Task Ledger 状态对象**

- **现状**：`allMessages[]` + `agentResponses Map` 是扁平历史，moderator 每轮重新"阅读"全部历史。
- **建议 `TaskLedger` 至少包含**：
  - decision brief normalized summary
  - non-negotiables
  - accepted claims / rejected claims
  - unresolved disagreements
  - evidence gaps
  - next questions for current round
  - stop conditions / convergence conditions
- **每轮 prompt 主要消费**：`TaskLedger` + 当轮 agent structured replies + 必要的引用 evidence snippets。**不再反复吞整段历史。**
- **核心收益**：降 token、降 lost-in-the-middle 风险、降 prompt 漂移、强化 follow-up/resume 一致性。

**3. Summary Evaluator Gate（验收型，非说教型）**

- **现状**：决策摘要由 moderator 一次生成，无独立评估。
- **关键判断（来自 GPT Final Review）**：第一阶段 evaluator 不应做成"多一个会说话的 agent"，也不应把 judge 分变成新的权威数字展示给用户。
- **应做成 summary QA gate，检查**：
  - 是否覆盖 brief 的关键约束
  - 是否覆盖主要分歧
  - 是否存在 recommendation 与 evidence mismatch
  - 是否把 gap 当成了结论
  - 是否遗漏 red lines / revisit triggers
- **judge 输出先服务于**：自动重试、内部评分、ops 可观测性、calibration 辅助信号。**不要直接展示成新的权威数字。**

**4. Trust-focused Validators 和 Event Metrics**

- **现状**："信任"还没有完全落到硬约束。
- **需要固化的规则**：
  - 哪些字段必须有 evidence
  - 哪些结论只能以 gap 呈现
  - 何时必须降级表述
  - 何时 summary 需要被 judge 打回
  - 何时 UI 必须提示"仅模型推理，无研究支持"
- **只要这些没有被 validator、typed schema、policy gates 固化，trust 仍然主要依赖 prompt discipline。**

---

### 接着做

**5. 单轮 Reflection（纠错回合，不是再开一场 debate）**

- Analysis 后，只允许一轮，只回答"是否修正/补充/撤回先前观点"
- 必须基于结构化 disagreement 或新证据
- 硬性限制 1 轮，避免 chatter

**6. 基于 decisionType 的 Agent 子集选择**

- 不是 GNN routing，而是朴素的 runtime policy
- 投资/职业/搬迁：风险与约束导向 agent 必选
- 创意/方案探索：发散型 agent 权重更高
- 明确比较型问题：两两对比优于全员自由发言
- 比"所有 agent 全上"更符合成本和信任目标

**7. Follow-up 继承 Ledger 摘要，而不是只继承 Action Items**

- 真正应该跨 session 延续的是：上次结论、当时的关键假设、触发 revisit 的条件、未解决的证据空白、后来被现实证伪/证实的点
- 这比引入重型长期记忆系统更符合产品价值

---

### 暂不做

| 模式 | 原因 |
|------|------|
| **MCTS/LATS 树搜索** | 决策不可低成本回滚，树搜索试探式扩展成本太高 |
| **图编排框架迁移** | RT 瓶颈不是缺少图框架，而是 typed artifact 不够深入、validation 不够系统。在这些解决前，重型 graph runtime 只是把复杂度前置 |
| **GNN 自动拓扑** | ≤7 agents 规模不值得。手动规则足够 |
| **MemGPT / 遗忘曲线 / 重型长期记忆** | RT 需要的是 follow-up continuity + lessons learned + calibration traceability，不是让 agent 自主维护庞大记忆层 |
| **通用安全审计框架** | RT 安全重点是：外部 research 内容不可信、browser extraction ≠ verification、高风险建议必须暴露不确定性。先把这几个 trust boundary 做扎实比引入通用 safety framework 更有价值 |
| **完全去中心化（Swarm 模式）** | 决策场景需要收敛和问责，不需要探索式自治 |

---

## 四、优先行动路线图

```
Phase 1（1-2 周）— 结构化基础
├── Agent reply structured schema
├── Trust validators（evidence 必填规则、gap 表述降级）
└── 设计 TaskLedger 数据结构

Phase 2（3-4 周）— 状态管理 + 评估
├── 实现 TaskLedger，moderator prompt 只接收 ledger + 当轮响应
├── Summary evaluator gate（内部 QA，不对用户展示分数）
└── Event metrics：per-phase 成功/降级/失败追踪

Phase 3（5-8 周）— 精细化
├── 单轮 reflection（纠错回合）
├── decisionType → agent 子集路由
└── Follow-up ledger inheritance

长期
├── 跨决策 lessons learned 检索
├── 基于 calibration 数据的 agent 动态加权
└── 评估 SSE → 更结构化运行时的必要性（仅当上述改进到位后）
```

---

## 五、最值得精读的论文/框架（按对 RT 的直接价值排序）

1. **Anthropic "Building Effective Agents"** — 五大 workflow 模式直接适用，尤其 Evaluator-Optimizer
2. **Magentic-One (Dual Ledger)** — Task/Progress 分离模式可直接移植
3. **MetaGPT (SOP + Structured Artifacts)** — 结构化中间产物的最佳实践
4. **DeepMind "Towards a Science of Scaling Agent Systems"** — 45% 规则、agent 数量饱和点
5. **UC Berkeley "Why Do Multi-Agent LLM Systems Fail?"** — 14 种失败模式分类，对照 RT 做预防性检查
6. **Reflexion** — verbal RL 在决策场景的直接应用，但仅限 1 轮
7. **STORM** — 多视角研究 + 来源锚定的完整实现
8. **Agent-as-a-Judge** — 独立评估节点设计参考，但注意落点是 QA gate 而非用户面权威分数
