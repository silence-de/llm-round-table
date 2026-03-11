import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_CATALOG, getModelId } from '@/lib/agents/registry';

const kimiAgent = AGENT_CATALOG.find((agent) => agent.id === 'kimi');

test('Kimi falls back from legacy Moonshot env override to canonical model id', () => {
  assert.ok(kimiAgent, 'expected Kimi agent definition to exist');

  const previous = process.env.KIMI_MODEL_ID;
  process.env.KIMI_MODEL_ID = 'Pro/moonshotai/Kimi-K2.5';

  try {
    assert.equal(getModelId(kimiAgent), 'kimi-k2.5');
  } finally {
    if (previous === undefined) {
      delete process.env.KIMI_MODEL_ID;
    } else {
      process.env.KIMI_MODEL_ID = previous;
    }
  }
});

test('Kimi normalizes legacy selected model ids from old sessions', () => {
  assert.ok(kimiAgent, 'expected Kimi agent definition to exist');

  assert.equal(getModelId(kimiAgent, 'Pro/moonshotai/Kimi-K2.5'), 'kimi-k2.5');
});

test('Kimi default temperature matches Moonshot model constraint', () => {
  assert.ok(kimiAgent, 'expected Kimi agent definition to exist');

  assert.equal(kimiAgent.defaultTemperature, 1);
});
