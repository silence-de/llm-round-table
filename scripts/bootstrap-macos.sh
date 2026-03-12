#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_NODE_VERSION="20.19.0"

echo "==> Round Table macOS bootstrap"
echo "    workspace: ${ROOT_DIR}"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required on macOS."
  echo "Install it from https://brew.sh and rerun this script."
  exit 1
fi

echo "==> Installing system dependencies"
brew install poppler

if ! command -v nvm >/dev/null 2>&1; then
  echo "nvm is not available in the current shell."
  echo "Install nvm, then run:"
  echo "  nvm install ${TARGET_NODE_VERSION}"
  echo "  nvm use ${TARGET_NODE_VERSION}"
else
  echo "==> Ensuring Node ${TARGET_NODE_VERSION}"
  nvm install "${TARGET_NODE_VERSION}"
  nvm use "${TARGET_NODE_VERSION}"
fi

cd "${ROOT_DIR}"

if [[ ! -f .env.local ]]; then
  echo "==> Creating .env.local from template"
  cp .env.example .env.local
fi

echo "==> Installing npm dependencies"
npm ci

echo "==> Installing Playwright Chromium"
npx playwright install chromium

echo "==> Running environment doctor"
npm run doctor

cat <<'EOF'

Bootstrap finished.

Next steps:
1. Edit .env.local and set the provider keys you want to use.
2. If you need readable Chinese PDFs, set ROUND_TABLE_PDF_CJK_FONT to a local .ttf/.otf path.
3. Start the app with:
   npm run dev

EOF
