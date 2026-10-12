import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { college, max, pass } = await request.json();

    const maxNum = Number(max);
    const passNum = Number(pass);

    if (!(maxNum > 0) || isNaN(passNum) || passNum < 0 || passNum > maxNum) {
      return NextResponse.json({ success: false, error: 'Pass marks must be between 0 and full marks.' }, { status: 400 });
    }

    const db = getDB();
    db.college = (college || 'Your College Name').trim();
    db.max = maxNum;
    db.pass = passNum;

    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
