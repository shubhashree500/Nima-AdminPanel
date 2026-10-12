import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

export async function GET() {
  try {
    const db = getDB();
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body || !body.data) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    saveDB(body.data);
    return NextResponse.json({ success: true, data: body.data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
