import { NextResponse } from 'next/server';

import {
  calculateResults,
} from '@/lib/resultEngine';

import {
  getDB,
  saveDB,
} from '@/lib/db';

import type {
  EngineRequest,
} from '@/lib/calculation/types';

import {
  detectUGCourse,
  mapUGExcelStudent,
} from '@/lib/calculation/ugExcelMapper';

// =====================================================
// PG DEPARTMENT
// =====================================================

function normalizeDepartment(
  value: unknown,
): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  if (
    raw === 'department' ||
    raw === 'department name'
  ) {
    return '';
  }

  const map: Record<
    string,
    string
  > = {
    odia: 'Odia',
    chemistry: 'Chemistry',
    math: 'Mathematics',
    mathematics: 'Mathematics',
    commerce: 'Commerce',
    geology: 'Geology',
    mfc: 'MFC',
  };

  return (
    map[raw] ??
    String(value ?? '').trim()
  );
}

function getDepartment(
  student: any,
): string {
  return normalizeDepartment(
    student?.Department ??
      student?.department ??
      student?.['Department Name'] ??
      student?.['department name'],
  );
}

// =====================================================
// STUDENT VALIDATION
// =====================================================

function isValidStudent(
  student: any,
): boolean {
  const department =
    getDepartment(student);

  const roll =
    student?.['College Roll No'] ??
    student?.['College Roll No.'] ??
    student?.['College Roll'] ??
    student?.collegeRollNo ??
    student?.roll ??
    student?.rollNo ??
    student?.['Roll No'];

  const name =
    student?.['Applicant Name'] ??
    student?.['Name of the Students'] ??
    student?.['Student Name'] ??
    student?.name;

  return Boolean(
    department &&
      (
        String(roll ?? '').trim() ||
        String(name ?? '').trim()
      ),
  );
}

// =====================================================
// PASS / FAIL
// =====================================================

function calculatePassCount(
  results: any[],
): number {
  return results.filter(
    (result) =>
      result.subjects.every(
        (subject: any) =>
          subject.grade !== 'F' &&
          subject.grade !== 'AB' &&
          subject.grade !== 'M',
      ),
  ).length;
}

// =====================================================
// SAVE
// =====================================================

function saveCalculation({
  engine,
  results,
  passed,
  failed,
  program,
  semester,
  batch,
  course,
  department,
  departments,
}: {
  engine: any;
  results: any[];
  passed: number;
  failed: number;
  program: string;
  semester: number;
  batch?: string;
  course?: string;
  department?: string;
  departments?: any[];
}) {
  const db: any = getDB();

  if (!db.calculatedResults) {
    db.calculatedResults = [];
  }

  const now =
    new Date().toISOString();

  const calculationRecord = {
    id: `CALC-${Date.now()}`,
    status: 'calculated',
    createdAt: now,

    program,
    semester,
    batch: batch || '',
    course: course || '',
    department: department || '',

    engine,

    count: results.length,
    passed,
    failed,

    departments:
      departments || [],

    results,
  };

  db.calculatedResults.push(
    calculationRecord,
  );

  saveDB(db);

  return NextResponse.json({
    success: true,

    engine,

    calculationId:
      calculationRecord.id,

    count: results.length,
    passed,
    failed,

    departments:
      departments || [],

    results,
  });
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const program =
      body.program;

    const semester =
      Number(body.semester);

    const batch =
      body.batch;

    const course =
      body.course;

    const mode =
      body.mode || 'normal';

    const requestedDepartment =
      body.department;

    const students =
      body.students || [];

    if (!program) {
      throw new Error(
        'Program is required.',
      );
    }

    if (!semester) {
      throw new Error(
        'Semester is required.',
      );
    }

    if (!Array.isArray(students)) {
      throw new Error(
        'Students data must be an array.',
      );
    }

    if (students.length === 0) {
      throw new Error(
        'No student data found in the uploaded file.',
      );
    }

    // =================================================
    // UG
    // =================================================

    if (program === 'UG') {
      /*
       * The combined UG workbook contains:
       *
       * BA24
       * BS24
       * BC24
       * BCA24
       * BBA24
       *
       * Detect course automatically from Roll No.
       */

      const validRows = students.filter((student) => {
  const rollNo =
    student?.['Roll No'] ??
    student?.['Roll No.'] ??
    student?.rollNo;

  return detectUGCourse(rollNo) !== null;
});

      if (validRows.length === 0) {
        throw new Error(
          'No valid UG students found. Could not detect course from Roll No.',
        );
      }

      const groups =
        new Map<
          string,
          any[]
        >();

      for (
        const student of validRows
      ) {
        const rollNo =
  student?.['Roll No'] ??
  student?.['Roll No.'] ??
  student?.rollNo;

const detected =
  detectUGCourse(rollNo);

        if (!detected) {
          continue;
        }

        const key =
          `${detected.course}-${detected.batch}`;

        if (!groups.has(key)) {
          groups.set(
            key,
            [],
          );
        }

        groups
          .get(key)!
          .push(student);
      }

      const allResults: any[] = [];

      const courseSummary: any[] =
        [];

      for (
        const [
          key,
          groupStudents,
        ] of Array.from(
          groups.entries(),
        )
      ) {
        
const firstRollNo =
  groupStudents[0]?.['Roll No'] ??
  groupStudents[0]?.['Roll No.'] ??
  groupStudents[0]?.rollNo;

const first = detectUGCourse(firstRollNo);

        if (!first) {
          continue;
        }

        const mappedStudents =
          groupStudents.map(
            mapUGExcelStudent,
          );

        const engineRequest:
          EngineRequest = {
            program: 'UG',
            semester,
            batch:
              String(
                first.batch,
              ),
            course:
              first.course,
            mode,
            students:
              mappedStudents,
          };

        let results: any[];

        try {
          results =
            calculateResults(
              engineRequest,
            );
        } catch (error) {
          throw new Error(
            `Failed to process UG course "${first.course}": ${
              error instanceof Error
                ? error.message
                : 'Unknown calculation error'
            }`,
          );
        }

        const passed =
          calculatePassCount(
            results,
          );

        const failed =
          results.length -
          passed;

        allResults.push(
          ...results,
        );

        courseSummary.push({
          course:
            first.course,
          batch:
            first.batch,
          count:
            results.length,
          passed,
          failed,
        });
      }

      const passed =
        calculatePassCount(
          allResults,
        );

      const failed =
        allResults.length -
        passed;

      return saveCalculation({
        engine: {
          program: 'UG',
          semester,
          batch: '2024',
          course: 'AUTO',
          department: 'AUTO',
          label:
            `UG Semester ${semester}`,
        },

        results:
          allResults,

        passed,
        failed,

        program: 'UG',
        semester,
        batch: '2024',
        course: 'AUTO',
        department: 'AUTO',

        departments:
          courseSummary,
      });
    }

    // =================================================
    // PG
    // =================================================

    if (program !== 'PG') {
      throw new Error(
        `Unsupported program: ${program}`,
      );
    }

    const validStudents =
      students.filter(
        isValidStudent,
      );

    if (
      validStudents.length === 0
    ) {
      throw new Error(
        'No valid PG student rows found. Department information is required.',
      );
    }

    const departmentGroups =
      new Map<
        string,
        any[]
      >();

    for (
      const student of validStudents
    ) {
      const department =
        getDepartment(
          student,
        );

      if (!department) {
        continue;
      }

      if (
        !departmentGroups.has(
          department,
        )
      ) {
        departmentGroups.set(
          department,
          [],
        );
      }

      departmentGroups
        .get(department)!
        .push(student);
    }

    if (
      departmentGroups.size === 0
    ) {
      throw new Error(
        'No PG departments could be detected from the uploaded Excel.',
      );
    }

    const allResults: any[] = [];

    const departmentSummary: any[] =
      [];

    for (
      const [
        department,
        departmentStudents,
      ] of Array.from(
        departmentGroups.entries(),
      )
    ) {
      const engineRequest:
        EngineRequest = {
          program: 'PG',
          semester,
          batch,
          course,
          department,
          mode,
          students:
            departmentStudents,
        };

      let results: any[];

      try {
        results =
          calculateResults(
            engineRequest,
          );
      } catch (error) {
        throw new Error(
          `Failed to process PG department "${department}": ${
            error instanceof Error
              ? error.message
              : 'Unknown calculation error'
          }`,
        );
      }

      const passed =
        calculatePassCount(
          results,
        );

      const failed =
        results.length -
        passed;

      allResults.push(
        ...results,
      );

      departmentSummary.push({
        department,
        count:
          results.length,
        passed,
        failed,
      });
    }

    const passed =
      calculatePassCount(
        allResults,
      );

    const failed =
      allResults.length -
      passed;

    return saveCalculation({
      engine: {
        program: 'PG',
        semester,
        batch,
        course,
        department: 'AUTO',
        label:
          `PG Semester ${semester}`,
      },

      results:
        allResults,

      passed,
      failed,

      program: 'PG',
      semester,
      batch,
      course,
      department: 'AUTO',

      departments:
        departmentSummary,
    });
  } catch (error) {
    console.error(
      'Result processing error:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Result processing failed',
      },
      {
        status: 400,
      },
    );
  }
}