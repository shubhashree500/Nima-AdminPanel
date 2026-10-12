import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

export async function POST() {
  try {
    const db = getDB();
    db.students = [];
    db.marks = {};
    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
