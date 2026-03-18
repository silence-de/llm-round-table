# 长会话 LLM 决策工作流的可靠性与可恢复性架构设计

## Executive Summary

**对于类似 Round Table（RT）的多阶段 LLM 决策系统，可靠性的核心挑战不是单次调用的成功率，而是复合失败的级联效应。** 经典串联系统可靠性公式 R_total = R₁ × R₂ × ... × Rₙ 表明，即使每个阶段达到 98% 的成功率，一个 4 阶段流水线的端到端成功率也仅为 **92.2%**——这意味着每 13 次会话约有 1 次失败。Berkeley BAIR 实验室 2024 年的 Compound AI Systems 研究（Zaharia 等人）以及 NeurIPS 2025 的 MAST 论文（Cemri 等人对 1600+ 执行轨迹的分析）证实，**当前最先进的多 Agent 系统框架的失败率高达 41%–86.7%**，且 79% 的失败源自规范和协调层面，而非技术实现。

这意味着 RT 系统的架构设计必须将 **可恢复性（recoverability）** 和 **信任一致性（trust consistency）** 置于吞吐量之上。本报告基于 Anthropic、OpenAI、Google DeepMind 的一手技术报告，LangGraph、Temporal、AWS Step Functions 的官方工程文档，以及 arXiv 上的最新学术论文，提供了从可靠性建模、故障分类、断点续传设计到可观测性仪表盘的完整架构指南。

---

## Verified Findings（已验证的核心发现）

以下每项发现均可追溯至具体的权威来源：

**复合可靠性急剧衰减是已证实的数学规律。** 串联系统可靠性理论（Cortland University/START 可靠性工程教材；IntechOpen "Reliability of Systems" 章节）明确指出：对于必须所有阶段均成功的串行流水线，系统可靠性 = 各阶段可靠性之积。当单步可靠性为 90% 时，3 步链仅为 72.9%，5 步链降至 59%。这一数学模型直接适用于 RT 的 research → synthesis → decision → summary 流水线。

**当前多 Agent 系统的失败率远高于预期。** MAST 论文（Cemri 等人，NeurIPS 2025，arXiv:2503.13657）分析了 7 个最先进开源 MAS 框架的 1642 条执行轨迹，发现 **14 种独特失败模式**分布于 3 个大类：系统设计缺陷、Agent 间对齐失败、任务验证不足。ChatDev（当时最先进的开源 MAS）正确率低至 **25%**。针对性的 prompt 优化和编排增强仅带来 +14% 的改善，表明问题根源在于 **架构设计** 而非表层调优。

**"静默降级"是比显式错误更危险的失败模式。** Pathak 等人的论文 "Detecting Silent Failures in Multi-Agentic AI Trajectories"（arXiv:2511.04032）识别出三种故障类型——Drift（路由到错误的 Agent/工具但无异常报错）、Cycles（循环调用同一 Agent）、Errors（显式错误）——其中 Drift 最难检测，需要将实际执行轨迹与黄金路径进行对比才能发现。

**LLM 流式 API 均不支持原生断点续传。** 经实际验证，OpenAI 和 Anthropic 的 SSE 流式 API 均为 fire-and-forget 模式，一旦连接中断无法恢复。SSE 规范（WHATWG HTML Standard §9.2）虽然定义了 `Last-Event-ID` 自动重连机制，但**服务端事件持久化和追赶（catch-up）完全是应用层责任**。Vercel AI SDK 的 `resumable-stream` 方案和 ElectricSQL 的 Durable Streams 协议提供了经过生产验证的解决方案。

**Checkpoint 是实现可恢复性的最关键机制。** LangGraph 官方文档确认其在每个 "super-step" 边界自动保存状态快照，Temporal.io 通过 Event History 实现确定性重放（OpenAI 的 Codex Agent 即采用 Temporal 架构处理百万级请求），AWS Step Functions 通过 Redrive 从失败点恢复——三种框架采用不同机制，但遵循共同原则：**将非确定性操作包裹在持久化边界内，确保完成的工作不被重做**。

---

## Reliability Model（多阶段 LLM 会话可靠性模型）

### 阶段可靠性的数学定义

对于 RT 的 4 阶段流水线（Research → Synthesis → Decision → Summary），每个阶段 i 的可靠性定义为：

**Rᵢ = P(阶段 i 在接收到正确输入的条件下产出正确输出)**

系统端到端可靠性遵循串联模型：

**R_system = R_research × R_synthesis × R_decision × R_summary**

| 单阶段可靠性 | 4 阶段系统可靠性 | 含义 |
|-------------|----------------|------|
| 99% | 96.1% | 每 26 次会话约 1 次失败 |
| 95% | 81.5% | 每 5.4 次会话约 1 次失败 |
| 90% | 65.6% | 每 3 次会话约 1 次失败 |
| 85% | 52.2% | 接近半数会话失败 |

**如何使复合可靠性计算既有意义又不具误导性：**

串联模型（R_total = ∏Rᵢ）假设各阶段独立且全部必须成功，但 RT 系统存在两个修正因素。第一，**各阶段并非独立**——前序阶段的低质量输出会级联放大后续阶段的失败概率。AgentErrorTaxonomy（Zhu 等人，arXiv:2509.25370）将此称为"级联失败"，即"单个根因错误通过后续决策传播"。因此，纯乘法模型在存在级联效应时会**低估**实际失败率。第二，**并非所有阶段都是严格必须的**——如果 RT 允许部分降级（如 5 个 research agent 中 3 个完成即可），则该阶段可采用并联模型 R_parallel = 1 - (1-r)ⁿ 提升可靠性。

建议 RT 采用 **分层复合可靠性模型**：

- **阶段内**：若存在冗余路径（如多个 research agent），采用并联模型
- **阶段间**：采用串联模型，但引入**级联衰减因子 α**：R_effective(i) = Rᵢ × α(quality_of_input_from_i-1)
- **系统级**：R_system = ∏ R_effective(i)，同时记录每个阶段的 **pass^k 指标**（ReliabilityBench，arXiv:2601.06112）——即同一任务执行 k 次全部成功的概率

### 阶段可靠性的记录方法

每个阶段应记录以下指标（基于 Anthropic "Demystifying Evals" 和 OpenTelemetry GenAI SemConv v1.40）：

- **成功率（Success Rate）**：二值判定——该阶段是否产出了可用输出
- **质量分（Quality Score）**：LLM-as-Judge 或确定性评分器对输出质量的评分（0.0–1.0）
- **延迟（Latency）**：该阶段的 P50/P95/P99 执行时间
- **重试次数（Retry Count）**：该阶段触发了多少次重试或回退
- **降级标记（Degradation Flag）**：是否使用了回退路径或部分结果

---

## Partial Failure Playbook（按故障类型分类）

### Phase-by-Phase 故障分类矩阵

| 阶段 | 故障类型 | 可见性 | 处理策略 | 恢复优先级 |
|------|---------|--------|---------|-----------|
| **Research** | Agent 超时（部分 agent 未在 deadline 内返回） | 用户可见（结果不完整标记） | **Quorum 策略**：≥3/5 agent 完成即可进入下一阶段，标记覆盖度 | P1 |
| **Research** | Agent 返回低质量/不相关结果 | 静默降级 | **Quality Gate**：对每个 agent 输出进行相关性评分，过滤 score < 阈值的结果 | P1 |
| **Research** | LLM API 429/503 错误 | 内部故障 | **Circuit Breaker + Exponential Backoff**：5 次连续失败后熔断，30s 后 half-open 探测 | P2 |
| **Synthesis** | 输入数据不完整（上游 research 部分缺失） | 静默降级 | **显式标注缺失范围**：在 synthesis 输出中声明 "基于 N/M 个来源的分析，未覆盖 X 领域" | P1 |
| **Synthesis** | LLM 幻觉/编造内容 | 静默降级 | **Grounding 检查**：对比 synthesis 输出与 research 原始材料的 faithfulness 分数 | P1 |
| **Synthesis** | 输出格式损坏（JSON 解析失败） | 用户可见 | **Structured Output + 重试**：使用 JSON Schema 约束输出，解析失败则重试（最多 3 次） | P2 |
| **Decision** | Agent 无法做出决定（置信度过低） | 用户可见 | **Human-in-the-loop 升级**：暂停流程，请求人工介入 | P1 |
| **Decision** | 决策逻辑与上下文不一致 | 静默降级 | **一致性校验**：用独立 LLM 验证决策理由是否与 synthesis 结论一致 | P2 |
| **Summary** | 输出不完整（SSE 流中断） | 用户可见 | **持久化 SSE 事件 + 断点续传**：客户端重连后从 last cursor 继续 | P1 |
| **Summary** | 输出质量下降但仍可用 | 静默降级 | **Online Eval 监控**：持续运行质量评分，低于阈值触发告警 | P3 |

### 三层故障可见性定义

**用户可见故障（User-Visible Failures）**：用户直接感知的故障——错误提示、空白响应、明显不完整的输出、流中断。处理原则是**快速失败并清晰沟通**，如返回已完成阶段的部分结果并标注 "该结论基于有限数据"。

**静默降级（Silent Degradation）**：系统返回 HTTP 200 但输出质量劣化——幻觉增加、相关性降低、覆盖度不足。这是**最危险的故障类型**，因为用户和基础设施监控均无法发现。Datadog 工程团队在构建 Dashboard Agent 时证实："故障极少抛出显式异常。我们看到的是畸形的 widget JSON 或不完整的仪表盘，而没有明确的故障定位信号。"检测方法依赖于**持续在线 eval**（LLM-as-Judge 对 faithfulness/relevance 的评分）和 **canary prompts**（固定测试输入的周期性执行）。

**内部故障（Internal-Only Failures）**：重试成功的 API 调用、触发了回退路径但最终成功、次优路由但仍产出可接受结果。用户不可见，但影响成本和效率。通过 trace 分析、重试计数和轨迹对比进行检测。

### 降级 Agent 处理策略

基于 Anthropic "Building Effective Agents" 和 OpenAI "A Practical Guide to Building Agents"，推荐以下分级策略：

**Slow Agent（响应缓慢）**：设置 per-operation 自适应超时——简单查询 2–10s，复杂推理 30–60s。超时后不立即判定失败，而是进入 **deadline propagation** 模式：如果整体 deadline 仍有余裕，继续等待并降低后续阶段的时间预算；如果 deadline 紧迫，切换到 "good enough" 模式，使用已有的部分结果。

**Unavailable Agent（完全不可用）**：触发 **Chain-of-Responsibility 回退链**——Primary Agent（完整推理能力）→ Recovery Agent（模板化决策逻辑）→ Emergency Fallback（规则引擎或人工升级）。每一级回退都应在输出中标注降级级别。

**Low-Quality Agent（输出质量低）**：在阶段间设置 **Quality Gate**——使用 Pydantic/JSON Schema 做结构验证，使用 LLM-as-Judge 做语义质量评分。当 faithfulness < 0.85 或 relevance < 0.7 时，触发重新生成（最多 2 次），若仍不达标则标记为降级输出并继续流程。Anthropic 建议 "safety should be a gate, not a gradient"——安全性检查必须是通过/不通过的二值判定。

**SSE 流断连**：详见下文 Resume/Replay 章节。

---

## Resume / Replay Design Implications（断点续传设计）

### 状态边界设计原则

RT 系统的 resume 边界应设置在**非确定性操作的完成点**——即每次 LLM 调用、外部 API 调用或工具执行完成之后。这一原则贯穿所有主流编排框架：LangGraph 将每个 `@task` 装饰的函数视为持久化单元，Temporal 将每个 Activity 的结果录入 Event History，Prefect 通过 cache key 标记已完成的 task。

**核心设计模式——"Task Boundary 原则"（跨框架共识）**：

1. **识别非确定性工作单元**：LLM 调用、API 调用、工具执行
2. **将每个单元包裹在框架的执行边界内**：确保框架记录其结果
3. **Resume 时重放确定性编排逻辑**，对已完成单元直接读取记录结果而非重新执行

### RT 四阶段必须持久化的中间产物

| 阶段 | 必须持久化的产物 | 原因 |
|------|----------------|------|
| **Research** | 原始检索结果（含 source URL）、搜索查询、每个 agent 的完整输出、相关性评分 | 成本最高且不可重现——外部 API 状态可能已变化 |
| **Synthesis** | 去重后的发现列表、提取的事实、矛盾映射、覆盖度元数据 | 代表大量 LLM 处理工作，避免重复计算 |
| **Decision** | 决策理由、置信度分数、备选方案及其评估、最终选择 | 审计和人工复审的必需品 |
| **Summary** | 每个 SSE event（含序列号）、草稿版本历史、最终输出 | 支持断点续传和增量优化 |
| **全局** | 每次 LLM 调用的 prompt + completion、配置参数、错误状态、时间戳 | 调试、审计和成本追踪 |

### SSE 断点续传最佳实践

**SSE 规范的内建机制及其局限：** WHATWG HTML Standard §9.2 定义了 `EventSource` 在连接中断后自动重连并携带 `Last-Event-ID` header 的机制。服务端可通过 `retry:` 字段控制重连间隔（毫秒）。但规范**仅定义了客户端行为**——服务端的事件持久化、catch-up 逻辑和多客户端协调完全由应用层负责。

**推荐架构——"Ordered Immutable Log + Cursor-Based Tailing"：**

这一模式已在 Vercel AI SDK、Upstash、ElectricSQL 和 LibreChat 的生产环境中验证。核心思想是：**每个会话的每个事件追加写入一个有序不可变日志，每个消费者通过自己的 cursor（最后处理的序列号）从日志中读取。Catch-up 和实时流是同一个操作——cursor 是唯一变量。**

具体实现模式：

```
┌──────────┐   POST /generate   ┌─────────────────┐  XADD   ┌────────────┐
│  Client   │ ─────────────────→ │ Stream Generator │ ──────→ │ Redis      │
│ (Browser) │                    │ (解耦于连接)      │ PUBLISH │ Streams    │
└──────────┘                     └─────────────────┘         └────────────┘
     │                                                            │
     │  GET /stream?sessionId=X&cursor=Y                          │
     │                              ┌────────────────┐ XREADGROUP │
     └─────────────────────────────→│ Stream Consumer │ ←─────────┘
              SSE text/event-stream │ (独立进程)      │ SUBSCRIBE
                                    └────────────────┘
```

**关键设计决策：**

- **生成与投递解耦**：LLM 生成进程独立于客户端连接，写入持久化存储（Redis Streams、Postgres 或 Durable Streams）。客户端断连不影响生成。
- **Event ID 设计**：使用**单调递增整数**作为序列号（单一 sequencer 保证全局有序），避免使用时间戳（跨进程时钟偏差导致排序不可靠）。复合 ID 格式：`{sessionId}:{sequenceNumber}`。
- **客户端 cursor 持久化**：将 last processed event ID 存储在 `localStorage`，刷新或重连后从此处恢复。
- **Heartbeat 保活**：每 15–30 秒发送 SSE 注释 `: ping\n\n`，客户端设置 watchdog timer——30 秒无事件则主动断开重连。Anthropic 官方 SDK 曾因未监控 heartbeat 导致 TCP 静默死连接无限挂起（Claude Code issue #33949）。
- **HTTP/2 消除连接限制**：HTTP/1.1 下每域名最多 6 个 SSE 连接，HTTP/2 多路复用可消除此瓶颈。

**应避免的"Accidental Message Broker"反模式**（starcite.ai 总结的 6 种故障模式）：消息在刷新后消失（gap）、重连后出现重复消息、工具结果出现但缺少对应的工具调用（因果序违反）、多 Agent 消息乱序、不同标签页显示不同消息（状态发散）、每次部署中断所有活跃会话（thundering herd）。以上 6 种故障均可通过 ordered log + cursor 模式一次性解决。

---

## Recommended Metrics and Dashboards（推荐监控指标与仪表盘）

### 10 个最有价值的 Ops Dashboard 信号

基于 OpenTelemetry GenAI Semantic Conventions v1.40、Datadog LLM Observability 文档、Anthropic Evals 指南和 ReliabilityBench 论文，按优先级排序：

| 优先级 | 指标 | 描述 | 数据来源 | 检测的故障类型 |
|--------|------|------|---------|--------------|
| **P0** | **Task Completion Rate（分阶段）** | 各阶段的成功率，系统级端到端成功率 | 每次执行的结果标记 | 用户可见故障 |
| **P0** | **End-to-End Latency（P50/P95/P99）** | 从用户请求到最终响应的墙钟时间；流式场景追加 TTFT | OTel `gen_ai.client.operation.duration` | 用户可见故障 |
| **P0** | **Error Rate by Phase** | 按阶段和错误类型分类的显式错误率 | Structured logging + span status | 用户可见故障 |
| **P1** | **Quality Score（Online Eval）** | LLM-as-Judge 对生产输出的 faithfulness、relevance 评分 | 采样评估 pipeline | **静默降级** |
| **P1** | **Token Usage & Cost per Task** | 按模型和阶段分解的输入/输出 token 数 | OTel `gen_ai.client.token.usage` | 成本回归、效率异常 |
| **P1** | **Retry / Loop Count per Execution** | 每次任务执行的重试次数和循环迭代数 | Trace span 计数 | Agent 挣扎/卡住 |
| **P2** | **Tool Call Success Rate** | 工具调用返回有效、有用结果的比例 | 工具调用日志 | 内部故障 |
| **P2** | **Trajectory Drift Score** | 实际执行路径偏离预期黄金路径的程度 | Pathak et al. 方法 | **静默降级** |
| **P2** | **SSE Stream Health** | 活跃连接数、重连次数、catch-up 事件量、heartbeat 超时率 | SSE 服务端日志 | 用户可见故障 |
| **P3** | **Cost per Successful Task** | 总成本（token + 工具调用 + 基础设施）/ 成功完成数 | 聚合计算 | 效率回归 |

### 仪表盘架构建议

采用 ActiveWizards 提出的 **三支柱集成模式**：

- **定量指标层（Grafana/Prometheus）**：延迟、成本、错误率、吞吐量——回答 "发生了什么"
- **定性 Trace 层（LangSmith/Langfuse）**：完整的 prompt/completion、工具调用序列、推理步骤——回答 "为什么发生"
- **系统日志层（ELK/Loki）**：基础设施事件、SSE 连接生命周期、部署事件——提供 "上下文"

**关键洞察：基础设施仪表盘全绿 ≠ LLM 行为正常。** 必须将 infra 指标与 semantic 质量指标关联监控。Datadog 团队在实践中发现，dashboard agent 的故障极少抛出异常——工具调用返回 HTTP 401 但不被识别为错误，导致产出畸形 JSON 而无任何告警。

---

## Recommended Test Matrix for RT（推荐测试矩阵）

### 完整测试矩阵

纵轴为测试层级，横轴为测试维度，交叉点为具体测试用例：

| | Correctness | Quality | Efficiency | Robustness | Fault Tolerance | Consistency |
|---|---|---|---|---|---|---|
| **Unit（单阶段）** | 单个 LLM 调用输出格式校验 | Prompt 模板质量评分 | 单调用 token 用量 | 同义改写输入 | Mock API 超时 | 同输入 3 次执行对比 |
| **Integration（跨阶段）** | 阶段间数据传递完整性 | Quality Gate 阈值验证 | 跨阶段延迟分布 | 上游降级输入 | 上游阶段部分失败 | 阶段间一致性 |
| **Trajectory（全流程）** | 执行路径与黄金轨迹对比 | 端到端输出评分 | 总步数和 token | 变体输入全流程 | 注入多阶段故障 | 全流程 pass^k |
| **Regression（回归）** | 已知正确 case 验证 | 质量不低于基线 | 成本不高于基线 | — | — | — |

### RT 应优先构建的 5 项可靠性测试

基于 ReliabilityBench（arXiv:2601.06112）的 Reliability Surface R(k, ε, λ) 框架和 Anthropic 的 Capability vs. Regression 方法论：

**1. Consistency Under Repeated Execution（一致性测试）** —— 对 50+ 个标准 case 各执行 3–5 次，计算 pass^k（全部 k 次均成功的概率）。ReliabilityBench 发现 k=1 时 96.88% 的基线在 k=2+ 时可能显著下降。这是衡量 "trust consistency" 的核心指标。

**2. Fault Injection: Rate Limiting（限流故障注入）** —— 模拟 LLM API 429 错误，验证 circuit breaker → fallback → resume 链路。ReliabilityBench 数据表明 rate limiting 是**破坏性最大**的故障类型（λ=0.2 时成功率降至 93.75%）。

**3. Partial Completion Handling（部分完成测试）** —— 模拟 Research 阶段 2/5 agent 超时，验证系统能否正确执行 quorum 策略，标注覆盖度，并产出质量可接受的 synthesis。

**4. SSE Reconnect / Catch-up（SSE 断点续传测试）** —— 在 Summary 流式输出过程中模拟客户端断连，验证重连后从正确 cursor 位置恢复且无消息丢失或重复。

**5. Regression Against Golden Dataset（回归测试）** —— 维护 150+ 个 question-answer 对（参考 Microsoft Copilot 团队建议），每次部署前验证通过率不低于基线。Anthropic 建议将高通过率的 capability eval 自动"毕业"为 regression suite。

---

## Recommended Minimum Design for RT（RT 最小可行架构设计）

### 核心架构组件

**1. 有状态编排引擎（State Machine + Checkpoint）**

推荐基于 LangGraph 的 graph-based 编排，原因是其 **super-step checkpointing** 机制天然适配 RT 的多阶段流水线，且提供 Postgres/DynamoDB 后端的生产级持久化。每个阶段定义为 graph 中的一个 node，阶段间 edge 可附带 Quality Gate 条件。

LangGraph 的三种持久化模式中，RT 应选择 `"sync"` 模式（每步同步持久化后再执行下一步），牺牲少量性能换取最高持久性。关键点：所有 LLM 调用和工具调用必须包裹在 `@task` 装饰器中，确保 resume 时不重复执行。

```python
# RT 最小编排框架示意
builder = StateGraph(RTSessionState)
builder.add_node("research", research_phase)       # Checkpoint ①
builder.add_node("quality_gate_1", validate_research) # Gate
builder.add_node("synthesis", synthesis_phase)      # Checkpoint ②
builder.add_node("quality_gate_2", validate_synthesis) # Gate
builder.add_node("decision", decision_phase)        # Checkpoint ③
builder.add_node("summary", summary_phase)          # Checkpoint ④

checkpointer = PostgresSaver(conn)
graph = builder.compile(checkpointer=checkpointer)
```

**2. 持久化 SSE 事件系统**

采用 **Redis Streams + Pub/Sub** 模式（参考 Vercel `resumable-stream` 和 LibreChat 生产架构）：

- Generator 进程写入 Redis Stream（XADD），独立于客户端连接
- Consumer 进程通过 Consumer Group 读取未消费事件，以 SSE 格式推送给客户端
- 客户端将 last processed cursor 存入 localStorage
- 重连时从 cursor 位置开始 catch-up，然后无缝过渡到实时 tailing
- 每 15 秒发送 heartbeat，客户端 30 秒无事件则主动重连

**3. 分层容错栈**

按 Google Cloud SRE 最佳实践和 Portkey AI Gateway 的架构，从外到内：

- **Structured Output Validation**：Pydantic/JSON Schema 校验每个 LLM 输出
- **Quality Gate（语义层）**：LLM-as-Judge 对关键输出评分
- **Circuit Breaker**：per-model/per-endpoint 独立熔断器（5 次连续失败触发，30s 探测周期）
- **Retry with Exponential Backoff + Jitter**：遵循 OpenAI 官方建议 `wait_random_exponential(min=1, max=60)`
- **Fallback Chain**：Primary Model → Alternative Model → Template-based → Human Escalation

**4. 观测性基础设施**

- **Tracing**：采用 OpenTelemetry GenAI Semantic Conventions，每个 phase/tool call/LLM call 生成 span
- **Metrics**：上述 10 个核心指标导出到 Prometheus/Grafana
- **Online Eval**：对 10% 生产流量运行 LLM-as-Judge 评分，检测静默降级
- **Alerts**：task completion rate < 90% 触发 P1 告警；quality score 7 日下降 > 10% 触发 P2 告警

### 最小可行的 Session 状态结构

```json
{
  "session_id": "rt-abc-123",
  "thread_id": "thread-456",
  "current_phase": "synthesis",
  "phase_results": {
    "research": {
      "status": "completed",
      "agents_completed": 4,
      "agents_total": 5,
      "coverage": 0.8,
      "artifacts": ["...persisted references..."],
      "quality_score": 0.87,
      "degradation_flags": ["agent_3_timeout"]
    }
  },
  "sse_stream": {
    "stream_key": "rt-abc-123:stream",
    "last_seq": 847,
    "heartbeat_interval_ms": 15000
  },
  "metadata": {
    "created_at": "2026-03-18T10:00:00Z",
    "config_version": "v2.3",
    "total_tokens": 45230,
    "total_cost_usd": 0.34
  }
}
```

---

## Anti-Patterns（反模式）

**1. 跨无关操作共享 Circuit Breaker。** 如果 Claude Messages 端点宕机但 Embeddings 端点正常，共享熔断器会不必要地阻断两者。**每个 model × endpoint 组合应有独立的 breaker。**

**2. 无 Circuit Breaker 的 Retry Storm。** 每个失败请求触发 2–3 次重试，在已经过载的服务上倍增负载。OpenAI 官方明确建议配合 exponential backoff + jitter 使用。

**3. 信任 LLM 输出的置信度语气。** LLM 无论实际正确与否都以同等自信的语气输出。将 "语气自信" 等同于 "输出正确" 是 RT 系统中最常见的静默降级来源。

**4. 两条读取路径（REST 历史 + SSE 实时流）。** starcite.ai 称之为 "accidental message broker" 反模式——维护两套独立的消息投递机制会导致 gap、重复、乱序和状态发散。应统一为 **单一 ordered log + cursor** 模式。

**5. Fallback 与 Primary 共享故障域。** 如果回退方案部署在同一基础设施或同一 LLM 供应商，它可能与主方案同时失败。回退应跨供应商或跨执行模式（LLM → 规则引擎）。

**6. 仅依赖 Infra 指标判断系统健康。** 100% 的 HTTP 200 响应率不代表 LLM 行为正常。缺乏 semantic 质量监控的 RT 系统将对静默降级完全不可见。

**7. Prompt 不做版本管理。** Anthropic 明确建议 "build evals before capabilities"。不对 prompt 进行与代码同等严格的版本控制和评审，会导致无法追溯的质量回归。

**8. 单体回退逻辑。** 将所有故障处理硬编码在一个 controller 中，而非采用模块化的 per-error-type 回退策略。正确做法是分层：Retry → Fallback → Circuit Breaker → Observability → Validation，每层处理特定关注点。

**9. 忽略幂等性。** 如果一个请求在 Primary 上部分处理后在 Fallback 上重试，副作用可能执行两次。Circuit Breaker 不解决这个问题——调用方必须确保请求可安全重试。

**10. 在已开始流式输出后尝试重放（Replay After Streaming Started）。** OpenAI Agents SDK 明确警告：一旦流式响应已发出事件，重放是不安全的。应采用 persisted event log 模式替代。

---

## Open Questions（开放问题）

**1. 级联失败的定量建模仍是学术空白。** 目前没有经过同行评审的论文将经典串联/并联可靠性工程框架严格应用于 LLM agent 流水线。串联模型假设各阶段独立，但 LLM 系统中前序阶段的输出质量会影响后续阶段——如何量化这一级联效应（即上文提到的 α 衰减因子）尚无标准方法。

**2. pass^k 指标的 k 值如何选择？** ReliabilityBench 使用 k=1 到 k=5，但对于生产系统，"用户期望的一致性水平" 对应的 k 值缺乏行业共识。过高的 k 值设定可能导致不切实际的可靠性目标。

**3. LLM-as-Judge 的校准稳定性。** 多个来源（Anthropic、DeepEval）推荐使用 LLM 评估 LLM 输出，但当评判模型本身升级时，评分标准可能漂移。如何保持跨时间的评分一致性是一个实际工程挑战。

**4. 多阶段系统中 "足够好" 的形式化定义。** 当 Research 阶段仅有 3/5 agent 完成时，如何量化"当前结果是否足以支撑高质量的 Synthesis"？这需要 task-specific 的 sufficiency 指标，目前尚无通用框架。

**5. SSE 长连接在极端网络条件下的行为。** 对于移动端或弱网环境，SSE 的自动重连机制在反复断连/重连循环中的表现（包括服务端资源消耗、catch-up 成本）缺乏系统性基准测试。Durable Streams 协议是否能在 2026 年成为行业标准仍有待观察。

**6. Agent 可观测性标准尚在早期阶段。** OpenTelemetry GenAI Semantic Conventions 中的 Agent-specific 属性（Tasks、Actions、Teams、Artifacts、Memory）仍处于提案阶段（GitHub Issue #2664），尚未正式发布。RT 可能需要定义自己的 semantic conventions 作为过渡方案。

---

## Source List

**学术论文：**
- Cemri 等人, "Why Do Multi-Agent LLM Systems Fail?" NeurIPS 2025 Datasets & Benchmarks Track, arXiv:2503.13657
- Zhu 等人, "Where LLM Agents Fail and How They Can Learn From Failures," arXiv:2509.25370
- Roig, "How Do LLMs Fail In Agentic Scenarios?" arXiv:2512.07497
- Tian 等人, "Rethinking the Reliability of Multi-agent System: A Perspective from Byzantine Fault Tolerance," arXiv:2511.10400
- Pathak, "Detecting Silent Failures in Multi-Agentic AI Trajectories," arXiv:2511.04032
- Gupta, "ReliabilityBench: Evaluating LLM Agent Reliability Under Production-Like Stress Conditions," arXiv:2601.06112
- Mohammadi 等人, "Evaluation and Benchmarking of LLM Agents: A Survey," KDD 2025, arXiv:2507.21504
- "ESAA: Event Sourcing for Autonomous Agents," arXiv:2602.23193

**一手技术报告：**
- Anthropic, "Building Effective AI Agents" (2024), anthropic.com/research/building-effective-agents
- Anthropic, "Demystifying Evals for AI Agents" (2025), anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic, "Effective Context Engineering for AI Agents" (2025), anthropic.com/engineering/effective-context-engineering-for-ai-agents
- OpenAI, "A Practical Guide to Building Agents" (2025), cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- Microsoft, "Taxonomy of Failure Modes in Agentic AI Systems" (2025), microsoft.com/en-us/security/blog/2025/04/24/
- Zaharia 等人, "The Shift from Models to Compound AI Systems," Berkeley BAIR (2024), bair.berkeley.edu/blog/2024/02/18/compound-ai-systems/

**官方工程文档：**
- LangGraph Persistence & Durable Execution, docs.langchain.com/oss/python/langgraph/persistence
- Temporal Workflow Execution & Event History, docs.temporal.io/workflow-execution
- AWS Step Functions Error Handling & Redrive, docs.aws.amazon.com/step-functions/
- CrewAI Flow State Management, docs.crewai.com/en/guides/flows/mastering-flow-state
- OpenTelemetry GenAI Semantic Conventions v1.40, opentelemetry.io/docs/specs/semconv/gen-ai/
- WHATWG HTML Living Standard §9.2 (SSE), html.spec.whatwg.org/multipage/server-sent-events.html
- Vercel AI SDK Resume Streams, ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
- ElectricSQL Durable Streams Protocol, electric-sql.com/blog/2025/12/09/announcing-durable-streams
- Datadog LLM Observability, docs.datadoghq.com/llm_observability/

**工程实践与分析：**
- Upstash, "Building Resumable LLM Streams with Redis," upstash.com/blog/resumable-llm-streams
- starcite.ai, "Why Agent UIs Lose Messages on Refresh," starcite.ai/blog/why-agent-uis-lose-messages-on-refresh
- Portkey, "Retries, Fallbacks, and Circuit Breakers in LLM Apps," portkey.ai/blog/
- Stack Overflow Blog, "Reliability for Unreliable LLMs" (2025), stackoverflow.blog/2025/06/30/
- Galileo, "AI Agent Reliability for Mission-Critical Systems," galileo.ai/blog/ai-agent-reliability-strategies
- Google Cloud Community, "Building Bulletproof LLM Applications: SRE Best Practices," Medium