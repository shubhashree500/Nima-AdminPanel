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

import { isValidStudentRecord } from '@/lib/studentValidation';

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
  if (!isValidStudentRecord(student)) {
    return false;
  }

  const department =
    getDepartment(student);

  const roll =
    student?.['College Roll No'] ??
    student?.['College Roll No.'] ??
    student?.['College Roll'] ??
    student?.collegeRollNo ??
    student?.roll ??
    student?.rollNo ??
    student?.['Roll No'] ??
    student?.autonomousRollNo ??
    student?.['Autonomous Roll No'] ??
    student?.['Autonomous Roll No.'] ??
    student?.r;

  const name =
    student?.['Applicant Name'] ??
    student?.['Name of the Students'] ??
    student?.['Student Name'] ??
    student?.name ??
    student?.n;

  const deptStr = String(department ?? '').trim().toLowerCase();
  const rollStr = String(roll ?? '').trim().toLowerCase();
  const nameStr = String(name ?? '').trim().toLowerCase();

  if (
    !deptStr ||
    deptStr === 'department' ||
    deptStr === 'department name' ||
    deptStr === 'dept'
  ) {
    return false;
  }
  if (
    rollStr === 'roll no' ||
    rollStr === 'roll no.' ||
    rollStr === 'college roll no' ||
    rollStr === 'autonomous roll no'
  ) {
    return false;
  }
  if (
    nameStr === 'name of the students' ||
    nameStr === 'student name' ||
    nameStr === 'applicant name'
  ) {
    return false;
  }

  return Boolean(rollStr || nameStr);
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
  calculationId,
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
  calculationId?: string;
}) {
  const db: any = getDB();

  if (!db.calculatedResults) {
    db.calculatedResults = [];
  }

  const now =
    new Date().toISOString();

  // Find existing calculation record for the same batch, program, semester
  let existingRecord: any = null;
  if (calculationId) {
    existingRecord = db.calculatedResults.find(
      (item: any) => item.id === calculationId
    );
  }

  if (!existingRecord) {
    // Prefer matching unpublished calculation for this program, semester, batch
    existingRecord = db.calculatedResults.find(
      (item: any) =>
        item.program === program &&
        Number(item.semester) === Number(semester) &&
        String(item.batch || '') === String(batch || '') &&
        item.status !== 'published'
    );
    // If none found with status !== 'published', match any for this program, semester, batch
    if (!existingRecord) {
      existingRecord = db.calculatedResults.find(
        (item: any) =>
          item.program === program &&
          Number(item.semester) === Number(semester) &&
          String(item.batch || '') === String(batch || '')
      );
    }
  }

  if (existingRecord) {
    // Merge new student results under this existing batch!
    const existingList: any[] = Array.isArray(existingRecord.results)
      ? existingRecord.results
      : [];

    for (const newRes of results) {
      const newS = newRes.student || newRes;
      const newAuto = String(
        newS.autonomousRollNo ?? newS['Autonomous Roll No'] ?? newS.r ?? ''
      ).trim().toLowerCase();
      const newCollege = String(
        newS.collegeRollNo ?? newS['College Roll No'] ?? ''
      ).trim().toLowerCase();

      const existingIdx = existingList.findIndex((item: any) => {
        const s = item.student || item;
        const sAuto = String(
          s.autonomousRollNo ?? s['Autonomous Roll No'] ?? s.r ?? ''
        ).trim().toLowerCase();
        const sCollege = String(
          s.collegeRollNo ?? s['College Roll No'] ?? ''
        ).trim().toLowerCase();

        return (
          (newAuto && sAuto === newAuto) ||
          (newCollege && sCollege === newCollege)
        );
      });

      if (existingIdx >= 0) {
        existingList[existingIdx] = newRes;
      } else {
        existingList.push(newRes);
      }
    }

    const cleanExisting = existingList.filter(isValidStudentRecord);
    existingRecord.results = cleanExisting;
    existingRecord.count = cleanExisting.length;
    existingRecord.passed = calculatePassCount(cleanExisting);
    existingRecord.failed = existingRecord.count - existingRecord.passed;
    existingRecord.updatedAt = now;

    if (Array.isArray(departments) && departments.length > 0) {
      existingRecord.departments = departments;
    }

    saveDB(db);

    return NextResponse.json({
      success: true,
      engine: existingRecord.engine || engine,
      calculationId: existingRecord.id,
      count: existingRecord.count,
      passed: existingRecord.passed,
      failed: existingRecord.failed,
      departments: existingRecord.departments || [],
      results: existingRecord.results,
    });
  }

  const cleanResults = results.filter(isValidStudentRecord);
  const cleanPassed = calculatePassCount(cleanResults);
  const cleanFailed = cleanResults.length - cleanPassed;

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

    count: cleanResults.length,
    passed: cleanPassed,
    failed: cleanFailed,

    departments:
      departments || [],

    results: cleanResults,
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

      const isAutoCourse = !course || course === 'ALL' || course === 'AUTO';

      const getRoll = (s: any) =>
        s?.['Roll No'] ??
        s?.['Roll No.'] ??
        s?.rollNo ??
        s?.collegeRollNo ??
        s?.['College Roll No'] ??
        s?.['College Roll No.'] ??
        s?.autonomousRollNo ??
        s?.['Autonomous Roll No'] ??
        s?.['Autonomous Roll No.'] ??
        s?.r;

      const validRows = students.filter((student) => {
        if (!isValidStudentRecord(student)) return false;
        const rollNo = getRoll(student);
        const c = student?.course || (!isAutoCourse ? course : undefined);
        const b = student?.batch || batch;
        const dept = student?.Department ?? student?.department ?? requestedDepartment;

        const detected = detectUGCourse(rollNo, c, b, dept);
        if (!detected) return false;

        // If a specific course was selected (not ALL and not AUTO), filter by course
        if (!isAutoCourse && detected.course !== course) {
          return false;
        }

        return true;
      });

      if (validRows.length === 0) {
        throw new Error(
          !isAutoCourse
            ? `No valid UG students found for course "${course}".`
            : 'No valid UG students found. Could not detect course from Roll No.',
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
        const rollNo = getRoll(student);
        const c = student?.course || (!isAutoCourse ? course : undefined);
        const b = student?.batch || batch;
        const dept = student?.Department ?? student?.department ?? requestedDepartment;

        const detected =
          detectUGCourse(rollNo, c, b, dept);

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
          .push({
            ...student,
            course: detected.course,
            batch: detected.batch,
          });
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
        
const firstRollNo = getRoll(groupStudents[0]);
const firstDept = groupStudents[0]?.Department ?? groupStudents[0]?.department ?? requestedDepartment;

const first = detectUGCourse(
  firstRollNo,
  groupStudents[0]?.course || (!isAutoCourse ? course : undefined),
  groupStudents[0]?.batch || batch,
  firstDept,
);

        if (!first) {
          continue;
        }

        const mappedStudents =
          groupStudents.map((s) => {
            if (s.subjects && typeof s.subjects === 'object' && Object.keys(s.subjects).length > 0) {
              return s;
            }
            return mapUGExcelStudent(s);
          });

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

      const savedCourse = !isAutoCourse ? course : 'AUTO';

      return saveCalculation({
        engine: {
          program: 'UG',
          semester,
          batch: batch || '2024',
          course: savedCourse,
          department: requestedDepartment || 'ALL',
          label:
            `UG Semester ${semester}`,
        },

        results:
          allResults,

        passed,
        failed,

        program: 'UG',
        semester,
        batch: batch || '2024',
        course: savedCourse,
        department: requestedDepartment || 'ALL',

        departments:
          courseSummary,
        calculationId: body.calculationId,
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

    const validStudents = students
      .map((student: any) => {
        const studentDept =
          getDepartment(student) ||
          (requestedDepartment && requestedDepartment !== 'ALL' && requestedDepartment !== 'AUTO'
            ? requestedDepartment
            : '');
        return {
          ...student,
          Department: studentDept,
          department: studentDept,
        };
      })
      .filter(isValidStudent);

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

      // If user selected a specific department (not ALL / AUTO), filter by that department
      if (
        requestedDepartment &&
        requestedDepartment !== 'ALL' &&
        requestedDepartment !== 'AUTO' &&
        normalizeDepartment(department) !== normalizeDepartment(requestedDepartment)
      ) {
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
        requestedDepartment && requestedDepartment !== 'ALL'
          ? `No PG students found for department "${requestedDepartment}".`
          : 'No PG departments could be detected from the student data.',
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
        batch: batch || '2025',
        course: course || '',
        department: requestedDepartment || 'ALL',
        label:
          `PG Semester ${semester}`,
      },

      results:
        allResults,

      passed,
      failed,

      program: 'PG',
      semester,
      batch: batch || '2025',
      course: course || '',
      department: requestedDepartment || 'ALL',

      departments:
        departmentSummary,
      calculationId: body.calculationId,
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

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Calculation ID is required' },
        { status: 400 },
      );
    }

    const db: any = getDB();
    if (!Array.isArray(db.calculatedResults)) {
      db.calculatedResults = [];
    }

    const initialLength = db.calculatedResults.length;
    db.calculatedResults = db.calculatedResults.filter(
      (item: any) => item.id !== id,
    );

    if (db.calculatedResults.length === initialLength) {
      return NextResponse.json(
        { success: false, error: `Calculation "${id}" not found` },
        { status: 404 },
      );
    }

    saveDB(db);

    return NextResponse.json({
      success: true,
      message: `Calculation "${id}" deleted successfully`,
      data: db,
    });
  } catch (error) {
    console.error('Error deleting calculation:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete calculation',
      },
      { status: 500 },
    );
  }
}
