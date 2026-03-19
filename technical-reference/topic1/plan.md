# Topic 1 开发计划：Agent Reply 结构化设计
> 基于 cross-reference-analysis-by-claude.md | 2026-03-19

## 依赖关系总览

```
T1-1 (sources[] 体系)
  └── T1-2 (claim-evidence schema)
        ├── T1-3 (parse-and-retry 解析层)
        └── T1-4 (moderator 聚合升级)
              └── T1-5 (UI 逻辑/叙事分离)
T1-6 (schema 版本控制) ── 可与 T1-1 并行启动，T1-2 完成后锁定
```

**可并行**：T1-1 与 T1-6 可同时启动；T1-3 与 T1-4 在 T1-2 完成后可并行。

---

## T1-1：自建 sources[] 体系（不依赖平台 citations）

**优先级**：P0
**依赖**：无（起点任务）
**可并行**：可与 T1-6 同时进行

### 背景
Claude/Bedrock 平台上 structured outputs 与 citations 功能存在硬冲突（同时启用报 400）。RT 必须自建 sources[] 体系。

### 任务
- [ ] 定义 `SourceEntry` 类型：`{ source_id: string, label: string, url: string, quote?: string, capturedAt: string }`
- [ ] `source_id` 生成规则：对 `url + fragment` 做 SHA-256 前 8 位，保证 canonical 唯一性
- [ ] 在 agent reply schema 中增加顶层 `sources: SourceEntry[]` 数组
- [ ] 在 `schema.ts` 中增加 `agent_sources` 表（session_id, message_id, source_id, label, url, quote）
- [ ] 在 `repository.ts` 中增加 `upsertAgentSources` 函数

### 验收
- 同一 URL 在同一 session 内生成相同 source_id
- sources[] 可独立于 claims[] 存在（允许空 claims 但有 sources）

---

## T1-2：claim-evidence 绑定 schema（核心结构）

**优先级**：P0
**依赖**：T1-1 完成
**可并行**：完成后 T1-3 / T1-4 可并行

### 背景
每条 claim 必须携带 `citations[]`（引用 sources[] 中的 source_id）或非空 `gapReason`，���者互斥且必填。

### 任务
- [ ] 定义 `ClaimEntry` 类型：
  ```ts
  type ClaimEntry = {
    text: string
    citations?: string[]        // source_id refs，与 gapReason 互斥
    gapReason?: 'insufficient-data' | 'conflicting-sources' | 'out-of-scope'
  }
  ```
- [ ] 定义完整 `AgentReply` schema（Minimal 版）：
  ```ts
  {
    position: 'support' | 'oppose' | 'neutral' | 'uncertain'
    confidence: number          // 0.0–1.0
    claims: ClaimEntry[]        // 至少 1 条
    body: string                // 叙事字段，自由文本
    sources: SourceEntry[]
  }
  ```
- [ ] 在 `types.ts` 中导出上述类型
- [ ] 编写 `validateAgentReply(reply)` 函数：检查每条 claim 的 citations/gapReason 互斥约束
- [ ] 编写单元测试：有 citations 无 gapReason ✓、有 gapReason 无 citations ✓、两者都有 ✗、两者都无 ✗

### 验收
- `validateAgentReply` 对所有边界情况返回正确结果
- schema 层级不超过 3 层，optional 字段最小化

---

## T1-3：parse-and-retry 解析层

**优先级**：P0
**依赖**：T1-2 完成
**可并行**：可与 T1-4 同时进行

### 背景
逻辑字段（position、confidence、claims[].gapReason）使用 parse-and-retry；叙事字段（body）保持自由生成，不做约束解码。

### 任务
- [ ] 实现 `parseAgentReply(raw: string): AgentReply | null`：
  - 第一层：直接 JSON.parse
  - 第二层：截取第一个 `{` 到最后一个 `}` 后重试
  - 第三层：将失败样本喂回 LLM，要求只输出修复后的 JSON
- [ ] 实现 `retryWithRepair(raw: string, model): Promise<AgentReply>`：第三层修复逻辑
- [ ] 在 agent 调用链中集成：LLM 输出 → parseAgentReply → validateAgentReply → 失败则 retryWithRepair（最多 1 次）
- [ ] 记录解析成功率指标到 `ledger_validation_metrics` 表

### 验收
- 解析成功率 ≥ 95%（在测试集上）
- 第三层修复不超过 1 次，超出则返回 null 并记录 ESCALATE

---

## T1-4：moderator 聚合升级（读逻辑层）

**优先级**：P1
**依赖**：T1-2 完成
**可并行**：可与 T1-3 同时进行

### 背景
Moderator 聚合只能读逻辑字段（position、confidence、claims[]），不能解析 body 叙事文本。

### 任务
- [ ] 重构 moderator 的 `aggregateReplies` 函数，输入改为 `AgentReply[]`（结构化）而非原始消息文本
- [ ] 实现置信度加权聚合：`final = Σ(position_weight × confidence) / Σ(confidence)`
- [ ] 实现 position 分布统计：support/oppose/neutral/uncertain 各自计数
- [ ] 实现 gap coverage 分析：统计 gapReason 分布，识别高频证据缺口
- [ ] 当任一 agent confidence < 0.5 时，在 moderator 输出中标注 `low_confidence_agents[]`

### 验收
- moderator 不再解析任何 body 文本字段
- 置信度加权结果与简单多数投票结果的差异可被记录和比较

---

## T1-5：UI 逻辑/叙事分离

**优先级**：P1
**依赖**：T1-4 完成
**可并行**：无

### 任务
- [ ] Agent reply 卡片组件：逻辑区（position badge、confidence bar、claims 列表）与叙事区（body 文本）物理分离
- [ ] Claims 列表：每条 claim 显示 citations 标签（[S1][S2]）或 gapReason 标签
- [ ] 点击 citation 标签时，侧边栏展示对应 source 的 quote 原文
- [ ] 移除任何将 confidence 数值直接展示为"可信度 X%"的 UI 文案
- [ ] 低置信度 agent（confidence < 0.5）在卡片上显示警告标记，不隐藏

### 验收
- UI 审查：不出现"已验证"、"可信度评分"等权威化文案
- 点击任意 citation 标签均能展示原文 quote

---

## T1-6：schema 版本控制机制

**优先级**：P2
**依赖**：无（可与 T1-1 并行启动）
**可并行**：可与 T1-1 同时进行，T1-2 完成后锁定 v1 schema

### 任务
- [ ] 在 `AgentReply` schema 中增加顶层 `schema_version: string` 字段（初始值 `"1.0"`）
- [ ] 实现 `migrateAgentReply(raw, version)` 函数：为缺失字段提供默认值
- [ ] 在数据库存储时记录 schema_version
- [ ] 文档化 v1 schema 的字段列表和约束，作为后续版本的 baseline

### 验收
- 历史 session 中无 schema_version 的记录能被正确读取（默认为 "1.0"）
- 新增可选字段不破坏旧版本解析
