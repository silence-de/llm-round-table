# Topic 6 开发计划：轻量级决策记忆架构设计
> 基于 cross-reference-analysis-by-claude.md + GPT 补充 | 2026-03-19

## 依赖关系总览

```
T6-1 (session_end_reflection schema + 写入点)
  ├── T6-2 (follow-up 注入白名单)
  └── T6-3 (lessons learned 生命周期规则)
        └── T6-4 (calibration 预测-结果对账)
T6-5 (决策进度仪表盘) ── 依赖 T6-1 + T6-2
```

**可并行**：T6-2 与 T6-3 在 T6-1 完成后可并行；T6-5 依赖 T6-1 + T6-2。

---

## T6-1：Session-end Reflection Schema + 写入点

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：完成后 T6-2 / T6-3 可并行

### 背景
会话结束时批量写入，严禁运行时连续写入。需定义 session_end_reflection 最小 schema 并在单点触发生成。

### 任务
- [ ] 定义 `SessionEndReflection` 类型：
  ```ts
  {
    sessionId: string
    generatedAt: string
    decisionSummary: string
    assumptionsWithStatus: AssumptionEntry[]   // { text, status: 'confirmed'|'refuted'|'open', howToFalsify }
    evidenceGaps: GapEntry[]                   // { topic, gapReason, nextAction }
    forecastItems: ForecastEntry[]             // { claim, probability, deadline, measurableOutcome }
    lessonsCandidate: LessonCandidate[]        // 候选教训，未提升为正式 lesson
  }
  ```
- [ ] 在 `schema.ts` 中增加 `session_reflections` 表
- [ ] 触发点：用户点击"结束决策" / session status 变为 `completed`
- [ ] 触发独立后台 LLM 实例（Summarizer）离线处理 transcript，不阻塞主流程
- [ ] 写入完成后原始 transcript 可冷归档（不删除，仅降低查询优先级）

### 验收
- session 完成后 `session_reflections` 表有对应记录
- 写入失���不影响 session 完成状态（异步写入，try/catch）

---

## T6-2：Follow-up 注入白名单

**优先级**：P0
**依赖**：T6-1 完成
**可并行**：可与 T6-3 同时进行

### 背景
follow-up 只注入结构化决策状态，不注入原始 transcript。白名单机制防止旧偏见和过期信息污染新会话。

### 任务
- [ ] 定义 follow-up context 注入白名单（仅以下内容进入新会话 prompt）：
  - `decisionSummary`（上次结论）
  - `assumptionsWithStatus`（未关闭假设，status: 'open'）
  - `evidenceGaps`（证据缺口）
  - `lessonsCandidate` 中已提升为正式 lesson 且未过期的条目
- [ ] 明确禁止注入：原始思维链、低置信度旧猜测、过期 lessons、完整 transcript
- [ ] 实现 `buildFollowUpContext(reflection, lessons)` 函数：按白名单组装注入内容
- [ ] 在 follow-up session 初始化时调用 `buildFollowUpContext`，替换当前的 transcript 回放逻辑
- [ ] 单元测试：验证禁止注入的内容不出现在 follow-up prompt 中

### 验收
- follow-up session 的初始 prompt token 数 < 原始 session transcript 的 30%
- `follow_up_token_reduction` 指标可被统计

---

## T6-3：Lessons Learned 生命周期规则

**优先级**：P1
**依赖**：T6-1 完成
**可并行**：可与 T6-2 同时进行

### 背景
单次观察不应提升为全局教训。需要 pattern_count、expiry_policy、conflict_marker 机制。

### 任务
- [ ] 定义 `Lesson` 类型：
  ```ts
  {
    id: string
    rule: string                    // 面向未来时态的行动指令（非第一人称叙事）
    applicabilityConditions: string
    evidenceBasis: string[]         // session_id 列表
    patternCount: number            // 观察到该模式的次数
    expiryPolicy: {
      reviewAfterSessions: number   // N 个 session 后触发复审
      autoFlagIfContradicted: boolean
    }
    conflictMarker?: string         // 与哪条 lesson 存在冲突
    status: 'candidate' | 'active' | 'expired' | 'contradicted'
  }
  ```
- [ ] 提升规则：`patternCount >= 3` 且 `evidenceBasis.length >= 2` 才从 candidate 提升为 active
- [ ] 过期规则：超过 `reviewAfterSessions` 未被引用 → status 变为 `expired`
- [ ] 冲突检测：新 lesson 与现有 active lesson 语义相反时，标注 `conflictMarker`
- [ ] 在 `schema.ts` 中增加 `lessons` 表
- [ ] 实现 `GET /api/lessons`（按 status 过滤）和 `POST /api/lessons/[id]/promote`

### 验收
- patternCount < 3 的 lesson 不出现在 follow-up 注入白名单中
- expired lesson 不进入新会话 prompt

---

## T6-4：Calibration 预测-结果对账

**优先级**：P1
**依赖**：T6-3 完成
**可并行**：无

### 背景
将预测作为一等对象管理，到期时自动触发验证，计算 Brier 分数，联通 lesson 命中追踪。

### 任务
- [ ] 确认 `forecastItems` 中每条预测包含：可观测事件定义、截止日期、概率（0-1）、度量口径
- [ ] 实现到期检测：定时任务每日扫描 `forecastItems`，对 deadline 已过的预测发送复核提醒
- [ ] 实现 `recordForecastOutcome(forecastId, actualOutcome)` 函数
- [ ] 实现 Brier 分数计算：`brier = (probability - outcome)^2`，按 session 和全局汇总
- [ ] 在 calibration 面板展示：Brier 分数趋势、预测-结果对照表、lesson 命中率
- [ ] `lesson_hit_rate` 指标：follow-up 中被引用的 lesson 占 active lessons 的比例

### 验收
- 到期预测在 deadline + 1 天内触发提醒
- Brier 分数计算结果与手动计算一致

---

## T6-5：决策进度仪表盘（Follow-up 启动界面）

**优先级**：P2
**依赖**：T6-1 + T6-2 完成
**可并行**：无

### 背景
MiniMax 报告独有的产品化视角：follow-up session 启动时，系统自动呈现当前决策状态，将抽象记忆架构转化为用户可操作的产品功能。

### 任务
- [ ] 实现 `DecisionProgressDashboard` 组件，展示：
  - 当前决策状态（decisionSummary 摘要）
  - 待验证预测列表（含到期日期、概率）
  - 待确认假设列表（status: 'open' 的条目）
  - 待填补证据缺口列表（含 nextAction 建议）
- [ ] 该组件作为 follow-up session 的第一屏，用户确认后才进入对话界面
- [ ] 用户可在仪表盘中直接标记假设为 confirmed/refuted，更新 `assumptionsWithStatus`
- [ ] 用户可在仪表盘中录入预测结果，触发 T6-4 的 `recordForecastOutcome`

### 验收
- follow-up session 启动时仪表盘正确加载上次 reflection 数据
- 假设状态更新后在下次 follow-up 的注入白名单中反映
