# 长会话 LLM Decision Workflow 的 Reliability、Partial Failure、Resume、Reconnect 与可观测性设计研究

## Executive Summary

面向类似 RT（多阶段 session + SSE streaming + agent 可能 timeout/degraded/partial completion + 支持 resume/follow-up + ops dashboard）的系统，可靠性设计的核心不是“每一步都不失败”，而是**在不可避免的失败与不确定性下，仍能提供可恢复（recoverable）、可解释（auditable）、对用户一致可信（trust-consistent）的体验**。这一目标与传统高吞吐分布式系统不同，更接近“长事务/工作流编排 + 事件溯源 + 可重放”的问题空间：用**持久化事件历史**来实现“断点续跑/重放/审计”，再用**显式降级策略**把不可恢复失败尽量转化为“可接受的部分完成 + 可继续推进”。citeturn6view0turn6view2turn7view1turn15view3

本研究给出一套可落地的设计框架：

- **Phase reliability**不是“phase 成功/失败”这么粗，而应定义为：**在给定前置条件与时间预算内，phase 能产出其 contract 约定的“可用产物”（含可降级产物）并正确记录状态**。记录必须是事件化、可审计、可回放的（类似 Temporal 的 Event History / Durable Functions 的 event sourcing + replay）。citeturn6view0turn7view1turn7view0  
- **Compound reliability**不要直接乘法（P=∏Pi）：这会系统性误导，因为步骤之间通常不独立、且存在重试/补偿/降级路径。更稳健的做法是把“端到端用户成功”定义为主 SLI，然后用**按路径的吸收概率（含重试/降级/补偿）**或直接用**历史回放日志的经验估计**计算；phase 指标用于定位与归因，而不是用来“拼”总体可靠性。citeturn9view0turn6view3turn21view0turn15view3  
- **Partial failure handling**应分为三类：user-visible failure、silent degradation、internal-only failure，并对每一类规定：可见呈现、可恢复动作、与审计记录。工作流补偿（Saga）是“多阶段 partial completion”的经典模型：把长事务拆为可独立提交的步骤，并为每一步定义补偿动作，允许在中途失败时“修正部分执行”。citeturn15view3turn14view0  
- **Resume / replay**的正确边界是：把 LLM 相关推理视为“非确定外部依赖”，将其结果当作 Activity/Task 输出写入事件历史；Orchestrator/Workflow 逻辑必须尽量确定性，依赖 replay 复原状态。Durable Functions 与 Temporal 都明确依赖 replay，且要求 orchestrator deterministic。citeturn7view0turn6view1turn6view2turn7view1  
- **SSE reconnect/catch-up**不能只靠“客户端自动重连”。最佳实践是：对每条流式事件设置单调递增的 `id`，客户端断线后会携带 `Last-Event-ID` 头重建连接；服务端必须能从持久化的输出事件日志中“补发缺失段”。WHATWG SSE 标准明确了 `Last-Event-ID`、`retry`、注释 keepalive（`:`）与 204 停止重连等机制。citeturn17view0turn17view1turn5view3turn17view3  
- **Ops dashboard**最值得监控的不是“模型 TPS”，而是：端到端成功率、可恢复失败率、用户可见中断率、resume 成功率、重放/幂等错误、以及“降级占比与降级后满意度/验证通过率”。分布式追踪（Dapper/W3C Trace Context/OpenTelemetry）应作为跨服务关联的基础。citeturn15view1turn8view3turn16view0turn16view2  
- **测试矩阵**要优先补“会破坏信任一致性”的场景：断线重连重复/丢失、resume 后内容漂移、部分完成未标注、工具调用重放造成副作用等。StableToolBench 的研究指出：真实 API 状态变化会导致评测不稳定，因此需要缓存/虚拟 API 服务器来获得可复现的执行型评测；这类思想同样适用于 RT 的回放与回归测试体系。citeturn15view6turn15view5turn15view4  

## Verified Findings

### 长任务可靠执行通常依赖“事件历史 + 可重放”

- Temporal 明确以**append-only Event History**跟踪 Workflow Execution 进展；Event History 的持久化既用于调试审计，也用于 Durable Execution（崩溃后恢复并继续推进）。citeturn6view0turn6view2  
- Temporal 的 replay 机制要求 Workflow **deterministic**：Worker 通过重放 Event History 再运行 Workflow 代码，生成的 Commands 必须与历史中的 Commands 序列一致，否则 replay 无法继续；因此非确定外部交互（例如 LLM API、数据库、HTTP）应放在 Activities 中，由重试策略与超时控制其失败姿态。citeturn6view1turn6view3turn8view0turn8view1  
- Azure Durable Functions（Durable Task）同样使用 **event sourcing + replay** 来重建 orchestrator 状态，并明确要求 orchestrator 代码 deterministic；其 Activities 被保证 **at-least-once**，因此需要业务层做幂等。citeturn7view1turn7view0  

结论：RT 类系统若要实现强 resume/replay，应把“工作流状态机（确定性）”与“外部调用/LLM 推理（非确定性）”分层，非确定结果必须持久化为事件输出，允许回放重建。citeturn6view1turn7view0turn6view0  

### Partial failure 的经典模型是“可提交步骤 + 补偿”（Saga）

Sagas 论文将长生命周期事务拆为一系列可交错执行的事务；系统保证要么所有事务都成功完成，要么执行补偿事务来修正部分执行造成的中间状态。citeturn15view3  

结论：RT 的多阶段 agent workflow 应显式为每一阶段定义：提交语义（commit）、补偿语义（compensate）、以及可接受的降级产物（degraded artifact），而不是只用“失败就重试/失败就终止”。citeturn15view3turn21view0  

### SSE 断线重连机制是标准化的，但“补发”需要服务端配合持久化

WHATWG SSE 标准关键点：

- 客户端连接断开会自动重连；服务端可通过 HTTP 204 让客户端停止重连。citeturn17view3  
- 服务端发送的事件可带 `id` 字段；客户端维护 last event id，并在重连时携带 `Last-Event-ID` 请求头，供服务端从该点继续发送。citeturn4view0turn5view3  
- `retry` 字段可由服务端指定重连间隔（毫秒）。citeturn17view1  
- 标准也给出工程建议：为应对代理超时，可定期发送以 `:` 开头的注释行作为 keepalive（例如每 15 秒）。citeturn17view0  

结论：RT 若“只做 SSE streaming 不做输出事件持久化”，那断线重连只能做到“重新开一条流”，无法保证不丢不重，更无法保证 trust consistency。必须引入“persisted catch-up”。citeturn17view0turn5view3  

### 可观测性要以“跨服务关联 + 低开销常开”为前提

- Dapper 论文强调分布式追踪系统需要低开销、应用透明、可扩展，并指出监控应该常开，因为异常往往难以复现。citeturn15view1  
- W3C Trace Context 定义了 `traceparent`/`tracestate` 头用于跨服务传播 trace 上下文，保证 traces 不被打断。citeturn8view3turn1search6  
- OpenTelemetry 进一步在规范/概念层面定义 SpanContext、TraceId/SpanId、以及语义约定，支持 traces/metrics/logs 的相关联。citeturn16view0turn16view1turn16view2  

结论：RT 的 ops dashboard 必须能把一次 session 的全链路（编排器、模型调用、工具调用、流式输出、持久化、resume）关联到同一 trace/span 树上，否则“长会话 + partial failure”会让排障不可控。citeturn15view1turn16view1turn8view3  

---

## Reliability Model

### 定义与术语

借用 SRE 框架，先把“可靠性”从抽象变成可度量目标：SLI（指标）是对服务水平的量化度量；SLO 是该指标的目标值或范围，并且应明确测量方法与有效条件。citeturn9view0turn9view1  

对 RT，这里的“服务水平”应面向**端到端用户体验**：用户是否拿到“可用且可信”的 decision output，并且在断线、超时、降级、resume 后仍保持一致性（不会悄悄改口、不解释地漂移）。SRE 也明确：选择合适指标能驱动正确行动，并避免用户对系统产生“虚假的稳定性假设”。citeturn9view0  

### 问题一：对 RT 这种系统，phase reliability 应如何定义和记录？

#### Phase 的最小 contract（建议）

RT 的 phase 不应只定义“成功/失败”，而应定义**可验证的 contract**，至少包含：

1) **输入边界**：phase 读取哪些已提交状态（state snapshot / event history），哪些是外部不可重放输入（例如新到的用户消息）。  
2) **输出产物**：必须产生哪些 artifact（可为降级版本），以及 artifact 的 schema/version。  
3) **可接受的终态集合**：`SUCCESS` / `DEGRADED_SUCCESS` / `NEEDS_USER_INPUT` / `RETRYABLE_FAILURE` / `TERMINAL_FAILURE`。  
4) **时间预算与心跳**：phase 的 SLA/SLO 不能只是总时延，长任务必须支持 heartbeats 或进度事件（Step Functions 对长任务建议设置 timeout 与 heartbeat；Temporal 也强调超时与重试协同）。citeturn8view0turn19view2turn21view0  

#### 记录方式：事件化、可回放、可审计

建议把 phase 记录为一组不可变事件（事件溯源思想），类似 Temporal Event History / Durable Functions event sourcing：

- `PhaseStarted(phase_id, phase_type, input_hash, deps, budget_ms, attempt)`  
- `PhaseArtifactCommitted(artifact_type, artifact_id, content_hash, schema_ver, quality_flags)`  
- `PhaseProgress(seq, percent, message)`（可选；同时馈送 SSE）  
- `PhaseEnded(outcome, error_class, error_code, user_visible, degraded_reason, retry_policy_applied)`  

Temporal 明确 Event History 既是可恢复状态来源，也是审计日志；Durable Functions 依赖 event sourcing + replay；两者共同点是：**状态不是“当前值”，而是“事件序列 + deterministic replay”得到的当前值**。citeturn6view0turn7view1turn7view0  

> 直接结论：RT 的 phase reliability 不是写在文档里的“我们会重试”，而是**从事件日志中可计算**：`P(outcome ∈ {SUCCESS, DEGRADED_SUCCESS, NEEDS_USER_INPUT} | phase executed)`，并且能按 error_class 归因。

### 问题二：compound reliability 应如何计算，才能既有价值又不误导？

#### 反例：简单乘法为什么误导

把总体成功率估为 `∏ P(phase_i_success)`隐含两条在 RT 中常不成立的假设：

- **独立性**：phase 失败往往相关（同一模型退化、同一网络抖动、同一外部 API 限流）。  
- **无恢复路径**：Temporal/Step Functions 这类系统的价值恰恰在重试、回放、补偿、redrive（从失败点继续）——这些机制会把“phase 失败”变成“系统仍成功”。citeturn6view3turn13view3turn15view3  

#### 推荐：以“端到端用户成功”为主 SLI，再分解归因

1) **先定义端到端 Success 的可检验条件**（建议最少包含）  
   - 最终输出存在且可解析（schema ok）  
   - 输出包含可信标注：哪些结论基于已完成 research，哪些是推断/缺失（防 silent degradation）  
   - 在断线重连/resume 后，用户已看到的内容不会“悄悄改写”（trust consistency）  
   - 如有工具调用副作用，保证幂等或可补偿（避免重放造成重复操作）citeturn18view0turn15view3turn7view1turn6view0  

2) **将工作流视为带吸收态的状态机/路径模型**  
   让每个 phase 有多个终态（成功/降级/需用户输入/可重试失败/不可恢复失败），并显式建模 retry、fallback、补偿（Saga），则 compound reliability 计算为：  
   - `R_total = P(absorb in SUCCESS or DEGRADED_SUCCESS within T)`  
   这个概率可以用两种方式得到：  
   - **经验估计**：直接从事件日志统计“session 最终吸收态”的频率（推荐，最不容易自欺）  
   - **路径分解**：按 error_class、retry_policy、fallback_policy 计算条件概率（用于解释与容量规划）citeturn9view0turn6view3turn21view0turn15view3  

3) **把乘法只用于“上界/下界推导”，不用于对外宣称**  
   在工程内可以把 `∏Pi`当作“假设独立且无恢复的悲观/乐观界”，但对产品与架构决策，它常会把团队带到错误方向：为了提升某个 phase 的 Pi 去做过度工程，而不是提升“可恢复成功率”。Google SRE 的经验反复强调：指标必须反映真实用户痛感，否则会引导错误权衡。citeturn9view2turn9view0  

---

## Partial Failure Playbook

本部分回答问题三，并给出**phase-by-phase failure taxonomy**（要求：区分 user-visible failure / silent degradation / internal-only failure）。

### Phase-by-phase failure taxonomy

下面按 RT 常见阶段划分（你可按实际实现拆/并），每条失败都标注“对用户可见性”与推荐处置。

| Phase | 典型失败模式 | 可见性分类 | 主要风险（对 recoverability / trust） | 检测信号（最小集合） | 推荐处置（要点） |
|---|---|---|---|---|---|
| Session 初始化（加载历史/权限/路由） | 历史状态缺失、版本不兼容、权限失败、路由到错误模型/策略 | user-visible 或 internal-only（若自动回退） | 错误上下文导致“答非所问”或内容漂移 | state load error、schema/version mismatch、trace 缺失 | 明确报错并请求重试/授权；版本不兼容需迁移层（类似 Durable/Temporal 强调版本与 deterministic replay 的一致性）citeturn7view2turn6view1turn7view0 |
| Plan / 分解 | planner 输出不完整、循环、策略选择错误 | **silent degradation** 为主 | 后续执行“看起来在做事但走偏”，用户难察觉 | plan quality flags、循环检测、重复步骤率 | 触发自检/反思/重规划；必要时降级为“请求澄清”而非继续胡跑（ReAct 强调 reasoning+acting 轨迹可解释并能处理异常）citeturn15view7 |
| 工具/研究调用（search/db/api） | timeout、限流、部分结果、返回 schema 变更 | internal-only（自动重试）→ silent degradation → user-visible | 不完整证据导致“结论过度自信” | tool latency、HTTP error、schema parse error、重试耗尽 | **优先降级策略**：标注缺失/不确定，给出继续补全的 resume 路径；对可副作用工具必须幂等/补偿（RFC 9110 强调非幂等请求不可盲重试）citeturn18view0turn15view3 |
| Agent 推理（LLM 调用） | 模型 timeout、服务端 error、输出截断、幻觉 | silent degradation 或 user-visible | 最影响信任：用户以为“全面完成”但其实缺失 | LLM finish_reason/长度上限触发、超时、质量评估失败 | 触发 degraded policy：产出“可用但受限”的结构化输出 + 清晰标注 + 可继续执行按钮；必要时分段执行并 checkpoint（Temporal/DF 的 durable 执行理念）citeturn6view2turn7view1 |
| Execution-based evaluation（运行/验证） | 测试环境不可用、外部 API 波动、结果不可复现 | internal-only 或 silent degradation | 评测不稳定会误判回归/提升 | evaluator flakiness、环境 hash 漂移 | 采用缓存/虚拟 API/固定环境快照（StableToolBench 提出虚拟 API server 与 caching 以提升评测稳定性）citeturn15view6turn15view4 |
| 输出组装（渲染/引用/结构化） | 引用丢失、格式错误、内容与证据不一致 | user-visible 或 **silent degradation** | “看起来完整但证据链断裂” | schema validator、引用完整率 | 输出必须“结构先行”：先发 outline/section headers，再填充；缺失引用必须显式降级标注 |
| SSE streaming | 断链、重复、乱序、末尾事件丢失、代理超时 | user-visible（卡住/中断）或 silent（丢段用户没发现） | 最典型的“信任事故”：用户看到的不是最终版本 / 或重复段 | SSE disconnect rate、Last-Event-ID gap、duplicate id | 在每个事件上使用单调 `id`，支持 `Last-Event-ID` catch-up；定期 `:` keepalive；`retry` 控制重连；必要时 204 停止并引导 resume（SSE 标准）citeturn17view0turn5view3turn17view1turn17view3 |
| Commit/持久化（产物、状态、审计日志） | 部分写入、写入成功但 ACK 丢失、幂等冲突 | internal-only → user-visible（resume 失败） | resume/replay 失效；用户看到的与系统记录不一致 | commit latency、写入幂等冲突、事件序列缺口 | 以 append-only 事件为准；提交要“先写后播”或“双写对账”；参考 Step Functions：若日志投递 best-effort，不可当作权威历史，需要写入可靠存储citeturn6view0turn13view2turn13view3 |
| Resume / follow-up | 从错误 checkpoint 恢复、重放触发副作用、版本漂移导致 replay 失败 | user-visible 或 silent degradation | “同一 session 前后矛盾”是致命体验 | resume success rate、replay deterministic error、side-effect duplication | 严格定义 resume 边界（见下节）；对外部动作必须幂等/补偿；版本管理避免 deterministic replay 破坏（Durable versioning 警告）citeturn7view2turn7view1turn18view0 |

### 问题三：degraded agents、missing research、partial summary、stream 断连的最佳处理策略

下面把四类问题拆开，给出**优先级顺序**与“用户呈现/后台策略/可恢复动作”。

#### Degraded agents（模型能力/延迟退化）

**目标：宁可显式降级，也不要 silent degradation。**

1) **先保结构化 contract**：输出必须保持可解析结构（sections/claims/evidence/status），把“质量下降”作为字段而不是藏在文字里。  
2) **降级阶梯（建议从轻到重）**  
   - A：换更快/更稳定的模型或减少推理深度（保持同一输出 schema）  
   - B：把长推理拆为多个 Activities/子任务并 checkpoint（Durable execution/replay 适配长任务）citeturn6view2turn7view1  
   - C：输出“已完成部分 + 未完成清单 + 继续执行入口”（DEGRADED_SUCCESS）  
   - D：需要用户输入（NEEDS_USER_INPUT）：请求用户缩小范围/提供资料  
3) **必须记录**：phase ended 时标注 degraded_reason（timeout、budget、dependency down 等），避免后续 resume 时“表面完成但其实没做”。（SRE 强调指标要反映真实用户体验与痛感，否则会误判健康）citeturn9view0turn9view2  

#### Missing research（工具调用失败/证据不足）

**原则：证据链不完整时，默认降低结论强度。**

- 若工具失败但仍能给出“框架/待验证假设”，输出中必须包含：  
  - 已验证事实（来源/时间/证据状态）  
  - 未完成项（缺失原因：timeout/权限/限流）  
  - 继续补全方式（resume token / 稍后重试）  
- 对工具调用要按“可重试”“不可重试”分类，并明确重试策略（Step Functions、Temporal 都把 retry policy 作为一等概念）。citeturn21view0turn6view3turn13view0  

#### Partial summary（中间总结不完整/质量不足）

**原则：partial summary 必须是“可逆的中间产物”，不能覆盖原始证据。**

- 把 summary 当作 artifact，带 `coverage`/`confidence`/`inputs_included` 元数据。  
- 任何后续推断若依赖 partial summary，必须知道它只覆盖了哪些输入。  
- 在 resume 时优先回到“原始 evidence artifacts”而不是只依赖 summary（避免误差积累）。这一点与 Temporal 的 replay 精神一致：真实推进依赖事件历史（真实发生了什么），而不是某次解释性的文本。citeturn6view0turn6view1  

#### Stream 断连（SSE）

**原则：断连是常态，必须工程化处理。**

- 每个 SSE event 都要有稳定 `id`，客户端断线后自动携带 `Last-Event-ID`；服务端必须支持从该 id 继续补发。citeturn5view3turn4view0  
- 通过 `retry:` 控制客户端重连节奏，避免雪崩；通过 `:` 注释 keepalive 避免代理超时。citeturn17view1turn17view0  
- 若服务端判断“不可能补发”（例如输出日志已回收），应停止无意义重连：可返回 204 让客户端停止重连，并引导用户走 resume（重新拉取已提交产物）。citeturn17view3  

---

## Resume / Replay Design Implications

本部分回答问题四，并把“resume 的状态边界/必须持久化的中间产物/重放副作用控制”说清楚。

### 问题四：resume 的状态边界应如何设计，哪些中间产物必须持久化？

#### 关键结论：把 RT 设计成“可重放工作流（deterministic orchestrator）+ 非确定活动（Activities）”

Temporal 与 Durable Functions 的共同工程结论是：**可靠续跑靠 replay**，而 replay 要求 orchestrator deterministic；外部不确定交互（LLM、HTTP、DB）必须以活动形式执行，并把结果写入事件历史。citeturn6view1turn7view0turn7view1  

因此，RT 的 resume 边界建议如下：

##### 边界一：Orchestrator state（必须可重放、可版本化）

- 工作流定义版本（workflow code version / schema version），否则会重放失败。Durable orchestration versioning 明确警告：移除旧代码路径会导致 deterministic replay failures。citeturn7view2turn6view1  
- Phase 状态机：当前 phase、attempt、budget、已完成 steps 索引  
- 去重信息：消息/操作的 idempotency keys（尤其跨 Continue-As-New / 新 run 的情况）  
  - Temporal 指出：Update ID 去重在 server 侧是“per Workflow run”，Continue-As-New 后需在 Workflow 代码层自行去重；Signals 也建议自带 idempotency key 做去重。citeturn20view0  

##### 边界二：Artifacts（必须持久化的中间产物清单）

建议按“恢复价值”分级：

**S 级（必须持久化，否则 resume 基本不可用）**  
1) **用户输入与系统输入快照**：每次用户 turn 的规范化表示（用于重跑/审计）。  
2) **工具调用请求与响应**（含失败响应）：否则你无法解释“为什么缺失/为什么这么做”。  
3) **已对用户可见的输出日志**（见下）：为 trust consistency 提供权威来源。  
4) **PhaseEnded 终态与原因**：区分 success/degraded/needs_input。  
上述与 Temporal 的 Event History “append-only + durable + audit”一致。citeturn6view0turn6view2turn13view2  

**A 级（强烈建议持久化，用于性能与一致性）**  
5) Planning/路线图（plan DAG）及其版本：便于解释与增量执行，而不是每次 resume 重规划导致漂移。  
6) 中间 summary / evidence index：但必须带覆盖信息（避免把 partial 当 complete）。  

**B 级（可选，主要为调试/评测）**  
7) token-level streaming deltas（量大）；可考虑做“分段 frame”或“最终文本 + 校验点 offsets”。  
8) 内部思考轨迹（如存在），通常不建议作为可靠性依赖项（更像 debug）。  

##### 边界三：输出与 SSE 的“权威来源”（trust consistency 的核心）

RT 必须区分三类“输出”：

1) **UI 流式输出（ephemeral）**：SSE 只是传输；断了可以重连，但它不是权威存档。citeturn17view0turn5view3  
2) **已提交输出（committed output）**：写入持久化输出日志/对象存储，带版本号与 hash。  
3) **最终产物（final artifact）**：例如“决策报告/行动清单”，以 committed output 的某个版本为基准生成。

最佳实践是：**先 commit，再 stream**（或至少做到“stream 的每个 chunk 都对应一个可重放事件 id，且后台已落盘/可补发”）。否则断线重连极易出现：用户看到了但系统没记住，或系统记住了但用户没看到。citeturn6view0turn17view0turn5view3  

#### 重放与外部副作用：必须幂等或可补偿

- Durable Functions Activities 明确 at-least-once，因此要幂等。citeturn7view1  
- RFC 9110 指出非幂等方法（如 POST）不应自动重试，除非有办法确认请求语义实际上幂等，或能检测原请求是否生效。citeturn18view0  
- Saga 模型为“已产生副作用但流程失败”提供补偿语义。citeturn15view3  

对 RT：  
- 任何具有外部副作用的工具（发邮件、下单、写 DB）必须：  
  - 要么使用幂等键（idempotency key）实现 exactly-once 效果  
  - 要么定义补偿动作（undo/cancel），并把补偿也作为 phase 的一部分记录  

---

## Recommended Metrics and Dashboards

本部分回答问题五（5–10 个信号）。

可观测性推荐遵循三条硬要求：

1) **跨服务关联**：使用 W3C Trace Context + OpenTelemetry，把一次 session 的 orchestrator、LLM calls、tool calls、SSE stream、持久化写入关联在同一 trace 下。citeturn8view3turn16view1turn16view0  
2) **语义化字段一致**：使用 OpenTelemetry semantic conventions，避免不同团队各自命名导致 dashboard 不可用。citeturn16view2  
3) **常开且低开销**：Dapper 强调低 overhead 与常开监控的重要性。citeturn15view1  

### 问题五：ops dashboard 最值得监控的 5–10 个信号

以下信号按“直接反映 recoverability 与信任一致性”的优先级排序：

1) **End-to-end User Success Rate（端到端成功率）**  
   定义为：session 最终吸收态 ∈ {SUCCESS, DEGRADED_SUCCESS} 的比例（按 SLO 窗口统计）。这是 compound reliability 的主指标（不要用 ∏Pi 代替）。citeturn9view0turn6view0  

2) **User-visible Interruption Rate（用户可见中断率）**  
   例如：SSE 中断导致 UI 停止增长、或明确报错弹窗的比例。与 trust 直接相关。citeturn17view3turn17view0  

3) **Resume Success Rate + Resume Latency（续跑成功率/耗时）**  
   续跑必须能在有限时间内恢复到一致状态并继续推进；否则“支持 resume”就是摆设。citeturn6view2turn13view3turn5view3  

4) **Silent Degradation Rate（静默降级占比）**  
   定义为：内部质量评估/覆盖率指标触发降级，但 UI 未显式标注的比例（理想应逼近 0）。其危害大于 user-visible failure。citeturn9view2turn15view6  

5) **Phase Outcome Distribution（各 phase 终态分布）**  
   SUCCESS / DEGRADED_SUCCESS / NEEDS_USER_INPUT / RETRYABLE_FAILURE / TERMINAL_FAILURE。用于快速判断“系统在靠重试硬扛还是在优雅降级”。citeturn6view3turn21view0  

6) **Retry / Redrive Pressure（重试/重驱动压力）**  
   - Temporal：Activity retries、timeout、heartbeat timeout 等；citeturn6view3turn8view1  
   - Step Functions：Retry/Catch、redrive 从失败点继续且保留成功步历史；citeturn21view0turn13view3  
   指标包括：重试次数分布、重试耗尽率、redrive 触发率。

7) **SSE Catch-up Health（断线补发健康度）**  
   核心信号：`Last-Event-ID gap`（客户端 last id 与服务端最新 id 的差）、重复事件率（duplicate ids）、补发耗时。SSE 标准的 `id`/`Last-Event-ID`/`retry` 为此提供协议基础。citeturn5view3turn17view1turn17view0  

8) **Side-effect Safety Incidents（副作用安全事件）**  
   指“重放/重试导致外部副作用重复或未补偿”的事件数，必须归零为长期目标。RFC 9110 对非幂等自动重试的警告可作为制度依据。citeturn18view0turn15view3  

9) **Evidence Coverage / Verification Pass Rate（证据覆盖/验证通过率）**  
   面向 decision workflow，输出应尽量“可执行验证”。执行型评测基准（SWE-bench/WebArena）强调通过真实测试/环境交互来判定 success；StableToolBench 强调可复现性。citeturn15view4turn15view5turn15view6  

---

## Recommended Test Matrix for RT

本部分回答问题六，并给出“RT 当前最该优先补的 5 个 reliability tests”。

### 评测与回归的原则：以“可执行/可重放”的测试为主

- SWE-bench 把任务定义为“生成补丁并通过真实测试”，强调可验证性与真实环境约束。citeturn15view4  
- WebArena 将 agent 放入可复现的真实 web 环境，以任务完成的 functional correctness 衡量；并指出复杂任务的端到端成功率显著低于人类，说明长期任务可靠执行本身很难。citeturn15view5  
- StableToolBench 明确指出：真实在线 API 不稳定会导致评测不可复现，提出虚拟 API server 与缓存来稳定评测。citeturn15view6  

对 RT：可靠性测试矩阵必须覆盖“外部依赖波动 + 长会话断线 + resume 重放 + 降级”四个维度，而不是只测单次回答正确率。

### 问题六：最值得补的测试矩阵是什么？

建议构建一个 4 维矩阵（每一维都必须覆盖）：

1) **阶段维度**：Plan / Tool / LLM / Eval / Stream / Commit / Resume  
2) **故障注入维度**：timeout、5xx、限流、部分返回、schema 变更、断网/丢包、存储写失败、重复请求  
3) **恢复策略维度**：retry、fallback model、degraded success、ask user、compensate、redrive/resume  
4) **一致性断言维度**：  
   - 输出结构一致（schema）  
   - 已可见内容不被无声改写（输出日志 hash + version）  
   - 外部副作用 exactly-once 或补偿完成  
   - 事件历史可回放到同一 committed 状态（determinism）citeturn6view1turn7view0turn18view0turn15view3  

### RT 当前最该优先补的 5 个 reliability tests（强优先级）

1) **SSE 断线重连补发一致性测试（must-have）**  
   - 在流式输出中随机断线 N 次  
   - 客户端使用 `Last-Event-ID` 重连  
   - 断言：最终 UI 文本与 committed output 完全一致；无重复/无丢段  
   依据：SSE 标准的 `id`/`Last-Event-ID`/`retry`/keepalive。citeturn5view3turn17view1turn17view0  

2) **工具调用超时 + 降级输出 + 后续 resume 补全测试**  
   - 强制 tool timeout  
   - 断言：系统返回 DEGRADED_SUCCESS（明确标注 missing research），并生成可 resume 的 checkpoint  
   - resume 后补全缺失并更新到新版本输出（不覆盖旧版本，做版本化 append）  
   依据：可重试/降级/补偿的工作流思想。citeturn21view0turn15view3turn6view0  

3) **Activity at-least-once + 幂等保证测试（副作用安全）**  
   - 注入“activity 完成但结果记录前崩溃/网络断开”（导致可能重跑）  
   - 断言：外部副作用不重复（幂等键/去重），或重复后能补偿回滚  
   依据：Durable Functions activities at-least-once；RFC 9110 非幂等重试风险；Saga 补偿模型。citeturn7view1turn18view0turn15view3  

4) **版本升级下的 replay/resume 兼容性测试（determinism）**  
   - 在 workflow 运行中途升级代码/策略  
   - 断言：旧 run 可继续 replay，不发生 deterministic replay failure；或被安全地 Continue-As-New/迁移  
   依据：Durable versioning 对移除旧路径的警告；Temporal 对 deterministic replay 的要求与 Continue-As-New/checkpoint。citeturn7view2turn6view1turn14view2  

5) **评测稳定性与回归可信度测试（执行型评测防漂移）**  
   - 对同一测试集重复运行（多天/多版本）  
   - 断言：在固定依赖快照/虚拟 API 下，成功率方差可控；在真实依赖下，能量化并隔离波动来源  
   依据：StableToolBench 对 API 波动导致评测不稳定的分析与解决方案；SWE-bench/WebArena 的执行型评测理念。citeturn15view6turn15view4turn15view5  

---

## Recommended Minimum Design for RT

下面给出“最小可用但不脆弱”的 RT 架构基线：目标是 recoverability 与 trust consistency，而不是吞吐。

### Recommended Minimum Design for RT

#### 架构骨架：Durable workflow + event-sourced artifacts + resumable streaming

1) **Durable Orchestrator（确定性）**  
   - 以 phase 状态机驱动，多终态（成功/降级/待输入/失败）。  
   - Orchestrator 逻辑必须 deterministic，避免把随机/时间/外部 I/O 放进 orchestrator（Durable Functions 明确限制；Temporal replay 也要求 determinism）。citeturn7view0turn6view1  

2) **Activities（非确定性）**  
   - LLM calls、工具调用、评测执行一律作为 Activities。  
   - 为每类 Activity 定义 timeout、retry policy、与可降级输出（Temporal/Step Functions 都把 retry 与 timeout 当作一等配置）。citeturn6view3turn21view0turn19view2  

3) **事件历史（权威）**  
   - Append-only：PhaseStarted/ArtifactCommitted/PhaseEnded 等。  
   - 可用于恢复与审计：Temporal 明确 Event History 用于 durable execution 与 audit log。citeturn6view0turn6view2  

4) **Artifact store（版本化）**  
   - 所有关键产物（plan、evidence、draft、final、用户可见输出日志）都版本化存储，并由 event 引用（artifact_id + hash）。  
   - 保证“用户看到的版本”永远可回溯，避免 silent rewriting。

5) **SSE streaming 网关（非权威传输层）**  
   - 每个事件：`id` 单调递增；必要时包含 event type（如“progress / delta / checkpoint / final”）。citeturn4view1turn17view2  
   - 断线重连：支持 `Last-Event-ID` 补发；用 `retry` 控制；用 `:` keepalive；必要时用 204 终止重连并引导 resume。citeturn5view3turn17view1turn17view0turn17view3  
   - **persisted catch-up**：SSE 网关从“输出事件日志”读取并补发，而不是从内存 buffer。

6) **Ops 可观测性**  
   - 全链路 trace：W3C Trace Context + OTel；统一语义字段。citeturn8view3turn16view2turn16view1  
   - 关键指标见上一节；并保留可钻取的事件历史视图（类似 Step Functions/Temporal 的 execution history 思路；尤其注意：日志投递可能 best-effort，不能当作权威历史）。citeturn13view2turn13view3turn6view0  

---

### Anti-Patterns

1) **把“流式输出”当作“真实状态”**  
SSE 只是传输协议；断线丢段/重复并不罕见。没有持久化输出事件日志与 `Last-Event-ID` 补发能力，就会出现用户端与系统记录不一致。citeturn5view3turn17view0  

2) **phase reliability 只记 “success/failure”，不记降级与原因**  
这会导致 silent degradation 无法被量化，也无法做可靠的 error budget/优先级决策（SRE 指标选择不当会驱动错误行动）。citeturn9view0turn9view2  

3) **用 ∏Pi 对外宣称“总体可靠性”**  
在有重试/补偿/降级的系统里，这是统计学自欺：Pi 常相关、且失败可被恢复路径“吸收”。应以端到端用户成功为主，phase 指标用于归因。citeturn6view3turn15view3turn9view0  

4) **把外部副作用操作放进可重放逻辑，或不做幂等/补偿**  
Durable/Temporal 都会 replay；Durable Activities 还可能 at-least-once。没有幂等键/补偿，重放会造成重复执行。RFC 9110 也明确警告不要自动重试非幂等请求。citeturn7view1turn18view0turn15view3  

5) **评测体系不可复现，仍用来做回归/发布门禁**  
StableToolBench 直接指出在线 API 不稳定会导致评测结果不可复现；解决要靠缓存/虚拟 API server/稳定评测系统。RT 若不先解决评测稳定性，dashboard 上的“成功率波动”会变成噪声。citeturn15view6  

---

### Open Questions

1) **“trust consistency”的形式化成功判定是什么？**  
需要明确：哪些内容允许在 resume 后“追加修正”（versioned append），哪些内容一旦展示就必须 immutable。没有这条边界，系统会在“更正”与“改口”之间踩雷。  

2) **DEGRADED_SUCCESS 的产品契约怎么定？**  
例如：缺失 research 时允许输出到什么粒度？是否必须给出“可重试入口 + 未完成 checklist”？这决定 silent degradation 能不能被根治。citeturn9view0turn15view3  

3) **输出事件日志的存储策略：粒度与成本**  
token 粒度最易补发但成本高；段落/section 粒度更省但断线恢复会有“跳变”。需要结合用户体验与存储预算做折衷，并用测试验证。citeturn17view0turn5view3  

4) **工作流版本迁移策略**  
Durable/Temporal 都强调版本与 determinism；但 RT 的 agent 策略可能变化更频繁。需要明确：何时 Continue-As-New/何时在同一 run 内做兼容分支，才能避免 replay 失败。citeturn7view2turn14view2  

5) **execution-based evaluation 在“决策类输出”上的落地形态**  
SWE-bench/WebArena 适用于可执行任务；RT 的 decision workflow 需要定义可执行的判定器（例如一致性检查、引用覆盖率、行动项可执行性、或模拟环境验证）。同时要防止评测漂移（StableToolBench）。citeturn15view4turn15view5turn15view6  

---

## Source List

### 论文与一手研究

- citeturn15view3 Garcia-Molina, H., & Salem, K. *SAGAS* (Princeton CS Tech Report, 1987).  
- citeturn15view4 Jimenez, C. E., et al. *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* (ICLR 2024).  
- citeturn15view5 Zhou, S., et al. *WebArena: A Realistic Web Environment for Building Autonomous Agents* (ICLR 2024).  
- citeturn15view6 Guo, Z., et al. *StableToolBench: Towards Stable Large-Scale Benchmarking on Tool Learning of Large Language Models* (ACL Findings 2024).  
- citeturn15view7 Yao, S., et al. *ReAct: Synergizing Reasoning and Acting in Language Models* (ICLR 2023).  
- citeturn15view8 Shinn, N., et al. *Reflexion: Language Agents with Verbal Reinforcement Learning* (arXiv 2023).  
- citeturn15view1 Sigelman, B. H., et al. *Dapper, a Large-Scale Distributed Systems Tracing Infrastructure* (Google Technical Report, 2010)（页面节选截图源）。  

### 官方工程文档与标准

- citeturn6view0turn6view2turn6view1turn6view3turn14view2turn14view3turn14view0turn20view0 Temporal Platform Documentation（Event History / Replay / Retry Policies / Continue-As-New / Limits / Failures / Message handling 等）。  
- citeturn7view1turn7view0turn7view2turn13view0turn13view1 Microsoft Learn — Azure Durable Functions / Durable Task（event sourcing + replay、determinism、versioning、retry、diagnostics 等）。  
- citeturn21view0turn19view2turn13view3turn13view2turn19view1turn19view0 AWS Step Functions 与 Amazon States Language（Retry/Catch、timeouts/heartbeats、redrive、execution history/logging 等）。  
- citeturn17view0turn17view1turn5view3turn17view3turn4view0 WHATWG HTML Standard — Server-Sent Events（EventSource、`Last-Event-ID`、`retry`、keepalive comment、204 stop reconnect 等）。  
- citeturn18view0 RFC 9110 — HTTP Semantics（safe/idempotent methods 与 retry 约束）。  
- citeturn8view3turn1search6 W3C Trace Context（`traceparent`/`tracestate`）。  
- citeturn16view0turn16view1turn16view2 OpenTelemetry（SpanContext、context propagation、semantic conventions）。  
- citeturn9view0turn9view1turn9view2 Google SRE（SLI/SLO 框架与 error budget 观念、指标与用户体验对齐）。