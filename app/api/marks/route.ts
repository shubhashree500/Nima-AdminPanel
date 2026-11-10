import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { findStudent } from '@/lib/calculations';
import { isAbsentMark } from '@/lib/calculation/absence';

export async function POST(request: Request) {
  try {
    const { roll, sem, marks } = (await request.json()) as {
      roll: string;
      sem: number | string;
      marks: Record<string, number>;
    };

    if (!roll || !sem || !marks || typeof marks !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Roll, semester, and marks are required.' },
        { status: 400 }
      );
    }

    const semNum = Number(sem);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 8) {
      return NextResponse.json(
        { success: false, error: 'Invalid semester number.' },
        { status: 400 }
      );
    }

    const db = getDB();
    const student = findStudent(db, roll);
    if (!student) {
      return NextResponse.json(
        { success: false, error: `Student with roll "${roll}" not found.` },
        { status: 404 }
      );
    }

    // Protection of official published results
    const publishedList = (db as any).calculatedResults || [];
    const hasPublished = publishedList.some((calc: any) => {
      if (calc.status !== 'published') return false;
      if (Number(calc.semester) !== semNum) return false;
      const results = Array.isArray(calc.results) ? calc.results : [];
      return results.some((item: any) => {
        const s = item.student || item;
        const auto = String(s.autonomousRollNo ?? s['Autonomous Roll No'] ?? s.r ?? '').toLowerCase();
        const college = String(s.collegeRollNo ?? s['College Roll No'] ?? '').toLowerCase();
        const rNorm = String(roll).toLowerCase();
        return auto === rNorm || college === rNorm;
      });
    });

    if (hasPublished) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot modify marks. Results for this student in Semester ${semNum} are already published. Use the formal result correction workflow.`,
        },
        { status: 409 }
      );
    }

    // Validate marks bounds (0 <= mark <= max) or Absent ('A')
    const validMarks: Record<string, number> = {};
    const statusMarks: Record<string, 'PRESENT' | 'ABSENT'> = {};

    for (const [subject, markValue] of Object.entries(marks)) {
      if (markValue === null || markValue === undefined || String(markValue).trim() === '') {
        continue;
      }

      if (isAbsentMark(markValue)) {
        // Treat as numeric 0 during calculations, preserve absence separately
        validMarks[subject] = 0;
        statusMarks[subject] = 'ABSENT';
        continue;
      }

      const num = Number(markValue);
      if (Number.isNaN(num) || num < 0 || num > db.max) {
        return NextResponse.json(
          {
            success: false,
            error: `Mark for "${subject}" (${markValue}) is invalid. Must be between 0 and ${db.max} (or 'A' for Absent).`,
          },
          { status: 400 }
        );
      }
      validMarks[subject] = num;
      statusMarks[subject] = 'PRESENT';
    }

    if (Object.keys(validMarks).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Enter at least one valid mark.' },
        { status: 400 }
      );
    }

    const primaryRoll = student.r || roll;
    const key = `${primaryRoll}|${semNum}`;
    db.marks[key] = { ...(db.marks[key] || {}), ...validMarks };
    db.marksStatus = db.marksStatus || {};
    db.marksStatus[key] = { ...(db.marksStatus[key] || {}), ...statusMarks };

    saveDB(db);
    return NextResponse.json({ success: true, data: db });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save marks.' },
      { status: 500 }
    );
  }
}
