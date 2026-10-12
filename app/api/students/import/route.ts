import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { Student } from '@/types';

export async function POST(request: Request) {
  try {
    const { students } = (await request.json()) as { students: Student[] };
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, error: 'No student records provided.' }, { status: 400 });
    }

    const db = getDB();
    students.forEach((s) => {
      const existing = db.students.find((item) => item.r === s.r);
      if (existing) {
        existing.n = s.n;
        existing.p = s.p;
      } else {
        db.students.push(s);
      }
    });

    saveDB(db);
    return NextResponse.json({ success: true, count: students.length, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
