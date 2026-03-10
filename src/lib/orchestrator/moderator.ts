import type { ResearchSource } from '../search/types';
import type {
  DecisionBrief,
  DecisionSummary,
  DiscussionAgenda,
} from '../decision/types';
import { parseDecisionSummary } from '../decision/utils';
import type { AgentResponse, ModeratorAnalysis } from './types';

export function buildOpeningPrompt(
  brief: DecisionBrief,
  agentNames: string[],
  agenda: DiscussionAgenda,
  researchBrief?: string,
  parentContext?: string
): string {
  return `你是一场圆桌讨论的主持人。参与者包括：${agentNames.join('、')}。

${buildDecisionContextBlock(brief, agenda, researchBrief, parentContext)}

请用简洁的方式：
1. 介绍今天的讨论议题
2. 将议题拆解为 2-3 个关键子问题，优先贴合目标与约束
3. 邀请各位参与者分享观点

用中文回答，保持专业但友好的语气。控制在 250 字以内。`;
}

export function buildAgentSystemPrompt(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  persona?: string,
  interjections?: string[],
  researchBrief?: string
): string {
  const base = `你是一场圆桌讨论的参与者。

${buildDecisionContextBlock(brief, agenda, researchBrief)}

请从你的专业视角出发，给出你的观点和分析。要求：
- 观点明确，有理有据
- 如果你有独特的视角，大胆提出
- 控制在 300-500 字
- 用中文回答`;

  const interjectionText =
    interjections && interjections.length > 0
      ? `\n\n用户在讨论中追加的要求：\n${interjections
          .slice(-3)
          .map((x, i) => `${i + 1}. ${x}`)
          .join('\n')}`
      : '';

  if (persona) {
    return `${base}\n\n你的角色设定：${persona}${interjectionText}`;
  }
  return `${base}${interjectionText}`;
}

export function buildAnalysisPrompt(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  responses: AgentResponse[],
  interjections?: string[],
  parentContext?: string
): string {
  const responsesText = responses
    .map((r) => `### ${r.displayName}\n${r.content}`)
    .join('\n\n');

  const interjectionText =
    interjections && interjections.length > 0
      ? `\n用户新增要求（需纳入分析）：\n${interjections
          .slice(-3)
          .map((x, i) => `${i + 1}. ${x}`)
          .join('\n')}\n`
      : '';

  return `你是圆桌讨论的主持人。
${buildDecisionContextBlock(brief, agenda, undefined, parentContext)}
${interjectionText}

各参与者的观点如下：

${responsesText}

请分析各方观点，用以下 JSON 格式回复（不要包含 markdown 代码块标记）：

{
  "agreements": [
    { "point": "共识点描述", "supporters": ["agent_id_1", "agent_id_2"] }
  ],
  "disagreements": [
    {
      "point": "分歧点描述",
      "positions": { "agent_id": "该参与者的立场" },
      "followUpQuestion": "针对该分歧的追问"
    }
  ],
  "shouldConverge": false,
  "moderatorNarrative": "2-3 句话的总结，用于向参与者播报"
}

注意：
- agreements 和 disagreements 中的 supporters/positions 使用参与者的 id（${responses.map((r) => r.agentId).join(', ')}）
- shouldConverge 为 true 表示各方已充分表达、分歧已缩小，可以进入总结阶段
- 如果 agenda 要求输出建议，请优先判断是否已经足够收敛
- 用中文填写所有描述文字`;
}

export function buildDebatePrompt(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  agentId: string,
  previousContent: string,
  disagreement: string,
  followUpQuestion: string,
  interjections?: string[]
): string {
  const interjectionText =
    interjections && interjections.length > 0
      ? `\n用户追加要求：\n${interjections
          .slice(-3)
          .map((x, i) => `${i + 1}. ${x}`)
          .join('\n')}\n`
      : '';

  return `继续圆桌讨论。
${buildDecisionContextBlock(brief, agenda)}
${interjectionText}

你此前的观点：
${previousContent}

主持人指出了以下分歧点：${disagreement}

主持人的追问：${followUpQuestion}

请回应这个追问，你可以：
- 坚持原有观点并补充论据
- 修正或调整你的立场
- 回应其他参与者的观点

控制在 200-300 字。用中文回答。`;
}

export function buildSummaryPrompt(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  allMessages: Array<{ agentId: string; displayName: string; content: string; phase: string }>,
  parentContext?: string
): string {
  const messagesText = allMessages
    .map((m) => `[${m.phase}] ${m.displayName}: ${m.content}`)
    .join('\n\n---\n\n');

  return `你是圆桌讨论的主持人。讨论已结束，请生成会议纪要。

${buildDecisionContextBlock(brief, agenda, undefined, parentContext)}

完整讨论记录：

${messagesText}

请生成结构化的会议纪要，格式如下：

# 圆桌讨论纪要

## 议题
${brief.topic}

## 参与者
（列出所有参与者）

## 核心观点汇总
（按参与者列出各自的核心观点，每人 1-2 句话）

## 共识
（列出各方达成的共识）

## 分歧与争议
（列出未解决的分歧，以及各方立场）

## 关键洞察
（讨论中出现的最有价值的 2-3 个洞察）

## 建议行动项
（基于讨论结果，建议的下一步行动）

用中文撰写，保持专业简洁。`;
}

export function buildDecisionSummaryPrompt(input: {
  brief: DecisionBrief;
  agenda: DiscussionAgenda;
  allMessages: Array<{ agentId: string; displayName: string; content: string; phase: string }>;
  minutes: string;
  researchSources: ResearchSource[];
}) {
  const messagesText = input.allMessages
    .map((message) => `[${message.phase}] ${message.displayName}: ${message.content}`)
    .join('\n\n---\n\n');
  const researchSection =
    input.researchSources.length > 0
      ? [
          '可引用的 research source 列表：',
          ...input.researchSources.map(
            (source) => `${source.id}: ${source.title} (${source.url})`
          ),
          '',
          '如果某条结论明显受到了这些 source 的支持，请在 evidence 的 sourceIds 中引用对应的 source id，例如 ["R1", "R2"]。',
        ].join('\n')
      : '当前没有可引用的 research source，可将 evidence 留空。';

  return `你是圆桌讨论的主持人，现在需要把会议纪要压缩成结构化决策卡片。

${buildDecisionContextBlock(input.brief, input.agenda)}

会议纪要：
${input.minutes}

原始讨论记录：
${messagesText}

${researchSection}

请仅返回 JSON，不要包含 markdown 代码块，格式如下：
{
  "summary": "本次讨论的简要结论",
  "recommendedOption": "推荐选择或当前最优方向",
  "why": ["推荐原因1", "推荐原因2"],
  "risks": ["核心风险1", "核心风险2"],
  "openQuestions": ["待验证问题1"],
  "nextActions": ["下一步行动1", "下一步行动2"],
  "confidence": 76,
  "evidence": [
    {
      "claim": "哪条结论受到了 evidence 支撑",
      "sourceIds": ["R1", "R2"]
    }
  ]
}

要求：
- 如果 agenda.requestRecommendation 为 false，也要给出当前最优倾向，但要明确说明不确定性。
- confidence 用 0-100 的整数。
- 所有文本都用中文。`;
}

export function parseAnalysis(content: string): ModeratorAnalysis {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Also try to find raw JSON
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    return JSON.parse(jsonStr) as ModeratorAnalysis;
  } catch {
    // Fallback if JSON parsing fails
    return {
      agreements: [],
      disagreements: [],
      shouldConverge: true,
      moderatorNarrative: content.slice(0, 500),
    };
  }
}

export function parseDecisionSummaryContent(
  content: string,
  fallbackSummary?: string,
  researchSources: ResearchSource[] = []
): DecisionSummary {
  return parseDecisionSummary(content, fallbackSummary, researchSources);
}

function buildDecisionContextBlock(
  brief: DecisionBrief,
  agenda: DiscussionAgenda,
  researchBrief?: string,
  parentContext?: string
) {
  const lines = [
    `讨论议题：「${brief.topic}」`,
    brief.goal ? `目标：${brief.goal}` : '',
    brief.background ? `背景：${brief.background}` : '',
    brief.constraints ? `约束：${brief.constraints}` : '',
    `决策类型：${brief.decisionType}`,
    `期望输出：${brief.desiredOutput}`,
    agenda.focalQuestions ? `重点问题：${agenda.focalQuestions}` : '',
    agenda.requiredDimensions ? `必须覆盖维度：${agenda.requiredDimensions}` : '',
    agenda.requestRecommendation ? '需要最终建议：是' : '需要最终建议：否',
    parentContext ? `历史上下文：${parentContext}` : '',
    researchBrief
      ? `\n在讨论开始前，已进行网络资讯检索，相关最新动态如下：\n${researchBrief}\n`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}
