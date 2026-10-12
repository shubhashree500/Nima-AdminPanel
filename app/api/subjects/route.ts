import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { PROG, ProgramKey } from '@/types';

// Add Subject
export async function POST(request: Request) {
  try {
    const { prog, sem, name } = await request.json();
    if (!prog || !sem || !name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Program, semester, and subject name are required.' }, { status: 400 });
    }

    const db = getDB();
    const key = `${prog}|${sem}`;
    if (!db.subjects[key]) {
      db.subjects[key] = [];
    }

    const cleanName = name.trim();
    if (db.subjects[key].some((s) => s.toLowerCase() === cleanName.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'That subject is already in the list.' }, { status: 400 });
    }

    db.subjects[key].push(cleanName);
    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Remove Subject
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prog = searchParams.get('prog');
    const sem = searchParams.get('sem');
    const indexStr = searchParams.get('index');

    if (!prog || !sem || indexStr === null) {
      return NextResponse.json({ success: false, error: 'Program, semester, and index are required.' }, { status: 400 });
    }

    const db = getDB();
    const key = `${prog}|${sem}`;
    const idx = parseInt(indexStr, 10);

    if (db.subjects[key] && idx >= 0 && idx < db.subjects[key].length) {
      db.subjects[key].splice(idx, 1);
      saveDB(db);
    }

    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Copy to all semesters
export async function PUT(request: Request) {
  try {
    const { prog, sem } = await request.json();
    if (!prog || !sem) {
      return NextResponse.json({ success: false, error: 'Program and semester are required.' }, { status: 400 });
    }

    const db = getDB();
    const sourceKey = `${prog}|${sem}`;
    const sourceSubs = [...(db.subjects[sourceKey] || [])];
    const pKey = prog as ProgramKey;
    const maxSems = PROG[pKey]?.sems || 6;

    for (let s = 1; s <= maxSems; s++) {
      db.subjects[`${prog}|${s}`] = [...sourceSubs];
    }

    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
