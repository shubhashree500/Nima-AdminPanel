
import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = [
  'calculated',
  'verified',
  'published',
  'rejected',
];

export async function GET(request: Request) {
  try {
    const db: any = getDB();

    return NextResponse.json({
      success: true,
      data: db.calculatedResults || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load calculated results',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { calculationId, status } = body;

    if (!calculationId || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Calculation ID and status are required.',
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid result status.',
        },
        { status: 400 }
      );
    }

    const db: any = getDB();
    const records = db.calculatedResults || [];

    const record = records.find(
      (item: any) => item.id === calculationId
    );

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: 'Calculation record not found.',
        },
        { status: 404 }
      );
    }

    // Published results are immutable through this workflow.
    if (record.status === 'published') {
      return NextResponse.json(
        { success: false, error: 'This calculation is already published and locked.' },
        { status: 400 }
      );
    }

    // Enforce the workflow: calculated/rejected -> verified -> published.
    if (status === 'verified') {
      if (!['calculated', 'rejected'].includes(String(record.status || 'calculated'))) {
        return NextResponse.json(
          { success: false, error: 'Only a calculated or rejected record can be verified.' },
          { status: 400 }
        );
      }
      if (!Array.isArray(record.results) || record.results.length === 0) {
        return NextResponse.json(
          { success: false, error: 'This calculation has no student results to verify.' },
          { status: 400 }
        );
      }
      const malformed = record.results.find((student: any) => !Array.isArray(student?.subjects) || student.subjects.length === 0);
      if (malformed) {
        return NextResponse.json(
          { success: false, error: 'At least one student result is missing subject-level results. Review the calculation before verifying.' },
          { status: 400 }
        );
      }
    }

    if (status === 'published') {
      if (!['verified', 'calculated'].includes(String(record.status || 'calculated'))) {
        return NextResponse.json(
          { success: false, error: 'Only a calculated or verified record can be published.' },
          { status: 400 }
        );
      }
      if (!Array.isArray(record.results) || record.results.length === 0 || record.results.some((student: any) => !Array.isArray(student?.subjects) || student.subjects.length === 0)) {
        return NextResponse.json(
          { success: false, error: 'Publication blocked: the saved calculation contains missing student or subject results.' },
          { status: 400 }
        );
      }
    }

    // Prevent two published records for the same exam scope.
    if (status === 'published') {
      const duplicate = records.find((item: any) =>
        item.id !== record.id && item.status === 'published' &&
        item.program === record.program && Number(item.semester) === Number(record.semester) &&
        String(item.batch || '') === String(record.batch || '') &&
        String(item.course || '') === String(record.course || '') &&
        String(item.department || '') === String(record.department || '')
      );
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `A result is already published for this exam scope (${duplicate.id}). Use a formal result-correction workflow instead of publishing a duplicate.` },
          { status: 409 }
        );
      }
    }

    const previousStatus = record.status || 'calculated';
    record.status = status;
    record.updatedAt = new Date().toISOString();
    record.statusHistory = Array.isArray(record.statusHistory) ? record.statusHistory : [];
    record.statusHistory.push({ from: previousStatus, to: status, at: record.updatedAt });

    if (status === 'published') {
      if (!db.marks) db.marks = {};
      if (Array.isArray(record.results)) {
        record.results.forEach((item: any) => {
          const s = item.student || item;
          const roll = String(
            s.autonomousRollNo || s['Autonomous Roll No'] || s.collegeRollNo || s['College Roll No'] || s.roll || s.r || ''
          ).trim();
          if (!roll) return;
          const key = `${roll}|${record.semester}`;
          if (!db.marks[key]) db.marks[key] = {};
          if (Array.isArray(item.subjects)) {
            item.subjects.forEach((sub: any) => {
              const subName = sub.subjectName || sub.paperCode || sub.code || sub.name;
              if (subName && sub.marks !== undefined) {
                db.marks[key][subName] = Number(sub.marks) || 0;
              }
            });
          }
        });
      }
    }

    if (status === 'published' && Array.isArray(db.examSessions)) {
      db.examSessions = db.examSessions.map((session: any) => {
        const matches = session.program === record.program &&
          Number(session.semester) === Number(record.semester) &&
          String(session.batch || '') === String(record.batch || '') &&
          (!session.course || !record.course || record.course === 'AUTO' || String(session.course) === String(record.course)) &&
          (!session.department || !record.department || record.department === 'AUTO' || String(session.department) === String(record.department));
        return matches
          ? { ...session, status: 'Published', updatedAt: record.updatedAt }
          : session;
      });
    }

    saveDB(db);

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update result status',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationId = searchParams.get('calculationId');
    const roll = searchParams.get('roll');

    if (!calculationId || !roll) {
      return NextResponse.json(
        { success: false, error: 'calculationId and roll are required.' },
        { status: 400 }
      );
    }

    const db: any = getDB();
    const records = db.calculatedResults || [];
    const record = records.find((item: any) => item.id === calculationId);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Calculation record not found.' },
        { status: 404 }
      );
    }

    const rollLower = roll.trim().toLowerCase();
    const originalLength = record.results?.length || 0;

    record.results = (record.results || []).filter((item: any) => {
      const s = item.student || item;
      const sRolls = [
        s['College Roll No'],
        s['College Roll No.'],
        s['Roll No'],
        s['Roll No.'],
        s['College Roll'],
        s.collegeRollNo,
        s.roll,
        s.rollNo,
        s.r,
        s['Autonomous Roll No'],
        s['Autonomous Roll No.'],
        s.autonomousRollNo,
        item?.studentRoll,
        item?.roll,
      ]
        .map((r) => String(r ?? '').trim().toLowerCase())
        .filter(Boolean);

      return !sRolls.includes(rollLower);
    });

    record.count = record.results.length;
    record.passed = record.results.filter((res: any) =>
      (res.subjects || []).every(
        (sub: any) =>
          !['F', 'AB', 'M'].includes(String(sub.grade || '').toUpperCase())
      )
    ).length;
    record.failed = record.count - record.passed;
    record.updatedAt = new Date().toISOString();

    // If published, also remove from db.marks
    if (record.status === 'published' && db.marks) {
      const key = `${roll}|${record.semester}`;
      delete db.marks[key];
    }

    saveDB(db);

    return NextResponse.json({
      success: true,
      deletedCount: originalLength - record.count,
      data: record,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete student result',
      },
      { status: 500 }
    );
  }
}

