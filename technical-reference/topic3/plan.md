# Topic 3 开发计划：Judge Gate 设计
> 基于 cross-reference-analysis-by-claude.md + GPT 补充 | 2026-03-19

## 依赖关系总览

```
T3-1 (deterministic pre-check 层)
  └── T3-2 (judge 三态升级 PASS/REWRITE/ESCALATE)
        ├── T3-3 (rewrite 指令约束)
        └── T3-4 (ops calibration 闭环)
T3-5 (UI 去权威化) ── 可与 T3-1 并行启动
T3-6 (偏差扰动测试集) ── 依赖 T3-4
```

**可并行**：T3-1 与 T3-5 可同时启动；T3-3 与 T3-4 在 T3-2 完成后可并行。

---

## T3-1：Deterministic Pre-check 层（L0/L1）

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：可与 T3-5 同时进行

### 背景
L0/L1 deterministic checks 在 LLM judge 之前运行，失败直接回退 generator，不消耗 LLM 资源。

### 任务
- [ ] 实现 `runL0Checks(summary)` — 结构/格式检查（<100ms）：
  - 当前 `DecisionSummary` 必填字段是否非空（`summary`、`recommendedOption`、`why`、`risks`、`nextActions`、`evidence`）
  - `confidence`、`evidence` 等核心字段是否满足最小结构约束
  - 避免引入与当前 schema 不一致的“固定章节名”检查
- [ ] 实现 `runL1Checks(summary, evidenceSet)` — 引用可解析性检查（<200ms）：
  - `summary.evidence[].sourceIds` 中的 source_id 是否在 research sources / claim links 中存在
  - `summary.risks` 是否覆盖 ledger 中的高优先风险
  - trust violations / unsupported claims 是否可被结构化识别
- [ ] L0/L1 失败时直接生成 `REWRITE` 所需 issue 列表，不进入 L2 LLM judge
- [ ] 在 `judge.ts` 中将 L0/L1 作为 `evaluateSummary` 的前置步骤

### 验收
- L0 执行时间 < 100ms，L1 < 200ms
- L0/L1 失败不触发任何 LLM 调用

---

## T3-2：Judge 三态升级（PASS / REWRITE / ESCALATE）

**优先级**：P0
**依赖**：T3-1 完成
**可并行**：完成后 T3-3 / T3-4 可并行

### ���景
当前 `JudgeDimension` 以 `score` 为一等字段，缺少 `ESCALATE` 状态。需升级为三态门禁 + issue codes + evidence pointers。

### 任务
- [ ] 重构 `JudgeDimension` 类型：
  ```ts
  type JudgeDimension = {
    name: string
    result: 'PASS' | 'WARN' | 'FAIL' | 'ABSTAIN'
    issueCode?: string          // e.g. 'missing_risk_disclosure', 'unsupported_claim'
    evidencePointers?: string[] // 指向具体缺陷位置
    actionableFixes?: string[]  // 具体修复指令
    score?: number              // 降级为内部可选字段，不对外暴露
  }
  ```
- [ ] 重构 `JudgeResult` 顶层输出：
  ```ts
  type JudgeResult = {
    gate: 'PASS' | 'REWRITE' | 'ESCALATE'
    dimensions: JudgeDimension[]
    rewriteInstructions?: string[]  // 仅 REWRITE 时填写
    escalateReason?: string         // 仅 ESCALATE 时填写
  }
  ```
- [ ] 升级判定逻辑：
  - 所有硬性维度通过，且无严重 FAIL → gate: PASS
  - 存在可修复 FAIL → gate: REWRITE（附 rewriteInstructions）
  - 任一维度 ABSTAIN 或 rewrite 已达上限 → gate: ESCALATE
- [ ] 更新 `recordJudgeEvaluation` 持久化新结构

### 验收
- 单元测试覆盖三态所有触发路径
- `score` 字段不出现在任何 API response 或 UI 组件中

---

## T3-3：Rewrite 指令约束（外科手术式）

**优先级**：P0
**依赖**：T3-2 完成
**可并行**：可与 T3-4 同时进行

### 背景
Rewrite 必须是"缺陷驱动的外科手术"，禁止整体润色。防止 verbosity bias 和 RIPD（Rubric-Induced Preference Drift）。

### 任务
- [ ] 在 `rewrite-loop.ts` 中，rewrite prompt 模板强制约束：
  - 只允许：补齐遗漏证据点、修正引用映射、删除无证断言、补充风险披露
  - 明确禁止：为提高观感扩写、为迎合 rubric 改变结论立场、增加装饰性引用
- [ ] rewrite prompt 中注入具体 `actionableFixes[]`（来自 T3-2 的 JudgeDimension）
- [ ] 硬上限：最多 2 轮 rewrite，由非 LLM 状态机（计数器）控制，不可被 LLM 绕过
- [ ] 第 2 轮结束后仍有 FAIL → 自动升级为 ESCALATE，打包当前最佳版本 + 未解缺陷列表
- [ ] 在 `rewrite-loop.ts` 中记录每轮 rewrite 前后的 gate 状态变化

### 验收
- rewrite 轮次计数器测试：第 3 次调用直接返回 ESCALATE
- rewrite prompt 中不包含"提升质量"、"优化表达"等模糊指令

---

## T3-4：Ops Calibration 闭环

**优先级**：P1
**依赖**：T3-2 完成
**可并行**：可与 T3-3 同时进行

### 背景
Judge 结果进入 calibration/ops，而不是用户信任 UI。建立人工抽样闭环，记录 judge-human agreement。

### 任务
- [ ] 在 `judge_evaluations` 表中增加字段：`human_review_result`、`human_reviewer_id`、`reviewed_at`、`agreement: boolean`
- [ ] 优先复用现有 ops / calibration 数据接口，避免立即新增一套独立后台
- [ ] 提供最小人工复核录入入口：能记录 REWRITE/ESCALATE 样本的人审结果即可
- [ ] 实现 calibration 指标计算：`judge_human_agreement_rate`、`rewrite_trigger_rate`、`escalate_rate`
- [ ] 在 ops dashboard 中展示上述三个指标的趋势图（按周）

### 验收
- 人工复核界面可访问，不需要直接操作数据库
- 指标计算结果与手动统计一致

---

## T3-5：UI 去权威化

**优先级**：P0
**依赖**：无（可与 T3-1 并行启动）
**可并行**：可与 T3-1 同时进行

### 背景
用户侧只暴露"接缝"（证据来源追溯），不暴露分数或通过率。

### 任务
- [ ] 审查所有 UI 组件，移除以下内容：
  - judge score 数值展示
  - "AI 质检通过"、"可信度评分"、"Quality A"等权威化文案
  - rewrite 发生的提示（用户不应被告知发生了 rewrite）
- [ ] 为每条核心断言挂载交互式引用标记（悬停展示原始证据 quote）
- [ ] 对推断性结论注入不确定性声明（"基于现有数据推断"）
- [ ] 对用户只展示最终摘要中的证据缺口 / 不确定性，不直接暴露 judge 内部缺陷标签
- [ ] PDF 导出中同样移除所有 judge 相关评分信息

### 验收
- UI 审查清单：无任何 judge 分数或通过率展示
- 警告底纹在 PDF 导出中可见

---

## T3-6：偏差扰动测试集

**优先级**：P2
**依赖**：T3-4 完成
**可并行**：无

### 背景
每月运行 CALM 式扰动测试，追踪 judge 在 position bias、authority bias、verbosity bias 上的 robustness rate 趋势。

### 任务
- [ ] 构建扰动测试集（每类至少 10 个样本对）：
  - 位置交换：交换 summary 中两个段落的顺序
  - 冗长度扰动：在不改变内容的情况下增加 50% 字数
  - 虚假权威词注入：插入"根据哈佛研究"等伪引用
- [ ] 实现 `runBiasTest(testSet)` 函数：对每个扰动对运行 judge，记录判定是否翻转
- [ ] 计算 Robustness Rate（RR）= 扰动前后判定一致的比例
- [ ] 将 RR 趋势接入 ops dashboard

### 验收
- 测试集覆盖三类偏差，每类 ≥ 10 个样本对
- RR < 0.8 时触发 ops 告警
