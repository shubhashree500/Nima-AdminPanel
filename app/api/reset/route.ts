import { NextResponse } from 'next/server';
import { getDB, generateInitialData, saveDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true' || body?.force === true;

    const db = getDB();
    const published = ((db as any).calculatedResults || []).filter(
      (r: any) => r.status === 'published'
    );

    if (published.length > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot reset database. System contains ${published.length} official published result calculation(s). Pass force=true to confirm reset.`,
          canForce: true,
        },
        { status: 409 }
      );
    }

    const cleanData = generateInitialData(true);
    cleanData.calculatedResults = [];
    cleanData.recheckingApplications = [];
    cleanData.resultCorrections = [];
    cleanData.examSessions = [];
    saveDB(cleanData);

    return NextResponse.json({ success: true, data: cleanData });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Reset failed.' },
      { status: 500 }
    );
  }
}
