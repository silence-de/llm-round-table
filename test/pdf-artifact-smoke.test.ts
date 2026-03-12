import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSessionArtifactFile } from '@/lib/session-artifact-files';

function hasCommand(command: string) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('decision dossier PDF passes pdfinfo and rendered-page smoke checks', async (t) => {
  if (!hasCommand('pdfinfo') || !hasCommand('pdftoppm')) {
    t.skip('pdfinfo/pdftoppm not available in this environment.');
    return;
  }

  const artifact = await buildSessionArtifactFile({
    session: {
      id: 'pdf-smoke-session',
      topic: 'Evaluate an important life decision with long-form dossier output',
      decisionStatus: 'needs_follow_up',
      goal: 'Compare several high-stakes options and produce a shareable decision dossier.',
      constraints:
        'Protect downside, preserve optionality, and ensure the recommendation remains explainable to an external reviewer.',
      timeHorizon: '12 months primary horizon, 36 months secondary horizon',
      nonNegotiables: 'Stay financially resilient, avoid irreversible downside, and protect health.',
      acceptableDownside: 'No more than a 15 percent setback to cash reserves or core goals.',
      reviewAt: '2026-06-01',
      outcomeSummary: 'Pending execution review.',
      actualOutcome: 'Not yet executed.',
      outcomeConfidence: 0,
      retrospectiveNote: 'Need to validate assumptions against live evidence before locking in.',
    },
    decisionSummary: {
      summary:
        'The recommendation is to prefer the option with lower regret, stronger evidence coverage, and clearer review triggers.',
      recommendedOption: 'Option B with staged validation and a defined stop-loss.',
      why: Array.from({ length: 8 }, (_, index) => `Reason ${index + 1}: structured rationale with concrete tradeoffs and execution logic.`),
      alternativesRejected: Array.from(
        { length: 6 },
        (_, index) => `Rejected alternative ${index + 1}: downside is less acceptable than the recommended path.`
      ),
      risks: Array.from({ length: 8 }, (_, index) => `Risk ${index + 1}: material uncertainty still requires follow-up evidence.`),
      openQuestions: Array.from(
        { length: 8 },
        (_, index) => `Open question ${index + 1}: unresolved variable requiring explicit verification.`
      ),
      nextActions: Array.from(
        { length: 10 },
        (_, index) => `Next action ${index + 1}: complete a concrete verification or execution step.`
      ),
      redLines: Array.from(
        { length: 5 },
        (_, index) => `Red line ${index + 1}: abort if this unacceptable downside is observed.`
      ),
      revisitTriggers: Array.from(
        { length: 5 },
        (_, index) => `Revisit trigger ${index + 1}: reopen the session if this condition changes.`
      ),
      confidence: 76,
      evidence: Array.from({ length: 12 }, (_, index) => ({
        claim: `Claim ${index + 1}`,
        sourceIds: index % 3 === 0 ? [] : [`R${(index % 4) + 1}`],
        gapReason: index % 3 === 0 ? 'Still needs verification before full confidence.' : '',
      })),
    },
    actionItems: Array.from({ length: 8 }, (_, index) => ({
      id: `action-${index + 1}`,
      content: `Action item ${index + 1} with enough detail to test wrapping behavior in the exported PDF.`,
      status: index % 2 === 0 ? 'pending' : 'in_progress',
      source: 'generated',
      carriedFromSessionId: null,
      note: '',
      owner: index % 2 === 0 ? 'self' : 'advisor',
      dueAt: null,
      verifiedAt: null,
      verificationNote: '',
      priority: index % 2 === 0 ? 'high' : 'medium',
      sortOrder: index,
    })),
    researchRun: {
      evaluation: {
        overallConfidence: 71,
        sourceDiversity: 78,
        sourceQuality: 74,
        freshness: 69,
        recommendation: 'Evidence quality is acceptable with some gaps.',
        gaps: [
          'Need one more direct source for the operational constraint.',
          'Need one more direct source for the downside scenario.',
        ],
      },
      sources: [
        {
          id: 'source-1',
          citationLabel: 'R1',
          sourceType: 'browser_verification',
          title: 'Primary verified source',
          url: 'https://example.com/primary',
          domain: 'example.com',
          snippet: 'Verified source with structured fields.',
          score: 0.95,
          selected: true,
          pinned: true,
          rank: 1,
          excludedReason: '',
          stale: false,
          qualityFlags: ['browser_verified'],
          capturedAt: Date.now(),
          snapshotPath: '/tmp/primary.png',
          verificationProfile: 'money_investment_product',
          verificationNotes: [
            'Extracted 3 verification fact(s) for manual review.',
            'Manual reviewer confirmed the fee schedule language.',
          ],
          verifiedFields: [
            { label: 'Fees', value: 'Management fee 0.25% annualized.', confidence: 'high' },
            { label: 'Liquidity / lock-up', value: 'Redemption allowed after 30 days.', confidence: 'high' },
            { label: 'Risk disclaimer', value: 'Capital is at risk and performance is not guaranteed.', confidence: 'medium' },
          ],
          captureStatus: 'screenshot',
        },
        {
          id: 'source-2',
          citationLabel: 'R2',
          sourceType: 'search',
          title: 'Secondary corroborating source',
          url: 'https://example.org/corroborating',
          domain: 'example.org',
          snippet: 'Secondary source confirming comparable terms.',
          score: 0.82,
          selected: true,
          pinned: false,
          rank: 2,
          excludedReason: '',
          stale: false,
          qualityFlags: ['multi_source'],
        },
        {
          id: 'source-3',
          citationLabel: 'R3',
          sourceType: 'browser_verification',
          title: 'Fallback verification capture',
          url: 'https://example.net/fallback',
          domain: 'example.net',
          snippet: 'Fallback capture with manual review note.',
          score: 0.76,
          selected: true,
          pinned: true,
          rank: 3,
          excludedReason: '',
          stale: false,
          qualityFlags: ['manual_review_required'],
          capturedAt: Date.now(),
          snapshotPath: '/tmp/fallback.svg',
          verificationProfile: 'life_location_policy',
          verificationNotes: ['No stable structured facts were extracted from this page.'],
          verifiedFields: [],
          captureStatus: 'snapshot_fallback',
        },
        {
          id: 'source-4',
          citationLabel: 'R4',
          sourceType: 'search',
          title: 'Additional supporting source',
          url: 'https://example.edu/supporting',
          domain: 'example.edu',
          snippet: 'Supporting analysis for the opportunity-cost angle.',
          score: 0.7,
          selected: true,
          pinned: false,
          rank: 4,
          excludedReason: '',
          stale: true,
          qualityFlags: ['stale'],
        },
      ],
    },
    unresolvedEvidence: [
      {
        claim: 'Need direct confirmation of implementation cost.',
        sourceIds: [],
        gapReason: 'No direct source mapped yet.',
      },
    ],
    parentReviewComparison: {
      topic: 'Previous decision cycle',
      recommendedOption: 'Option A',
      predictedConfidence: 81,
      outcomeSummary: 'The prior choice underperformed expectations.',
      actualOutcome: 'Course correction was required after two months.',
      outcomeConfidence: 49,
      retrospectiveNote: 'The team quality signal was overestimated.',
    },
  });

  assert.equal(artifact.contentType, 'application/pdf');
  assert.equal(fs.existsSync(artifact.filePath), true);

  const info = execFileSync('pdfinfo', [artifact.filePath], { encoding: 'utf8' });
  assert.match(info, /Title:\s+Evaluate an important life decision with long-form dossier output - Decision Dossier/);
  const pagesMatch = info.match(/Pages:\s+(\d+)/);
  assert.ok(pagesMatch);
  const pageCount = Number(pagesMatch[1]);
  assert.ok(pageCount >= 4);

  const renderDir = path.join(process.cwd(), 'tmp', 'pdfs');
  fs.mkdirSync(renderDir, { recursive: true });
  const prefix = path.join(renderDir, 'pdf-artifact-smoke');
  for (const entry of fs.readdirSync(renderDir)) {
    if (entry.startsWith('pdf-artifact-smoke-') && entry.endsWith('.png')) {
      fs.rmSync(path.join(renderDir, entry), { force: true });
    }
  }
  execFileSync('pdftoppm', ['-png', artifact.filePath, prefix], { stdio: 'ignore' });

  const renderedPages = fs
    .readdirSync(renderDir)
    .filter((entry) => entry.startsWith('pdf-artifact-smoke-') && entry.endsWith('.png'))
    .sort();
  assert.equal(renderedPages.length, pageCount);

  for (const page of renderedPages) {
    const stats = fs.statSync(path.join(renderDir, page));
    assert.ok(stats.size > 5_000);
  }
});
