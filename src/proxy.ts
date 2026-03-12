import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const requiredToken = process.env.ROUND_TABLE_ACCESS_TOKEN?.trim();
  if (!requiredToken) {
    return NextResponse.next();
  }

  const headerToken = req.headers.get('x-round-table-token')?.trim();
  const authorization = req.headers.get('authorization')?.trim();
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (headerToken === requiredToken || bearerToken === requiredToken) {
    return NextResponse.next();
  }

  return NextResponse.json(
    {
      code: 'UNAUTHORIZED',
      error:
        'Missing or invalid API access token. Provide x-round-table-token or Authorization: Bearer <token>.',
    },
    { status: 401 }
  );
}

export const config = {
  matcher: '/api/:path*',
};
