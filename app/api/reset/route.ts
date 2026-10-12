import { NextResponse } from 'next/server';
import { generateInitialData, saveDB } from '@/lib/db';

export async function POST() {
  try {
    const cleanData = generateInitialData();
    saveDB(cleanData);
    return NextResponse.json({ success: true, data: cleanData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
