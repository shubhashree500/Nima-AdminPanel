
import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

const STATUSES = [
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Completed',
] as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Completed'],
  Rejected: [],
  Completed: [],
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

function nameOf(result: any): string {
  const student = result?.student ?? {};

  return text(
    student['Name of the Students'] ??
      student['Student Name'] ??
      student.name ??
      student.studentName
  );
}

function findSubject(result: any, paperCode: string) {
  if (!Array.isArray(result?.subjects)) return undefined;

  return result.subjects.find(
    (subject: any) =>
      text(subject?.paperCode).toLowerCase() ===
      paperCode.toLowerCase()
  );
}

function validateRequestedMarks(
  value: unknown,
  fullMark: number
): { valid: boolean; value: number | null } {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return { valid: true, value: null };
  }

  if (!Number.isFinite(fullMark) || fullMark <= 0) {
    return { valid: false, value: null };
  }

  const marks = Number(value);

  if (
    !Number.isFinite(marks) ||
    marks < 0 ||
    marks > fullMark
  ) {
    return { valid: false, value: null };
  }

  return { valid: true, value: marks };
}

export async function GET() {
  try {
    const db: any = getDB();

    return NextResponse.json({
      success: true,
      applications: Array.isArray(db.recheckingApplications)
        ? db.recheckingApplications
        : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load applications.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentRoll = text(body.studentRoll);
    const studentName = text(body.studentName);
    const program = text(body.program).toUpperCase();
    const semester = Number(body.semester);
    const batch = text(body.batch);
    const paperCode = text(body.paperCode);
    const reason = text(body.reason);

    if (
      !studentRoll ||
      !studentName ||
      !program ||
      body.semester === undefined ||
      body.semester === null ||
      text(body.semester) === '' ||
      !batch ||
      !paperCode ||
      !reason
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Student roll, name, program, semester, batch, paper code, and reason are required.',
        },
        { status: 400 }
      );
    }

    if (!['UG', 'PG'].includes(program)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Program must be UG or PG.',
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(semester) || semester < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Semester must be a positive integer.',
        },
        { status: 400 }
      );
    }

    const db: any = getDB();

    const records = Array.isArray(db.calculatedResults)
      ? db.calculatedResults
      : [];

    const matchingRecords = records.filter((record: any) => {
      if (record.status !== 'published') return false;
      if (record.program !== program) return false;
      if (Number(record.semester) !== semester) return false;
      if (String(record.batch ?? '') !== batch) return false;

      return (
        Array.isArray(record.results) &&
        record.results.some(
          (result: any) =>
            rollOf(result).toLowerCase() ===
              studentRoll.toLowerCase() &&
            Boolean(findSubject(result, paperCode))
        )
      );
    });

    if (matchingRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No published calculation contains this student and paper for the selected program, semester, and batch.',
        },
        { status: 404 }
      );
    }

    if (matchingRecords.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            'More than one published calculation matches this request. The application was not created because the original result is ambiguous.',
        },
        { status: 409 }
      );
    }

    const originalCalculation = matchingRecords[0];

    const studentResults = originalCalculation.results.filter(
      (result: any) =>
        rollOf(result).toLowerCase() ===
        studentRoll.toLowerCase()
    );

    if (studentResults.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The student does not match exactly one result in the original calculation.',
        },
        { status: 409 }
      );
    }

    const studentResult = studentResults[0];
    const officialName = nameOf(studentResult);

    if (
      !officialName ||
      officialName.toLowerCase() !== studentName.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Student name does not match the published result. Please verify the roll number and name.',
        },
        { status: 400 }
      );
    }

    const matchingSubjects = Array.isArray(studentResult.subjects)
      ? studentResult.subjects.filter(
          (subject: any) =>
            text(subject?.paperCode).toLowerCase() ===
            paperCode.toLowerCase()
        )
      : [];

    if (matchingSubjects.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            matchingSubjects.length === 0
              ? 'Paper not found in the original result.'
              : 'The paper code occurs more than once in the original result. The application was not created.',
        },
        { status: matchingSubjects.length === 0 ? 404 : 409 }
      );
    }

    const subject = matchingSubjects[0];

    const markCheck = validateRequestedMarks(
      body.requestedMarks,
      Number(subject.fullMark)
    );

    if (!markCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Requested marks must be a number between 0 and ${subject.fullMark}.`,
        },
        { status: 400 }
      );
    }

    db.recheckingApplications ||= [];

    // Prevent duplicate active applications for the same paper
    // against the same published calculation.
    const duplicate = db.recheckingApplications.find(
      (app: any) =>
        app.originalCalculationId === originalCalculation.id &&
        text(app.studentRoll).toLowerCase() ===
          studentRoll.toLowerCase() &&
        text(app.paperCode).toLowerCase() ===
          paperCode.toLowerCase() &&
        !['Rejected', 'Completed'].includes(app.status)
    );

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error:
            'An active application already exists for this student and paper.',
          applicationId: duplicate.id,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const application = {
      id: `RECHECK-${Date.now()}`,
      studentRoll,
      studentName: officialName,
      program,
      semester,
      batch,
      paperCode,
      reason,
      requestedMarks: markCheck.value,

      originalCalculationId: originalCalculation.id,
      originalMarks: subject.marks,
      originalFullMark: subject.fullMark,
      originalGrade: subject.grade,
      originalGradePoint: subject.gradePoint,

      status: 'Submitted',
      decisionNotes: '',
      correctionId: null,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          action: 'Application submitted',
          at: now,
        },
      ],
    };

    db.recheckingApplications.push(application);
    saveDB(db);

    return NextResponse.json(
      { success: true, application },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create application.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Application ID is required.',
        },
        { status: 400 }
      );
    }

    const db: any = getDB();
    db.recheckingApplications ||= [];

    const application = db.recheckingApplications.find(
      (item: any) => item.id === body.id
    );

    if (!application) {
      return NextResponse.json(
        {
          success: false,
          error: 'Application not found.',
        },
        { status: 404 }
      );
    }

    if (
      application.status === 'Completed' ||
      application.status === 'Rejected'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${application.status} applications are locked.`,
        },
        { status: 400 }
      );
    }

    if (
      body.status !== undefined &&
      !STATUSES.includes(body.status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid application status.',
        },
        { status: 400 }
      );
    }

    if (body.status !== undefined) {
      const allowed =
        ALLOWED_TRANSITIONS[application.status] ?? [];

      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot change status from ${application.status} to ${body.status}.`,
          },
          { status: 400 }
        );
      }

      application.status = body.status;
    }

    if (body.decisionNotes !== undefined) {
      application.decisionNotes = text(body.decisionNotes);
    }

    application.updatedAt = new Date().toISOString();

    application.history = Array.isArray(application.history)
      ? application.history
      : [];

    application.history.push({
      action:
        body.status !== undefined
          ? `Status changed to ${body.status}`
          : 'Application notes updated',
      at: application.updatedAt,
    });

    saveDB(db);

    return NextResponse.json({
      success: true,
      application,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update application.',
      },
      { status: 500 }
    );
  }
}