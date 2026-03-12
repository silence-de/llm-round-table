import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECISION_TEMPLATES,
  PERSONAL_DECISION_CHECKLIST,
} from '@/lib/decision/templates';

test('decision templates cover all first-wave families and required metadata', () => {
  assert.equal(DECISION_TEMPLATES.length, 6);
  assert.deepEqual(
    [...new Set(DECISION_TEMPLATES.map((template) => template.family))].sort(),
    ['career', 'life', 'money']
  );

  for (const template of DECISION_TEMPLATES) {
    assert.ok(template.id.length > 0);
    assert.ok(template.label.length > 0);
    assert.ok(template.description.length > 0);
    assert.ok(template.verificationProfileId.length > 0);
    assert.ok(template.reviewWindowSuggestion.length > 0);
    assert.ok(template.evidenceExpectations.length > 0);
    assert.ok(template.defaultRedLines.length > 0);
    assert.ok(template.defaultRevisitTriggers.length > 0);
    assert.deepEqual(template.analysisChecklist, PERSONAL_DECISION_CHECKLIST);
    assert.ok(template.focalQuestions.length > 0);
    assert.ok(template.requiredDimensions.length > 0);
  }
});

test('decision template ids remain unique and map to the planned first-wave set', () => {
  const ids = DECISION_TEMPLATES.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.sort(), [
    'career-pivot',
    'investment-allocation',
    'large-purchase',
    'move-city',
    'offer-choice',
    'rent-vs-buy',
  ]);
});
