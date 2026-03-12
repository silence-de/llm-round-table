#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const verbose = args.has('--verbose');

const env = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

const results = [];

function addResult(level, title, detail, fix) {
  results.push({ level, title, detail, fix });
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const next = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    next[key] = value;
  }
  return next;
}

function parseVersion(version) {
  const normalized = version.replace(/^v/, '');
  const [major = '0', minor = '0', patch = '0'] = normalized.split('.');
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
}

function isSupportedNodeVersion(version) {
  const current = parseVersion(version);
  if (current.major === 20) {
    return current.minor > 19 || (current.minor === 19 && current.patch >= 0);
  }
  if (current.major === 22) {
    return current.minor > 13 || (current.minor === 13 && current.patch >= 0);
  }
  return current.major >= 24;
}

function commandExists(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function resolvePlaywrightModule() {
  try {
    return require.resolve('playwright');
  } catch {
    return null;
  }
}

function detectPlaywrightBrowserStatus() {
  try {
    const playwright = require('playwright');
    const executablePath = playwright.chromium.executablePath();
    return {
      ok: Boolean(executablePath && fs.existsSync(executablePath)),
      executablePath,
    };
  } catch (error) {
    return {
      ok: false,
      executablePath: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function pathExists(candidate) {
  return Boolean(candidate && fs.existsSync(candidate));
}

const providerKeys = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'SILICONFLOW_API_KEY',
  'DEEPSEEK_API_KEY',
  'MOONSHOT_API_KEY',
];

if (!isSupportedNodeVersion(process.version)) {
  addResult(
    'fail',
    'Node version is outside the supported baseline',
    `Current: ${process.version}. Required: 20.19.x, 22.13.x, or >=24.`,
    'Run `nvm install 20.19.0 && nvm use 20.19.0`.'
  );
} else {
  addResult(
    'pass',
    'Node version baseline',
    `Using ${process.version}.`,
    null
  );
}

if (!fs.existsSync(path.join(cwd, '.env.local'))) {
  addResult(
    'warn',
    '.env.local is missing',
    'The app will still boot, but most provider-backed flows will be unavailable.',
    'Run `cp .env.example .env.local` and fill in the keys you need.'
  );
} else {
  addResult('pass', '.env.local detected', 'Local runtime config file exists.', null);
}

const configuredProviderKeys = providerKeys.filter((key) => env[key]?.trim());
if (configuredProviderKeys.length === 0) {
  addResult(
    'warn',
    'No model provider API key is configured',
    'Agent roster will load, but no real discussion agents will be runnable.',
    `Set at least one of: ${providerKeys.join(', ')}.`
  );
} else {
  addResult(
    'pass',
    'Model provider keys',
    `Configured: ${configuredProviderKeys.join(', ')}.`,
    null
  );
}

if (!env.TAVILY_API_KEY?.trim()) {
  addResult(
    'warn',
    'Tavily key is missing',
    'Research runs will degrade to no-search mode and browser verification will be less useful.',
    'Set `TAVILY_API_KEY` if you want the research pipeline enabled.'
  );
} else {
  addResult('pass', 'Tavily key', 'Research pipeline can use Tavily.', null);
}

if (!env.ROUND_TABLE_ACCESS_TOKEN?.trim()) {
  addResult(
    'warn',
    'ROUND_TABLE_ACCESS_TOKEN is not configured',
    'This is acceptable for localhost, but non-localhost deployments should require it.',
    'Set `ROUND_TABLE_ACCESS_TOKEN` before exposing the app outside localhost.'
  );
} else {
  addResult('pass', 'Access token', 'API proxy token is configured.', null);
}

const cjkFont = env.ROUND_TABLE_PDF_CJK_FONT?.trim() || '';
if (!cjkFont) {
  addResult(
    'warn',
    'CJK PDF font is not configured',
    'Chinese/Japanese/Korean text may not render correctly in exported PDFs.',
    'Set `ROUND_TABLE_PDF_CJK_FONT` to a local .ttf/.otf path.'
  );
} else if (!pathExists(cjkFont)) {
  addResult(
    'warn',
    'Configured CJK PDF font was not found',
    `Missing font path: ${cjkFont}`,
    'Point `ROUND_TABLE_PDF_CJK_FONT` at a valid local font file.'
  );
} else {
  addResult('pass', 'CJK PDF font', `Font found at ${cjkFont}.`, null);
}

for (const command of ['pdfinfo', 'pdftoppm', 'pdftotext']) {
  if (!commandExists(command)) {
    addResult(
      'warn',
      `${command} is missing`,
      'PDF smoke checks or text extraction will be skipped on this machine.',
      'Install Poppler. On macOS: `brew install poppler`.'
    );
  } else if (verbose) {
    addResult('pass', `${command} detected`, 'System PDF tooling is available.', null);
  }
}

const playwrightModule = resolvePlaywrightModule();
if (!playwrightModule) {
  addResult(
    'warn',
    'Playwright package is not installed',
    'Browser DOM capture will fall back to plain HTML extraction and screenshot capture may degrade.',
    'Run `npm install -D playwright && npx playwright install chromium`.'
  );
} else {
  addResult('pass', 'Playwright package', `Resolved at ${playwrightModule}.`, null);
  const browserStatus = detectPlaywrightBrowserStatus();
  if (!browserStatus.ok) {
    addResult(
      'warn',
      'Playwright Chromium binary is unavailable',
      browserStatus.error || 'Chromium executable path could not be resolved.',
      'Run `npx playwright install chromium`.'
    );
  } else {
    addResult(
      'pass',
      'Playwright Chromium binary',
      `Chromium found at ${browserStatus.executablePath}.`,
      null
    );
  }
}

const dbPath = env.ROUND_TABLE_DB_PATH?.trim() || './data/round-table.db';
const dataDir = env.ROUND_TABLE_DATA_DIR?.trim() || './data';
addResult('pass', 'Runtime paths', `DB: ${dbPath} | Data dir: ${dataDir}`, null);

const failures = results.filter((item) => item.level === 'fail');
const warnings = results.filter((item) => item.level === 'warn');

for (const item of results) {
  const prefix =
    item.level === 'pass' ? 'PASS' : item.level === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${prefix}  ${item.title}`);
  console.log(`      ${item.detail}`);
  if (item.fix) {
    console.log(`      fix: ${item.fix}`);
  }
}

console.log('');
console.log(
  `Doctor summary: ${results.filter((item) => item.level === 'pass').length} pass, ${warnings.length} warn, ${failures.length} fail`
);

if (failures.length > 0) {
  process.exitCode = 1;
}
