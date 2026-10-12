import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { roll, sem, marks } = (await request.json()) as {
      roll: string;
      sem: number | string;
      marks: Record<string, number>;
    };

    if (!roll || !sem || !marks) {
      return NextResponse.json({ success: false, error: 'Roll, semester, and marks are required.' }, { status: 400 });
    }

    const db = getDB();
    const key = `${roll}|${sem}`;
    db.marks[key] = { ...(db.marks[key] || {}), ...marks };

    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
