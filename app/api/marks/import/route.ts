import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { sem, records } = (await request.json()) as {
      sem: number | string;
      records: Array<{ r: string; m: Record<string, number> }>;
    };

    if (!sem || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: 'Semester and records are required.' }, { status: 400 });
    }

    const db = getDB();
    records.forEach(({ r, m }) => {
      const key = `${r}|${sem}`;
      db.marks[key] = { ...(db.marks[key] || {}), ...m };
    });

    saveDB(db);
    return NextResponse.json({ success: true, count: records.length, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
