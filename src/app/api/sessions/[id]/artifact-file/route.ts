import fs from 'node:fs';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { getSessionDetail } from '@/lib/db/repository';
import { buildSessionArtifactFile } from '@/lib/session-artifact-files';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) {
    return apiError(404, 'NOT_FOUND', 'session not found');
  }

  try {
    const artifact = await buildSessionArtifactFile(detail);
    const content = fs.readFileSync(artifact.filePath);
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(
      500,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'artifact export failed'
    );
  }
}
