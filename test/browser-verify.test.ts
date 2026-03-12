import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyWebPageSource } from '@/lib/search/browser-verify';

const originalFetch = globalThis.fetch;

test('verifyWebPageSource falls back to snapshot and flags manual review when extraction is weak', async () => {
  process.env.ROUND_TABLE_DISABLE_SCREENSHOT_CAPTURE = '1';
  globalThis.fetch = async () =>
    new Response(
      '<html><head><title>Quiet Listing</title></head><body><main>Minimal copy with no pricing, policy, or structured terms.</main></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  try {
    const source = await verifyWebPageSource({
      sessionId: 'browser-verify-fallback',
      url: 'https://example.com/minimal',
      profileId: 'life_housing',
      claimHint: 'Verify housing terms',
      note: 'Sparse source',
    });

    assert.equal(source.captureStatus, 'snapshot_fallback');
    assert.equal(source.verificationProfile, 'life_housing');
    assert.equal(source.claimHint, 'Verify housing terms');
    assert.equal(source.note, 'Sparse source');
    assert.equal(source.qualityFlags.includes('manual_review_required'), true);
    assert.equal(source.verifiedFields?.length ?? 0, 0);
    assert.equal(
      source.verificationNotes?.includes(
        'Manual review required for page-specific interpretation.'
      ),
      true
    );
    assert.equal(typeof source.snapshotPath, 'string');
    assert.equal(fs.existsSync(source.snapshotPath ?? ''), true);
  } finally {
    delete process.env.ROUND_TABLE_DISABLE_SCREENSHOT_CAPTURE;
    globalThis.fetch = originalFetch;
  }
});
