import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { nanoid } from 'nanoid';
import type { ResearchSource } from './types';
import {
  getVerificationProfile,
  type VerificationProfileId,
} from './verification-profiles';

const USER_AGENT =
  'RoundTableBrowserVerification/2.0 (+https://github.com/chengxi-mba/round-table)';
const execFileAsync = promisify(execFile);
const CAPTURE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
let lastCaptureCleanupAt = 0;

export async function verifyWebPageSource(input: {
  sessionId: string;
  url: string;
  profileId?: string;
  claimHint?: string;
  note?: string;
}): Promise<ResearchSource> {
  const normalizedUrl = normalizeVerificationUrl(input.url);
  const profile = getVerificationProfile(input.profileId);
  const playwrightExtraction = await extractPlaywrightBodyText(normalizedUrl);
  let extractionMethod: ResearchSource['extractionMethod'] = 'playwright_dom';
  let extractionQuality: ResearchSource['extractionQuality'] = 'high';
  let finalUrl = normalizedUrl;
  let title = normalizedUrl;
  let snippet = '';
  let bodyText = '';

  if (playwrightExtraction) {
    finalUrl = playwrightExtraction.url;
    title = cleanupText(playwrightExtraction.title) || finalUrl;
    bodyText = cleanupText(playwrightExtraction.bodyText);
    snippet = bodyText.slice(0, 360) || 'No readable excerpt captured.';
    extractionQuality = bodyText.length >= 180 ? 'high' : 'medium';
  } else {
    extractionMethod = 'fetch_html_fallback';
    const response = await fetch(normalizedUrl, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`verification fetch failed (${response.status})`);
    }

    const html = await response.text();
    finalUrl = response.url || normalizedUrl;
    title = extractTitle(html) || finalUrl;
    snippet = extractSnippet(html);
    bodyText = extractBodyText(html);
    extractionQuality = bodyText.length >= 180 ? 'medium' : 'low';
  }
  const capturedAt = Date.now();
  const screenshotPath = await capturePageScreenshot({
    sessionId: input.sessionId,
    url: finalUrl,
    capturedAt,
  });
  const snapshotPath =
    screenshotPath ??
    writeVerificationSnapshot({
      sessionId: input.sessionId,
      url: finalUrl,
      title,
      snippet,
      capturedAt,
    });

  const extraction = extractVerificationFields({
    title,
    url: finalUrl,
    snippet,
    bodyText,
    profileId: profile?.id,
  });
  const verificationNotes = [
    ...(profile ? [`Capture profile: ${profile.label}`] : ['Capture profile: generic']),
    `Extraction method: ${extractionMethod}`,
    `Extraction quality: ${extractionQuality}`,
    ...(input.claimHint?.trim() ? [`Claim hint: ${input.claimHint.trim()}`] : []),
    ...(input.note?.trim() ? [`User note: ${input.note.trim()}`] : []),
    ...(extraction.notes.length > 0 ? extraction.notes : ['Manual review required for page-specific interpretation.']),
  ];

  return {
    id: nanoid(8),
    sourceType: 'browser_verification',
    verificationProfile: profile?.id,
    title,
    url: finalUrl,
    domain: extractDomain(finalUrl),
    snippet,
    score: 0.95,
    selected: true,
    pinned: true,
    rank: 1,
    excludedReason: '',
    stale: false,
    qualityFlags: [
      'browser_capture',
      profile ? `profile:${profile.id}` : 'profile:generic',
      extraction.fields.length > 0 ? 'structured_extract' : 'manual_review_required',
    ],
    capturedAt,
    snapshotPath,
    claimHint: input.claimHint?.trim() || undefined,
    note: input.note?.trim() || undefined,
    verificationNotes,
    verifiedFields: extraction.fields,
    extractionMethod,
    extractionQuality,
    captureStatus: screenshotPath ? 'screenshot' : 'snapshot_fallback',
  };
}

function normalizeVerificationUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('verification url required');
  }
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('verification url must use http or https');
  }
  return parsed.toString();
}

function extractTitle(html: string) {
  const match =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanupText(match?.[1] ?? '');
}

function extractSnippet(html: string) {
  const metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    '';
  const bodyText = extractBodyText(html);
  return (cleanupText(metaDescription) || bodyText || 'No readable excerpt captured.').slice(
    0,
    360
  );
}

function extractBodyText(html: string) {
  return cleanupText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
  );
}

function cleanupText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractVerificationFields(input: {
  title: string;
  url: string;
  snippet: string;
  bodyText: string;
  profileId?: VerificationProfileId;
}) {
  const haystack = `${input.title}\n${input.snippet}\n${input.bodyText}`.slice(0, 15_000);
  const fields: ResearchSource['verifiedFields'] = [];
  const notes: string[] = [];
  const pushField = (
    label: string,
    value: string | null,
    confidence: 'high' | 'medium' | 'low'
  ) => {
    const normalized = cleanupText(value ?? '');
    if (!normalized) return;
    if (fields.some((item) => item.label === label && item.value === normalized)) return;
    fields.push({ label, value: normalized.slice(0, 160), confidence });
  };

  switch (input.profileId) {
    case 'career_offer':
      pushField('Compensation', matchMoneySentence(haystack), 'high');
      pushField('Location', matchKeywordSentence(haystack, ['location', 'located', 'office', 'city', 'onsite']), 'medium');
      pushField('Work mode', matchKeywordSentence(haystack, ['remote', 'hybrid', 'onsite']), 'high');
      pushField('Visa / relocation', matchKeywordSentence(haystack, ['visa', 'relocation', 'sponsorship']), 'high');
      pushField('Benefits', matchKeywordSentence(haystack, ['benefits', 'insurance', 'pto', 'leave']), 'medium');
      pushField('Deadline / date', matchDateSentence(haystack), 'medium');
      break;
    case 'career_company_research':
      pushField('Company overview', matchKeywordSentence(haystack, ['about', 'mission', 'company', 'we are']), 'medium');
      pushField('Hiring claim', matchKeywordSentence(haystack, ['hiring', 'join', 'role', 'team']), 'medium');
      pushField('Team / manager signal', matchKeywordSentence(haystack, ['team', 'manager', 'leadership', 'founder']), 'medium');
      pushField('Benefits / policy', matchKeywordSentence(haystack, ['benefits', 'policy', 'remote', 'hybrid']), 'medium');
      pushField('Latest date marker', matchDateSentence(haystack), 'low');
      break;
    case 'life_housing':
      pushField('Price / rent', matchMoneySentence(haystack), 'high');
      pushField('Area / size', matchKeywordSentence(haystack, ['sqft', 'sqm', 'square feet', 'm²', '面积']), 'medium');
      pushField('Location', matchKeywordSentence(haystack, ['neighborhood', 'district', 'address', 'subway', 'station']), 'medium');
      pushField('Commute', matchKeywordSentence(haystack, ['commute', 'minutes', 'transit', 'train', 'bus']), 'low');
      pushField('School / policy', matchKeywordSentence(haystack, ['school', 'district', 'pet', 'parking']), 'low');
      break;
    case 'life_location_policy':
      pushField('Policy title', input.title, 'high');
      pushField('Effective date', matchDateSentence(haystack), 'high');
      pushField('Eligibility', matchKeywordSentence(haystack, ['eligible', 'eligibility', 'resident', 'applicant']), 'medium');
      pushField('Restriction', matchKeywordSentence(haystack, ['restriction', 'must', 'cannot', 'required']), 'medium');
      pushField('Official link', input.url, 'high');
      break;
    case 'money_investment_product':
      pushField('Fees', matchKeywordSentence(haystack, ['fee', 'expense ratio', 'management fee']), 'high');
      pushField('Liquidity / lock-up', matchKeywordSentence(haystack, ['liquidity', 'lock-up', 'redemption', 'withdraw']), 'high');
      pushField('Risk disclaimer', matchKeywordSentence(haystack, ['risk', 'loss', 'not guaranteed', 'volatility']), 'medium');
      pushField('Benchmark / performance', matchKeywordSentence(haystack, ['benchmark', 'performance', 'return', 'yield']), 'medium');
      pushField('Latest date marker', matchDateSentence(haystack), 'low');
      break;
    case 'money_large_purchase':
      pushField('Price', matchMoneySentence(haystack), 'high');
      pushField('Warranty / return', matchKeywordSentence(haystack, ['warranty', 'return', 'refund', 'exchange']), 'high');
      pushField('Financing', matchKeywordSentence(haystack, ['financing', 'apr', 'installment', 'monthly']), 'medium');
      pushField('Shipping / install', matchKeywordSentence(haystack, ['shipping', 'delivery', 'install', 'assembly']), 'medium');
      break;
    default:
      pushField('Headline', input.title, 'high');
      pushField('Key excerpt', input.snippet, 'medium');
      break;
  }

  if (fields.length === 0) {
    notes.push('No stable structured signals were extracted from this page.');
    notes.push('Manual review required for page-specific interpretation.');
  } else {
    notes.push(`Captured ${fields.length} signal(s) for manual review.`);
  }
  return { fields, notes };
}

function matchMoneySentence(haystack: string) {
  const sentence =
    matchSentence(haystack, /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:per year|yr|month|mo|annual))?/i) ??
    matchSentence(haystack, /\b(?:usd|cny|rmb|eur)\s?\d[\d,]*(?:\.\d+)?/i) ??
    matchSentence(haystack, /\d[\d,]*(?:\.\d+)?\s?(?:元|万|k|m)(?:\/月|\/年| per month| per year)?/i);
  return sentence;
}

function matchDateSentence(haystack: string) {
  return (
    matchSentence(haystack, /\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}\/20\d{2})\b/i) ??
    matchSentence(haystack, /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2},? 20\d{2}\b/i)
  );
}

function matchKeywordSentence(haystack: string, keywords: string[]) {
  const lowered = haystack.toLowerCase();
  const keyword = keywords.find((item) => lowered.includes(item.toLowerCase()));
  if (!keyword) return null;
  return matchSentence(haystack, new RegExp(escapeRegex(keyword), 'i'));
}

function matchSentence(haystack: string, pattern: RegExp) {
  const sentences = haystack
    .split(/(?<=[.!?。；;])\s+/)
    .map((sentence) => cleanupText(sentence))
    .filter(Boolean);
  return (
    sentences.find((sentence) => pattern.test(sentence)) ??
    null
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeVerificationSnapshot(input: {
  sessionId: string;
  url: string;
  title: string;
  snippet: string;
  capturedAt: number;
}) {
  const dataDir = process.env.ROUND_TABLE_DATA_DIR?.trim()
    ? path.resolve(process.env.ROUND_TABLE_DATA_DIR)
    : path.join(process.cwd(), 'data');
  const snapshotDir = path.join(dataDir, 'verification-captures');
  fs.mkdirSync(snapshotDir, { recursive: true });
  cleanupVerificationCaptures(snapshotDir);

  const filePath = path.join(
    snapshotDir,
    `${input.sessionId}-${input.capturedAt}-${nanoid(6)}.svg`
  );
  const escapedTitle = escapeXml(input.title);
  const escapedUrl = escapeXml(input.url);
  const escapedSnippet = wrapSvgText(input.snippet, 68)
    .map((line) => escapeXml(line))
    .join('</tspan><tspan x="32" dy="22">');
  const capturedAt = new Date(input.capturedAt).toISOString();
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#09121a" />
      <stop offset="100%" stop-color="#13232b" />
    </linearGradient>
  </defs>
  <rect width="1200" height="720" rx="36" fill="url(#bg)" />
  <rect x="24" y="24" width="1152" height="672" rx="28" fill="#0f1b22" stroke="#27404c" stroke-width="2" />
  <text x="32" y="66" fill="#89c6d9" font-size="22" font-family="ui-sans-serif, system-ui">Round Table browser verification</text>
  <text x="32" y="118" fill="#f4fbff" font-size="34" font-weight="700" font-family="ui-sans-serif, system-ui">${escapedTitle}</text>
  <text x="32" y="158" fill="#8ba8b5" font-size="18" font-family="ui-monospace, monospace">${escapedUrl}</text>
  <text x="32" y="220" fill="#d9edf4" font-size="24" font-family="ui-sans-serif, system-ui">
    <tspan x="32" dy="0">${escapedSnippet}</tspan>
  </text>
  <text x="32" y="650" fill="#8ba8b5" font-size="18" font-family="ui-monospace, monospace">captured ${escapeXml(capturedAt)}</text>
</svg>`;
  fs.writeFileSync(filePath, svg, 'utf8');
  return filePath;
}

async function capturePageScreenshot(input: {
  sessionId: string;
  url: string;
  capturedAt: number;
}) {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.ROUND_TABLE_DISABLE_SCREENSHOT_CAPTURE === '1'
  ) {
    return null;
  }
  try {
    const dataDir = process.env.ROUND_TABLE_DATA_DIR?.trim()
      ? path.resolve(process.env.ROUND_TABLE_DATA_DIR)
      : path.join(process.cwd(), 'data');
    const snapshotDir = path.join(dataDir, 'verification-captures');
    fs.mkdirSync(snapshotDir, { recursive: true });
    cleanupVerificationCaptures(snapshotDir);
    const filePath = path.join(
      snapshotDir,
      `${input.sessionId}-${input.capturedAt}-${nanoid(6)}.png`
    );
    await execFileAsync(
      'npx',
      ['-y', 'playwright', 'screenshot', '--device=Desktop Chrome', input.url, filePath],
      { timeout: 8_000 }
    );
    return fs.existsSync(filePath) ? filePath : null;
  } catch {
    return null;
  }
}

function wrapSvgText(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['No readable excerpt captured.'];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 8);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function extractPlaywrightBodyText(url: string): Promise<{
  title: string;
  bodyText: string;
  url: string;
} | null> {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.ROUND_TABLE_DISABLE_PLAYWRIGHT_DOM_CAPTURE === '1'
  ) {
    return null;
  }
  try {
    const playwrightModuleName = 'playwright';
    const playwright = (await import(playwrightModuleName)) as unknown as {
      chromium: {
        launch: (options: { headless: boolean }) => Promise<{
          newPage: (options: { userAgent: string }) => Promise<{
            goto: (
              target: string,
              options: { waitUntil: 'domcontentloaded'; timeout: number }
            ) => Promise<void>;
            title: () => Promise<string>;
            evaluate: (pageFn: () => string) => Promise<string>;
            url: () => string;
          }>;
          close: () => Promise<void>;
        }>;
      };
    };
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        userAgent: USER_AGENT,
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      const [title, bodyText, finalUrl] = await Promise.all([
        page.title(),
        page.evaluate(() => document.body?.innerText ?? ''),
        page.url(),
      ]);
      return {
        title,
        bodyText,
        url: finalUrl || url,
      };
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

function cleanupVerificationCaptures(snapshotDir: string) {
  const now = Date.now();
  if (now - lastCaptureCleanupAt < 10 * 60 * 1000) {
    return;
  }
  lastCaptureCleanupAt = now;
  try {
    const entries = fs.readdirSync(snapshotDir);
    for (const entry of entries) {
      const filePath = path.join(snapshotDir, entry);
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;
      if (now - stats.mtimeMs > CAPTURE_TTL_MS) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    // ignore cleanup failures
  }
}
