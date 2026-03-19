# Round Table Topic2 Cross Review（第二段 Prompt 报告交叉评审）

## 1) 评审范围与方法
本交叉评审覆盖以下 4 份报告：
- `.../topic2/面向 RT 决策产品的 Message-Driven 多智能体流程向 Task Ledger : Typed State 的演进研究 by gpt5.4.md`
- `.../topic2/决策摘要评审门设计：在信任优先系统中避免伪权威的评估器架构 by claude.md`
- `.../topic2/智能体决策系统演进研究 by gemini.md`
- `.../topic2/Message-Driven多智能体决策流程向Task-Ledger:Typed-State驱动系统的演进研究报告 by minimax 2.5.md`

评审标准：
- 证据质量：是否主要依赖官方文档/论文，而非二手社区帖子
- 与 RT 场景适配度：是否针对“决策产品（非代码执行 agent）”
- 可落地性：能否在当前系统低风险增量实施
- 风险意识：是否识别过度工程和信任误导

## 2) 高置信共识（建议直接采纳）

### A. 状态架构：`history + typed ledger` 共存，而不是二选一
四份报告一致认为：只靠消息历史会在 `resume/replay/follow-up/UI hydration` 上出现不可控和高成本；应引入结构化状态（Task Ledger/Typed State）作为“规范状态对象”。

对 RT 的价值：
- UI 不再从自然语言“猜状态”，直接读状态快照
- resume 不再依赖“重新喂历史+再推理”
- follow-up 可在已有状态上增量推进，降低 token 消耗和状态漂移

### B. 不应直接上完整 DAG Runtime
GPT/Minimax/Gemini 都给出同一结论：RT 当前阶段应优先 `FSM + typed state + checkpoint`，而不是引入完整图运行时（并行 superstep/reducer/subgraph 等）。

对 RT 的价值：
- 明显降低实现和调试复杂度
- 避免“平台化过度设计”拖慢产品迭代
- 先满足恢复、回放、可追溯，再决定是否需要图级并行

补充的更精确判据（本次新增）：
- 当前 RT 编排是 moderator 主导的顺序写状态模型，不是并行多节点同时写状态模型。
- LangGraph 的 reducer/superstep 复杂度主要在“并行写冲突合并”场景收益显著。
- 因此 RT 当下不上完整 DAG 的关键理由不是“流程固定”本身，而是“并发模型不匹配”；若未来引入并行子任务（如并行检索/并行评审），再重新评估图运行时。

### C. replay 需要语义拆分：审计回放 vs 重新执行
GPT 报告给出最关键、最容易被忽略的点：`replay` 必须区分
- 审计回放：读历史产物，不重跑模型
- 探索回放：从旧 checkpoint 分叉，允许重跑并产生新分支

对 RT 的价值：
- 避免“用户以为在看历史，系统却在重算”的信任破坏
- 为未来“分叉比较方案”打下清晰语义基础

### D. 评审器（Judge）应是内部 QA，不是对用户的权威分
Claude 报告的质量最高，且与其他报告不冲突：评审器适合做结构校验与缺陷反馈，不适合输出“决策正确性”分数给用户。

对 RT 的价值：
- 防止“伪权威”产品风险
- 能用于内部质量门、回归检测、摘要重写触发
- 更可控地做评估漂移治理

## 3) 有价值但需修正/约束采纳的观点

### A. “RT 需要 Progress Ledger”表述需要收敛
Gemini 强调保留 Progress Ledger；GPT/Minimax 倾向“进度能力内嵌到 Task Ledger（phase/cursor/history）”。

建议：
- 这是架构边界分歧，不仅是术语分歧
- 在 RT 用最小进度语义字段即可（如 `current_phase`、`phase_history`、`cursor.waiting_on`），不单独引入复杂第二账本
- 推荐合并方案：采用 GPT 的 `cursor` 精确定义 + Minimax 的内嵌思路
  - `cursor.next_task_id`：下一步做什么
  - `cursor.waiting_on`：当前等待谁（至少 `human_input | moderator_review | agent_processing | none`）

### B. “评分化评审”应降级为“通过/失败+反馈”
Claude 对此证据充分；Gemini 中“独立评分”说法可保留在内部实验层，不应进入用户主链路。

建议：
- 用户面只展示“结构检查结果与缺口”
- 内部可记录维度级指标，但不暴露总分做信任锚

### C. 资料来源分层使用
Gemini/Minimax 中有不少 Reddit/Dev.to/Medium 类来源，可用于工程经验参考，但不应作为架构决策主证据。

建议：
- 决策主依据优先官方文档/论文（LangGraph、Magentic-One、Anthropic/NeurIPS 等）
- 社区材料只作为“实现提示”而非“规范依据”

## 4) 对 RT 的目标架构建议（可执行）

### 4.1 最小状态模型（第一阶段）
建议先落地以下核心字段：
- `session_id/thread_id`
- `ledger_version`
- `current_phase`
- `phase_history[]`
- `evidence[]`（含来源引用）
- `decision_snapshot`（结构化，不仅是文本）
- `cursor`（`waiting_on` / `next_step`）
- `checkpoints[]`（关键里程碑）

同时保留：
- `all_messages` 作为审计事件流（append-only）

新增约束（Judge 可实现性）：
- 若要落地 Claude 报告中的 Risk Disclosure 维度，ledger 必须有“可枚举、可引用、可校验”的风险结构。
- 实现可二选一：
  - 顶层 `risk_register[]`（推荐，便于统一校验与统计）
  - 或在 `decision_snapshot.options[].risks[]` + 映射规则中保证可程序化聚合
- 若风险只存在自然语言段落中，Judge 将退化为软评估，无法做稳定结构校验。

新增约束（版本演进）：
- `ledger_version` 必须配套向前兼容读取策略，否则历史 checkpoint 在 schema 演进后会失效，直接影响 resume。
- 最小策略：
  - 读取时按版本做默认值补全（missing fields defaulting）
  - 保留版本化解码器（v1/v2 adapter）
  - 对关键快照提供懒迁移（read-time migrate）或批迁移任务

### 4.2 运行时模型
- 编排：有限状态机（固定阶段+受控跳转）
- 中断恢复：在关键点写 checkpoint
- follow-up：作为新增事件驱动状态更新，不再“全历史重喂”

### 4.3 Judge 接入模型
- 输入：结构化状态对象 + 必要上下文引用
- 输出：维度级 `PASS/FAIL` + 可执行反馈
- 循环：最多 1-2 次重写，超过则转人工确认/提示
- 展示：对外仅展示“需人工复核/缺失项”，不展示权威评分

## 5) 迁移路线（按风险递增）

### Phase 1：Shadow Ledger（低风险）
- 从现有消息流抽取结构化状态并持久化
- 不改变现有主流程，仅用于观测与校验

新增放行门槛（本次补充）：
- Shadow 阶段不能只“旁路抽取”，必须建立提取质量基线再进入 Phase 2。
- 建议至少引入以下校验：
  - 抽样一致性评估：对比“人工/二评审器标注状态”与 ledger 抽取状态
  - 核心字段分项准确率：优先评估 `evidence[]`（高于 `current_phase` 的优先级）
  - 放行阈值：设置明确门槛（例如 evidence 覆盖与引用正确率达到目标）再切 Hybrid Read Path
  - 失败处理：阈值未达标时仅保留影子写入，不允许 UI 主路径切换到 ledger

### Phase 2：Hybrid Read Path
- UI 逐步改为优先读 ledger（阶段、证据、决策快照）
- 消息流继续保留，作为审计与证据展开

### Phase 3：State-led Resume/Follow-up
- resume/follow-up 改为“加载 checkpoint + 增量事件”
- 引入审计回放与探索分叉两类 replay 语义

### Phase 4：Quality Gate Integration
- 接入 judge 作为内部质量门
- 建立维度失败触发定向重写与告警

## 6) 明确不建议本轮做的事
- 不引入完整通用 DAG runtime
- 不把评审分数作为用户可见“可信度”标签
- 不做全量 Event Sourcing 重构
- 不以社区帖子作为架构定案依据

补充：
- 不在 `cursor.waiting_on` 语义未冻结前推进 resume 主链路切换（否则会回退到“重新推理当前状态”）

## 7) 结论（给本项目的决策建议）
这批报告里最有价值的组合是：
- 用 GPT/Minimax 的“最小 typed-state + checkpoint + FSM”作为演进主线
- 用 Claude 的“Judge 去权威化（内部 QA 化）”作为质量治理边界
- 对 Gemini/社区来源中的建议做“降权采纳”，仅保留可验证、低耦合、可灰度的部分

如果按“成本/收益/风险”排序，RT 下一步最值得投入的是：
1. 先把 `history + ledger` 双轨打通（Shadow + Hydration）
2. 明确 resume/replay/follow-up 的状态语义与分叉语义
3. 再接 Judge 质量门，且严格限制为内部信号
