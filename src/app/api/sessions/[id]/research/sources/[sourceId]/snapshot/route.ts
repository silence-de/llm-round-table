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
