# Topic4 Cross Reference Analysis (Trust Boundary / Honest Evidence Expression)

## 1) Scope
本文件回答 topic4 的核心问题：RT 这类 evidence-backed 决策系统，如何定义 trust boundary，并把 extraction / verification / uncertainty 诚实表达出来，而不制造“被验证过”的假象。

输入材料：
- Claude: `证据驱动决策系统的信任边界与诚实表达机制 by claude.md`
- GPT: `Evidence-backed 决策系统如何定义 Trust Boundary，并诚实表达 Extraction : Verification : Uncertainty by gpt5.4.md`
- Gemini: `信任边界与证据决策系统 by gemini.md`
- Minimax: `Evidence-Backed 决策系统的 Trust Boundary 与诚实表达研究报告 by minimax2.5.md`

## 2) Source Weighting
- 高权重：Claude / GPT / Minimax
  - 原因：topic 聚焦度高，且都把 trust boundary、allowed claims、uncertainty UI、injection 风险拆成结构化模型。
- 中权重：Gemini
  - 原因：方向正确，但工程细则与强制约束设计不如前三者完整。

## 3) Consensus / Disagreement Matrix

### 共识
- 外部检索内容默认是不可信输入，不因“来自网页”就自动提升可信级别。
- Extraction 与 Verification 必须严格区分。
- Claim 进入 summary 之前必须经过类型约束。
- Research 缺失时必须显式降级，不允许静默退化。
- 不确定性表达必须避免 fake precision 与误导性 verified 文案。

### 分歧
- 是否需要严格分层 trust taxonomy：
  - Minimax 更系统，提出 trust level 分层。
  - Claude/GPT 更重视最小工程可落地分类。
- 注入防护强度：
  - 各报告都承认 prompt-level 防御不够。
  - 但在实现上，哪些内容要做规则扫描、哪些要做模型扫描，细节不同。

## 4) Adoption Decisions

### 采纳
- 定义 claim class，并在 summary 之前做门控。
- 强制把 evidence refs、verification status、uncertainty status 变成结构字段。
- 统一 UI 语言：优先使用 `captured` / `extracted` / `manual review required`。
- Research 缺失/失败时进行显式降级。

### 部分采纳
- 完整 trust level 多层体系：
  - 可以作为设计参考
  - 第一阶段只实现最小必要分类，不先做过细分层

### 不采纳
- 把 extraction 结果包装成“已验证事实”
- 用来源质量替代内容正确性
- 仅靠 prompt 提示作为 trust boundary

## 5) RT-Specific Constraints
- RT 已有 browser verification 与 extraction 元数据，因此 topic4 不是从零开始。
- RT 当前最危险的问题不是“抓不到页面”，而是“抓到了之后如何被 summary 使用”。也就是 claim gate 还没有真正落地。
- RT 的核心风险是用户把“引用过网页”误认为“事实已验证”，所以 UI 文案与声明约束必须先于更复杂的验证体系。

## 6) Current Code Review
- 已具备：
  - DOM 优先提取、HTML fallback：[`browser-verify.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/search/browser-verify.ts)
  - `extractionMethod` / `extractionQuality`：[`browser-verify.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/search/browser-verify.ts), [`schema.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/db/schema.ts)
  - verification notes / manual review 提示：[`browser-verify.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/search/browser-verify.ts)
  - 部分“captured page”措辞已出现：[`session-artifact-files.ts`](/Users/chengxi-mba/Projects/round-table/src/lib/session-artifact-files.ts)
- 核心缺口：
  - 缺少 claim-level gate，导致 extraction 仍可能被 summary 当作 verification 使用。
  - 缺少 `allowed / disallowed / gap-only` 声明策略的系统化实现。
  - 缺少内容级 injection suspect 标注与降权逻辑。

## 7) Development Guidance

### P0
- 在 summary 之前增加 claim gate：
  - `allowed_without_evidence`
  - `requires_evidence`
  - `gap_only`
- 为每条 claim 增加：
  - `claimType`
  - `evidenceRefs`
  - `verificationStatus`
  - `uncertaintyLabel`
- 统一替换误导性词汇，确保 UI/PDF 中不把提取结果说成 verified。

### P1
- 增加 untrusted content scan：
  - 提示注入可疑标记
  - suspicious instructions 摘要
  - 降权或阻断进入最终 summary
- 为缺失 research 建立标准降级决策树。

### P2
- 引入最小 trust classification：
  - source-level
  - claim-level
  - summary-level
- 高风险主题启用更严格人工复核。

## 8) Validation Plan
- 测试：
  - extraction 不等于 verification 的断言测试
  - research 缺失场景降级测试
  - 注入可疑页面标记测试
- UI 验收：
  - 不出现误导性的 verified copy
  - claim 可追溯到 evidence refs
- 运行指标：
  - gap-only claim ratio
  - research degraded rate
  - suspicious content flagged rate

## 9) Bottom Line
topic4 最重要的不是“把网页抓得更全”，而是建立一条不撒谎的证据表达链：抓取、提取、验证、综合四者不能混写。这个结论与 RT 当前代码直接相关，且应作为下一阶段 summary/verification 体系重构的理论基础。
