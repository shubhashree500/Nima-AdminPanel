import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

const KINDS = ['courses', 'departments', 'batches', 'subjects'] as const;
type Kind = typeof KINDS[number];

export async function GET() {
  try {
    const db: any = getDB();
    db.masterData ||= { courses: [], departments: [], batches: [], subjects: [] };
    for (const kind of KINDS) db.masterData[kind] ||= [];
    return NextResponse.json({ success: true, data: db.masterData });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load master data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!KINDS.includes(body.kind)) return NextResponse.json({ success: false, error: 'Invalid master-data category.' }, { status: 400 });
    const value = String(body.value ?? '').trim();
    if (!value) return NextResponse.json({ success: false, error: 'A name or value is required.' }, { status: 400 });
    const db: any = getDB();
    db.masterData ||= { courses: [], departments: [], batches: [], subjects: [] };
    const kind = body.kind as Kind;
    db.masterData[kind] ||= [];
    if (db.masterData[kind].some((item: any) => String(item).toLowerCase() === value.toLowerCase())) return NextResponse.json({ success: false, error: 'This item already exists.' }, { status: 409 });
    db.masterData[kind].push(value);
    db.masterData[kind].sort((a: string, b: string) => a.localeCompare(b));
    saveDB(db);
    return NextResponse.json({ success: true, data: db.masterData });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to save master data.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (!KINDS.includes(body.kind) || !String(body.value ?? '').trim()) return NextResponse.json({ success: false, error: 'Category and value are required.' }, { status: 400 });
    const db: any = getDB();
    db.masterData ||= { courses: [], departments: [], batches: [], subjects: [] };
    const kind = body.kind as Kind;
    const target = String(body.value).trim().toLowerCase();
    db.masterData[kind] = (db.masterData[kind] || []).filter((item: any) => String(item).toLowerCase() !== target);
    saveDB(db);
    return NextResponse.json({ success: true, data: db.masterData });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to remove master data.' }, { status: 500 });
  }
}
