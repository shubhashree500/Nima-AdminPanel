import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { Student } from '@/types';

export async function POST(request: Request) {
  try {
    const { r, n, p } = (await request.json()) as Student;
    if (!r || !n || !p) {
      return NextResponse.json({ success: false, error: 'Roll number, name, and program are required.' }, { status: 400 });
    }

    const db = getDB();
    if (db.students.some((s) => s.r === r)) {
      return NextResponse.json({ success: false, error: `Roll number ${r} already exists.` }, { status: 400 });
    }

    db.students.push({ r: r.trim(), n: n.trim(), p });
    saveDB(db);

    return NextResponse.json({ success: true, student: { r, n, p }, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roll = searchParams.get('roll');
    if (!roll) {
      return NextResponse.json({ success: false, error: 'Roll number is required.' }, { status: 400 });
    }

    const db = getDB();
    db.students = db.students.filter((s) => s.r !== roll);

    // Delete associated marks
    Object.keys(db.marks).forEach((key) => {
      if (key.split('|')[0] === roll) {
        delete db.marks[key];
      }
    });

    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
