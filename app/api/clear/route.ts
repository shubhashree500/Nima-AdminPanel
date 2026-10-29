import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

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
          error: `Cannot clear student data while ${published.length} official published result calculation(s) exist.`,
        },
        { status: 409 }
      );
    }

    db.students = [];
    db.marks = {};
    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
