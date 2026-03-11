# API Error Codes

更新时间：2026-03-11

## 统一结构

所有 API 错误返回统一结构：

```json
{
  "error": "Human-readable message",
  "code": "INVALID_INPUT",
  "details": {}
}
```

## 代码表

| Code | 含义 | 常见触发 |
| --- | --- | --- |
| `INVALID_INPUT` | 参数不合法或缺失 | topic 为空、缺少 resumeFromSessionId |
| `NOT_FOUND` | 资源不存在 | session/source/research 不存在 |
| `CONFLICT` | 当前状态不允许该操作 | 非 running 状态 interject、不可恢复状态 resume |
| `AUTH_MISSING_KEY` | provider key 缺失导致不可运行 | moderator 或 participant 无可用 key |
| `PROVIDER_UNAVAILABLE` | 外部 provider 不可用 | research rerun 失败 |
| `TIMEOUT_STARTUP` | 启动超时 | 首 token 超时 |
| `TIMEOUT_IDLE` | 流式空闲超时 | 中途长时间无 token |
| `TIMEOUT_REQUEST` | 请求超时 | chat/stream 请求整体超时 |
| `RATE_LIMITED` | 达到预算或频率限制 | research rerun 超过 `maxReruns` |
| `PARSE_FAILED` | 解析失败 | JSON 解析异常（预留） |
| `INTERNAL_ERROR` | 未分类系统异常 | 兜底错误（预留） |

## 前端映射

- `useDiscussionStream.extractErrorMessage` 会优先显示 `[code] message`。
- 没有 `code` 时仍回退到旧格式，确保兼容历史接口。
