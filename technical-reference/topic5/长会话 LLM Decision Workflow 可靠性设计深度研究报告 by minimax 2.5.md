# 长会话 LLM Decision Workflow 可靠性设计深度研究报告

**Round Table (RT) 系统可靠性、Partial Failure Handling、Resume、Reconnect 与可观测性**

---

## 1. Executive Summary

本报告为长会话 LLM decision workflow 提供了一套全面的可靠性设计框架，专门针对 Round Table (RT) 这类系统——它们采用多阶段 session、SSE streaming，且 agent 可能出现 timeout、降级运行或 partial completion 的情况。研究综合了来自 UC Berkeley、Anthropic、Google、OpenAI 等机构的同行评审论文、官方技术报告和工程文档。

核心挑战在于：多智能体 LLM 系统展现出与传统软件 pipeline 根本不同的可靠性特征。UC Berkeley 的研究表明，多智能体系统 paradoxically 失败率更高——在 AppWorld 等基准环境中失败率高达 86.7%。本报告识别出三大类共 14 种 distinct failure modes，并提供了可操作的 mitigation 策略。

**关键发现包括**：

1. **Compound reliability 必须分解为 phase-level 原子测量**，而非端到端成功率
2. **Partial failures 需要 graduated response 策略**，而非 binary success/failure semantics
3. **Checkpoint-based resume 机制必须持久化 state 和 intermediate artifacts**
4. **SSE streaming 需要明确的 reconnect 和 catch-up 协议**
5. **可观测性必须区分 user-visible failures、silent degradation、internal-only failures**

RT 系统的最小推荐设计强调：每个 phase boundary 的 checkpoint 持久化、degraded agent 处理与 fallback 策略、带 retry budget 的结构化异常处理，以及涵盖延迟、准确性和资源消耗的综合指标。

---

## 2. Verified Findings

### 2.1 多智能体系统故障分类法 (MASFT)

UC Berkeley 与 Intesa Sanpaolo 的基础研究建立了首个多智能体 LLM 系统的 empirical failure taxonomy，标记为 MASFT。对 7 个流行框架（使用 GPT-4o 和 Claude-3）超过 1,600 条 annotated traces 的分析揭示了 14 种 unique failure modes，分为三大类：

**类别一：Specification and System Design Failures** 涉及 incorrect problem decomposition、improper agent role definitions、missing or ambiguous tool specifications，以及导致 deadlock 或 livelock 的 flawed workflow architecture。这类失败源于 inadequate upfront design，通常在 session 执行早期显现。

**类别二：Inter-Agent Misalignment Failures** 发生在 agents 未能有效通信、目标冲突、误解彼此输出、或在 phases 之间 improper context transfer 时。Error propagation across agent boundaries 加剧这些失败——上游 agents 可能传递 degraded outputs 给下游而没有适当的 signaling。

**类别三：Task Verification and Termination Failures** 涉及 improper completion criteria、missing validation of intermediate results、未能识别何时需要 human intervention，以及永远不会自然终止的 circular reasoning loops。

### 2.2 COCO 框架：持续监督以提高可靠性

最新研究引入 COCO (Cognitive Operating System with Continuous Oversight) 框架，通过 asynchronous self-monitoring 和 adaptive error correction 解决多智能体 workflow 中的 quality-efficiency tradeoff。该框架实现 checkpoint-based error detection，使下游 agents 能够识别并补偿上游失败，而无需 complete pipeline restart。

### 2.3 Anthropic 的工具可靠性指南

Anthropic 的官方工程文档建立了构建可靠 agent 工具的最佳实践，强调传统软件的 deterministic error handling 必须适应 non-deterministic agentic 系统。关键发现包括：

**Evaluation-Driven Development**：工具应通过迭代评估优化，收集包括 top-level accuracy、runtime、tool call counts、token consumption 和 error frequency 在内的指标。Strong evaluation tasks 可能需要数十次 tool calls 才能充分测试可靠性。

**错误响应设计**：错误消息必须经过 prompt engineering，清楚传达 specific、actionable 的改进。Opaque error codes 或 raw tracebacks 无法指导 agent self-correction，被识别为 anti-patterns。有效的错误响应包括正确格式化的工具输入示例。

**Token 效率**：应实现默认响应限制（例如 Claude Code 的 25,000 tokens）并配合 pagination 和 truncation。Agents 应被引导进行许多 small、targeted operations，而非生成过多 context 的 broad searches。

### 2.4 A2A 协议：企业级 Agent 互操作性

Google 于 2025 年 4 月发布的 Agent-to-Agent (A2A) 协议为 agent 通信提供了标准化框架，包含明确的可靠性机制。协议定义了完整的 task lifecycle state machine：

| State | Description |
|-------|-------------|
| submitted | Task submitted, initial state |
| working | Task actively processing |
| input-required | Task blocked awaiting additional input (optional intermediate state) |
| completed | Task successfully finished |
| failed | Task execution failed |

该协议通过 `tasks/sendSubscribe` 支持 SSE (Server-Sent Events)，实现实时 task status updates，使客户端无需 polling 即可监控 long-running tasks。A2A 还指定 Webhook callbacks 用于异步通知，并包含企业安全需求的 built-in authentication/authorization 机制。

### 2.5 OpenAI Agents SDK：流式传输和错误处理

OpenAI 于 2025 年 3 月发布的 Agents SDK 为多智能体协调提供了内置模式，明确支持流式传输和错误恢复。SDK 实现智能 handoffs between agents、内置 security validation 和 tracing observability。Responses API 支持可预测的 streaming events 和 computer-use agents 的 truncation handling。

### 2.6 Agent 评估基准

多个专门基准测试评估 multi-step agent 可靠性：

**GAIA (General AI Assistants Benchmark)**：由 Meta、HuggingFace 和 AutoGPT 开发，包含三个难度级别共 466 个问题。Level 2 任务通常需要 5-10 步并整合多个工具，特别适合评估 phase-level 可靠性。

**SWE-bench / SWE-bench Verified**：软件工程任务基准，LLM agents 需解决 GitHub issues。SWE-bench Verified 通过使用 containerized Docker evaluation environments 解决了之前的 limitations，提供更一致的结果。

**AgentBench**：清华大学领衔开发的系统性 Agent 基准测试，评估 LLM 在多轮开放-ended生成环境中的推理和决策能力，涵盖 8 个不同环境。

---

## 3. Reliability Model

### 3.1 Phase Reliability 定义与记录

对于 RT 系统，phase reliability 应在 individual workflow stages 的粒度上定义，而非整个 session。每个 phase 代表一个 atomic work unit，其要么成功完成，要么以可识别的错误模式失败。

**Phase States**：一个 phase 可能处于以下状态之一：

- **pending**：Phase 尚未开始
- **running**：Phase 正在执行
- **completed**：Phase 成功完成，输出有效
- **failed**：Phase 以可识别的错误终止
- **degraded**：Phase 完成但输出质量低于阈值
- **cancelled**：Phase 被明确取消（例如用户中止、上游失败）

**记录要求**：每次 phase 执行必须记录：

- Phase identifier 和 version
- 开始和结束 timestamp
- 输入 artifacts 及其 checksums
- 输出 artifacts 及其 integrity markers
- 错误类型和错误消息（如适用）
- Token consumption metrics
- Agent instance identifier
- Retry count（如适用）

### 3.2 Compound Reliability 计算

多阶段 workflow 的 compound reliability 计算必须谨慎，避免误导性总结。我们推荐 **multidimensional reliability model**：

**Phase Success Rate (PSR)**：达到 completed 状态的 phases 与 attempted phases 的比率。衡量基本可执行性。

```
PSR = count(phases.completed) / count(phases.attempted)
```

**Phase Accuracy Rate (PAR)**：对于产生可验证输出的 phases，通过质量验证的输出与 completed phases 的比率。区分"completed"和"completed correctly"。

```
PAR = count(outputs.passing_validation) / count(phases.completed)
```

**End-to-End Success Rate (EESR)**：所有 phases 成功达到最终完成的 sessions 与 attempted sessions 的比率。这是最严格的指标，通常值最低。

```
EESR = count(sessions.all_phases_successful) / count(sessions.attempted)
```

**Degraded Completion Rate (DCR)**：以一个或多个 phases 处于 degraded 状态完成的 sessions。识别传统指标忽略的"impaired success"。

```
DCR = count(sessions.any_phase_degraded) / count(sessions.attempted)
```

**Critical Failure Rate (CFR)**：因不可恢复失败而终止的 sessions（而非 graceful degradation 或用户取消）。

```
CFR = count(sessions.unrecoverable_failure) / count(sessions.attempted)
```

**避免误导性指标**：简单的端到端成功率具有误导性，因为它们混合了不同的失败模式。在 phase 1 失败的 workflow 与在 phase 5 失败的 workflow 具有根本不同的特征。我们推荐将可靠性呈现为 **reliability profile**，显示 per-phase success rates，而非单一 aggregate number。

### 3.3 Trust Consistency Model

对于 RT 类系统，用户可能在初始 session 后提出 follow-up questions，trust consistency 要求：

**状态协调**：当用户重新访问 session 时，系统必须展示与产生原始答案相同的 reasoning path。任何偏差必须标记为潜在的 consistency violation。

**溯源追踪**：Workflow 中的每个结论必须可追溯到其 source artifacts 和 agent outputs。用户应能通过检查中间状态来审计任何答案。

**置信度校准**：Agent outputs 应包含置信度指标，允许用户理解可靠性。Degraded agents 或不完整 research 应将 uncertainty 传播到最终结论。

---

## 4. Partial Failure Playbook

### 4.1 故障分类

我们区分三类需要不同处理的系统状态：

**User-Visible Failures** 是直接影响用户体验或可能产生可操作错误输出的状态。示例包括：带错误消息的 complete session termination、incorrect final conclusions，或误导性置信度指标。User-visible failures 需要立即通知，可能还需要 compensation 机制。

**Silent Degradation** 指系统继续产生输出但质量低于可接受阈值的状态。示例包括：agents 产生不完整 research、summaries 缺少关键上下文，或不符合实际可靠性的置信度水平。Silent degradation 需要通过 validation 检测并主动 alerting。

**Internal-Only Failures** 是发生在 workflow 内但在用户影响之前自动恢复的错误。示例包括：with successful retry 的 transient network timeouts、with eventual success 的 redundant tool calls，或 resolve 的 temporary resource constraints。Internal failures 应记录用于 diagnostics，但不需要用户通知。

### 4.2 Degraded Agent 处理

当 agent 表现出 degraded performance（超时率高于阈值、输出质量低于验证阈值、或资源消耗异常）时，推荐的策略是 graduated response：

**Level 1 - Warning**：Agent 继续执行，但事件被记录用于 pattern analysis。如果 degradation across multiple turns 持续存在，升级到 Level 2。

**Level 2 - Mitigation**：减少 agent 的责任范围。限制其可自主做出的决策类型。增加其输出的验证频率。考虑分配额外的时间或计算预算。

**Level 3 - Isolation**：继续将 agent 用于非关键子任务，但将 consequential decisions 路由到验证 agents 或 human review。Degraded agent 实际上是隔离的，而非完全移除。

**Level 4 - Replacement**：如果 degradation 是 persistent and severe，用替代实例替换 agent。保留 agent 的 checkpoint state 用于 post-mortem analysis。

### 4.3 Missing Research 处理

当 agent research 返回不足或无相关结果时：

**检测**：监控低 result-count returns、基于稀疏证据的高置信度声明，或当声明无法验证时的 validation failures。

**响应策略**：

1. 扩展搜索范围（更广泛的查询、替代数据源）
2. 降低受影响声明的置信度校准
3. 在用户面向输出中明确标记 limitations
4. 考虑 fallback 到缓存的历史结果（如可用且已验证）

### 4.4 Partial Summary 处理

当 agent 产生不完整或缺少关键上下文的 summary 时：

**检测**：将 summary 与 source artifacts 比较。使用 validation agents 检查 critical points 的 coverage。

**响应策略**：

1. 识别特定 gaps（missing sources、incomplete reasoning chains、unverified claims）
2. 尝试针对 gaps 进行 targeted re-research
3. 如果 gaps 无法填补，产生带有明确 limitations 的"partial summary"
4. 永不将不完整的 summaries 呈现为完整

### 4.5 Stream Disconnection 处理

当 SSE streams 断开连接时：

**立即恢复**：客户端应尝试以指数退避进行重新连接。重新连接请求必须包含 `Last-Event-ID` header 以启用 server-side catch-up。

**Server-Side Catch-Up**：服务器必须维护事件缓冲区（通常为最后 5-10 个事件）以服务 catch-up requests。超出缓冲区的 events 需要 fresh execution。

**客户端状态协调**：重新连接时，客户端必须协调服务器状态与本地状态。任何在断开连接期间收到的事件应在恢复正常流式传输之前按顺序处理。

**超时处理**：如果最大重试次数后重新连接失败，session 应标记为手动 resume，通过 checkpoint 进行完整状态重建。

---

## 5. Resume / Replay Design Implications

### 5.1 状态边界设计

Resume 的基本设计问题是：什么构成一个可 resume 的单元？我们推荐 **phase-aligned boundaries**，其中每个 phase 设计为 idempotent、reentrant unit。

**幂等性**：使用相同输入重新执行 phase 必须产生相同的输出。这需要仔细处理 non-deterministic 元素（timestamps、random seeds、external API variations）。

**可重入性**：如果 phase 在 mid-execution 中被中断，必须能够从中断点恢复而非从头重启。这需要 phase 内的细粒度 checkpointing。

### 5.2 必须持久化的中间 Artifacts

为有效 resume，每个 phase boundary 必须持久化以下 artifacts：

**Checkpoint Data**：

- Complete workflow state machine position
- 所有 variable bindings 和 context
- Session configuration 和 parameters
- Agent instance identifiers

**Input Artifacts**：

- 上游 phase outputs 的 references
- 为此 phase 获取的 external data
- 用户提供的 context 和 constraints

**Output Artifacts**：

- Final outputs（summaries、conclusions、artifacts）
- Intermediate working state（如 resume 需要从 mid-phase 重启）
- Validation results 和 confidence scores

**Metadata**：

- Phase start/end timestamps
- Token consumption
- Error logs（如有）
- Retry counts

### 5.3 Replay vs. Resume

**Replay** 涉及从 checkpoint 重新执行，使用相同或等效的输入。当失败是 internal（例如 crash）且输入仍然有效时，这很合适。Replay 可能因 LLM non-determinism 产生不同输出，必须通过 output reconciliation 处理。

**Resume** 涉及使用保留的中间状态从确切中断点继续。这更高效，但需要更复杂的状态管理。当失败是 external（例如 network timeout）且 agent 的 working state 可以保留时，Resume 是合适的。

### 5.4 SSE Persisted Catch-Up 最佳实践

基于 SSE 规范和 agent workflow 要求：

**事件缓冲**：服务器必须维护带 sequence IDs 的 events ring buffer。缓冲区大小应容纳预期的重新连接延迟（通常为 30-60 秒的事件）。

**Last-Event-ID 协议**：所有事件消息必须包含递增 IDs。客户端必须跟踪最后收到的 ID，并在重新连接时通过 `Last-Event-ID` header 发送。

**Catch-Up 响应**：在收到带有 `Last-Event-ID` 的重新连接后，服务器应发送所有 ID 大于指定值的缓冲事件，然后发送带有 recommended reconnection interval 的 `retry` comment。

**去重**：事件在 catch-up 期间可能多次传递。客户端必须通过 event ID 去重。

**排序保证**：事件必须按 ID 顺序传递。ID 中的 gaps 表示无法恢复的 missing events。

---

## 6. Recommended Metrics and Dashboards

### 6.1 Ops Dashboard 的顶级信号

对于 RT 类系统，以下信号提供最高的 operational value：

**1. Session Completion Rate (SCR)**：达到 completed 状态的 sessions 百分比。这是主要健康指标。

**2. Phase-Level Success Rate**：Per-phase success rate，识别特定 workflow stages 中的 systematic failures。

**3. Average Time to Completion (TTC)**：平均 session 持续时间，按 success/failure outcomes 分段。Failed sessions 通常具有不同的 TTC profiles。

**4. Token Consumption Rate**：每个 session、每个 phase 的平均 tokens。Unexpected spikes 可能表示 circular reasoning 或 token waste。

**5. Error Rate by Type**：失败模式分布（timeout、validation failure、API error 等），实现 targeted fixes。

**6. Degraded Session Rate**：以 degraded 状态完成的 sessions，表示被传统指标隐藏的 impaired success。

**7. Reconnect Frequency**：每个 session 的客户端 SSE reconnections。高频率表示不稳定性。

**8. Validation Pass Rate**：对于有 validation 的 phases，通过的百分比。低通过率表示质量问题。

**9. Agent Timeout Rate**：Individual agent calls 超过 timeout 阈值的实例。

**10. User Escalation Rate**：需要 human intervention 或 explicit user retry 的 sessions。

### 6.2 Dashboard 组织

Ops dashboard 应将指标组织为三个视图：

**Executive View**：高级 session completion rate、degraded session rate、用户满意度分数。按小时或天更新。

**Operational View**：Phase-level success rates、error distributions、token consumption trends、reconnect frequencies。实时更新。

**Diagnostic View**：详细的 session traces、individual agent call latencies、详细 error logs。按需更新，用于事件调查。

---

## 7. Recommended Test Matrix for RT

### 7.1 Execution-Based Evaluation 方法

Execution-based evaluation 让 agents 通过 realistic workflows 运行，并测量 actual outcomes，而非依赖静态基准。对于 RT，我们推荐：

**Realistic Task Design**：评估任务应反映实际的 RT use cases，具有 multi-step reasoning、tool integration 和可验证的 conclusions。不能反映生产模式的 synthetic tasks 具有误导性。

**可验证的 Outcomes**：每个评估任务必须有可验证的 expected outcome。可以多种方式"完成"的 open-ended tasks 难以可靠评估。

**综合指标**：为每次评估运行收集 accuracy、runtime、tool call counts、token consumption 和 error types。

### 7.2 推荐测试矩阵

| Test Category | Test Case | Success Criteria |
|--------------|-----------|-----------------|
| **Phase Reliability** | Single phase executes successfully | Phase reaches completed state with valid output |
| | Single phase with degraded input handles gracefully | Phase completes with appropriate warning |
| | Phase timeout triggers retry | Retry succeeds within budget |
| | Phase validation failure triggers fallback | Fallback produces acceptable output |
| **Multi-Phase Reliability** | Sequential phases execute with valid inter-phase data transfer | All phases complete; output is coherent |
| | Upstream failure doesn't cascade to downstream | Failed phase is isolated; downstream receives error signal |
| | Phase recovery after checkpoint resume | Resume completes within acceptable latency |
| **Degraded Agent** | Agent timeout handling | Timeout detected; retry or fallback activates |
| | Agent producing low-quality output | Quality degradation detected; mitigation activates |
| | Agent replacement mid-session | New agent initializes correctly; session continues |
| **SSE Streaming** | Client disconnect and reconnect | Reconnection succeeds; catch-up delivers missed events |
| | Server-side event buffering | Events preserved for reconnection window |
| | Reconnection with Last-Event-ID | Server delivers only missed events |
| **User Interaction** | Session resume after browser close | Full state reconstruction; user continues seamlessly |
| | Follow-up question after session completion | Context preserved; answer consistent with session |
| **Error Handling** | Network timeout recovery | Retry with backoff succeeds |
| | API error handling | Error classified correctly; appropriate response |
| | Unrecoverable failure handling | Graceful degradation; user notification |

### 7.3 RT 最优先的 5 个 Reliability Tests

基于生产中的 impact 和 occurrence likelihood：

**Priority 1: Phase Timeout and Retry**

测试超过 timeout 阈值的 individual agent calls 是否正确重试并带有指数退避，且 retry budgets 是否被遵守。这是生产中最常见的失败模式。

**Priority 2: SSE Reconnect and Catch-Up**

测试完整的重新连接流程：客户端断开连接、带 Last-Event-ID 的重新连接、服务器传递缓冲 events、客户端协调状态。验证无重复 events 且顺序正确。

**Priority 3: Checkpoint Resume**

测试从最后一个 checkpoint 恢复 mid-session workflow。验证状态正确重建、中间 artifacts 可用，且执行继续而无重复。

**Priority 4: Degraded Agent Fallback**

测试产生 degraded outputs 的 agents 是否通过 validation 检测到，且 fallback 机制是否产生可接受的替代 outputs。

**Priority 5: Silent Degradation Detection**

测试不完整的 research 或 partial summaries 是否被检测并标记，而非呈现为完整。验证 user-visible warnings 是否适当显示。

---

## 8. Recommended Minimum Design for RT

### 8.1 架构组件

最小可行的可靠 RT 系统需要：

**Phase Manager**：使用明确的 phase boundaries 编排 workflow execution。维护 phase state machine 和 transitions。在每个 boundary 触发 checkpoints。

**Checkpoint Store**：Checkpoint data、input/output artifacts 和 metadata 的持久化存储。必须支持 atomic writes 和高 durability。

**Agent Pool**：管理带有 health monitoring 的 agent instances。支持 degraded agent detection、isolation 和 replacement。维护 agent versioning 以实现可重现性。

**Validation Layer**：为每个 phase output 运行 validation checks 以检测 degradation。产生 confidence scores 和 validation reports。

**SSE Manager**：处理带 buffering、ID assignment 和 reconnect 支持的 server-side event streaming。与 checkpoint store 集成以实现 event persistence。

**Observability Layer**：收集 metrics、traces 和 logs。为 executive、operational 和 diagnostic 视图提供 dashboards。

### 8.2 Phase-by-Phase Failure Taxonomy

| Phase | Potential Failures | Detection | Response |
|-------|-------------------|-----------|----------|
| **Init** | Invalid session parameters, missing context | Input validation | Fail fast with clear error |
| **Research** | Timeout, no results, sparse results | Result count check, confidence calibration | Expand scope, flag limitations |
| **Analysis** | Reasoning errors, circular logic | Validation agent, output check | Retry with expanded context |
| **Synthesis** | Incomplete summary, missing key points | Coverage validation | Targeted re-research |
| **Verification** | Claims not verifiable, contradictions | Cross-reference check | Flag inconsistencies |
| **Delivery** | Stream disconnect, client timeout | SSE heartbeat, reconnect protocol | Catch-up, state reconciliation |

### 8.3 错误类别和处理

**Transient Errors**（network timeouts、rate limits、temporary unavailability）：

- Retry with exponential backoff
- 每个 phase 的最大 retry budget
- 如可用且有效则 Fallback to cached results

**Permanent Errors**（invalid inputs、unsupported operations、authentication failures）：

- 用明确的错误分类使 phase 失败
- 未经用户干预不重试
- 传播错误信号到 downstream phases

**Degraded States**（low-confidence outputs、incomplete research、validation near-misses）：

- 带有 warning flags 完成 phase
- 产生 reduced confidence 的输出
- 如果 confidence below threshold 则路由进行 potential human review

---

## 9. Anti-Patterns

### 9.1 Reliability Anti-Patterns

**Single-Point End-to-End Success Metric**：仅报告"成功完成的 sessions 百分比"会隐藏失败性质。在 phase 1 失败的 session 与在 phase 5 失败的有不同特征。始终报告 phase-level metrics。

**Unbounded Retries**：无限重试而不设预算会导致资源耗尽和 cascade failures。每次 retry 必须有最大 count 和 exponential backoff。

**Silent Failures**：在 detectable errors 后继续执行而不记录或用户通知会产生难以调试的不一致状态。除非证明无害，否则错误应该是 explicit。

**Tight Coupling**：假设所有 upstream phases 成功完成的 agents 或 phases 会不可预测地传播错误。实现明确的错误信号和条件执行路径。

**Missing Checkpoints**：仅在 session boundaries 保存状态会造成大的恢复粒度。在每个 phase boundary 的 checkpoints 限制失败时丢失的工作。

### 9.2 Streaming Anti-Patterns

**No Event IDs**：不为 SSE events 分配递增 IDs 使得重新连接无法避免重复或 gaps。

**Unbounded Event Buffer**：无限缓冲 events 会造成内存压力。Buffer 应根据预期的重新连接窗口调整大小。

**No Ordering Guarantee**：在 catch-up 期间无序传递 events 会造成状态不一致。Events 必须在传递前按 ID 排序。

**Missing Heartbeats**：仅发送实际 events 而不发送 periodic heartbeats 会导致客户端将沉默解释为断开连接。包括 periodic comments 或 ping events。

### 9.3 Tool/Agent Design Anti-Patterns

**Opaque Errors**：返回 error codes 或 stack traces 而无 actionable guidance。错误消息必须帮助 agents self-correct。

**Excessive Context**：返回所有可用数据而不进行过滤。Agents 变得不知所措并错过关键信号。实现 pagination、filtering 和 truncation 的合理默认值。

**Ambiguous Tool Names**：边界不清或功能重叠的工具。使用 namespacing 来划分工具族。

**Missing Validation**：接受任何输入而不验证。实现带有明确参数名称的严格输入 schemas。

---

## 10. Open Questions

### 10.1 Compound Reliability 语义

"Compound reliability"——如何将 phase-level reliabilities 组合成 session-level reliability——仍然是一个开放的研究问题。简单乘法（PSR₁ × PSR₂ × ... × PSRₙ）假设了 phases 共享 context 或下游 phases 依赖上游质量时不成立的独立性。需要新的 compositional theories。

### 10.2 非确定性下的 Trust Consistency

LLMs 本质上是非确定性的，意味着相同的输入可能在不同执行中产生不同的输出。对于用户可能提出 follow-up questions 的 RT 类系统，维持 trust consistency 需要理解何时差异是可接受的（不同但同样有效的结论）vs. 有问题的（来自相同上下文的矛盾结论）。

### 10.3 Degraded State Thresholds

当前 degraded detection 依赖 heuristics（validation scores below threshold、confidence below cutoff）。建立平衡 false positives（标记可接受的输出）against false negatives（错过 degraded outputs）的原则性 thresholds 需要更多研究和生产数据。

### 10.4 Resume Granularity

Checkpoint-based resume 的最佳粒度——phase boundaries vs. sub-phase checkpoints vs. continuous state capture——涉及存储成本、恢复延迟和实现复杂性之间的权衡。正确的平衡取决于 workflow characteristics 和 failure frequency。

### 10.5 Evaluation Methodology

像 GAIA 和 SWE-bench 这样的静态基准提供有价值的 signal，但不能完全反映生产 RT workloads。开发在 realistic multi-step workflows 中准确评估可靠性的 execution-based evaluation 方法论仍然具有挑战性。

---

## 11. Source List

| # | Source | Reliability |
|---|--------|-------------|
| 1 | SSE Protocol Overview - InfoQ | Medium |
| 2 | JavaScript SSE Best Practices | Medium |
| 3 | SSE Reconnection Mechanisms | Medium |
| 4 | SSE 断线重连技术要点 | Medium |
| 5 | Apple HLS Error Handling Best Practices - WWDC17 | High |
| 6 | Spring MVC SSE Implementation | Medium |
| 7 | JavaScript Server-Sent Events - PHP.cn | Medium |
| 8 | SSE Event Stream Implementation - 掘金 | Medium |
| 9 | Coze API Streaming Implementation | Medium |
| 10 | COCO Framework - arXiv:2508.13815 | High |
| 11 | MASFT Paper - arXiv:2503.13657 | High |
| 12 | Why Do Multi-Agent LLM Systems Fail - 36kr | Medium |
| 13 | Multi-Agent Failure Analysis - 网易 | Medium |
| 14 | Berkeley Multi-Agent Research - 澎湃新闻 | Medium |
| 15 | Anthropic Tool Writing Guide | High |
| 16 | Anthropic Claude 3.7 Technical Summary | High |
| 17 | Google A2A Protocol Overview | Medium |
| 18 | Google A2A Deep Dive - CSDN | Medium |
| 19 | A2A Protocol Technical Analysis - 掘金 | Medium |
| 20 | MCP Protocol Getting Started | High |
| 21 | OpenAI Responses API - CSDN | Medium |
| 22 | OpenAI Agent SDK Overview | Medium |
| 23 | OpenAI Agents SDK - 腾讯云 | Medium |
| 24 | GAIA Benchmark - CSDN | Medium |
| 25 | GAIA Benchmark Analysis - CSDN | Medium |
| 26 | SWE-bench Verified - OpenAI | Medium |
| 27 | SWE-bench Overview - C114 | Medium |
| 28 | AgentBench - ResearchGate | High |
| 29 | AgentBench - CSDN | Medium |
| 30 | Multi-Agent FEA Reliability - arXiv:2408.13406 | High |
| 31 | OpenAI Agent SDK Errors - OpenAI Community | Medium |
| 32 | Mid-Stream Error Handling - OpenAI Community | Medium |

---

## Appendix A: SSE Reconnection Protocol Reference

### Client-Side Reconnection Flow

```
1. Detect disconnection (error event or heartbeat timeout)
2. Store last received event ID
3. Attempt reconnection with exponential backoff (initial: 1s, max: 30s)
4. On connection established, send Last-Event-ID header
5. Receive catch-up events (IDs > Last-Event-ID)
6. Process events in ID order, deduplicating by ID
7. Resume normal streaming after catch-up complete
```

### Server-Side Event Buffer

```
Ring buffer size: 100 events (configurable)
Event ID: incrementing integer, start from 1
Buffer retention: events with IDs > (current - buffer_size)
```

### Event Format

```
id: <incrementing_id>
event: message
data: {"type": "...", "content": "..."}

retry: 5000
```

---

## Appendix B: A2A Task Lifecycle Reference

```
                    ┌─────────────┐
                    │ submitted   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   working   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐     │     ┌──────▼──────┐
       │input-required│     │     │  completed  │
       └─────────────┘     │     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    failed   │
                    └─────────────┘
```

---

**报告生成日期**：2026-03-18

**研究方法**：同行评审论文、官方技术报告、官方工程文档

**作者**：MiniMax Agent

---
