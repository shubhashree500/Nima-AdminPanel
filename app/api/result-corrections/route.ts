import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationId = searchParams.get('calculationId');
    const includeAll =
      searchParams.get('all') === 'true' ||
      searchParams.get('includeAll') === 'true';

    const db: any = getDB();

    const corrections = Array.isArray(db.resultCorrections)
      ? db.resultCorrections
      : [];

    // Reports should use applied corrections only.
    // When includeAll is specified, return all corrections for history.
    const filteredCorrections = corrections.filter(
      (correction: any) =>
        (includeAll || correction.status === 'applied') &&
        (!calculationId ||
          correction.originalCalculationId === calculationId)
    );

    return NextResponse.json({
      success: true,
      data: filteredCorrections,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load result corrections.',
      },
      { status: 500 }
    );
  }
}
