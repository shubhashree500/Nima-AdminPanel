import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';
import { calculateResults } from '@/lib/resultEngine';
import { getResultConfig } from '@/lib/configs';
import type { PaperConfig, CourseConfig } from '@/lib/configs/types';
import {
  RECHECKING_COMPONENTS,
  DEFAULT_RECHECKING_CONFIG,
  normalizeComponentName,
  getComponentMaxMark,
  validateRecheckingMarkChange,
} from '@/lib/rules/rechecking';

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function rollOf(result: any): string {
  const student = result?.student ?? result ?? {};
  return text(
    student['Roll No'] ??
      student['Roll No.'] ??
      student.rollNo ??
      student.roll ??
      student['College Roll No'] ??
      student['College Roll No.'] ??
      student.collegeRollNo ??
      student['Autonomous Roll No'] ??
      student.autonomousRollNo
  );
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

function extractStudentPaperComponents(studentResult: any, paper: PaperConfig) {
  const sourceStudent = studentResult?.student ?? studentResult ?? {};
  const subjectsMap = sourceStudent.subjects;
  const coursesList = Array.isArray(sourceStudent.courses)
    ? sourceStudent.courses
    : Array.isArray(sourceStudent.Papers)
    ? sourceStudent.Papers
    : null;

  let midsem: number | null = null;
  let endsem: number | null = null;
  let practical: number | null = null;
  let attendance: number | null = null;
  let surpriseTest: number | null = null;
  let assignment: number | null = null;

  const toNum = (v: any): number | null =>
    v !== undefined && v !== null && text(v) !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null;

  // 1. Check subjects object (UG)
  if (subjectsMap && typeof subjectsMap === 'object' && !Array.isArray(subjectsMap)) {
    const entry =
      subjectsMap[paper.code] ??
      Object.entries(subjectsMap).find(
        ([k]) => k.toLowerCase() === paper.code.toLowerCase()
      )?.[1];

    if (entry && typeof entry === 'object') {
      midsem = toNum(entry.MidsemMark ?? entry.midsemMark ?? entry.midsem);
      endsem = toNum(entry.FinalMark ?? entry.finalMark ?? entry.endsem);
      practical = toNum(entry.PracticalMark ?? entry.practicalMark ?? entry.practical);
      attendance = toNum(entry.Attandance ?? entry.attendance);
      surpriseTest = toNum(entry.SurpriseTest ?? entry.surpriseTest);
      assignment = toNum(entry.Assignment ?? entry.assignment);
    }
  }

  // 2. Check courses list (PG)
  if (coursesList) {
    const c = coursesList.find((item: any) => {
      const raw = String(item?.paper?.code || item?.code || item?.paper || '')
        .trim()
        .toLowerCase()
        .replace(/^paper\s*/, '');
      return raw === paper.code.toLowerCase().replace(/^paper\s*/, '');
    });

    if (c) {
      if (c.midsemMark !== undefined || c.midsem !== undefined) {
        midsem = toNum(c.midsemMark ?? c.midsem);
      }
      if (c.finalMark !== undefined || c.endsem !== undefined) {
        endsem = toNum(c.finalMark ?? c.endsem);
      }
      if (c.practical !== undefined || c.practicalMark !== undefined) {
        practical = toNum(c.practical ?? c.practicalMark);
      }
    }
  }

  // 3. Fallback to calculated subject in studentResult.subjects
  const subResult = (studentResult.subjects || []).find(
    (s: any) => paperCodeOf(s) === paper.code.toLowerCase()
  );

  if (subResult) {
    if (endsem === null && midsem === null) {
      endsem = toNum(subResult.marks);
    }
  }

  return { midsem, endsem, practical, attendance, surpriseTest, assignment };
}

function applyComponentToStudent(
  sourceStudent: any,
  paper: PaperConfig,
  componentName: string,
  newValue: number
) {
  const norm = normalizeComponentName(componentName);
  const updated = structuredClone(sourceStudent);

  // If student has subjects object (UG)
  if (
    updated.subjects &&
    typeof updated.subjects === 'object' &&
    !Array.isArray(updated.subjects)
  ) {
    const matchedKey =
      Object.keys(updated.subjects).find(
        (k) => k.toLowerCase() === paper.code.toLowerCase()
      ) || paper.code;

    if (!updated.subjects[matchedKey] || typeof updated.subjects[matchedKey] !== 'object') {
      updated.subjects[matchedKey] = {
        code: paper.code,
        paperCode: paper.code,
        subject: paper.title,
      };
    }

    if (norm === 'midsem') updated.subjects[matchedKey].MidsemMark = newValue;
    else if (norm === 'endsem' || norm === 'final' || norm === 'sem')
      updated.subjects[matchedKey].FinalMark = newValue;
    else if (norm === 'practical')
      updated.subjects[matchedKey].PracticalMark = newValue;
    else if (norm === 'attendance')
      updated.subjects[matchedKey].Attandance = newValue;
    else if (norm === 'surpriseTest')
      updated.subjects[matchedKey].SurpriseTest = newValue;
    else if (norm === 'assignment')
      updated.subjects[matchedKey].Assignment = newValue;
  }

  // If student has courses array (PG)
  if (Array.isArray(updated.courses)) {
    let course = updated.courses.find((item: any) => {
      const raw = String(item?.paper?.code || item?.code || item?.paper || '')
        .trim()
        .toLowerCase()
        .replace(/^paper\s*/, '');
      return raw === paper.code.toLowerCase().replace(/^paper\s*/, '');
    });

    if (!course) {
      course = { paper: paper.code };
      updated.courses.push(course);
    }

    if (norm === 'midsem') course.midsemMark = newValue;
    else if (norm === 'endsem' || norm === 'final' || norm === 'sem')
      course.finalMark = newValue;
    else if (norm === 'practical') {
      course.practical = newValue;
      course.finalMark = newValue;
    }
  }

  // If neither existed, create subjects object
  if (!updated.subjects && !Array.isArray(updated.courses)) {
    updated.subjects = {
      [paper.code]: {
        code: paper.code,
        paperCode: paper.code,
        subject: paper.title,
        ...(norm === 'midsem' ? { MidsemMark: newValue } : {}),
        ...(norm === 'endsem' || norm === 'final' || norm === 'sem'
          ? { FinalMark: newValue }
          : {}),
        ...(norm === 'practical' ? { PracticalMark: newValue } : {}),
        ...(norm === 'attendance' ? { Attandance: newValue } : {}),
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

    const calculation = records.find((r: any) => r.id === calculationId);

    if (!calculation) {
      return errorResponse('Calculation record not found.', 404);
    }

    const results = Array.isArray(calculation.results) ? calculation.results : [];

    if (!studentRoll) {
      // Return student list for dropdown
      const students = results.map((r: any) => ({
        roll: rollOf(r),
        name: nameOf(r),
        department: deptOf(r),
        sgpa: r.sgpa ?? '-',
        status: (r.subjects || []).some((s: any) =>
          ['F', 'AB', 'M'].includes(String(s?.grade || '').toUpperCase())
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

    // Locate single student
    const studentResult = results.find(
      (r: any) => rollOf(r).toLowerCase() === studentRoll.trim().toLowerCase()
    );

    if (!studentResult) {
      return errorResponse('Student not found in this calculation.', 404);
    }

    const sourceStudent = studentResult?.student ?? studentResult;
    const batch = Number(sourceStudent.batch ?? calculation.batch ?? 2025);
    const semester = Number(calculation.semester);
    const program = String(calculation.program).toUpperCase() as 'UG' | 'PG';
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

    // Map each subject with component breakdowns
    const papers = (studentResult.subjects || []).map((sub: any) => {
      const pCode = text(sub.paperCode || sub.code);
      const confPaper = papersConfig.find(
        (p) => p.code.toLowerCase() === pCode.toLowerCase()
      );

      const paperObj = confPaper || {
        code: pCode,
        title: sub.subjectName || sub.title || pCode,
        type: 'theory',
        credit: sub.credit ?? 4,
        marks: {
          fullMark: sub.fullMark ?? 100,
          endsem: { max: sub.fullMark ?? 100 },
          midsem: { max: 20 },
        },
      };

      const extracted = extractStudentPaperComponents(studentResult, paperObj as PaperConfig);

      return {
        code: pCode,
        title: sub.subjectName || confPaper?.title || pCode,
        category: sub.category || confPaper?.category || '',
        type: confPaper?.type || (extracted.practical !== null ? 'practical' : 'theory'),
        credit: sub.credit ?? confPaper?.credit ?? 0,
        fullMark: sub.fullMark ?? confPaper?.marks.fullMark ?? 100,
        marks: sub.marks ?? 0,
        grade: sub.grade || '-',
        gradePoint: sub.gradePoint ?? 0,
        creditPoint: sub.creditPoint ?? 0,
        grace: sub.grace ?? 0,
        components: {
          midsem: {
            value: extracted.midsem,
            max: getComponentMaxMark(paperObj as PaperConfig, 'midsem'),
          },
          sem: {
            value: extracted.endsem,
            max: getComponentMaxMark(paperObj as PaperConfig, 'endsem'),
          },
          practical: {
            value: extracted.practical,
            max: getComponentMaxMark(paperObj as PaperConfig, 'practical'),
          },
          attendance: {
            value: extracted.attendance,
            max: getComponentMaxMark(paperObj as PaperConfig, 'attendance'),
          },
        },
      };
    });

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
        status: (studentResult.subjects || []).some((s: any) =>
          ['F', 'AB', 'M'].includes(String(s?.grade || '').toUpperCase())
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
    const sourceStudent = originalResult?.student ?? originalResult;

    const program = String(original.program).toUpperCase() as 'UG' | 'PG';
    const semester = Number(original.semester);
    const batch = Number(sourceStudent.batch ?? original.batch ?? 2025);
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
      (item) => item.code.toLowerCase() === paperCode.toLowerCase()
    );

    if (!paper) {
      return errorResponse('Paper is not configured for this student.', 404);
    }

    const maxMark = getComponentMaxMark(paper, componentName);
    const extracted = extractStudentPaperComponents(originalResult, paper);
    const norm = normalizeComponentName(componentName);

    let oldValue: number | null = null;
    if (norm === 'midsem') oldValue = extracted.midsem;
    else if (norm === 'endsem' || norm === 'final' || norm === 'sem')
      oldValue = extracted.endsem;
    else if (norm === 'practical') oldValue = extracted.practical;
    else if (norm === 'attendance') oldValue = extracted.attendance;
    else if (norm === 'surpriseTest') oldValue = extracted.surpriseTest;
    else if (norm === 'assignment') oldValue = extracted.assignment;

    const validation = validateRecheckingMarkChange({
      oldValue,
      newValue,
      maxMark,
      config,
    });

    if (!validation.valid) {
      return errorResponse(validation.error || 'Invalid mark change.', 400);
    }

    // Apply change to an isolated copy of source student
    const updatedStudent = applyComponentToStudent(
      sourceStudent,
      paper,
      componentName,
      newValue
    );

    // Recalculate using official result engine
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

    const originalPaperResult = (originalResult.subjects || []).find(
      (s: any) => paperCodeOf(s) === paper.code.toLowerCase()
    );

    const revisedPaperResult = recalculated.subjects.find(
      (s: any) => paperCodeOf(s) === paper.code.toLowerCase()
    );

    const now = new Date().toISOString();

    const correction = {
      id: `CORR-${Date.now()}`,
      status: shouldApply ? 'applied' : 'preview',
      originalCalculationId: original.id,
      applicationId: text(body.applicationId) || null,

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

      originalPaperResult: structuredClone(originalPaperResult),
      revisedPaperResult: structuredClone(revisedPaperResult),

      originalStudentResult: structuredClone(originalResult),
      revisedStudentResult: structuredClone(recalculated),

      createdAt: now,
      appliedAt: shouldApply ? now : null,
      history: [
        {
          action: shouldApply
            ? 'Correction applied to result'
            : 'Correction preview generated',
          at: now,
        },
      ],
    };

    if (!Array.isArray(db.resultCorrections)) {
      db.resultCorrections = [];
    }

    db.resultCorrections.push(correction);

    if (shouldApply) {
      // Mark student result as revised in original calculation
      const idx = original.results.findIndex(
        (r: any) => rollOf(r).toLowerCase() === studentRoll.toLowerCase()
      );

      if (idx !== -1) {
        const enrichedRevised = {
          ...recalculated,
          isRevised: true,
          revisedAt: now,
          revisedPaper: paper.code,
          correctionId: correction.id,
        };
        original.results[idx] = enrichedRevised;
        original.hasRevisions = true;
        original.updatedAt = now;
      }

      // If tied to an application, complete it
      if (body.applicationId && Array.isArray(db.recheckingApplications)) {
        const app = db.recheckingApplications.find(
          (a: any) => a.id === body.applicationId
        );
        if (app) {
          app.status = 'Completed';
          app.correctionId = correction.id;
          app.decisionNotes = text(
            `${app.decisionNotes ? app.decisionNotes + ' | ' : ''}Approved & mark updated to ${newValue}: ${reason}`
          );
          app.updatedAt = now;
          app.history = app.history || [];
          app.history.push({
            action: `Mark updated to ${newValue}. Result revised.`,
            at: now,
          });
        }
      }
    }

    saveDB(db);

    return NextResponse.json(
      {
        success: true,
        message: shouldApply
          ? 'Mark update applied successfully. Result has been revised.'
          : 'Correction preview generated successfully.',
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