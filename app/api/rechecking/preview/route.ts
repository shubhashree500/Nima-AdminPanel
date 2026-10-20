
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


function extractStudentPaperComponents(
  studentResult: any,
  paper: PaperConfig
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

  // A calculated subject total is not a component mark.
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
  newValue: number
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
    const original = extractStudentPaperComponents(sourceStudent, paper);

    const components: Record<string, number | null> = {
      midsem: original.midsem,
      endsem: original.endsem,
      practical: original.practical,
      attendance: original.attendance,
      surpriseTest: original.surpriseTest,
      assignment: original.assignment,
    };

    components[norm] = newValue;

    updated.subjects = {
      [paper.code]: {
        code: paper.code,
        paperCode: paper.code,
        subject: paper.title,
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
      },
    };
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

   const studentResult = results.find((result: any) => {
  const student = result?.student ?? result;

  const rolls = [
    rollOf(result),
    rollOf(student),
    student?.autonomousRollNo,
    student?.['Autonomous Roll No'],
    student?.collegeRollNo,
    student?.['College Roll No'],
  ];

  return rolls.some(
    (roll) =>
      String(roll ?? '').trim().toLowerCase() === requestedRoll
  );
});

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

    const papers = (studentResult.subjects || []).map(
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
          studentResult,
          paperObj
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
        sgpa: studentResult.sgpa ?? '-',
        percentage: studentResult.percentage ?? '-',
        totalCredits: studentResult.totalCredits ?? '-',
        totalCreditPoints: studentResult.totalCreditPoints ?? '-',
        status: (studentResult.subjects || []).some(
          (subject: any) =>
            ['F', 'AB', 'M'].includes(
              String(subject?.grade || '').toUpperCase()
            )
        )
          ? 'FAIL'
          : 'PASS',
        isRevised: studentResult.isRevised === true,
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
    const paperCode = text(body.paperCode);
    const componentName = text(body.component);
    const reason = text(body.reason);
    const applicationId = text(body.applicationId);
    const shouldApply = body.apply === true;

    if (
      !originalCalculationId ||
      !studentRoll ||
      !paperCode ||
      !componentName ||
      !reason ||
      body.newValue === '' ||
      body.newValue === null ||
      body.newValue === undefined
    ) {
      return errorResponse(
        'Calculation ID, student roll, paper code, component, new value, and reason are required.',
        400
      );
    }

    if (shouldApply && !applicationId) {
      return errorResponse(
        'An approved rechecking application is required before applying a mark correction.',
        400
      );
    }

    const newValue = Number(body.newValue);

    if (!Number.isFinite(newValue)) {
      return errorResponse('New mark must be a valid number.', 400);
    }

    const db: any = getDB();

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

    // Applying a correction requires a matching Approved application.
    let linkedApplication: any = null;

    if (shouldApply) {
      const applications = Array.isArray(db.recheckingApplications)
        ? db.recheckingApplications
        : [];

      linkedApplication = applications.find(
        (app: any) => app.id === applicationId
      );

      if (!linkedApplication) {
        return errorResponse(
          'Linked rechecking application was not found.',
          404
        );
      }

      if (linkedApplication.status !== 'Approved') {
        return errorResponse(
          'Only an Approved rechecking application can be applied.',
          400
        );
      }

      if (
        text(linkedApplication.originalCalculationId) !==
          originalCalculationId ||
        text(linkedApplication.studentRoll).toLowerCase() !==
          studentRoll.toLowerCase() ||
        text(linkedApplication.paperCode).toLowerCase() !==
          paperCode.toLowerCase()
      ) {
        return errorResponse(
          'The application does not match this calculation, student, and paper.',
          400
        );
      }
    }

   const requestedRoll = studentRoll.trim().toLowerCase();

const studentMatches = original.results.filter((result: any) => {
  const student = result?.student ?? result;

  const rolls = [
    rollOf(result),
    rollOf(student),
    student?.autonomousRollNo,
    student?.['Autonomous Roll No'],
    student?.collegeRollNo,
    student?.['College Roll No'],
  ];

  return rolls.some(
    (roll) => String(roll ?? '').trim().toLowerCase() === requestedRoll
  );
});

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
    const sourceStudent = originalResult?.student ?? originalResult;

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

    const paper = config.papers?.find(
      (item) =>
        item.code.toLowerCase() === paperCode.toLowerCase()
    );

    if (!paper) {
      return errorResponse(
        'Paper is not configured for this student.',
        404
      );
    }

    const maxMark = getComponentMaxMark(paper, componentName);

    const extracted = extractStudentPaperComponents(
      originalResult,
      paper
    );

    const norm = normalizeComponentName(componentName);

    let oldValue: number | null = null;

    if (norm === 'midsem') {
      oldValue = extracted.midsem;
    } else if (
      norm === 'endsem' ||
      norm === 'final' ||
      norm === 'sem'
    ) {
      oldValue = extracted.endsem;
    } else if (norm === 'practical') {
      oldValue = extracted.practical;
    } else if (norm === 'attendance') {
      oldValue = extracted.attendance;
    } else if (norm === 'surpriseTest') {
      oldValue = extracted.surpriseTest;
    } else if (norm === 'assignment') {
      oldValue = extracted.assignment;
    }

    const validation = validateRecheckingMarkChange({
      oldValue,
      newValue,
      maxMark,
      config,
    });

    if (!validation.valid) {
      return errorResponse(
        validation.error || 'Invalid mark change.',
        400
      );
    }

    // Modify an isolated copy. The published original is never changed.
    const updatedStudent = applyComponentToStudent(
      sourceStudent,
      paper,
      componentName,
      newValue
    );

    // Use the existing official calculation engine.
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

    const originalPaperResult = (
      originalResult.subjects || []
    ).find(
      (subject: any) =>
        paperCodeOf(subject) === paper.code.toLowerCase()
    );

    const revisedPaperResult = recalculated.subjects.find(
      (subject: any) =>
        paperCodeOf(subject) === paper.code.toLowerCase()
    );

    if (!revisedPaperResult) {
      return errorResponse(
        'The revised paper result could not be found. No correction was applied.',
        422
      );
    }

    const now = new Date().toISOString();
    const correctionId = `CORR-${Date.now()}`;

    const revisedStudentResult = shouldApply
      ? {
          ...structuredClone(recalculated),
          isRevised: true,
          revisedAt: now,
          revisedPaper: paper.code,
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

      paperCode: paper.code,
      paperTitle: paper.title,
      component: componentName,

      oldValue,
      newValue,
      reason,

      originalPaperResult: structuredClone(originalPaperResult ?? null),
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

    if (!Array.isArray(db.resultCorrections)) {
      db.resultCorrections = [];
    }

    db.resultCorrections.push(correction);

    // Complete the linked application only after successful recalculation.
    if (shouldApply && linkedApplication) {
      linkedApplication.status = 'Completed';
      linkedApplication.correctionId = correction.id;
      linkedApplication.decisionNotes = [
        text(linkedApplication.decisionNotes),
        `Mark correction applied: ${oldValue ?? '—'} → ${newValue}. ${reason}`,
      ]
        .filter(Boolean)
        .join(' | ');

      linkedApplication.updatedAt = now;

      if (!Array.isArray(linkedApplication.history)) {
        linkedApplication.history = [];
      }

      linkedApplication.history.push({
        action: `Correction ${correction.id} applied; mark changed from ${oldValue ?? '—'} to ${newValue}.`,
        at: now,
      });
    }

    // The original published calculation remains unchanged.
    saveDB(db);

    return NextResponse.json(
      {
        success: true,
        message: shouldApply
          ? 'Mark correction applied successfully. The original published result remains unchanged; the revised result is stored separately.'
          : 'Correction preview generated successfully. No result was changed.',
        correction,
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
