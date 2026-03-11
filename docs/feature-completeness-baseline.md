# Round Table 功能完善度基线

更新时间：2026-03-11

## 模块盘点

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 会话启动 / SSE 讨论主流程 | 已闭环 | `start` 路由、orchestrator、流式事件消费已打通，主流程可运行。 |
| Moderator 分析 / 总结 | 已闭环 | opening、analysis、summary 都有独立 prompt 和持久化落点。 |
| 用户插话 | 可用但脆弱 | 运行中插话、入库、后续轮次消费已存在，但之前对不存在会话和非运行态的反馈不够清晰。 |
| Web Research | 已闭环 | 支持 auto/guided、source 持久化、rerun 预算、quality signals。 |
| 历史会话 / 纪要导出 | 已闭环 | 会话列表、详情、minutes 导出具备基本可用性。 |
| 回放 | 可用但脆弱 | replay 状态机已存在，但此前缺少自动化验证，易出现状态串联回归。 |
| 模型 / Persona 配置 | 已闭环 | agent、model、persona preset 与 custom note 已串到会话配置和回放数据。 |
| 停止讨论 | 已闭环 | stop flag、会话状态与 API 返回已通过测试覆盖。 |
| Safe Resume 2.0 | 可用但脆弱 | 已有 resume snapshot / preview 与恢复链展示，后续需继续加大异常路径压测。 |
| 执行闭环 2.0 | 可用但脆弱 | action item 已有 owner/due/priority/verified 字段，仍需持续补执行看板交互细节。 |
| 运行可观测 | 缺少保障 | session event 与 ops summary 已接入，仍需补更多运营级可视化。 |

## 代码已存在但缺少保障

- API 路由此前没有自动化测试，主流程主要依赖手测。
- orchestrator 缺少可重复验证，研究跳过、提前停止、总结持久化等行为没有测试保护。
- 前端 store 的 live / replay / reset 行为缺少回归测试。
- 启动时对 moderator API key 的校验存在漏口，可能导致晚失败。
- 流式错误反馈此前没有稳定映射到 UI 的统一错误提示。
- provider 异常与 timeout 事件虽已入库，但告警阈值与趋势分析仍需产品化。

## 本轮补完目标

- 为 API 路由、orchestrator、前端状态管理建立最小自动化验证。
- 修复启动校验与错误反馈中的高风险缺口。
- 保持当前产品交互模型不变，不扩展新的讨论能力。
