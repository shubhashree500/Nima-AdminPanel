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

    db.students.push(student);
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roll = searchParams.get('roll');

    if (!roll) {
      return NextResponse.json(
        { success: false, error: 'Roll number is required.' },
        { status: 400 },
      );
    }

    const db = getDB();

    db.students = db.students.filter((student) => {
      const record = student as Student & Record<string, any>;

      const autonomousRollNo = String(
        record.autonomousRollNo ?? record.r ?? '',
      ).trim();

      const collegeRollNo = String(record.collegeRollNo ?? '').trim();

      return autonomousRollNo !== roll && collegeRollNo !== roll;
    });

    // Delete associated marks using the supplied roll number.
    Object.keys(db.marks).forEach((key) => {
      if (key.split('|')[0] === roll) {
        delete db.marks[key];
      }
    });

    saveDB(db);

    return NextResponse.json({ success: true, data: db });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
