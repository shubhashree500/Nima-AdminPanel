import { NextResponse } from 'next/server';
import { getDB, generateInitialData, saveDB } from '@/lib/db';

export async function POST() {
  try {
    const db = getDB();
    const published = ((db as any).calculatedResults || []).filter(
      (r: any) => r.status === 'published'
    );

    if (published.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot reset database. System contains ${published.length} official published result calculation(s).`,
        },
        { status: 409 }
      );
    }

    const cleanData = generateInitialData();
    saveDB(cleanData);
    return NextResponse.json({ success: true, data: cleanData });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
