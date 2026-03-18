import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStructuredAgentReply,
  validateStructuredReply,
} from '@/lib/orchestrator/moderator';

// ── parseStructuredAgentReply ──────────────────────────────────────

test('parse: returns narrative only when no separator present', () => {
  const result = parseStructuredAgentReply('这是一段普通回复，没有结构化部分。');
  assert.equal(result.narrative, '这是一段普通回复，没有结构化部分。');
  assert.equal(result.structured, undefined);
  assert.equal(result.parseMetadata.success, false);
  assert.ok(result.parseMetadata.warnings.includes('no separator found'));
});

test('parse: handles valid v1 schema with claims', () => {
  const json = JSON.stringify({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'support',
    claims: [
      {
        claim: '市场前景良好',
        reasoning: '数据支撑',
        claimType: 'fact',
        citationLabels: ['R1'],
        gapReason: null,
        confidenceBand: 'high',
      },
    ],
    caveats: ['需要更多数据'],
    questionsForOthers: ['你怎么看？'],
    narrative: '我支持这个方案。',
  });
  const content = `我支持这个方案。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.equal(result.parseMetadata.success, true);
  assert.ok(result.structured);
  assert.equal(result.structured.schemaVersion, 'rt.agent.reply.v1');
  assert.equal(result.structured.stance, 'support');
  assert.equal(result.structured.claims.length, 1);
  assert.equal(result.structured.claims[0].claimType, 'fact');
  assert.deepEqual(result.structured.claims[0].citationLabels, ['R1']);
  assert.equal(result.structured.claims[0].gapReason, null);
  assert.equal(result.parseMetadata.citationResolveRate, 1);
});

test('parse: migrates legacy keyPoints + evidenceCited to claims + citationLabels', () => {
  const json = JSON.stringify({
    stance: 'mixed',
    keyPoints: [
      {
        claim: '风险较高',
        reasoning: '缺乏验证',
        evidenceCited: ['R2'],
        confidenceBand: 'medium',
      },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '有风险。',
  });
  const content = `有风险。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.equal(result.parseMetadata.success, true);
  assert.ok(result.structured);
  assert.equal(result.structured.claims.length, 1);
  assert.deepEqual(result.structured.claims[0].citationLabels, ['R2']);
  assert.equal(result.structured.claims[0].claimType, 'assumption'); // defaulted
  assert.ok(result.parseMetadata.warnings.some((w) => w.includes('legacy keyPoints')));
  assert.ok(result.parseMetadata.warnings.some((w) => w.includes('legacy evidenceCited')));
});

test('parse: handles dirty JSON gracefully', () => {
  const content = '一些回复\n---STRUCTURED---\n{not valid json!!!}';
  const result = parseStructuredAgentReply(content);

  assert.equal(result.narrative, '一些回复');
  assert.equal(result.structured, undefined);
  assert.equal(result.parseMetadata.success, false);
  assert.ok(result.parseMetadata.warnings.includes('JSON parse failed'));
});

test('parse: rejects invalid stance', () => {
  const json = JSON.stringify({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'banana',
    claims: [],
    caveats: [],
    questionsForOthers: [],
    narrative: '无效立场',
  });
  const content = `无效立场\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.equal(result.structured, undefined);
  assert.equal(result.parseMetadata.success, false);
  assert.ok(result.parseMetadata.warnings.some((w) => w.includes('invalid or missing stance')));
});

test('parse: defaults invalid claimType to assumption with warning', () => {
  const json = JSON.stringify({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'oppose',
    claims: [
      {
        claim: '不可行',
        reasoning: '成本太高',
        claimType: 'guess',
        citationLabels: [],
        gapReason: '暂无数据',
        confidenceBand: 'low',
      },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '反对。',
  });
  const content = `反对。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.ok(result.structured);
  assert.equal(result.structured.claims[0].claimType, 'assumption');
  assert.ok(result.parseMetadata.warnings.some((w) => w.includes('invalid claimType')));
});

test('parse: enforces mutual exclusion — clears gapReason when citationLabels present', () => {
  const json = JSON.stringify({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'support',
    claims: [
      {
        claim: '有证据',
        reasoning: '来源可靠',
        claimType: 'fact',
        citationLabels: ['R1'],
        gapReason: '不应该有这个',
        confidenceBand: 'high',
      },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '支持。',
  });
  const content = `支持。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.ok(result.structured);
  assert.equal(result.structured.claims[0].gapReason, null);
  assert.ok(result.parseMetadata.warnings.some((w) => w.includes('citationLabels and gapReason both present')));
});

test('parse: computes citationResolveRate correctly', () => {
  const json = JSON.stringify({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'mixed',
    claims: [
      { claim: 'A', reasoning: 'r', claimType: 'fact', citationLabels: ['R1'], gapReason: null, confidenceBand: 'high' },
      { claim: 'B', reasoning: 'r', claimType: 'assumption', citationLabels: [], gapReason: '无来源', confidenceBand: 'low' },
      { claim: 'C', reasoning: 'r', claimType: 'projection', citationLabels: ['R2', 'R3'], gapReason: null, confidenceBand: 'medium' },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '混合。',
  });
  const content = `混合。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.ok(result.structured);
  // 2 out of 3 claims have citations
  assert.ok(Math.abs(result.parseMetadata.citationResolveRate - 2 / 3) < 0.01);
});

test('parse: warns on missing schemaVersion', () => {
  const json = JSON.stringify({
    stance: 'unsure',
    claims: [],
    caveats: [],
    questionsForOthers: [],
    narrative: '不确定。',
  });
  const content = `不确定。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.ok(result.structured);
  assert.equal(result.structured.schemaVersion, 'rt.agent.reply.v1'); // forced
  assert.ok(result.parseMetadata.warnings.some((w) => w.includes('missing schemaVersion')));
});

test('parse: skips claims with missing required fields', () => {
  const json = JSON.stringify({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'support',
    claims: [
      { claim: '有效', reasoning: '理由', claimType: 'fact', citationLabels: [], gapReason: '无', confidenceBand: 'high' },
      { claim: '缺reasoning', confidenceBand: 'low' },
      { reasoning: '缺claim', confidenceBand: 'medium' },
      { claim: '缺band', reasoning: '理由', claimType: 'fact', citationLabels: [], gapReason: null },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '支持。',
  });
  const content = `支持。\n---STRUCTURED---\n${json}`;
  const result = parseStructuredAgentReply(content);

  assert.ok(result.structured);
  assert.equal(result.structured.claims.length, 1);
  assert.equal(result.structured.claims[0].claim, '有效');
});

// ── validateStructuredReply ────────────────────────────────────────

test('validate: passes for a well-formed reply', () => {
  const result = validateStructuredReply({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'support',
    claims: [
      { claim: 'A', reasoning: 'r', claimType: 'fact', citationLabels: ['R1'], gapReason: null, confidenceBand: 'high' },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '好的。',
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validate: errors on invalid stance', () => {
  const result = validateStructuredReply({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'banana' as 'support',
    claims: [],
    caveats: [],
    questionsForOthers: [],
    narrative: '',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('invalid stance')));
});

test('validate: errors on invalid claimType', () => {
  const result = validateStructuredReply({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'oppose',
    claims: [
      { claim: 'X', reasoning: 'r', claimType: 'guess' as 'fact', citationLabels: [], gapReason: '无', confidenceBand: 'low' },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('invalid claimType')));
});

test('validate: warns when both citationLabels and gapReason present', () => {
  const result = validateStructuredReply({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'mixed',
    claims: [
      { claim: 'Y', reasoning: 'r', claimType: 'assumption', citationLabels: ['R1'], gapReason: '不应有', confidenceBand: 'medium' },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '',
  });
  assert.equal(result.valid, true); // warning, not error
  assert.ok(result.warnings.some((w) => w.includes('citationLabels and gapReason both present')));
});

test('validate: warns when neither citationLabels nor gapReason', () => {
  const result = validateStructuredReply({
    schemaVersion: 'rt.agent.reply.v1',
    stance: 'unsure',
    claims: [
      { claim: 'Z', reasoning: 'r', claimType: 'projection', citationLabels: [], gapReason: null, confidenceBand: 'high' },
    ],
    caveats: [],
    questionsForOthers: [],
    narrative: '',
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes('neither citationLabels nor gapReason')));
});

test('validate: warns on unexpected schemaVersion', () => {
  const result = validateStructuredReply({
    schemaVersion: 'rt.agent.reply.v99' as 'rt.agent.reply.v1',
    stance: 'support',
    claims: [],
    caveats: [],
    questionsForOthers: [],
    narrative: '',
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes('unexpected schemaVersion')));
});
