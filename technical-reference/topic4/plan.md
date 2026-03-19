# Topic 4 开发计划：Trust Boundary 与 Evidence 诚实表达
> 基于 cross-reference-analysis-by-claude.md + GPT 补充 | 2026-03-19

## 依赖关系总览

```
T4-1 (claim gate + claimType 约束)
  ├── T4-2 (untrusted content scan / injection 标注)
  └── T4-3 (gapReason 结构化降级)
        └── T4-4 (UI 诚实表达 + 频率格式)
T4-5 (原子化声明分解 + FActScore 验证) ── 依赖 T4-1
```

**可并行**：T4-2 与 T4-3 在 T4-1 完成后可并行；T4-5 依赖 T4-1。

---

## T4-1：Claim Gate + claimType 约束

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：完成后 T4-2 / T4-3 可并行

### 背景
extraction 仍可能被 summary 当作 verification 使用。需在 summary 生成之前增加 claim gate，强制区分 extraction 与 verification。

### 任务
- [ ] 定义 `ClaimType` 枚举：`'allowed_without_evidence' | 'requires_evidence' | 'gap_only'`
- [ ] 为每条进入 summary 的 claim 增加字段：
  ```ts
  {
    claimType: ClaimType
    evidenceRefs: string[]          // source_id 列表
    verificationStatus: 'captured' | 'extracted' | 'evidence_backed' | 'inferred' | 'ungrounded'
    uncertaintyLabel: 'high' | 'medium' | 'low' | 'unknown'
  }
  ```
- [ ] 实现 `runClaimGate(claims)` 函数：
  - `requires_evidence` 且 `evidenceRefs` 为空 → 阻断，返回 gapReason
  - `gap_only` claim 只允许进入 gap / unresolved 区块，不进入 recommendation 主体
  - `allowed_without_evidence` → 直接通过
- [ ] 将 `runClaimGate` 集成到 summary 生成前的 pipeline
- [ ] 单元测试：三种 claimType 的通过/阻断逻辑

### 验收
- `requires_evidence` 类型的 claim 在无 evidenceRefs 时不进入 summary
- `verificationStatus: 'extracted'` 的 claim 不得使用 "verified" 相关 UI 文案

---

## T4-2：Untrusted Content Scan（注入标注）

**优先级**：P1
**依赖**：T4-1 完成
**可并行**：可与 T4-3 同时进行

### 背景
外部检索内容默认不可信。需对提示注入可疑内容进行标注，降权或阻断进入最终 summary。

### 任务
- [ ] 实现 `scanForSuspiciousContent(pageContent)` 函数，检测以下模式：
  - 包含指令性语句（"ignore previous instructions"、"you are now"、"disregard"）
  - 包含角色扮演触发词
  - 包含异常长度的隐藏文本（>500 chars 无空格）
- [ ] 对可疑内容标注 `suspicionLevel: 'low' | 'medium' | 'high'`
- [ ] `high` 级别：先隔离为 `manual_review_required`，不自动进入 summary evidenceRefs
- [ ] `medium` 级别：允许进入 research source 列表，但在 claim 上标注 `injectionRisk: true`
- [ ] 在 ops dashboard 中展示 `suspicious_content_flagged_rate` 指标

### 验收
- 测试集：10 个已知注入样本，检出率 ≥ 80%
- high 级别来源不出现在任何 summary 的 evidenceRefs 中

---

## T4-3：gapReason 结构化降级

**优先级**：P0
**依赖**：T4-1 完成
**可并行**：可与 T4-2 同时进行

### 背景
research 缺失时必须显式降级，不允许静默退化。输出结构化 gapReason，而非以模型参数知识静默填充。

### 任务
- [ ] 定义 `GapReasonEntry` 类型：
  ```ts
  {
    topic: string
    reason: 'search_failed' | 'source_inaccessible' | 'insufficient_evidence' | 'conflicting_sources' | 'out_of_scope'
    searchScope?: string        // 已搜索的范围描述
    accessStatus?: string       // 403 / timeout / empty_result 等
    nextAction?: string         // 建议用户的下一步
  }
  ```
- [ ] 在 research agent 失败时生成 `GapReasonEntry`，写入 ledger 的 `evidenceGaps[]` 字段
- [ ] 在 summary 生成 prompt 中注入 `evidenceGaps`，明确禁止用参数知识填充
- [ ] 实��降级决策树：search_failed → 重试 1 次 → 仍失败 → 生成 gap_only claim

### 验收
- research 失败场景下 summary 中出现对应 gap 标注，不出现无来源断言
- `gap_only_claim_ratio` 指标可被统计

---

## T4-4：UI 诚实表达 + 频率格式不确定性

**优先级**：P1
**依赖**：T4-3 完成
**可并行**：无

### 背景
UI 文案中"Verified / 已验证"类词汇在未完成独立验证时属于误导。不确定性表达优先使用频率格式。

### 任务
- [ ] 全局替换误导性 UI 文案：
  - 禁止：`已验证`、`Verified`、`Confirmed`、`Sources confirm`、`经证实`
  - 替换为：`来源显示`、`根据检索到的资料`、`基于现有数据`
- [ ] 不确定性表达优先改为“来源覆盖 + 支撑情况”而不是裸百分比
  - 若当前实现拿不到可靠的 `N of M support`，先展示 `有来源支撑 / 来源不足 / 存在冲突来源`
- [ ] 为每条 claim 的 `verificationStatus` 对应不同 UI 样式：
  - `evidence_backed` → 绿色引用标记
  - `captured` → 灰色边框标记（悬停提示"已捕获页面，待人工复核"）
  - `extracted` → 灰色引用标记（悬停提示"已提取，未独立验证"）
  - `inferred` → 橙色标记（悬停提示"推断性结论"）
  - `ungrounded` → 红色标记（悬停提示"无来源支撑"）
- [ ] gap 条目在 UI 中显示为独立的"信息缺口"卡片，包含 nextAction 建议

### 验收
- UI 审查：无任何 "verified/已验证" 文案出现在 extraction-only 场景
- 频率格式在所有不确定性表达位置生效

---

## T4-5：原子化声明分解 + 逐条接地验证（后续增强）

**优先级**：P3
**依赖**：T4-1 完成
**可并行**：无

### 背景
参照 FActScore 方法，将长文本摘要分解为原子声明，逐一进行来源蕴含验证，防止"全覆盖假象"反模式。

### 任务
- [ ] 实现 `decomposeToAtomicClaims(summaryText)` 函数：将段落分解为单一事实陈述
- [ ] 对每条原子 claim 运行 NLI 蕴含检测（entailment check）：claim 是否被 evidenceRef 的 quote 所蕴含
- [ ] 蕴含结果写入 claim 的 `verificationStatus` 字段
- [ ] 统计 `atomic_claim_coverage_rate`：有证据支撑的原子 claim 占总数的比例
- [ ] 在 ops dashboard 中展示该指标趋势

### 验收
- 原子分解后每条 claim 平均长度 < 30 词
- NLI 检测结果与人工标注的一致率 ≥ 75%（在测试集上）

### 调整说明
- 此任务保留为后续增强，不进入下一阶段主开发。原因：当前 RT 还未完成 claim gate、honest UI 和 injection 标注，先上 NLI/FActScore 会引入额外误差和实现复杂度。
