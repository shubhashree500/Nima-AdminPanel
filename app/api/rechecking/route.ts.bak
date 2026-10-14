import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed'];

export async function GET() {
  try {
    const db: any = getDB();
    return NextResponse.json({ success: true, applications: db.recheckingApplications || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load applications.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ['studentRoll', 'studentName', 'program', 'semester', 'reason'];
    const missing = required.filter((key) => body[key] === undefined || String(body[key]).trim() === '');
    if (missing.length) return NextResponse.json({ success: false, error: `Required fields: ${missing.join(', ')}` }, { status: 400 });
    if (!['UG', 'PG'].includes(body.program)) return NextResponse.json({ success: false, error: 'Program must be UG or PG.' }, { status: 400 });
    if (!Number.isInteger(Number(body.semester)) || Number(body.semester) < 1) return NextResponse.json({ success: false, error: 'Semester must be a positive number.' }, { status: 400 });

    const db: any = getDB();
    db.recheckingApplications ||= [];
    const app = {
      id: `RECHECK-${Date.now()}`,
      studentRoll: String(body.studentRoll).trim(),
      studentName: String(body.studentName).trim(),
      program: body.program,
      semester: Number(body.semester),
      batch: body.batch ? String(body.batch).trim() : '',
      paperCode: body.paperCode ? String(body.paperCode).trim() : '',
      reason: String(body.reason).trim(),
      requestedMarks: body.requestedMarks === '' || body.requestedMarks == null ? null : Number(body.requestedMarks),
      status: 'Submitted',
      decisionNotes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.recheckingApplications.push(app);
    saveDB(db);
    return NextResponse.json({ success: true, application: app }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create application.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: 'Application ID is required.' }, { status: 400 });
    if (body.status !== undefined && !STATUSES.includes(body.status)) return NextResponse.json({ success: false, error: 'Invalid application status.' }, { status: 400 });
    const db: any = getDB();
    db.recheckingApplications ||= [];
    const application = db.recheckingApplications.find((item: any) => item.id === body.id);
    if (!application) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
    if (application.status === 'Completed' && body.status && body.status !== 'Completed') return NextResponse.json({ success: false, error: 'Completed applications are locked.' }, { status: 400 });
    if (body.status !== undefined) application.status = body.status;
    if (body.decisionNotes !== undefined) application.decisionNotes = String(body.decisionNotes).trim();
    if (body.requestedMarks !== undefined) application.requestedMarks = body.requestedMarks === '' || body.requestedMarks === null ? null : Number(body.requestedMarks);
    application.updatedAt = new Date().toISOString();
    saveDB(db);
    return NextResponse.json({ success: true, application });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update application.' }, { status: 500 });
  }
}
