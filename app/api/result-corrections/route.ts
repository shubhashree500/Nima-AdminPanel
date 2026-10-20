
import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationId = searchParams.get('calculationId');

    const db: any = getDB();

    const corrections = Array.isArray(db.resultCorrections)
      ? db.resultCorrections
      : [];

    // Reports should use applied corrections only.
    const appliedCorrections = corrections.filter(
      (correction: any) =>
        correction.status === 'applied' &&
        (!calculationId ||
          correction.originalCalculationId === calculationId)
    );

    return NextResponse.json({
      success: true,
      data: appliedCorrections,
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
