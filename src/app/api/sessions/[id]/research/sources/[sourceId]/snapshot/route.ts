import fs from 'node:fs';
import path from 'node:path';
import { apiError } from '@/lib/api/errors';
import { getSessionResearch } from '@/lib/db/repository';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { id, sourceId } = await params;
  const run = await getSessionResearch(id);
  if (!run) {
    return apiError(404, 'NOT_FOUND', 'research not found');
  }
  const source = run.sources.find((item) => item.id === sourceId);
  if (!source?.snapshotPath) {
    return apiError(404, 'NOT_FOUND', 'snapshot not found');
  }
  const resolvedPath = path.resolve(source.snapshotPath);
  const dataDir = process.env.ROUND_TABLE_DATA_DIR?.trim()
    ? path.resolve(process.env.ROUND_TABLE_DATA_DIR)
    : path.join(process.cwd(), 'data');
  const captureDir = path.resolve(path.join(dataDir, 'verification-captures'));
  const insideCaptureDir =
    resolvedPath === captureDir ||
    resolvedPath.startsWith(`${captureDir}${path.sep}`);
  if (!insideCaptureDir) {
    return apiError(403, 'UNAUTHORIZED', 'snapshot path outside capture directory');
  }
  if (!fs.existsSync(resolvedPath)) {
    return apiError(404, 'NOT_FOUND', 'snapshot file missing');
  }

  const content = fs.readFileSync(resolvedPath);
  const contentType = resolvedPath.endsWith('.svg')
    ? 'image/svg+xml'
    : 'application/octet-stream';
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}
