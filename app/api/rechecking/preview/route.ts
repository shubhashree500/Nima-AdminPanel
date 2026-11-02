
import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { calculateResults } from '@/lib/resultEngine';
import { getResultConfig } from '@/lib/configs';
import type { PaperConfig } from '@/lib/configs/types';
import {
  normalizeComponentName,
  getComponentMaxMark,
  validateRecheckingMarkChange,
} from '@/lib/rules/rechecking';
import { getPgPaperSourceKeys } from '@/lib/calculation/pgCalculator';

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function rollOf(result: any): string {
  const student = result?.student ?? result ?? {};

  const candidates = [
    student['Roll No'],
    student['Roll No.'],
    student.rollNo,
    student.roll,
    student.r,
    student.Roll,
    student.rollNumber,
    student.roll_number,
    student['Roll Number'],
    student['College Roll No'],
    student['College Roll No.'],
    student.collegeRollNo,
    student['Autonomous Roll No'],
    student['Autonomous Roll No.'],
    student.autonomousRollNo,
    student.registrationNo,
    student.registrationNumber,
    student['Registration No'],
    student['Registration No.'],
    student['Registration Number'],
  ];

  const value = candidates.find(
    (item) =>
      item !== undefined &&
      item !== null &&
      String(item).trim() !== ''
  );

  return String(value ?? '').trim();
}

function nameOf(result: any): string {
  const student = result?.student ?? result ?? {};

  return text(
    student['Applicant Name'] ??
      student['Name of the Students'] ??
      student['Student Name'] ??
      student.name ??
      student.studentName ??
      rollOf(result)
  );
}

function deptOf(result: any): string {
  const student = result?.student ?? result ?? {};

  return text(
    student.Department ??
      student.department ??
      student.course ??
      student['Department Name'] ??
      '-'
  );
}

function paperCodeOf(subject: any): string {
  return text(subject?.paperCode ?? subject?.code).toLowerCase();
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

function rollsOf(result: any): string[] {
  const student = result?.student ?? result ?? {};
  return [
    rollOf(result),
    rollOf(student),
    student?.autonomousRollNo,
    student?.['Autonomous Roll No'],
    student?.collegeRollNo,
    student?.['College Roll No'],
    student?.['College Roll No.'],
    student?.['Roll No'],
    student?.rollNo,
  ]
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function resultMatchesRoll(result: any, requestedRoll: string): boolean {
  const requested = requestedRoll.trim().toLowerCase();
  return rollsOf(result).includes(requested);
}

function orderedAppliedCorrections(
  db: any,
  calculationId: string,
  result: any
) {
  const rolls = new Set(rollsOf(result));

  return (Array.isArray(db.resultCorrections) ? db.resultCorrections : [])
    .filter(
      (correction: any) =>
        correction?.status === 'applied' &&
        correction.originalCalculationId === calculationId &&
        rolls.has(String(correction.studentRoll ?? '').trim().toLowerCase())
    )
    .sort((a: any, b: any) =>
      String(a.appliedAt || a.createdAt || '').localeCompare(
        String(b.appliedAt || b.createdAt || '')
      )
    );
}

function paperIndexOf(papers: PaperConfig[] | undefined, paper: PaperConfig) {
  if (!Array.isArray(papers)) return -1;
  return papers.findIndex(
    (item) => item.code.toLowerCase() === paper.code.toLowerCase()
  );
}

function extractStudentPaperComponents(
  studentResult: any,
  paper: PaperConfig,
  options?: {
    papers?: PaperConfig[];
    department?: string;
  }
) {
  const sourceStudent = studentResult?.student ?? studentResult ?? {};

  const toNum = (value: any): number | null =>
    value !== undefined &&
    value !== null &&
    text(value) !== '' &&
    Number.isFinite(Number(value))
      ? Number(value)
      : null;

  // Find spreadsheet fields without depending on key capitalization.
  const getField = (...keys: string[]): any => {
    for (const key of keys) {
      const actualKey = Object.keys(sourceStudent).find(
        (item) => item.toLowerCase() === key.toLowerCase()
      );

      if (actualKey !== undefined) {
        return sourceStudent[actualKey];
      }
    }
    return undefined;
  };

  // PG spreadsheet columns use:
  // Midsem-Mark, Final-Mark, Midsem-Mark_1, Final-Mark_1, etc.
  const lastPart = paper.code.trim().match(/(\d+)$/);
  const paperNumber = lastPart ? Number(lastPart[1]) : 1;
  const suffix = paperNumber > 1 ? `_${paperNumber - 1}` : '';

  let midsem: number | null = null;
  let endsem: number | null = null;
  let practical: number | null = null;
  let attendance: number | null = null;
  let surpriseTest: number | null = null;
  let assignment: number | null = null;

  // UG structured subject marks.
  const subjectsMap = sourceStudent.subjects;

  if (
    subjectsMap &&
    typeof subjectsMap === 'object' &&
    !Array.isArray(subjectsMap)
  ) {
    const entry =
      subjectsMap[paper.code] ??
      Object.entries(subjectsMap).find(
        ([key]) => key.toLowerCase() === paper.code.toLowerCase()
      )?.[1];

    if (entry && typeof entry === 'object') {
      const e: any = entry;

      midsem = toNum(
        e.MidsemMark ?? e.midsemMark ?? e.midsem
      );
      endsem = toNum(
        e.FinalMark ?? e.finalMark ?? e.endsem
      );
      practical = toNum(
        e.PracticalMark ?? e.practicalMark ?? e.practical
      );
      attendance = toNum(
        e.Attandance ?? e.Attendance ?? e.attendance
      );
      surpriseTest = toNum(
        e.SurpriseTest ?? e.surpriseTest
      );
      assignment = toNum(e.Assignment ?? e.assignment);
    }
  }

  // PG course-based marks.
  const courses = Array.isArray(sourceStudent.courses)
    ? sourceStudent.courses
    : Array.isArray(sourceStudent.Papers)
      ? sourceStudent.Papers
      : [];

  const courseEntry = courses.find((item: any) => {
    const raw = String(
      item?.paper?.code ?? item?.code ?? item?.paper ?? ''
    )
      .trim()
      .toLowerCase()
      .replace(/^paper\s*/, '');

    return raw === paper.code.toLowerCase().replace(/^paper\s*/, '');
  });

  if (courseEntry) {
    midsem = toNum(
      courseEntry.midsemMark ?? courseEntry.midsem
    ) ?? midsem;

    endsem = toNum(
      courseEntry.finalMark ?? courseEntry.endsem
    ) ?? endsem;

    practical = toNum(
      courseEntry.practical ?? courseEntry.practicalMark
    ) ?? practical;

    attendance = toNum(
      courseEntry.attendance ?? courseEntry.Attandance
    ) ?? attendance;
  }

  // Flat spreadsheet marks: use the paper's own component columns.
  // Do not substitute the calculated subject total for endsem.
  if (midsem === null) {
    midsem = toNum(
      getField(`Midsem-Mark${suffix}`, `MidsemMark${suffix}`)
    );
  }

  if (endsem === null) {
    endsem = toNum(
      getField(`Final-Mark${suffix}`, `FinalMark${suffix}`)
    );
  }

  if (practical === null) {
    practical = toNum(
      getField(`Practical-Mark${suffix}`, `PracticalMark${suffix}`)
    );
  }

  if (attendance === null) {
    attendance = toNum(
      getField(
        `Attendance${suffix}`,
        `Attandance${suffix}`,
        `Attendance-Mark${suffix}`
      )
    );
  }

  if (surpriseTest === null) {
    surpriseTest = toNum(
      getField(`SurpriseTest${suffix}`, `Surprise-Test${suffix}`)
    );
  }

  if (assignment === null) {
    assignment = toNum(
      getField(`Assignment${suffix}`, `Assignment-Mark${suffix}`)
    );
  }

  const pgIndex = paperIndexOf(options?.papers, paper);
  if (pgIndex >= 0 && options?.department) {
    const pgKeys = getPgPaperSourceKeys(
      options.department,
      pgIndex,
      paper.type
    );

    if (midsem === null && pgKeys.midsem) {
      midsem = toNum(sourceStudent[pgKeys.midsem]);
    }
    if (endsem === null && pgKeys.endsem) {
      endsem = toNum(sourceStudent[pgKeys.endsem]);
    }
    if (practical === null && pgKeys.practical) {
      practical = toNum(sourceStudent[pgKeys.practical]);
    }
  }

  // Check structured subject results if present on studentResult or sourceStudent
  const subjectsArray = Array.isArray(studentResult?.subjects)
    ? studentResult.subjects
    : Array.isArray(sourceStudent?.subjects)
      ? sourceStudent.subjects
      : Array.isArray(sourceStudent?._originalSubjects)
        ? sourceStudent._originalSubjects
        : [];

  const matchedSub = subjectsArray.find(
    (item: any) =>
      text(item?.paperCode ?? item?.code).toLowerCase() ===
      paper.code.toLowerCase()
  );

  if (matchedSub && typeof matchedSub === 'object') {
    const s: any = matchedSub;
    midsem = toNum(s.midsem ?? s.midsemMark ?? s.MidsemMark) ?? midsem;
    endsem = toNum(s.endsem ?? s.finalMark ?? s.FinalMark) ?? endsem;
    practical = toNum(s.practical ?? s.practicalMark ?? s.PracticalMark) ?? practical;
    attendance = toNum(s.attendance ?? s.Attandance) ?? attendance;
    surpriseTest = toNum(s.surpriseTest ?? s.SurpriseTest) ?? surpriseTest;
    assignment = toNum(s.assignment ?? s.Assignment) ?? assignment;

    if (s.components && typeof s.components === 'object') {
      const c = s.components;
      midsem = toNum(c.midsem?.value ?? c.midsem) ?? midsem;
      endsem = toNum(c.sem?.value ?? c.sem ?? c.endsem?.value ?? c.endsem) ?? endsem;
      practical = toNum(c.practical?.value ?? c.practical) ?? practical;
      attendance = toNum(c.attendance?.value ?? c.attendance) ?? attendance;
    }

    if (midsem === null && endsem === null && practical === null && s.marks !== undefined) {
      endsem = toNum(s.marks);
    }
  }

  return {
    midsem,
    endsem,
    practical,
    attendance,
    surpriseTest,
    assignment,
  };
}


function applyComponentToStudent(
  sourceStudent: any,
  paper: PaperConfig,
  componentName: string,
  newValue: number,
  options?: {
    papers?: PaperConfig[];
    department?: string;
  }
) {
  const norm = normalizeComponentName(componentName);
  const updated = structuredClone(sourceStudent);

  // Update flat spreadsheet component columns used by PG imports.
  const lastPart = paper.code.trim().match(/(\d+)$/);
  const paperNumber = lastPart ? Number(lastPart[1]) : 1;
  const suffix = paperNumber > 1 ? `_${paperNumber - 1}` : '';

  const updateExistingField = (
    keys: string[],
    value: number
  ) => {
    const existingKey = Object.keys(updated).find((key) =>
      keys.some((candidate) =>
        candidate.toLowerCase() === key.toLowerCase()
      )
    );

    if (existingKey !== undefined) {
      updated[existingKey] = value;
      return true;
    }

    return false;
  };

  if (norm === 'midsem') {
    updateExistingField(
      [`Midsem-Mark${suffix}`, `MidsemMark${suffix}`],
      newValue
    );
  } else if (
    norm === 'endsem' ||
    norm === 'final' ||
    norm === 'sem'
  ) {
    updateExistingField(
      [`Final-Mark${suffix}`, `FinalMark${suffix}`],
      newValue
    );
  } else if (norm === 'practical') {
    updateExistingField(
      [`Practical-Mark${suffix}`, `PracticalMark${suffix}`],
      newValue
    );
  } else if (norm === 'attendance') {
    updateExistingField(
      [
        `Attendance${suffix}`,
        `Attandance${suffix}`,
        `Attendance-Mark${suffix}`,
      ],
      newValue
    );
  } else if (norm === 'surpriseTest') {
    updateExistingField(
      [`SurpriseTest${suffix}`, `Surprise-Test${suffix}`],
      newValue
    );
  } else if (norm === 'assignment') {
    updateExistingField(
      [`Assignment${suffix}`, `Assignment-Mark${suffix}`],
      newValue
    );
  }

  const pgIndex = paperIndexOf(options?.papers, paper);
  if (pgIndex >= 0 && options?.department) {
    const pgKeys = getPgPaperSourceKeys(
      options.department,
      pgIndex,
      paper.type
    );

    if (norm === 'midsem' && pgKeys.midsem) {
      updated[pgKeys.midsem] = newValue;
    } else if (
      (norm === 'endsem' || norm === 'final' || norm === 'sem') &&
      pgKeys.endsem
    ) {
      updated[pgKeys.endsem] = newValue;
    } else if (norm === 'practical' && pgKeys.practical) {
      updated[pgKeys.practical] = newValue;
    }
  }

  // Update UG subject-component data.
  if (
    updated.subjects &&
    typeof updated.subjects === 'object' &&
    !Array.isArray(updated.subjects)
  ) {
    const matchedKey =
      Object.keys(updated.subjects).find(
        (key) => key.toLowerCase() === paper.code.toLowerCase()
      ) || paper.code;

    if (
      !updated.subjects[matchedKey] ||
      typeof updated.subjects[matchedKey] !== 'object'
    ) {
      updated.subjects[matchedKey] = {
        code: paper.code,
        paperCode: paper.code,
        subject: paper.title,
      };
    }

    if (norm === 'midsem') {
      updated.subjects[matchedKey].MidsemMark = newValue;
    } else if (
      norm === 'endsem' ||
      norm === 'final' ||
      norm === 'sem'
    ) {
      updated.subjects[matchedKey].FinalMark = newValue;
    } else if (norm === 'practical') {
      updated.subjects[matchedKey].PracticalMark = newValue;
    } else if (norm === 'attendance') {
      updated.subjects[matchedKey].Attandance = newValue;
    } else if (norm === 'surpriseTest') {
      updated.subjects[matchedKey].SurpriseTest = newValue;
    } else if (norm === 'assignment') {
      updated.subjects[matchedKey].Assignment = newValue;
    }
  }

  // Update PG course-component data.
  if (Array.isArray(updated.courses)) {
    let courseEntry = updated.courses.find((item: any) => {
      const raw = String(
        item?.paper?.code ?? item?.code ?? item?.paper ?? ''
      )
        .trim()
        .toLowerCase()
        .replace(/^paper\s*/, '');

      return (
        raw === paper.code.toLowerCase().replace(/^paper\s*/, '')
      );
    });

    if (!courseEntry) {
      courseEntry = { paper: paper.code };
      updated.courses.push(courseEntry);
    }

    if (norm === 'midsem') {
      courseEntry.midsemMark = newValue;
    } else if (
      norm === 'endsem' ||
      norm === 'final' ||
      norm === 'sem'
    ) {
      courseEntry.finalMark = newValue;
    } else if (norm === 'practical') {
      courseEntry.practical = newValue;
      courseEntry.finalMark = newValue;
    } else if (norm === 'attendance') {
      courseEntry.attendance = newValue;
    }
  }


  // Preserve every original component when creating a subject entry
  // for flat spreadsheet records, then override only the revised mark.
  if (
    !updated.subjects &&
    !Array.isArray(updated.courses) &&
    !Array.isArray(updated.Papers)
  ) {
    const papersList = options?.papers?.length ? options.papers : [paper];
    const newSubjects: Record<string, any> = {};

    for (const p of papersList) {
      const orig = extractStudentPaperComponents(sourceStudent, p, options);
      const isTarget = p.code.toLowerCase() === paper.code.toLowerCase();
      const compNorm = isTarget ? norm : null;

      const components: Record<string, number | null> = {
        midsem: compNorm === 'midsem' ? newValue : orig.midsem,
        endsem:
          compNorm === 'endsem' || compNorm === 'final' || compNorm === 'sem'
            ? newValue
            : orig.endsem,
        practical: compNorm === 'practical' ? newValue : orig.practical,
        attendance: compNorm === 'attendance' ? newValue : orig.attendance,
        surpriseTest: compNorm === 'surpriseTest' ? newValue : orig.surpriseTest,
        assignment: compNorm === 'assignment' ? newValue : orig.assignment,
      };

      newSubjects[p.code] = {
        code: p.code,
        paperCode: p.code,
        subject: p.title,
        ...(components.midsem !== null
          ? { MidsemMark: components.midsem }
          : {}),
        ...(components.endsem !== null
          ? { FinalMark: components.endsem }
          : {}),
        ...(components.practical !== null
          ? { PracticalMark: components.practical }
          : {}),
        ...(components.attendance !== null
          ? { Attandance: components.attendance }
          : {}),
        ...(components.surpriseTest !== null
          ? { SurpriseTest: components.surpriseTest }
          : {}),
        ...(components.assignment !== null
          ? { Assignment: components.assignment }
          : {}),
      };
    }

    updated.subjects = newSubjects;
  } else if (
    updated.subjects &&
    typeof updated.subjects === 'object' &&
    !Array.isArray(updated.subjects)
  ) {
    if (options?.papers?.length) {
      for (const p of options.papers) {
        const foundKey = Object.keys(updated.subjects).find(
          (key) => key.toLowerCase() === p.code.toLowerCase()
        );
        if (!foundKey || !updated.subjects[foundKey]) {
          const orig = extractStudentPaperComponents(sourceStudent, p, options);
          updated.subjects[p.code] = {
            code: p.code,
            paperCode: p.code,
            subject: p.title,
            ...(orig.midsem !== null ? { MidsemMark: orig.midsem } : {}),
            ...(orig.endsem !== null ? { FinalMark: orig.endsem } : {}),
            ...(orig.practical !== null ? { PracticalMark: orig.practical } : {}),
            ...(orig.attendance !== null ? { Attandance: orig.attendance } : {}),
            ...(orig.surpriseTest !== null ? { SurpriseTest: orig.surpriseTest } : {}),
            ...(orig.assignment !== null ? { Assignment: orig.assignment } : {}),
          };
        }
      }
    }
  }

  return updated;
}

function applyStoredCorrections(
  sourceStudent: any,
  corrections: any[],
  papersConfig: PaperConfig[],
  department: string
) {
  let updated = structuredClone(sourceStudent);

  for (const correction of corrections) {
    const paper = papersConfig.find(
      (item) =>
        item.code.toLowerCase() ===
        text(correction.paperCode).toLowerCase()
    );

    if (!paper || !Number.isFinite(Number(correction.newValue))) {
      continue;
    }

    updated = applyComponentToStudent(
      updated,
      paper,
      text(correction.component),
      Number(correction.newValue),
      { papers: papersConfig, department }
    );
  }

  return updated;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationId = searchParams.get('calculationId');
    const studentRoll = searchParams.get('studentRoll');

    if (!calculationId) {
      return errorResponse('Calculation ID is required.', 400);
    }

    const db: any = getDB();

    const records = Array.isArray(db.calculatedResults)
      ? db.calculatedResults
      : [];

    const calculation = records.find(
      (record: any) => record.id === calculationId
    );

    if (!calculation) {
      return errorResponse('Calculation record not found.', 404);
    }

    const results = Array.isArray(calculation.results)
      ? calculation.results
      : [];

    // If no roll is supplied, return a student list for this calculation.
    if (!studentRoll) {
      const students = results.map((result: any) => ({
        roll: rollOf(result),
        name: nameOf(result),
        department: deptOf(result),
        sgpa: result.sgpa ?? '-',
        status: (result.subjects || []).some((subject: any) =>
          ['F', 'AB', 'M'].includes(
            String(subject?.grade || '').toUpperCase()
          )
        )
          ? 'FAIL'
          : 'PASS',
      }));

      return NextResponse.json({
        success: true,
        calculation: {
          id: calculation.id,
          program: calculation.program,
          semester: calculation.semester,
          batch: calculation.batch,
          status: calculation.status,
          totalStudents: results.length,
        },
        students,
      });
    }

    const requestedRoll = studentRoll.trim().toLowerCase();

    const studentMatches = results.filter((result: any) =>
      resultMatchesRoll(result, requestedRoll)
    );

    if (studentMatches.length > 1) {
      return errorResponse(
        'Student roll is not unique in this calculation.',
        409
      );
    }

    const studentResult = studentMatches[0];

    if (!studentResult) {
      const availableRolls = results
        .map((result: any) => rollOf(result))
        .filter(Boolean)
        .slice(0, 10);

      return NextResponse.json(
        {
          success: false,
          error: `Student roll "${studentRoll}" was not found in this examination.`,
          availableRolls,
          totalStudents: results.length,
        },
        { status: 404 }
      );
    }

    const sourceStudent = studentResult?.student ?? studentResult;

    const batch = Number(
      sourceStudent.batch ?? calculation.batch ?? 2025
    );

    const semester = Number(calculation.semester);

    const program = String(calculation.program).toUpperCase() as
      | 'UG'
      | 'PG';

    const course = text(sourceStudent.course ?? calculation.course);

    const department = text(
      sourceStudent.Department ??
        sourceStudent.department ??
        calculation.department
    );

    const config = getResultConfig({
      program,
      batch,
      semester,
      course: course || undefined,
      department: department || undefined,
    });

    const papersConfig = config?.papers || [];

    const appliedCorrections = orderedAppliedCorrections(
      db,
      calculation.id,
      studentResult
    );

    const latestCorrection =
      appliedCorrections[appliedCorrections.length - 1] ?? null;

    const displayStudent = appliedCorrections.length
      ? applyStoredCorrections(
          sourceStudent,
          appliedCorrections,
          papersConfig,
          department
        )
      : sourceStudent;

    const displayResult =
      latestCorrection?.revisedStudentResult &&
      Array.isArray(latestCorrection.revisedStudentResult.subjects)
        ? latestCorrection.revisedStudentResult
        : studentResult;

    const papers = (displayResult.subjects || []).map(
      (subject: any) => {
        const paperCode = text(subject.paperCode || subject.code);

        const configuredPaper = papersConfig.find(
          (item) =>
            item.code.toLowerCase() === paperCode.toLowerCase()
        );

        const paperObj: PaperConfig = configuredPaper || {
          code: paperCode,
          title:
            subject.subjectName || subject.title || paperCode,
          type: 'theory',
          credit: subject.credit ?? 4,
          marks: {
            fullMark: subject.fullMark ?? 100,
            endsem: { max: subject.fullMark ?? 100 },
            midsem: { max: 20 },
          },
        } as PaperConfig;

        const extracted = extractStudentPaperComponents(
          { student: displayStudent, subjects: displayResult.subjects },
          paperObj,
          { papers: papersConfig, department }
        );

        return {
          code: paperCode,
          title:
            subject.subjectName ||
            subject.title ||
            configuredPaper?.title ||
            paperCode,
          category:
            subject.category || configuredPaper?.category || '',
          type:
            configuredPaper?.type ||
            (extracted.practical !== null ? 'practical' : 'theory'),
          credit: subject.credit ?? configuredPaper?.credit ?? 0,
          fullMark:
            subject.fullMark ??
            configuredPaper?.marks.fullMark ??
            100,
          marks: subject.marks ?? 0,
          grade: subject.grade || '-',
          gradePoint: subject.gradePoint ?? 0,
          creditPoint: subject.creditPoint ?? 0,
          grace: subject.grace ?? 0,
          components: {
            midsem: {
              value: extracted.midsem,
              max: getComponentMaxMark(paperObj, 'midsem'),
            },
            sem: {
              value: extracted.endsem,
              max: getComponentMaxMark(paperObj, 'endsem'),
            },
            practical: {
              value: extracted.practical,
              max: getComponentMaxMark(paperObj, 'practical'),
            },
            attendance: {
              value: extracted.attendance,
              max: getComponentMaxMark(paperObj, 'attendance'),
            },
          },
        };
      }
    );

    return NextResponse.json({
      success: true,
      student: {
        roll: rollOf(studentResult),
        name: nameOf(studentResult),
        department: deptOf(studentResult),
        course: course || deptOf(studentResult),
        program,
        semester,
        batch,
        sgpa: displayResult.sgpa ?? '-',
        percentage: displayResult.percentage ?? '-',
        totalCredits: displayResult.totalCredits ?? '-',
        totalCreditPoints: displayResult.totalCreditPoints ?? '-',
        status: (displayResult.subjects || []).some(
          (subject: any) =>
            ['F', 'AB', 'M'].includes(
              String(subject?.grade || '').toUpperCase()
            )
        )
          ? 'FAIL'
          : 'PASS',
        isRevised: appliedCorrections.length > 0,
      },
      papers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to fetch student details.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const originalCalculationId = text(body.originalCalculationId);
    const studentRoll = text(body.studentRoll);
    const applicationId = text(body.applicationId);
    const shouldApply = body.apply === true;
    const defaultReason = text(body.reason || 'Rechecking mark update');

    if (!originalCalculationId || !studentRoll) {
      return errorResponse('Calculation ID and student roll are required.', 400);
    }

    // Support both multiple changes (body.changes) or single change (body.paperCode, component, newValue)
    let rawChanges: any[] = [];
    if (Array.isArray(body.changes) && body.changes.length > 0) {
      rawChanges = body.changes;
    } else if (
      body.paperCode &&
      body.newValue !== '' &&
      body.newValue !== null &&
      body.newValue !== undefined
    ) {
      rawChanges = [
        {
          paperCode: body.paperCode,
          component: body.component || 'sem',
          newValue: body.newValue,
          reason: body.reason || defaultReason,
        },
      ];
    } else {
      return errorResponse(
        'Paper code, component, and new mark are required.',
        400
      );
    }

    for (const c of rawChanges) {
      if (!c.paperCode || c.newValue === '' || c.newValue === null || c.newValue === undefined) {
        return errorResponse('Each paper change must have a paperCode and newValue.', 400);
      }
      if (!Number.isFinite(Number(c.newValue))) {
        return errorResponse('New mark must be a valid number.', 400);
      }
    }

    const db: any = getDB();

    // If an applicationId was explicitly provided, verify it exists
    if (shouldApply && applicationId) {
      const applications = Array.isArray(db.recheckingApplications)
        ? db.recheckingApplications
        : [];
      const app = applications.find((a: any) => a.id === applicationId);
      if (!app) {
        return errorResponse('Application not found.', 404);
      }
    }

    const records = Array.isArray(db.calculatedResults)
      ? db.calculatedResults
      : [];

    const original = records.find(
      (record: any) => record.id === originalCalculationId
    );

    if (!original) {
      return errorResponse('Original calculation was not found.', 404);
    }

    if (original.status !== 'published') {
      return errorResponse(
        'Corrections can only start from a published calculation.',
        400
      );
    }

    if (!Array.isArray(original.results)) {
      return errorResponse(
        'Student results are unavailable in the original calculation.',
        400
      );
    }

    const requestedRoll = studentRoll.trim().toLowerCase();

    const studentMatches = original.results.filter((result: any) =>
      resultMatchesRoll(result, requestedRoll)
    );

    if (studentMatches.length === 0) {
      return errorResponse(
        'Student not found in the original calculation.',
        404
      );
    }

    if (studentMatches.length !== 1) {
      return errorResponse(
        'Student roll is not unique in the original calculation.',
        409
      );
    }

    const originalResult = studentMatches[0];
    const sourceStudent = originalResult?.student
      ? {
          ...originalResult.student,
          _originalSubjects: originalResult.subjects,
        }
      : originalResult;

    const program = String(original.program).toUpperCase() as
      | 'UG'
      | 'PG';

    const semester = Number(original.semester);

    const batch = Number(
      sourceStudent.batch ?? original.batch ?? 2025
    );

    const course = text(sourceStudent.course ?? original.course);

    const department = text(
      sourceStudent.Department ??
        sourceStudent.department ??
        original.department
    );

    const config = getResultConfig({
      program,
      batch,
      semester,
      course: course || undefined,
      department: department || undefined,
    });

    if (!config) {
      return errorResponse(
        `No configuration found for ${program} Semester ${semester}.`,
        400
      );
    }

    // Validate all changes
    const validatedChanges: Array<{
      paper: PaperConfig;
      component: string;
      oldValue: number;
      newValue: number;
      reason: string;
      originalPaperResult: any;
    }> = [];

    for (const c of rawChanges) {
      const pCode = text(c.paperCode);
      const compName = text(c.component || 'sem');
      const nVal = Number(c.newValue);
      const chReason = text(c.reason || defaultReason);

      const paper = (config.papers || []).find(
        (item) => item.code.toLowerCase() === pCode.toLowerCase()
      ) || (originalResult.subjects || []).find(
        (s: any) => text(s.paperCode || s.code).toLowerCase() === pCode.toLowerCase()
      );

      if (!paper) {
        return errorResponse(`Paper ${pCode} is not configured for this student.`, 404);
      }

      const paperConfigObj: PaperConfig = paper.marks
        ? paper
        : ({
            code: pCode,
            title: paper.subjectName || paper.title || pCode,
            type: 'theory',
            credit: paper.credit ?? 4,
            marks: {
              fullMark: paper.fullMark ?? 100,
              endsem: { max: paper.fullMark ?? 100 },
              midsem: { max: 20 },
            },
          } as PaperConfig);

      const maxMark = getComponentMaxMark(paperConfigObj, compName);
      const extracted = extractStudentPaperComponents(
        originalResult,
        paperConfigObj,
        { papers: config.papers, department }
      );

      const norm = normalizeComponentName(compName);
      let oldValue: number | null = null;
      if (norm === 'midsem') oldValue = extracted.midsem;
      else if (norm === 'endsem' || norm === 'final' || norm === 'sem') oldValue = extracted.endsem;
      else if (norm === 'practical') oldValue = extracted.practical;
      else if (norm === 'attendance') oldValue = extracted.attendance;
      else if (norm === 'surpriseTest') oldValue = extracted.surpriseTest;
      else if (norm === 'assignment') oldValue = extracted.assignment;

      if (oldValue === null || !Number.isFinite(oldValue)) {
        const sub = (originalResult.subjects || []).find(
          (s: any) => text(s.paperCode || s.code).toLowerCase() === pCode.toLowerCase()
        );
        if (sub && Number.isFinite(Number(sub.marks))) {
          oldValue = Number(sub.marks);
        } else {
          return errorResponse(
            `Cannot create a correction for ${pCode}: the original component mark is missing.`,
            422
          );
        }
      }

      const validation = validateRecheckingMarkChange({
        oldValue,
        newValue: nVal,
        maxMark,
        config,
      });

      if (!validation.valid) {
        return errorResponse(validation.error || `Invalid mark change for ${pCode}.`, 400);
      }

      const originalPaperResult = (originalResult.subjects || []).find(
        (s: any) => paperCodeOf(s) === paperConfigObj.code.toLowerCase()
      );

      validatedChanges.push({
        paper: paperConfigObj,
        component: compName,
        oldValue,
        newValue: nVal,
        reason: chReason,
        originalPaperResult,
      });
    }

    // Replay previously applied corrections first
    const previousCorrections = orderedAppliedCorrections(
      db,
      original.id,
      originalResult
    );

    let updatedStudent = applyStoredCorrections(
      sourceStudent,
      previousCorrections,
      config.papers || [],
      department
    );

    // Apply all staged changes sequentially
    for (const vc of validatedChanges) {
      updatedStudent = applyComponentToStudent(
        updatedStudent,
        vc.paper,
        vc.component,
        vc.newValue,
        { papers: config.papers, department }
      );
    }

    // Use official calculation engine
    const recalculatedResults = calculateResults({
      program,
      semester,
      batch: String(batch),
      course: course || undefined,
      department: department || undefined,
      mode: 'rechecking',
      students: [updatedStudent],
    });

    const recalculated = Array.isArray(recalculatedResults)
      ? recalculatedResults[0]
      : null;

    if (!recalculated || !Array.isArray(recalculated.subjects)) {
      return errorResponse(
        'Recalculation failed. No correction was applied.',
        422
      );
    }

    const originalSubjects = Array.isArray(originalResult.subjects)
      ? originalResult.subjects
      : [];

    const revisedSubjects = recalculated.subjects;

    const originalPaperCodes = originalSubjects
      .map((subject: any) => paperCodeOf(subject))
      .filter(Boolean);

    const revisedPaperCodes = revisedSubjects
      .map((subject: any) => paperCodeOf(subject))
      .filter(Boolean);

    const missingPaperCodes = originalPaperCodes.filter(
      (code: string) => !revisedPaperCodes.includes(code)
    );

    if (
      originalPaperCodes.length === 0 ||
      revisedPaperCodes.length !== originalPaperCodes.length ||
      missingPaperCodes.length > 0
    ) {
      return errorResponse(
        'Recalculation was rejected because the revised result does not contain the same complete set of papers. No correction was saved.',
        422
      );
    }

    const now = new Date().toISOString();
    const createdCorrections: any[] = [];

    for (let i = 0; i < validatedChanges.length; i++) {
      const vc = validatedChanges[i];
      const revisedPaperResult = recalculated.subjects.find(
        (subject: any) => paperCodeOf(subject) === vc.paper.code.toLowerCase()
      );

      if (!revisedPaperResult) {
        return errorResponse(
          `The revised paper result for ${vc.paper.code} could not be found. No correction was applied.`,
          422
        );
      }

      const correctionId = `CORR-${Date.now()}-${i}`;

      const revisedStudentResult = shouldApply
        ? {
            ...structuredClone(recalculated),
            isRevised: true,
            revisedAt: now,
            revisedPaper: vc.paper.code,
            correctionId,
          }
        : structuredClone(recalculated);

      const correction = {
        id: correctionId,
        status: shouldApply ? 'applied' : 'preview',
        originalCalculationId: original.id,
        applicationId: applicationId || null,

        studentRoll: rollOf(originalResult),
        studentName: nameOf(originalResult),

        program,
        semester,
        batch,
        course: course || null,
        department: department || null,

        paperCode: vc.paper.code,
        paperTitle: vc.paper.title,
        component: vc.component,

        oldValue: vc.oldValue,
        newValue: vc.newValue,
        reason: vc.reason,

        originalPaperResult: structuredClone(vc.originalPaperResult ?? null),
        revisedPaperResult: structuredClone(revisedPaperResult),

        originalStudentResult: structuredClone(originalResult),
        revisedStudentResult,

        createdAt: now,
        appliedAt: shouldApply ? now : null,

        history: [
          {
            action: shouldApply
              ? 'Approved mark correction applied; original result preserved'
              : 'Correction preview generated',
            at: now,
          },
        ],
      };

      createdCorrections.push(correction);
    }

    let linkedApplication: any = null;

    if (shouldApply) {
      if (!Array.isArray(db.resultCorrections)) {
        db.resultCorrections = [];
      }
      db.resultCorrections.push(...createdCorrections);

      if (!Array.isArray(db.recheckingApplications)) {
        db.recheckingApplications = [];
      }

      if (applicationId) {
        linkedApplication = db.recheckingApplications.find(
          (app: any) => app.id === applicationId
        );
      }

      if (!linkedApplication) {
        linkedApplication = db.recheckingApplications.find(
          (app: any) =>
            text(app.studentRoll).toLowerCase() === requestedRoll &&
            app.status !== 'Completed' &&
            app.status !== 'Rejected'
        );
      }

      const paperSummary = validatedChanges
        .map((vc) => `${vc.paper.code} (${vc.component}: ${vc.oldValue} → ${vc.newValue})`)
        .join(', ');

      const papersUpdated = validatedChanges.map((vc, idx) => ({
        paperCode: vc.paper.code,
        paperTitle: vc.paper.title,
        component: vc.component,
        oldValue: vc.oldValue,
        newValue: vc.newValue,
        originalMarks: vc.originalPaperResult?.marks ?? 0,
        revisedMarks: createdCorrections[idx]?.revisedPaperResult?.marks ?? 0,
        originalGrade: vc.originalPaperResult?.grade ?? '—',
        revisedGrade: createdCorrections[idx]?.revisedPaperResult?.grade ?? '—',
        appliedAt: now,
      }));

      if (!linkedApplication) {
        linkedApplication = {
          id: `APP-${Date.now()}`,
          studentRoll: rollOf(originalResult),
          studentName: nameOf(originalResult),
          program: String(original.program).toUpperCase(),
          semester: Number(original.semester),
          batch: String(original.batch ?? ''),
          paperCode: validatedChanges.map((vc) => vc.paper.code).join(', '),
          papersCount: validatedChanges.length,
          papersUpdated,
          reason: defaultReason,
          requestedMarks: validatedChanges[0]?.newValue ?? null,
          status: 'Completed',
          originalCalculationId: original.id,
          correctionId: createdCorrections[0]?.id || null,
          decisionNotes: `Mark correction applied for ${validatedChanges.length} paper(s): ${paperSummary}. ${defaultReason}`,
          originalStudentResult: structuredClone(originalResult),
          revisedStudentResult: structuredClone(recalculated),
          createdAt: now,
          updatedAt: now,
          history: [
            {
              action: `Application registered and mark corrections applied for ${validatedChanges.length} paper(s): ${paperSummary}.`,
              at: now,
            },
          ],
        };
        db.recheckingApplications.unshift(linkedApplication);
      } else {
        linkedApplication.status = 'Completed';
        linkedApplication.paperCode = validatedChanges.map((vc) => vc.paper.code).join(', ');
        linkedApplication.papersCount = validatedChanges.length;
        linkedApplication.papersUpdated = papersUpdated;
        linkedApplication.correctionId = createdCorrections[0]?.id || linkedApplication.correctionId;
        linkedApplication.originalStudentResult = structuredClone(originalResult);
        linkedApplication.revisedStudentResult = structuredClone(recalculated);
        linkedApplication.decisionNotes = [
          text(linkedApplication.decisionNotes),
          `Mark correction applied for ${validatedChanges.length} paper(s): ${paperSummary}. ${defaultReason}`,
        ]
          .filter(Boolean)
          .join(' | ');
        linkedApplication.updatedAt = now;
        if (!Array.isArray(linkedApplication.history)) {
          linkedApplication.history = [];
        }
        linkedApplication.history.push({
          action: `Correction applied for ${validatedChanges.length} paper(s): ${paperSummary}.`,
          at: now,
        });
      }

      for (const c of createdCorrections) {
        c.applicationId = linkedApplication.id;
      }

      saveDB(db);
    }

    return NextResponse.json(
      {
        success: true,
        message: shouldApply
          ? `Mark correction applied successfully for ${validatedChanges.length} paper(s). The original published result remains unchanged; the revised result is stored separately.`
          : 'Correction preview generated successfully. No result was changed.',
        correction: createdCorrections[0],
        corrections: createdCorrections,
        application: linkedApplication,
        applied: shouldApply,
      },
      { status: shouldApply ? 200 : 201 }
    );
  } catch (error) {
    console.error('Rechecking preview error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to process correction.',
      },
      { status: 500 }
    );
  }
}
