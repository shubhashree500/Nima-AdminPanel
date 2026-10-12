import { DBData, Student, ProgramKey, CalcResult } from '@/types';

export function getSubjects(
  db: DBData,
  program: ProgramKey,
  semester: number
): string[] {
  const key = `${program}|${semester}`;
  return db.subjects?.[key] || [];
}

export function findStudent(
  db: DBData,
  roll: string
): Student | undefined {
  const normalizedRoll = String(roll).trim().toLowerCase();

  return db.students?.find(
    (student) =>
      String(student.r).trim().toLowerCase() === normalizedRoll
  );
}

export function formatPct(
  value: number | undefined | null
): string {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(Number(value))
  ) {
    return '—';
  }

  return `${Number(value).toFixed(2)}%`;
}

export function calculateResult(
  db: DBData,
  student: Student,
  semester?: number
): CalcResult {
  const sem = semester && semester > 0 ? semester : 1;

  const subjects = getSubjects(db, student.p, sem);

  if (!subjects.length) {
    return {
      status: 'Pending',
    };
  }

  let total = 0;
  let max = 0;
  let hasMarks = false;
  let hasPending = false;

  for (const subject of subjects) {
    const key = `${student.r}|${sem}`;
    const marks = db.marks?.[key]?.[subject];

    if (
      marks === undefined ||
      marks === null ||
      Number.isNaN(Number(marks))
    ) {
      hasPending = true;
      continue;
    }

    hasMarks = true;
    total += Number(marks);
    max += db.max;
  }

  if (!hasMarks) {
    return {
      status: 'Pending',
    };
  }

  const percentage =
    max > 0 ? (total / max) * 100 : 0;

  if (hasPending) {
    return {
      t: total,
      mx: max,
      pct: percentage,
      status: 'Pending',
    };
  }

  const passed = subjects.every((subject) => {
    const key = `${student.r}|${sem}`;
    const marks = db.marks?.[key]?.[subject];

    return (
      marks !== undefined &&
      marks !== null &&
      Number(marks) >= db.pass
    );
  });

  let division: string | undefined;

  if (passed) {
    if (percentage >= 60) {
      division = 'First';
    } else if (percentage >= 45) {
      division = 'Second';
    } else {
      division = 'Third';
    }
  }

  return {
    t: total,
    mx: max,
    pct: percentage,
    status: passed ? 'Pass' : 'Fail',
    div: division,
  };
}