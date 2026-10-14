import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { calculateResults } from '@/lib/resultEngine';
import { getResultConfig } from '@/lib/configs';

const COMPONENTS: Record<string, { key: string; configKey: string }> = {
  midsem: { key: 'MidsemMark', configKey: 'midsem' },
  endsem: { key: 'FinalMark', configKey: 'endsem' },
  final: { key: 'FinalMark', configKey: 'endsem' },
  attendance: { key: 'Attandance', configKey: 'attendance' },
  surpriseTest: { key: 'SurpriseTest', configKey: 'surpriseTest' },
  assignment: { key: 'Assignment', configKey: 'assignment' },
  practical: { key: 'PracticalMark', configKey: 'practical' },
  internalPractical: {
    key: 'I-Practical',
    configKey: 'internalPractical',
  },
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function rollOf(result: any): string {
  const student = result?.student ?? {};

  return text(
    student['Roll No'] ??
      student['Roll No.'] ??
      student.rollNo ??
      student.roll ??
      student['College Roll No'] ??
      student['College Roll No.']
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const originalCalculationId = text(body.originalCalculationId);
    const studentRoll = text(body.studentRoll);
    const paperCode = text(body.paperCode);
    const componentName = text(body.component);
    const reason = text(body.reason);

    // Do not convert blank strings or null to zero.
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

    const newValue = Number(body.newValue);

    if (!Number.isFinite(newValue)) {
      return errorResponse('New mark must be a valid number.', 400);
    }

    const component = COMPONENTS[componentName];

    if (!component) {
      return errorResponse('Unsupported mark component.', 400);
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

    // This initial implementation intentionally supports UG Semester 3 only.
    if (
      text(original.program).toUpperCase() !== 'UG' ||
      Number(original.semester) !== 3
    ) {
      return errorResponse(
        'The correction preview currently supports UG Semester 3 only.',
        400
      );
    }

    if (!Array.isArray(original.results)) {
      return errorResponse(
        'Student results are unavailable in the original calculation.',
        400
      );
    }

    const studentMatches = original.results.filter(
      (result: any) =>
        rollOf(result).toLowerCase() === studentRoll.toLowerCase()
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
    const sourceStudent = originalResult?.student;

    if (
      !sourceStudent ||
      !sourceStudent.subjects ||
      typeof sourceStudent.subjects !== 'object' ||
      Array.isArray(sourceStudent.subjects)
    ) {
      return errorResponse(
        'Original raw subject component data is unavailable.',
        400
      );
    }

    // Resolve the paper key case-insensitively to avoid casing mismatches.
    const matchedPaperEntry = Object.entries(sourceStudent.subjects).find(
      ([key]) => key.toLowerCase() === paperCode.toLowerCase()
    );

    if (!matchedPaperEntry) {
      return errorResponse(
        'Paper component data was not found for this student.',
        404
      );
    }

    const [actualPaperCode, sourceSubject] = matchedPaperEntry as [
      string,
      Record<string, unknown>,
    ];

    if (!sourceSubject || typeof sourceSubject !== 'object') {
      return errorResponse(
        'The selected paper has invalid raw mark data.',
        400
      );
    }

    const batch = Number(sourceStudent.batch ?? original.batch);

    if (!Number.isFinite(batch)) {
      return errorResponse(
        'A valid batch could not be determined for this student.',
        400
      );
    }

    const course = text(sourceStudent.course);
    const department = text(
      sourceStudent.Department ?? sourceStudent.department
    );

    const config = getResultConfig({
      program: 'UG',
      batch,
      semester: 3,
      course: course || undefined,
      department: department || undefined,
    });

    if (
      !config?.rechecking?.enabled ||
      !config.rechecking.recalculateResult
    ) {
      return errorResponse(
        'Rechecking or result recalculation is disabled for this configuration.',
        400
      );
    }

    const paper = config.papers?.find(
      (item) =>
        item.code.toLowerCase() === actualPaperCode.toLowerCase()
    );

    if (!paper) {
      return errorResponse(
        'Paper is not configured for this student.',
        404
      );
    }

    const markConfig = (paper.marks as any)?.[component.configKey];

    if (
      !markConfig ||
      !Number.isFinite(Number(markConfig.max)) ||
      Number(markConfig.max) < 0
    ) {
      return errorResponse(
        'That mark component is not configured for this paper.',
        400
      );
    }

    const maxMark = Number(markConfig.max);

    if (newValue < 0 || newValue > maxMark) {
      return errorResponse(
        `New value must be between 0 and ${maxMark}.`,
        400
      );
    }

    const rawOldValue = sourceSubject[component.key];
    const parsedOldValue = Number(rawOldValue);

    const oldValue =
      text(rawOldValue) === '' || !Number.isFinite(parsedOldValue)
        ? null
        : parsedOldValue;

    if (oldValue === null) {
      return errorResponse(
        'The existing component is blank or non-numeric. Review it before requesting a numeric correction.',
        400
      );
    }

    if (oldValue < 0 || oldValue > maxMark) {
      return errorResponse(
        'The existing mark is outside the configured range. Review the source mark before correcting it.',
        400
      );
    }

    if (
      newValue > oldValue &&
      !config.rechecking.allowMarkIncrease
    ) {
      return errorResponse(
        'Mark increases are disabled for this configuration.',
        400
      );
    }

    if (
      newValue < oldValue &&
      !config.rechecking.allowMarkDecrease
    ) {
      return errorResponse(
        'Mark decreases are disabled for this configuration.',
        400
      );
    }

    if (newValue === oldValue) {
      return errorResponse(
        'The new mark is the same as the existing mark. No correction is needed.',
        400
      );
    }

    /*
     * Work on a copy. Never mutate original.results or its student data.
     * Only the selected student's selected raw mark component is changed.
     */
    const updatedStudent = {
      ...sourceStudent,
      subjects: {
        ...sourceStudent.subjects,
        [actualPaperCode]: {
          ...sourceSubject,
          [component.key]: newValue,
        },
      },
    };

    const recalculatedResults = calculateResults({
      program: 'UG',
      semester: 3,
      batch: String(batch),
      course,
      department: department || undefined,
      mode: 'rechecking',
      students: [updatedStudent],
    });

    const recalculated = Array.isArray(recalculatedResults)
      ? recalculatedResults[0]
      : null;

    // Validate all calculation output before saving anything.
    if (!recalculated) {
      return errorResponse(
        'Recalculation failed. No correction was saved.',
        422
      );
    }

    if (!Array.isArray(recalculated.subjects)) {
      return errorResponse(
        'Recalculated subject results are invalid. No correction was saved.',
        422
      );
    }

    const revisedPaperResult = recalculated.subjects.find(
      (subject: any) =>
        paperCodeOf(subject) === actualPaperCode.toLowerCase()
    );

    if (!revisedPaperResult) {
      return errorResponse(
        'Recalculated paper was not found. No correction was saved.',
        422
      );
    }

    if (
      !Array.isArray(originalResult.subjects) ||
      !originalResult.subjects.some(
        (subject: any) =>
          paperCodeOf(subject) === actualPaperCode.toLowerCase()
      )
    ) {
      return errorResponse(
        'The original calculated paper result could not be verified. No correction was saved.',
        422
      );
    }

    // Only initialize a missing array. Reject malformed stored data.
    if (db.resultCorrections === undefined || db.resultCorrections === null) {
      db.resultCorrections = [];
    }

    if (!Array.isArray(db.resultCorrections)) {
      return errorResponse(
        'Correction storage is invalid. No correction was saved.',
        500
      );
    }

    const originalPaperResult = originalResult.subjects.find(
      (subject: any) =>
        paperCodeOf(subject) === actualPaperCode.toLowerCase()
    );

    const now = new Date().toISOString();

    const correction = {
      id: `CORR-${Date.now()}`,
      status: 'preview',
      originalCalculationId: original.id,
      applicationId: text(body.applicationId) || null,

      studentRoll: rollOf(originalResult),
      studentName: text(
        sourceStudent['Name of the Students'] ??
          sourceStudent['Student Name'] ??
          sourceStudent.name
      ),

      program: 'UG',
      semester: 3,
      batch: sourceStudent.batch ?? original.batch,
      course: sourceStudent.course ?? null,
      department:
        sourceStudent.Department ?? sourceStudent.department ?? null,

      paperCode: actualPaperCode,
      component: componentName,
      componentKey: component.key,

      oldValue,
      newValue,
      reason,

      originalPaperResult: structuredClone(originalPaperResult),
      revisedPaperResult: structuredClone(revisedPaperResult),

      originalStudentResult: structuredClone(originalResult),
      revisedStudentResult: structuredClone(recalculated),

      createdAt: now,
      history: [
        {
          action: 'Correction preview generated',
          at: now,
        },
      ],
    };

    // This appends a separate preview record. It does not replace the
    // original calculation or change its published status or result data.
    db.resultCorrections.push(correction);
    saveDB(db);

    return NextResponse.json(
      {
        success: true,
        message:
          'Correction preview generated. The original published result has not been changed.',
        correction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Rechecking preview error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to generate correction preview.',
      },
      { status: 500 }
    );
  }
}