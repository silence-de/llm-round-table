import { NextRequest, NextResponse } from 'next/server';
import { getLatestLedgerCheckpoint, listLedgerCheckpoints } from '@/lib/db/repository';
import { deserializeLedger } from '@/lib/orchestrator/task-ledger';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;
  const checkpoint = await getLatestLedgerCheckpoint(sessionId);
  if (!checkpoint) {
    return NextResponse.json({ ledger: null, checkpoints: [] });
  }
  const ledger = deserializeLedger(checkpoint.ledgerJson);
  const checkpoints = await listLedgerCheckpoints(sessionId);
  return NextResponse.json({
    ledger,
    checkpoints: checkpoints.map((c) => ({
      id: c.id,
      phase: c.phase,
      ledgerVersion: c.ledgerVersion,
      createdAt: c.createdAt,
    })),
  });
}
