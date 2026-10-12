import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import type { DBData, ExamSession } from '@/types';

export async function GET() {
  try {
    const db = getDB();

    return NextResponse.json({
      success: true,
      sessions: db.examSessions || [],
    });
  } catch (error) {
    console.error('Failed to load exam sessions:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load exam sessions',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.academicYear) {
      return NextResponse.json(
        { success: false, error: 'Academic year is required' },
        { status: 400 }
      );
    }

    if (!body.batch) {
      return NextResponse.json(
        { success: false, error: 'Batch is required' },
        { status: 400 }
      );
    }

    if (!body.program) {
      return NextResponse.json(
        { success: false, error: 'Program is required' },
        { status: 400 }
      );
    }

    if (!body.semester) {
      return NextResponse.json(
        { success: false, error: 'Semester is required' },
        { status: 400 }
      );
    }
    if (!['UG', 'PG'].includes(body.program)) {
      return NextResponse.json({ success: false, error: 'Program must be UG or PG.' }, { status: 400 });
    }
    const semester = Number(body.semester);
    const maxSemester = body.program === 'UG' ? 6 : 4;
    if (!Number.isInteger(semester) || semester < 1 || semester > maxSemester) {
      return NextResponse.json({ success: false, error: `Semester must be between 1 and ${maxSemester} for ${body.program}.` }, { status: 400 });
    }
    if (!Number.isInteger(Number(body.batch)) || Number(body.batch) < 2000) {
      return NextResponse.json({ success: false, error: 'Enter a valid batch year.' }, { status: 400 });
    }

    const db = getDB() as DBData;
    const sessions = db.examSessions || [];
    const duplicate = sessions.find((item) =>
      item.academicYear === String(body.academicYear).trim() &&
      Number(item.batch) === Number(body.batch) && item.program === body.program &&
      Number(item.semester) === Number(body.semester) && item.examType === (body.examType || 'Regular') &&
      String(item.course || '') === String(body.course || '') &&
      String(item.department || '') === String(body.department || '')
    );
    if (duplicate) {
      return NextResponse.json({ success: false, error: `An exam session with these details already exists (${duplicate.id}).` }, { status: 409 });
    }

    const session: ExamSession = {
      id: `EXAM-${Date.now()}`,
      academicYear: body.academicYear,
      batch: Number(body.batch),
      program: body.program,
      course: body.course || undefined,
      department: body.department || undefined,
      semester: Number(body.semester),
      examType: body.examType || 'Regular',
      status: body.status || 'Draft',
      examStartDate: body.examStartDate || undefined,
      examEndDate: body.examEndDate || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessions.push(session);
    db.examSessions = sessions;

    saveDB(db);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Failed to create exam session:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create exam session',
      },
      { status: 500 }
    );
  }
}


/* =========================
   UPDATE SESSION
   ========================= */

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID is required',
        },
        { status: 400 }
      );
    }

    const db = getDB() as DBData;
    const sessions = db.examSessions || [];

    const index = sessions.findIndex(
      (session) => session.id === body.id
    );

    if (index === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Exam session not found',
        },
        { status: 404 }
      );
    }

    const existing = sessions[index];
    if (body.status === 'Published') {
      const calculations = (db as any).calculatedResults || [];
      const hasPublishedResult = calculations.some((item: any) =>
        item.status === 'published' && item.program === existing.program &&
        Number(item.semester) === Number(existing.semester) &&
        String(item.batch || '') === String(existing.batch || '') &&
        (!existing.course || !item.course || String(item.course) === String(existing.course)) &&
        (!existing.department || !item.department || String(item.department) === String(existing.department))
      );
      if (!hasPublishedResult) {
        return NextResponse.json({ success: false, error: 'Publish the verified calculation first. The exam session cannot be marked Published before a result is published.' }, { status: 400 });
      }
    }

    const updated: ExamSession = {
      ...existing,

      academicYear:
        body.academicYear ?? existing.academicYear,

      batch:
        body.batch !== undefined
          ? Number(body.batch)
          : existing.batch,

      program:
        body.program ?? existing.program,

      course:
        body.course !== undefined
          ? body.course || undefined
          : existing.course,

      department:
        body.department !== undefined
          ? body.department || undefined
          : existing.department,

      semester:
        body.semester !== undefined
          ? Number(body.semester)
          : existing.semester,

      examType:
        body.examType ?? existing.examType,

      status:
        body.status ?? existing.status,

      examStartDate:
        body.examStartDate !== undefined
          ? body.examStartDate || undefined
          : existing.examStartDate,

      examEndDate:
        body.examEndDate !== undefined
          ? body.examEndDate || undefined
          : existing.examEndDate,

      updatedAt: new Date().toISOString(),
    };

    sessions[index] = updated;
    db.examSessions = sessions;

    saveDB(db);

    return NextResponse.json({
      success: true,
      session: updated,
    });
  } catch (error) {
    console.error('Failed to update exam session:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update exam session',
      },
      { status: 500 }
    );
  }
}


/* =========================
   DELETE SESSION
   ========================= */

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID is required',
        },
        { status: 400 }
      );
    }

    const db = getDB() as DBData;
    const sessions = db.examSessions || [];

    const existing = sessions.find(
      (session) => session.id === body.id
    );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Exam session not found',
        },
        { status: 404 }
      );
    }

    const publishedResult = ((db as any).calculatedResults || []).find((item: any) =>
      item.status === 'published' && item.program === existing.program &&
      Number(item.semester) === Number(existing.semester) &&
      String(item.batch || '') === String(existing.batch || '') &&
      (!existing.course || !item.course || String(item.course) === String(existing.course)) &&
      (!existing.department || !item.department || String(item.department) === String(existing.department))
    );
    if (publishedResult) {
      return NextResponse.json({ success: false, error: `This session is linked to published calculation ${publishedResult.id} and cannot be deleted.` }, { status: 409 });
    }

    db.examSessions = sessions.filter(
      (session) => session.id !== body.id
    );

    saveDB(db);

    return NextResponse.json({
      success: true,
      message: 'Exam session deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete exam session:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete exam session',
      },
      { status: 500 }
    );
  }
}