# Local Setup

This document is for bringing up Round Table on a fresh machine.

## Supported Node Baseline

Use one of these:

- Node `20.19.x`
- Node `22.13.x`
- Node `24+`

The recommended baseline for private beta is Node `20.19.0`.

## macOS Quick Bootstrap

From the repo root:

```bash
bash ./scripts/bootstrap-macos.sh
```

That script does the following:

1. installs `poppler` with Homebrew
2. ensures Node `20.19.0` if `nvm` is available
3. creates `.env.local` from `.env.example` if needed
4. runs `npm ci`
5. installs Playwright Chromium
6. runs `npm run doctor`

## Manual Setup

### 1. Use the supported Node version

```bash
nvm install 20.19.0
nvm use 20.19.0
```

### 2. Install npm dependencies

```bash
npm ci
```

### 3. Install browser capture dependencies

Round Table's browser verification flow uses Playwright DOM capture when available.

```bash
npx playwright install chromium
```

### 4. Install PDF verification tools

PDF smoke checks and text extraction use Poppler tools:

- `pdfinfo`
- `pdftoppm`
- `pdftotext`

On macOS:

```bash
brew install poppler
```

### 5. Create `.env.local`

```bash
cp .env.example .env.local
```

Typical keys to fill:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `SILICONFLOW_API_KEY`
- `DEEPSEEK_API_KEY`
- `MOONSHOT_API_KEY`
- `TAVILY_API_KEY`
- `ROUND_TABLE_ACCESS_TOKEN`
- `ROUND_TABLE_PDF_CJK_FONT`

## Chinese PDF Export

To make Chinese PDF output readable, point `ROUND_TABLE_PDF_CJK_FONT` at a local font file.

Examples on macOS:

```bash
ROUND_TABLE_PDF_CJK_FONT=/System/Library/Fonts/Supplemental/Arial Unicode.ttf
```

or

```bash
ROUND_TABLE_PDF_CJK_FONT=/System/Library/Fonts/Supplemental/NISC18030.ttf
```

## Environment Doctor

Run this after setup and after moving the project to a new machine:

```bash
npm run doctor
```

It checks:

- Node baseline
- `.env.local`
- provider keys
- Tavily availability
- access-token recommendation
- CJK font path
- Poppler commands
- Playwright package and Chromium binary

## Start and Verify

```bash
npm run dev
npm run gate
```

If `npm run doctor` reports warnings, the app may still boot, but specific features will degrade or be skipped.
