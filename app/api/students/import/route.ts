import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { Student, ProgramKey, PROG } from '@/types';
import { isValidStudentRecord } from '@/lib/studentValidation';

export async function POST(request: Request) {
  try {
    const { students } = (await request.json()) as { students: Student[] };
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No student records provided.' },
        { status: 400 }
      );
    }

    const db = getDB();
    let addedCount = 0;
    let updatedCount = 0;

    students.forEach((raw) => {
      if (!isValidStudentRecord(raw)) {
        return;
      }
      const autoRoll = String(raw.autonomousRollNo ?? raw.r ?? '').trim();
      const collegeRoll = String(raw.collegeRollNo ?? '').trim();
      const name = String(raw.name ?? raw.n ?? '').trim();
      const prog = String(raw.programme ?? raw.p ?? 'UG').trim().toUpperCase() as ProgramKey;

      if (!name || (!autoRoll && !collegeRoll)) {
        return;
      }

      const primaryRoll = autoRoll || collegeRoll;
      const targetRoll = primaryRoll.toLowerCase();

      const existingIndex = db.students.findIndex((existing) => {
        const s = existing as Student & Record<string, any>;
        const sAuto = String(s.autonomousRollNo ?? s.r ?? '').trim().toLowerCase();
        const sCollege = String(s.collegeRollNo ?? '').trim().toLowerCase();
        const sR = String(s.r ?? '').trim().toLowerCase();

        return (
          (autoRoll && sAuto === autoRoll.toLowerCase()) ||
          (collegeRoll && sCollege === collegeRoll.toLowerCase()) ||
          sR === targetRoll
        );
      });

      if (existingIndex > -1) {
        const existing = db.students[existingIndex];
        const updatedRecord: Student = {
          batch: String(raw.batch || existing.batch || '2025').trim(),
          programme: PROG[prog] ? prog : existing.programme,
          autonomousRollNo: autoRoll || existing.autonomousRollNo || '',
          collegeRollNo: collegeRoll || existing.collegeRollNo || '',
          name: name || existing.name,
          dob: String(raw.dob || existing.dob || '').trim(),
          abcId: String(raw.abcId || existing.abcId || '').trim(),
          department: String(raw.department || existing.department || '').trim(),
          course: String(raw.course || existing.course || '').trim(),
          stream: String(raw.stream || existing.stream || '').trim(),
          r: autoRoll || collegeRoll || existing.r,
          n: name || existing.name,
          p: PROG[prog] ? prog : existing.p,
        };
        db.students[existingIndex] = updatedRecord;
        updatedCount++;
      } else {
        const newRecord: Student = {
          batch: String(raw.batch || '2025').trim(),
          programme: PROG[prog] ? prog : 'UG',
          autonomousRollNo: autoRoll,
          collegeRollNo: collegeRoll,
          name,
          dob: String(raw.dob || '').trim(),
          abcId: String(raw.abcId || '').trim(),
          department: String(raw.department || '').trim(),
          course: String(raw.course || '').trim(),
          stream: String(raw.stream || '').trim(),
          r: primaryRoll,
          n: name,
          p: PROG[prog] ? prog : 'UG',
        };
        db.students.push(newRecord);
        addedCount++;
      }
    });

    saveDB(db);

    return NextResponse.json({
      success: true,
      count: students.length,
      added: addedCount,
      updated: updatedCount,
      data: db,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Import failed.' },
      { status: 500 }
    );
  }
}
