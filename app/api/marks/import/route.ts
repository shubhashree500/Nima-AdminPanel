import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { findStudent } from '@/lib/calculations';

export async function POST(request: Request) {
  try {
    const { sem, records } = (await request.json()) as {
      sem: number | string;
      records: Array<{ r: string; m: Record<string, number> }>;
    };

    if (!sem || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Semester and records are required.' },
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
    const publishedList = (db as any).calculatedResults || [];
    const publishedStudentsInSem = new Set<string>();

    publishedList.forEach((calc: any) => {
      if (calc.status === 'published' && Number(calc.semester) === semNum) {
        const results = Array.isArray(calc.results) ? calc.results : [];
        results.forEach((item: any) => {
          const s = item.student || item;
          const auto = String(s.autonomousRollNo ?? s['Autonomous Roll No'] ?? s.r ?? '').toLowerCase();
          const college = String(s.collegeRollNo ?? s['College Roll No'] ?? '').toLowerCase();
          if (auto) publishedStudentsInSem.add(auto);
          if (college) publishedStudentsInSem.add(college);
        });
      }
    });

    let importedCount = 0;
    let skippedPublished = 0;
    let skippedNotFound = 0;
    let skippedInvalid = 0;

    records.forEach(({ r, m }) => {
      if (!r || !m || typeof m !== 'object') {
        skippedInvalid++;
        return;
      }

      const rNorm = String(r).trim().toLowerCase();
      if (publishedStudentsInSem.has(rNorm)) {
        skippedPublished++;
        return;
      }

      const student = findStudent(db, r);
      if (!student) {
        skippedNotFound++;
        return;
      }

      const primaryRoll = student.r || r;
      const key = `${primaryRoll}|${semNum}`;

      const validM: Record<string, number> = {};
      for (const [sub, val] of Object.entries(m)) {
        const num = Number(val);
        if (!Number.isNaN(num) && num >= 0 && num <= db.max) {
          validM[sub] = num;
        }
      }

      if (Object.keys(validM).length > 0) {
        db.marks[key] = { ...(db.marks[key] || {}), ...validM };
        importedCount++;
      }
    });

    saveDB(db);

    return NextResponse.json({
      success: true,
      count: records.length,
      imported: importedCount,
      skippedPublished,
      skippedNotFound,
      skippedInvalid,
      data: db,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to import marks.' },
      { status: 500 }
    );
  }
}
