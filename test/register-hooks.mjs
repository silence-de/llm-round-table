import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, registerHooks } from 'node:module';

const rootDir = process.cwd();
const moduleRequire = createRequire(import.meta.url);

if (!process.env.ROUND_TABLE_DB_PATH) {
  process.env.ROUND_TABLE_DB_PATH = path.join(
    os.tmpdir(),
    `round-table-test-${process.pid}.sqlite`
  );
}

const nextServerPath = resolvePackageSubpath('next/server');

function resolveWithTsExtension(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolvePackageSubpath(specifier) {
  const candidates = [specifier, `${specifier}.js`, `${specifier}.mjs`];
  for (const candidate of candidates) {
    try {
      return moduleRequire.resolve(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return path.join(rootDir, 'node_modules', ...specifier.split('/'));
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return nextResolve(pathToFileURL(nextServerPath).href, context);
    }

    if (specifier.startsWith('@/')) {
      const resolved = resolveWithTsExtension(
        path.join(rootDir, 'src', specifier.slice(2))
      );
      if (resolved) {
        return nextResolve(pathToFileURL(resolved).href, context);
      }
    }

    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL?.startsWith('file:')
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      if (parentPath.includes(`${path.sep}node_modules${path.sep}`)) {
        return nextResolve(specifier, context);
      }

      const resolved = resolveWithTsExtension(
        path.resolve(path.dirname(parentPath), specifier)
      );
      if (resolved) {
        return nextResolve(pathToFileURL(resolved).href, context);
      }
    }

    return nextResolve(specifier, context);
  },
});
