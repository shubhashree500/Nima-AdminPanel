import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

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
          error: `Cannot clear student data while ${published.length} official published result calculation(s) exist. Confirm clear with force=true to proceed.`,
          canForce: true,
        },
        { status: 409 }
      );
    }

    db.students = [];
    db.marks = {};
    if (force) {
      db.calculatedResults = [];
      db.recheckingApplications = [];
      db.resultCorrections = [];
    }
    saveDB(db);

    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Clear failed.' },
      { status: 500 }
    );
  }
}
