# 面向 RT 决策产品的 Message-Driven 多智能体流程向 Task Ledger / Typed State 的演进研究

## Executive Summary

RT（Round Table 类）决策产品的核心矛盾是：**你想要“可恢复、可回放、可复审、可追责”的流程状态**，但“仅靠 allMessages / conversation history”天然是**叙事性、非结构化、难做一致性校验**的载体；一旦对 follow‑up / replay / resume 设为一等需求，就会迅速暴露出状态漂移、UI 难水合、以及 token 成本随历史线性增长的问题。LangGraph 之所以在工程上强调“state + checkpoint + time travel”，就是把“状态”从消息文本中抽出，变成可快照、可分叉、可恢复的对象；其官方文档明确把 persistence（checkpoints/threads）与 time travel、fault‑tolerance、human‑in‑the‑loop 绑定在一起。citeturn2view3turn10view0turn2view4

你指定重点研究的 entity["company","Microsoft","software company"] Magentic‑One “dual-ledger”实践，其论文与官方说明把 ledgers 分成两层：外层 Task Ledger（计划 + 事实/待验证/推导/假设）和内层 Progress Ledger（每步自检：是否完成、是否循环、是否前进、下一位发言者是谁、下一条指令是什么）。这不是“多写一份摘要”，而是把**控制流与工作记忆**从对话文本里剥离出来，以便做恢复与纠偏。citeturn18view1turn18view2turn2view1turn15view0

面向 RT 的结论很直接：

- **Task Ledger 的最小可行形态**不应复刻通用 agent runtime，而应围绕 RT 的产品不变项：多阶段 discussion flow、证据驱动总结、可恢复/可回放/可复审。最小 schema 应包含：`goal`、`stage_plan`、`tasks[]`（带 status/owner/依赖/输入输出引用）、`claims_or_facts[]`（带证据引用与置信/争议状态）、`decision_snapshot`（候选与理由的结构化占位）、以及 `cursor`（“下一步做什么/谁来做”）。这相当于把 Magentic‑One Task Ledger 的“facts/guesses/plan”迁移成决策语境下的“claims/evidence/plan”，并把 Progress Ledger 的“next speaker + instruction”收敛为 cursor。citeturn18view1turn18view2
- **Task Ledger 与原始 history 必须共存**：history 是审计日志/证据链与可解释性的地基；Task Ledger 是可查询、可水合 UI、可校验一致性的“物化视图”。这对应经典 Event Sourcing + Materialized View 的关系：append‑only events 作为审计轨迹，state view 可从 events 重建且可丢弃重算。citeturn17view0turn17view1turn17view2
- **RT 是否真的需要 Progress Ledger？**需要，但不需要 Magentic‑One 那种面向“工具执行/失败恢复”的完整形态；RT 的最小 Progress Ledger 可以退化为 `cursor + completion_flags + stall_signal`（可选），甚至直接并入 Task Ledger 的每个 task 状态与 `next_action` 字段即可。保留它的唯一理由是：你要把“流程推进”从叙事文本中拔出来，变成可持久化、可回放、可判定的控制信号。citeturn18view1turn18view2turn10view0
- **不需要上完整 DAG/graph runtime**（尤其是 Pregel/superstep 并行、reducers、subgraphs 等一整套），除非你明确需要并行分支合并与复杂路由。对 RT 更小的替代方案是：**typed state + 显式阶段机（FSM）+ checkpoint 快照 + fork（分叉）语义**。LangGraph 的文档已经把“threads/checkpoints/time travel/fault tolerance”与“state schema”讲得很清楚；你可以吸收其语义，但实现不必照搬完整图执行模型。citeturn9view0turn2view3turn10view0turn12view0

下面的 Verified Findings 先把你点名的关键材料“可核验事实”固化，再给出 RT 的最小任务台账、共存策略、持久化边界、以及 migration 路线。

## Verified Findings

### Magentic‑One 的 Dual‑Ledger 是“外层计划记忆 + 内层进度自检”的分层控制结构

Magentic‑One 的论文 Figure 2 明确给出 Task Ledger 与 Progress Ledger 的职责与字段粒度：Task Ledger 包含 “given or verified facts / facts to look up / facts to derive (computation or logic) / educated guesses / task plan”；Progress Ledger 包含 “task complete? / unproductive loops? / is progress being made? / what is the next speaker? / next speaker instruction”。citeturn18view1turn6view2

论文对两层循环的定义也很明确：外层循环创建并更新 Task Ledger，作为任务期的短期记忆；内层循环每次迭代通过回答“五个问题”生成 Progress Ledger，以决定下一位 agent 及其指令，并检测卡住/循环从而触发外层重新规划与更新 Task Ledger。citeturn18view2turn6view0turn6view1

这套设计的关键点不在“有两份文本”，而在于：**把控制流决策（next speaker / next instruction / stuck detection）结构化**，以支持纠错与恢复。citeturn18view1turn18view2

### LangGraph 把“state”提升为一等公民，并用 checkpoint/threads 支撑 time travel、恢复与 human‑in‑the‑loop

LangGraph 官方 Graph API 概览把系统拆成 State / Nodes / Edges，并强调 state 是“当前快照”，nodes 读 state 写 state 更新，edges 根据 state 决定下一步执行路径。citeturn9view0

其 persistence 文档明确：编译 graph 时配置 checkpointer，会在每一步保存 graph state 的 checkpoint，并按 thread 组织；这被官方直接列为 human‑in‑the‑loop、memory、time travel、fault‑tolerance 的前置条件，并提到失败时可从上一步恢复以及 pending writes 的语义。citeturn2view3

time travel 文档给出“Replay 与 Fork”的官方语义：两者都从某个 checkpoint 恢复；checkpoint 之前的节点不再执行，之后的节点会重新执行；fork 通过对旧 checkpoint update_state 产生一个分支 checkpoint，且不会“回滚覆盖”原历史。citeturn10view0

interrupts 文档说明：interrupt 可以在任意位置暂停执行并等待外部输入；触发 interrupt 时 LangGraph 会保存 graph state 并“等到你 resume”；同时指出 thread_id 是恢复指针、checkpointing 能“保持你的位置”。citeturn2view4

### message history 不必被抛弃：LangGraph 也把 messages 当作可选的 state channel，并提供 reducer 语义

LangGraph 的 Graph API 文档专门讨论“Working with messages in graph state”：可以在 state 中保存 messages 列表，并通过 reducer 决定如何合并更新；官方还给出 add_messages 的目的：既能追加新消息，也能基于 message IDs 覆盖更新已有消息，以适应 human‑in‑the‑loop 改写历史消息的场景。citeturn2view2

这对 RT 很关键：它说明 **“message history vs typed state”不是二选一**；messages 可以作为 state 的一个 channel（用于 LLM 输入与审计），而决策过程的“规范状态”用其它结构化字段承载。citeturn2view2turn2view3

### token efficiency 的根因是上下文窗有限，工程上必然走向“分层记忆/摘要/裁剪 + 外部状态”

MemGPT 的论文摘要把问题说得很直白：LLM 受限于 context window，这会削弱长对话与大文档分析；其提出“virtual context management/分层记忆”来在有限上下文内实现更长程的信息保留。citeturn13view2

LangGraph 的 Memory 文档也正面指出：长对话会超出上下文窗，常见解法包括 trimming、删除、摘要、以及通过 checkpoints 管理/检索历史。citeturn16view0

对 RT 来说，这意味着“只堆 allMessages”会天然把 token 成本做成线性增长；要做 token efficiency，必须引入**可检索、可摘要、可结构化的外部状态**来替代“把一切都塞回对话上下文”。citeturn16view0turn13view2

### record/replay 作为系统机制正在被直接研究为 agent 可靠性与成本控制手段

AgentRR（LLM Agents with Record & Replay）提出把经典 record‑and‑replay 引入 agent：记录交互 trace 与内部决策过程，把 trace 总结成结构化 experience，并在后续相似任务中 replay 这些经验；其动机包含可靠性、成本与性能，并引入 check function 作为回放过程的“信任锚”。citeturn13view0

对 RT 的启发是：replay 不应只理解为“把旧消息再喂一遍”，而应理解为**对状态轨迹的结构化重放**（包括：当时的 stage、任务分配、证据索引、以及产生总结的约束）。citeturn13view0turn2view3

### message-driven 多智能体是主流起点，但它本质上把“控制流”埋进了对话文本

AutoGen 论文将其核心 insight 归结为“用 multi‑agent conversations 来统一复杂工作流”，并把工程范式称为 conversation programming；agents “receive/react/respond to messages”，工作流是 conversation‑centric。citeturn14view0

这类范式非常适合快速起步，但对 RT 这种“state correctness / recoverability / replay”为一等需求的产品来说，conversation‑centric 往往意味着：控制信号（阶段、任务是否完成、证据是否齐全）会被埋在自然语言里，后续只能靠 LLM 反复“读史取义”来推断状态，成本与一致性都不可控。citeturn14view0turn16view0

## State Model Comparison

### 三种状态观：history‑as‑state、state‑as‑object、history + ledger（推荐）

**history‑as‑state（纯 message-driven）**：把 allMessages 视为唯一真实来源，流程阶段与任务完成度只存在于对话叙事中。这与 conversation programming 的直觉一致：交互即状态。citeturn14view0  
问题在于：RT 需要“回放/恢复/复审”时，你必须在每次 follow‑up 里重新解释历史，这会把 token 成本与状态不一致风险一起放大；LangGraph 的记忆文档已经把“长对话超过 context window”视为常态问题。citeturn16view0turn13view2

**state‑as‑object（纯显式状态对象）**：把状态当成结构体（Typed State），消息只是输入输出或日志。LangGraph 的 Graph API 把 state 定义为共享快照，node 返回 partial update，reducer 决定合并语义；并通过 checkpointer 把 state 快照化。citeturn9view0turn9view1turn2view3  
问题在于：如果你完全抛弃 history，会失去审计/可解释性与原始证据链；而 RT 又强调 evidence‑backed summary，这通常需要能指回“原话/原始材料”。citeturn17view0turn18view1

**history + ledger（推荐）**：把 messages 当作 append‑only event log（审计轨迹），把 Task Ledger/Typed State 当作 materialized view（可查询的规范状态）。这非常贴近 Azure 架构中心对 Event Sourcing 与 Materialized View 的描述：事件日志可回放重建视图，视图是可丢弃可重建的“专用缓存”。citeturn17view0turn17view1turn17view2  
同时，LangGraph 也证明 messages 可以存在于 state 里作为一个 channel，并通过 reducer 维护消息列表一致性（例如基于 message IDs 的覆盖更新）。citeturn2view2

### message history vs explicit state object 的硬权衡点

- **一致性与可判定性**：Typed State 可以对“哪些字段必须存在、哪些字段可空、状态转移如何发生”做硬约束；纯 history 只能靠解释。LangGraph 的 schema + reducer 机制本质是把“写状态”的规则显式化。citeturn9view1turn2view2  
- **恢复与分叉**：LangGraph 的 checkpoint/thread/time travel 明确把恢复与分叉变成一等能力，且 fork 不覆盖原历史。citeturn2view3turn10view0  
- **token 成本曲线**：history‑as‑state 的成本随交互轮次增长；MemGPT 与 LangGraph memory 文档都把“上下文窗有限”作为必须外化状态/摘要/裁剪的理由。citeturn13view2turn16view0  
- **证据链**：Event Sourcing 文档强调 append‑only events 提供 audit trail，可用于测试与调试，并可通过 replay 生成当前状态。citeturn17view0  
- **迁移成本**：同一份官方材料也警告：Event Sourcing 是高侵入模式，迁移成本高，且对多数系统不划算。citeturn17view3  
  对 RT 的含义是：你要的是“history + ledger 的思想”，但不应把自己绑死成“完整 event sourcing 系统”。

## Minimum Task Ledger for RT

本节直接回答问题：

- **问题一：对 RT 来说，Task Ledger 的最小 schema 应是什么？**  
- **问题二：Task Ledger 与原始 conversation history 应如何共存，而不是互斥？**  
并同时给出对 Magentic‑One dual‑ledger 的 RT 化改写。

### 从 Magentic‑One Task Ledger 抽象到 RT：把“facts/guesses/plan”改造成“claims/evidence/plan”

Magentic‑One 的 Task Ledger 字段可以视为三类：已知/待查/待推导的事实 + 假设（educated guesses）+ 计划（task plan）。citeturn18view1turn18view2  
RT 决策产品虽然“不执行代码”，但同样存在三类信息：

1) **可引用事实/证据（Evidence-backed）**：谁说了什么、引用了哪份材料、材料是哪一段。  
2) **尚未闭合的争议/未知（To look up / to verify / to clarify）**：需要补问用户、需要补充证据、需要确认约束条件。  
3) **推导与判断（To derive / analysis）**：权衡、利弊、风险、结论的生成逻辑。

因此，RT 的 Task Ledger 最小必须同时容纳：**任务计划（阶段与任务）、证据索引、主张/事实的状态、以及决策输出的结构化占位**。这对应 Magentic‑One Figure 2 的“Task plan + facts/guesses”精神，但把“web search / computation”语义替换成“证据请求 / 论证与综合”。citeturn18view1turn18view2

### RT 适用的最小 Task Ledger 字段建议

下面给出一个**“最小但够用”**的字段集合（刻意不引入通用 agent runtime 的复杂度，不包含工具执行、代码产物、环境状态等）。字段命名偏工程可落地；你可以用 JSON Schema、TypedDict、protobuf 都行，关键是语义。

```json5
{
  "ledger_version": 1,

  // 线程/会话身份：对应 LangGraph 的 thread_id 概念，用于把多次 follow-up 归到同一条“可恢复时间线”
  "thread_id": "rt_...",

  // 任务定义：RT 的“要做什么决策”
  "goal": {
    "decision_question": "...",
    "success_criteria": ["..."],          // 何时算“讨论够了/可输出”
    "constraints": { "deadline": "..."}   // 可选：时间/范围/偏好等
  },

  // 阶段与任务：把 multi-stage discussion flow 变成显式结构
  "stage_plan": [
    { "stage_id": "scope", "status": "done|active|todo" },
    { "stage_id": "evidence", "status": "done|active|todo" },
    { "stage_id": "deliberation", "status": "done|active|todo" },
    { "stage_id": "summary", "status": "done|active|todo" },
    { "stage_id": "decision", "status": "done|active|todo" }
  ],

  // Task Ledger 的核心：每个 task 是可恢复/可回放的最小工作单元
  "tasks": [
    {
      "task_id": "t1",
      "stage_id": "evidence",
      "title": "收集关键证据缺口",
      "type": "ask_user|extract_claims|weigh_options|draft_summary|critique_summary|finalize_decision",
      "status": "todo|running|blocked|done",
      "owner": "moderator|agent:...|human:...",
      "depends_on": ["t0"],
      "inputs": { "message_refs": ["m12"], "artifact_refs": ["a3"] },
      "outputs": { "artifact_refs": ["a4"] },
      "acceptance_criteria": ["证据至少覆盖 A/B 两个关键点"],
      "updated_at": "2026-03-17T..."
    }
  ],

  // 证据与主张：用显式对象承载 evidence-backed summary 的“可追责性”
  "evidence": [
    { "evidence_id": "e1", "kind": "quote|doc|link", "source_ref": "m12", "snippet": "...", "hash": "..." }
  ],
  "claims_or_facts": [
    { "claim_id": "c1", "text": "...", "status": "given|supported|disputed|unknown", "evidence_ids": ["e1"] }
  ],
  "assumptions": [
    { "assumption_id": "a1", "text": "...", "risk_if_wrong": "..." }
  ],

  // 决策输出：哪怕在早期也要有结构化占位，方便 UI hydration 与后续 judge
  "decision_snapshot": {
    "options": [{ "option_id": "o1", "label": "...", "pros": [], "cons": [], "risks": [] }],
    "current_recommendation": { "option_id": "o1", "rationale": "...", "confidence": "low|med|high" },
    "open_questions": ["..."]
  },

  // Progress 的最小化实现：把 Magentic-One Progress Ledger 收敛为 cursor（下一步/下一位/等待什么）
  "cursor": {
    "next_task_id": "t2",
    "waiting_on": "human_input|moderator_review|none",
    "stall_signal": { "stalled": false, "reason": "" } // 可选；用于“循环/无进展”检测
  }
}
```

上面 schema 的“血肉”来自三处一手材料的共同点：

- Magentic‑One 把 Task Ledger 定义为任务期短期记忆，容纳 plan 与 facts/guesses，并允许在卡住时更新计划。citeturn18view2turn15view0  
- Magentic‑One 的 Progress Ledger 本质是每步回答几个“控制问题”来决定 next speaker 与 next instruction；RT 不需要完整保留这五问文本，但需要把其输出收敛成 cursor（next actor/next action）与最小 stall 信号。citeturn6view1turn18view1  
- LangGraph 的 state/updates/reducers 与 checkpoints 说明：state 可以有多个 channel（包括 messages），并且天然支持“每步快照 + 回放/分叉”。这为“tasks 列表 + cursor”提供了可靠的运行语义底座。citeturn9view0turn2view3turn10view0

### Task Ledger 与 conversation history 共存的推荐方式：history 是事件流，ledger 是物化视图

最稳健的共存方式是把两者角色定死：

- **conversation history（allMessages）**：append‑only 的事实记录（谁在何时说了什么/引用了什么）。它提供审计轨迹与可解释性，且可用于“重建某时刻状态”。Event Sourcing 模式把这种 append‑only events 明确视为 audit trail，并可通过 replay 生成当前状态/投影。citeturn17view0  
- **Task Ledger / Typed State**：面向产品查询与 UI 水合的“读模型/物化视图”，可以丢弃并从 history 重新生成（至少在理论上）。Materialized View 模式强调 view 是“专用缓存”、可丢弃可重建。citeturn17view1  

但要实话实说：**你不应该把 RT 设计成完整 event sourcing**，因为官方材料警告 event sourcing 会“渗透整个架构、迁移成本高、对多数系统不划算”。citeturn17view3  
对 RT 更现实的版本是“事件日志 + 状态快照”的折中：保留 append‑only messages，同时持久化每次关键推进后的 ledger snapshot（见后文 Persistence Boundaries）。这也更贴近 LangGraph 的 persistence/checkpoints 机制：每步保存状态快照，按 thread 组织，并支持 time travel 与 fault tolerance。citeturn2view3turn12view0

## Persistence Boundaries

本节回答问题三：**哪些字段应持久化进数据库，哪些只做 runtime state？**

为了支持 RT 的 resume/replay/follow‑up，一条硬原则是：**凡是影响“可恢复语义”的信息，都必须持久化**；否则所谓 resume 只是“重新推理一遍”，等价于不可恢复。LangGraph 把 persistence 定义为 checkpoints（每步 state snapshot）并直接把 fault‑tolerance、time travel、human‑in‑the‑loop 建立在上面。citeturn2view3turn2view4

### 必须持久化的字段

**会话与时间线身份**

- `thread_id`：把多轮 follow‑up 绑定到同一条时间线；LangGraph 把 thread 定义为一串 checkpoints 的容器，并要求执行时提供 thread_id。citeturn2view3turn16view0  
- `ledger_version` / schema 版本：事件/状态结构演进不可避免；Event Sourcing 文档强调“事件版本与 schema 迁移”是实施难点之一，这同样适用于 ledger。citeturn17view0turn17view3  

**可恢复的规范状态（ledger snapshot）**

- `goal`、`stage_plan`、`tasks[]`（含 status/owner/depends_on/输入输出 refs）、`claims_or_facts[]`、`evidence[]`、`decision_snapshot`、`cursor`：这些共同构成“当前处于什么阶段、已经做了什么、下一步该做什么”的可判定答案。LangGraph 的 checkpoints 本质就是保存这类 state。citeturn2view3turn12view0  

**审计与证据链**

- 原始 `messages`（或至少 message 元数据 + 内容 hash + 可复原存储指针）：Event Sourcing 模式把 append‑only events 作为 audit trail；RT 的 evidence‑backed summary 没有原始依据就无法复审。citeturn17view0turn18view1  
- `evidence.source_ref → message_id / artifact_id` 的可追溯映射：否则所谓“evidence‑backed”会退化成又一段不可验证的摘要。citeturn18view1turn17view1  

**回放所需的执行元数据（最小集合）**

你说 RT “不执行代码”，但它仍然会执行 LLM 调用与人类审批流程；LangGraph durable execution 讨论的“determinism/consistent replay”直接指出：恢复时并非从同一行代码继续，而是从某个起点 replay；因此必须把关键非确定性步骤包起来并依赖持久化结果，才能避免重复副作用。citeturn12view0  
对 RT 的落地是：**至少持久化这些元数据**（否则 replay 不可控）：

- 产生关键 artifact（总结/判决/结论）的 `model_config_id`、`prompt_version`、`policy_version`（你内部的版本号即可）
- 关键节点的 `artifact_id` 与输出 hash（用于“同一快照下是否改变”）

这些不必让 LLM 看见，但必须让系统能判定“这次回放是复现旧结果还是再跑一遍”。

### 只应作为 runtime state 的字段

**纯缓存/加速类**

- token 计数缓存、向量检索的临时 top‑k、UI 排序缓存、临时的候选草稿（未进入 artifacts 的）  
LangGraph 的 Materialized View 说明 view 本质是“专用缓存”，可丢弃重算；同理，纯加速信息不应进入“可恢复真相层”。citeturn17view1

**短命推理脚手架**

- 仅用于某一次 LLM 调用的 scratchpad、临时分解草案、未被采纳的中间链路  
（如果你把这些都持久化，会制造“状态噪音”，之后反而增加 UI 水合与判定复杂度；而 RT 的目标是 state correctness，不是保存一切思考过程。）

**可由持久化状态确定的派生字段**

- 例如“当前阶段进度百分比”“是否已满足完成条件”等，可由 tasks/status 与 acceptance_criteria 派生；除非你需要历史对比（那就作为 metrics 单独存）。  
Materialized View 模式强调 view 可丢弃重建；派生字段天然应该可重建。citeturn17view1

## Implications for Resume / Replay / Follow-up

本节回答问题四：**typed state 如何帮助 resume、follow‑up、replay、judge、UI hydration？**  
同时也解释：为什么 RT 不该继续把这些能力押在 “allMessages 重新总结” 上。

### Resume：从“重新推理”变成“从快照继续”

LangGraph interrupts 文档明确：触发 interrupt 时会保存 graph state，并“等待直到你 resume”；thread_id 是恢复指针。citeturn2view4  
把这套语义迁移到 RT，typed state 的直接收益是：

- 你可以把“等待用户补充/等待 moderator 审核/等待某 agent 输出”建模成 `cursor.waiting_on`，并在中断点把完整 ledger snapshot 写库。
- resume 时不需要让模型“读全历史”才能找回上下文：系统直接加载 ledger snapshot，知道下一步该执行哪个 task、需要谁输入什么。

如果没有 typed state，resume 常见会退化成：把旧消息再喂给模型，问“我们到哪了？”——这就是最典型的不可控与昂贵。LangGraph persistence 把 fault‑tolerance 与从 last successful step 重启写得很直白，这就是你要的“恢复语义”。citeturn2view3

### Replay：把回放分成两类，否则你会“看起来能回放、实际上在重跑”

LangGraph 的 time travel 语义非常关键：Replay 会重新执行 checkpoint 之后的节点（包括 LLM 调用与 interrupts），因此结果可能不同；Fork 会在旧 checkpoint 基础上创建新分支 checkpoint，且原历史不被覆盖。citeturn10view0

这对 RT 的产品定义提出一个你必须提前回答的问题：你说的 replay 是哪一种？

- **审计型 replay（replay‑as‑reproduction）**：回放时应复现当时输出（不再调用模型），用于复审/仲裁/追责。  
- **探索型 replay（replay‑as‑reexecution）**：从某个旧状态分叉，用新证据或新约束重新跑“总结/判决/结论”，得到一个新分支。

如果你不区分两者，就会出现：用户以为“回放旧结论”，系统却偷偷重跑 LLM 得到不同文本，从而破坏信任。LangGraph durable execution 专门讨论“consistent replay”与把非确定性/副作用放进 tasks，以便恢复时不重复执行；这在 RT 里可以等价为：把关键 LLM 输出当作“可缓存任务结果/产物”，审计型 replay 直接读取产物，不重跑。citeturn12view0turn2view3

### Follow‑up：把新输入视为事件，更新 ledger，而不是“把历史变长”

LangGraph persistence 把 thread 视为多次 runs 累积 state 的容器，并把 memory（跨多轮对话）建立在同一 thread 的 checkpoint 上。citeturn2view3turn16view0  
RT 的 follow‑up 应对齐这个语义：新问题/新证据是追加事件（message），系统更新 ledger（tasks/claims/decision_snapshot），并产生新的 checkpoint。

这样 follow‑up 的 token 成本不必随总历史增长：你可以只带上“最近消息 + ledger 结构化摘要/索引”，而不是把所有历史都塞回上下文。LangGraph memory 文档把 trimming、summarize、manage checkpoints 都列为常用策略；这说明官方也默认你不能无限喂 messages。citeturn16view0

### Judge：把“可判定的输出对象”从文本里抽出来

你说 RT “更关注 state correctness”，judge 的关键不在于“再问一个模型打分”，而在于：**是否存在可验证的结构化对象**（例如每个 claim 是否有 evidence_id、每个 option 是否有 pros/cons/risks、当前 recommendation 是否满足 success_criteria）。  

LangGraph 的 state schema/reducer 机制说明：节点可以返回 partial update，系统按 reducer 合并，这让你可以把 judge 写成“只读 state 的校验节点/规则集”。citeturn9view1turn2view2  
即使你不用 LangGraph，也应该吸收这个思想：judge 针对 typed state，而不是针对自然语言历史。

### UI hydration：UI 不应靠“从对话里猜”，而应靠“读状态对象”

当 UI 需要展示“阶段进度、待办、证据表、结论版本、分叉时间线”，如果你只有 allMessages，你就必须：

- 要么在后端临时 LLM 总结出一个 UI state（昂贵且易漂移）
- 要么写一堆脆弱的正则/启发式

LangGraph 把 state 作为快照，并用 checkpoints 保存；time travel/fork 还能天然生成“时间线分叉”的 UI 数据结构。citeturn2view3turn10view0  
这正是 RT 需要的 UI hydration 模式：**UI 直接读 ledger snapshot**，messages 只用于“展开查看原话/证据链”。

## Recommended Minimum Design for RT

本节回答问题五与问题六，并给出你要求的 migration 路线（从 allMessages/history 逐步演进，而不是推倒重来）。

### Dual‑Ledger 在 RT 场景的简化原则

Magentic‑One 的 Progress Ledger 五问中，后三问（next speaker / next instruction）在 RT 中依然有价值，因为 RT 是 moderator‑mediated、并且多阶段流程需要“下一步该谁做什么”。citeturn6view1turn18view1  
但前两问（task complete? / unproductive loops? / is progress being made?）在 RT 的实现方式应显著简化：

- RT 不执行工具、环境副作用更少，所谓“卡住/循环”多数是**信息缺口**或**讨论发散**；这可以通过 tasks 的 blocked 状态与 `waiting_on` 来表达，而不必每步生成一段自省文本。  
- “完成判定”可以由 success_criteria + tasks.done + claims 覆盖率派生，而不必每轮写一条 progress 总结。

因此，RT 的 Dual‑Ledger 推荐两种简化形态（二选一）：

1) **单 Ledger + Cursor（最小）**：保留 Task Ledger，加入 `cursor` 字段承载 next actor/action 与 stall 信号。  
2) **弱化的 Progress Ledger（可选）**：如果你希望保留“每轮推进记录”用于可视化时间线，可以把 Progress Ledger 退化为每轮一个极小事件：`{step_id, next_task_id, waiting_on, done_delta[]}`，但它更像“运行轨迹日志”，不是第二个工作记忆层。

你问“RT 是否真的需要 Progress Ledger？”——答案是：**需要的是 Progress 语义，不需要的是 Progress Ledger 的完整形态**。Magentic‑One 的做法证明“next speaker + next instruction + 检测卡住”是控制循环的核心；RT 只要把它压缩成 cursor 即可。citeturn18view1turn18view2

### RT 是否需要完整 DAG/graph runtime？

LangGraph Graph API 的执行模型包含 message passing、super‑steps、并行节点、reducers 等，能力很强，但复杂度也真实存在。citeturn9view0turn9view2  
对 RT 来说，上完整图执行并非“免费午餐”，典型会把你带入三类过度工程：

- **为并行与合并付出复杂度**：reducers、并行冲突（例如同一 key overwrite）等问题，你可能根本不需要。citeturn9view1turn11search3  
- **为通用路由付出理解成本**：conditional edges、subgraphs、Pregel/superstep 心智模型，除非你明确要做复杂分支探索，否则多半收益不匹配。citeturn9view0  
- **为 durable execution 的“任务级副作用隔离”付出开发成本**：LangGraph durable execution 强调 determinism/idempotence/tasks；RT 虽然也有 LLM 非确定性，但如果你把关键输出当 artifact 持久化，许多“副作用重复执行”的复杂度可以大幅降低。citeturn12view0turn2view3

#### 最小替代方案

如果你不需要完整图 runtime，一个足够覆盖 RT 需求的最小替代方案是：

- **显式阶段机（FSM）**：`scope → evidence → deliberation → summary → decision → followups`  
  每个阶段有明确入口条件与退出条件（success_criteria）。这对应 LangGraph “edges 根据 state 决定下一步”但你只实现线性/小分支版本。citeturn9view0  
- **typed state（Task Ledger）作为唯一规范状态对象**：所有节点/阶段只允许对 state 做受控更新（类似 LangGraph node 返回 partial update 的思想）。citeturn9view1turn2view2  
- **checkpoint 快照 + thread 时间线**：每次阶段推进、每次产出关键 artifact、每次等待人类输入，都写入一个 state snapshot（可回滚点），并用 thread_id 聚合。citeturn2view3turn2view4turn16view0  
- **fork 语义**：对 follow‑up 或 replay‑as‑exploration 直接“从某个 snapshot 复制一条新分支”，保留原分支不变。这与 LangGraph fork “不回滚覆盖原历史”的语义一致。citeturn10view0turn17view0  

这套最小方案本质是：**吸收 LangGraph 的语义（state/checkpoint/thread/fork/interrupt），但不引入其完整图执行模型**。

### 从 allMessages/history 逐步迁移的路线图

你明确要求“不是推倒重来”。下面给出一个按风险递增、可灰度的迁移路径。每一步都保证：旧系统还能跑，新能力逐步接管。

#### 阶段一：把 history 变成“可引用事件流”，先解决可追溯性

1) **为每条 message 引入稳定 ID 与元数据**：`message_id, role, author, created_at, parent_id(optional), attachments_refs`。  
2) **把 evidence 引用建立在 message_id 上**：summary/claims 不再只写文本，而是能指回 message_id + snippet/hash。  
这一步对应的是把 messages 朝 Event Sourcing 的“append‑only audit trail”方向靠拢，但不引入 event store 的全套复杂机制。citeturn17view0turn17view3  

#### 阶段二：引入最小 Task Ledger，但先只做“旁路写入”，不改主流程

3) 在每个关键里程碑点生成 ledger：例如“定完范围/证据收集结束/第一次总结/最终决策”。  
4) ledger 先作为 materialized view：UI 可以开始读 ledger 展示“阶段/任务/证据表”，但 LLM 仍然用 allMessages 驱动。  
Materialized View 文档强调 view 可丢弃重建且是专用缓存；你这一步就是在做“可丢弃的读模型”。citeturn17view1turn17view2  

#### 阶段三：让流程推进从“文本叙事”迁移到 `tasks[] + cursor`

5) 把 moderator 的“下一步做什么”改成：更新 `cursor.next_task_id`，并把 task 状态从 todo→running→done。  
6) 把“等待用户输入/等待审核”改成 `cursor.waiting_on`，并持久化为 checkpoint。LangGraph interrupts/persistence 的语义证明这种“可暂停可恢复”的状态机是合理且工程可行的。citeturn2view4turn2view3  

#### 阶段四：收敛 token 成本——从“喂全历史”到“喂 ledger + 近端消息”

7) 引入 message trimming / summarization 策略：把长历史摘要到 `ledger.summary` 或 `decision_snapshot` 的结构字段里，模型输入只带最近 N 条消息 + 结构化状态。LangGraph memory 文档把 trimming/summarize/messages 管理当作常规手段。citeturn16view0turn2view2  
8) 对于关键 artifacts（总结/决策），保存其结构化版本与 hash，避免 follow‑up 时反复重跑同一总结。

#### 阶段五：正式支持 replay/fork，把 follow‑up 变成“分支时间线”而不是“继续变长”

9) 实现 snapshot 列表与 fork：从任一 checkpoint 复制出新 branch_id（或新 thread_id），保留原分支不变。LangGraph time travel/fork 的语义可以直接作为产品交互参考：fork 产生新 checkpoint 分支，原历史保持完整。citeturn10view0turn2view3  
10) 引入“审计型 replay vs 探索型 replay”的区分：审计型读产物不重跑；探索型从旧 snapshot fork 后允许重新生成输出。

这条路线的核心是：你始终保留 history（证据链），并逐步让 ledger 接管“流程与状态”，直到 allMessages 不再是唯一状态载体。

## Anti-Patterns

### 把“阶段/任务/完成条件”写在提示词里，而不是写进状态对象

这会让系统处于一种自欺状态：看似有流程，实际流程只存在于 prompt 里，无法被 UI 直接读取、无法被恢复机制直接定位、也无法被 judge 稳定校验。LangGraph 把 workflow 明确拆成 state/nodes/edges，就是要把这些控制要素显式化。citeturn9view0

### “replay = 重新把历史喂给模型再总结一遍”

LangGraph time travel 明确：replay 会重新执行 checkpoint 后的节点，LLM 调用可能给不同结果；如果你的产品语义是“复审旧结论”，这种 replay 会直接破坏可信度。citeturn10view0turn12view0  
RT 必须区分“审计回放（读取旧产物）”与“探索回放（分叉重跑）”。

### 为了“可追溯”直接把系统改造成完整 Event Sourcing

官方材料直说：Event Sourcing 复杂、迁移成本高、对多数系统不值得。citeturn17view3  
RT 的正确姿势是：把 messages 当 append‑only 审计日志 + ledger snapshots（checkpoints）做恢复点，而不是一开始就追求事件投影、版本化事件处理器、补偿事件等全套。

### 过度工程：把 RT 当成通用 agent runtime 去实现完整图执行、并行 superstep、reducers、subgraphs

LangGraph 的图模型很强，但它服务的目标包含复杂路由、并行节点、通用 orchestration；RT 的目标是“正确性/可恢复/省 token”，并且明确“不追求通用 runtime、不执行代码”。citeturn12view1turn9view0turn12view0  
如果你没有清晰需求（并行分支合并、复杂条件路由、子图复用），引入完整图 runtime 大概率只会带来额外故障面与更难的调试。

### Open Questions

1) **RT 的 replay 语义到底是“复现”还是“重算”？**是否两者都要，并在 UI 上如何暴露？LangGraph 把 replay 与 fork 的语义区分得很清楚，但它的 replay 默认会重跑后续节点；RT 若要审计复现，需要额外的 artifact 冻结层。citeturn10view0turn12view0  
2) **证据对象（evidence）如何做稳定引用？**是 message_id + snippet/hash 足够，还是需要对外部文档做段落级锚点？（这会直接影响“evidence‑backed summary”的可审计性。）citeturn18view1turn17view0  
3) **claims_or_facts 的最小本体模型**：是否需要区分 claim/assumption/constraint/risk？如果区分，typed state 的 schema 版本演进机制要怎么做，避免后期断档？Event Sourcing 文档强调 schema/versioning 的挑战。citeturn17view0turn17view3  
4) **任务粒度**：task 到底以“阶段内子任务”为粒度，还是以“每个 agent 发言/回合”为粒度？Magentic‑One 的 Progress Ledger 是 step‑level；RT 若用过细粒度会造成 checkpoint 爆炸与 UI 噪音。citeturn18view1turn6view1  
5) **judge 的边界**：哪些校验必须是确定性的结构校验（例如 evidence_ids 非空、stage 状态一致），哪些允许用模型做软评估？LangGraph 的 reducer/state 更新语义让结构校验更可行，但你仍需定义“硬约束 vs 软评估”的产品边界。citeturn2view2turn9view1  

### Source List

- Fourney et al. **Magentic‑One: A Generalist Multi‑Agent System for Solving Complex Tasks**（论文 PDF / 技术报告）。citeturn2view0turn18view1turn18view2turn19view0  
- entity["company","Microsoft","software company"] Research 官方文章：**Magentic‑One: A Generalist Multi‑Agent System for Solving Complex Tasks**（含 dual‑ledger 概述与仓库/报告入口）。citeturn15view0  
- Microsoft AutoGen 官方文档：**Magentic‑One — AutoGen user guide**（dual‑ledger outer/inner loop 描述）。citeturn2view1  
- LangGraph 官方文档：**Graph API overview**（State/Nodes/Edges、schema、reducers、messages in state、add_messages）。citeturn9view0turn9view1turn2view2  
- LangGraph 官方文档：**Persistence**（checkpoints/threads、time travel、fault tolerance、pending writes）。citeturn2view3  
- LangGraph 官方文档：**Use time‑travel**（Replay/Fork 语义、update_state、分支历史不回滚覆盖）。citeturn10view0  
- LangGraph 官方文档：**Interrupts**（pause/resume、保存 state、thread_id 作为恢复指针）。citeturn2view4  
- LangGraph 官方文档：**Durable execution**（durable execution 定义、恢复时 replay 起点、determinism/idempotence/tasks）。citeturn12view0  
- LangGraph 官方文档：**Memory**（短期/长期记忆、生产 checkpointer、trimming/summary、管理 checkpoints）。citeturn16view0  
- Microsoft Learn（Azure Architecture Center）：**Event Sourcing pattern**（append‑only events、audit trail、可通过 replay 物化视图）。citeturn17view0  
- Microsoft Learn（Azure Architecture Center）：**Materialized View pattern**（视图可丢弃可重建、专用缓存）。citeturn17view1  
- Microsoft Learn（Azure Architecture Center）：**CQRS pattern**（事件作为 write model、read model 生成物化视图、复杂度与快照建议）。citeturn17view2  
- MicrosoftDocs/architecture-center（官方仓库内容页）：**event-sourcing-content.md**（Event Sourcing 复杂、迁移成本高、对多数系统不划算）。citeturn17view3  
- Wu et al. **AutoGen: Enabling Next‑Gen LLM Applications via Multi‑Agent Conversation**（一手论文 PDF，conversation programming/message‑centric 范式）。citeturn14view0  
- Packer et al. **MemGPT: Towards LLMs as Operating Systems**（一手论文，context window 限制与分层记忆动机）。citeturn13view2  
- Feng et al. **Get Experience from Practice: LLM Agents with Record & Replay (AgentRR)**（一手论文，record‑and‑replay + 结构化 experience + check functions）。citeturn13view0