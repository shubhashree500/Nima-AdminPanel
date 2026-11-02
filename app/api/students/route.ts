import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { Student, ProgramKey, PROG } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const batch = String(body.batch ?? '').trim();
    const programme = String(body.programme ?? body.p ?? '')
      .trim()
      .toUpperCase();

    const autonomousRollNo = String(
      body.autonomousRollNo ?? body.r ?? '',
    ).trim();

    const collegeRollNo = String(body.collegeRollNo ?? '').trim();
    const name = String(body.name ?? body.n ?? '').trim();
    const dob = String(body.dob ?? '').trim();
    const abcId = String(body.abcId ?? '').trim();
    const department = String(body.department ?? '').trim();
    const course = String(body.course ?? '').trim();
    const stream = String(body.stream ?? '').trim();

    if (!name || !programme || (!autonomousRollNo && !collegeRollNo)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Student name, programme, and at least one roll number are required.',
        },
        { status: 400 },
      );
    }

    if (!PROG[programme as ProgramKey]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid programme "${programme}".`,
        },
        { status: 400 },
      );
    }

    const db = getDB();

    const duplicate = db.students.some((student) => {
      const existing = student as Student & Record<string, any>;

      const existingAuto = String(
        existing.autonomousRollNo ?? existing.r ?? '',
      ).trim();

      const existingCollege = String(
        existing.collegeRollNo ?? '',
      ).trim();

      return (
        (autonomousRollNo &&
          existingAuto.toLowerCase() === autonomousRollNo.toLowerCase()) ||
        (collegeRollNo &&
          existingCollege.toLowerCase() === collegeRollNo.toLowerCase())
      );
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: 'A student with this autonomous or college roll number already exists.',
        },
        { status: 400 },
      );
    }

    const student: Student = {
      // Actual student record
      batch,
      programme,
      autonomousRollNo,
      collegeRollNo,
      name,
      dob,
      abcId,
      department,
      course,
      stream,

      // Backward compatibility with existing Admin Panel code
      r: autonomousRollNo || collegeRollNo,
      n: name,
      p: programme as ProgramKey,
    };

    db.students.unshift(student);
    saveDB(db);

    return NextResponse.json({
      success: true,
      student,
      data: db,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const originalRoll = String(
      body.originalRoll ?? body.originalAutonomousRollNo ?? body.r ?? ''
    )
      .trim()
      .toLowerCase();

    const batch = String(body.batch ?? '').trim();
    const programme = String(body.programme ?? body.p ?? '')
      .trim()
      .toUpperCase();

    const autonomousRollNo = String(body.autonomousRollNo ?? '').trim();
    const collegeRollNo = String(body.collegeRollNo ?? '').trim();
    const name = String(body.name ?? body.n ?? '').trim();
    const dob = String(body.dob ?? '').trim();
    const abcId = String(body.abcId ?? '').trim();
    const department = String(body.department ?? '').trim();
    const course = String(body.course ?? '').trim();
    const stream = String(body.stream ?? '').trim();

    if (!name || !programme || (!autonomousRollNo && !collegeRollNo)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Student name, programme, and at least one roll number are required.',
        },
        { status: 400 }
      );
    }

    if (!PROG[programme as ProgramKey]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid programme "${programme}".`,
        },
        { status: 400 }
      );
    }

    const db = getDB();
    const targetRoll =
      originalRoll ||
      autonomousRollNo.toLowerCase() ||
      collegeRollNo.toLowerCase();

    const existingIndex = db.students.findIndex((student) => {
      const record = student as Student & Record<string, any>;
      const sAuto = String(record.autonomousRollNo ?? record.r ?? '')
        .trim()
        .toLowerCase();
      const sCollege = String(record.collegeRollNo ?? '')
        .trim()
        .toLowerCase();
      const sR = String(record.r ?? '')
        .trim()
        .toLowerCase();
      return (
        sAuto === targetRoll || sCollege === targetRoll || sR === targetRoll
      );
    });

    if (existingIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Student record not found to update.' },
        { status: 404 }
      );
    }

    // Check duplicate among OTHER students
    const duplicate = db.students.some((student, index) => {
      if (index === existingIndex) return false;
      const existing = student as Student & Record<string, any>;
      const existingAuto = String(
        existing.autonomousRollNo ?? existing.r ?? ''
      )
        .trim()
        .toLowerCase();
      const existingCollege = String(existing.collegeRollNo ?? '')
        .trim()
        .toLowerCase();

      return (
        (autonomousRollNo &&
          existingAuto === autonomousRollNo.toLowerCase()) ||
        (collegeRollNo && existingCollege === collegeRollNo.toLowerCase())
      );
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A different student already has this autonomous or college roll number.',
        },
        { status: 400 }
      );
    }

    const oldRecord = db.students[existingIndex];
    const oldPrimaryRoll =
      oldRecord.r || oldRecord.autonomousRollNo || oldRecord.collegeRollNo;
    const newPrimaryRoll = autonomousRollNo || collegeRollNo;

    const updatedStudent: Student = {
      batch: batch || oldRecord.batch || '2025',
      programme,
      autonomousRollNo,
      collegeRollNo,
      name,
      dob,
      abcId,
      department,
      course,
      stream,
      r: newPrimaryRoll,
      n: name,
      p: programme as ProgramKey,
    };

    db.students[existingIndex] = updatedStudent;

    // If primary roll key changed, migrate marks to the new roll key
    if (oldPrimaryRoll && oldPrimaryRoll !== newPrimaryRoll) {
      Object.keys(db.marks).forEach((key) => {
        const [roll, sem] = key.split('|');
        if (roll.toLowerCase() === oldPrimaryRoll.toLowerCase()) {
          const newKey = `${newPrimaryRoll}|${sem}`;
          db.marks[newKey] = db.marks[key];
          delete db.marks[key];
        }
      });
    }

    saveDB(db);

    return NextResponse.json({
      success: true,
      student: updatedStudent,
      data: db,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roll = searchParams.get('roll');
    const force = searchParams.get('force') === 'true';

    if (!roll) {
      return NextResponse.json(
        { success: false, error: 'Roll number is required.' },
        { status: 400 },
      );
    }

    const db = getDB();
    const rollLower = roll.trim().toLowerCase();

    // Protect published results from unauthorized changes
    const publishedList = (db as any).calculatedResults || [];
    const hasPublished = publishedList.some((calc: any) => {
      if (calc.status !== 'published') return false;
      const results = Array.isArray(calc.results) ? calc.results : [];
      return results.some((item: any) => {
        const s = item.student || item;
        const auto = String(
          s.autonomousRollNo ?? s['Autonomous Roll No'] ?? s.r ?? ''
        ).toLowerCase();
        const college = String(
          s.collegeRollNo ?? s['College Roll No'] ?? ''
        ).toLowerCase();
        return auto === rollLower || college === rollLower;
      });
    });

    if (hasPublished && !force) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Cannot delete student who has official published examination results. Confirm force delete to proceed.',
          canForce: true,
        },
        { status: 409 }
      );
    }

    const beforeCount = db.students.length;
    db.students = db.students.filter((student) => {
      const record = student as Student & Record<string, any>;

      const autonomousRollNo = String(
        record.autonomousRollNo ?? record.r ?? '',
      ).trim().toLowerCase();

      const collegeRollNo = String(record.collegeRollNo ?? '').trim().toLowerCase();
      const r = String(record.r ?? '').trim().toLowerCase();

      return (
        autonomousRollNo !== rollLower &&
        collegeRollNo !== rollLower &&
        r !== rollLower
      );
    });

    // Delete associated marks using the supplied roll number (case-insensitive).
    Object.keys(db.marks).forEach((key) => {
      const markRoll = key.split('|')[0].trim().toLowerCase();
      if (markRoll === rollLower) {
        delete db.marks[key];
      }
    });

    saveDB(db);

    return NextResponse.json({
      success: true,
      deleted: beforeCount - db.students.length,
      data: db,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
