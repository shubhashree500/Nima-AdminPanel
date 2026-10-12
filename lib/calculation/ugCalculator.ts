
import type { CourseConfig, PaperConfig } from '../configs/types';
import type { StudentResult, SubjectResult } from './types';

import {
  calculateCreditPoint,
  calculateSGPA,
  roundNumber,
} from './common';

import { calculateGrade } from '../rules/grading';

const PRACTICAL_SUBJECTS = [
  'Biofertilizer & Biopesticides',
  'Botany',
  'C.PROG.',
  'Chemistry',
  'Climatology',
  'Education',
  'Geology',
  'P.PROG.',
  'Physics',
  'Psychology',
  'Zoology',
];

function isPracticalSubject(
  subjectName?: string,
): boolean {
  if (!subjectName) {
    return false;
  }

  const value = String(subjectName)
    .trim()
    .toLowerCase();

  return PRACTICAL_SUBJECTS.some(
    (name) => name.trim().toLowerCase() === value,
  );
}

type MarkStatus = 'normal' | 'AB' | 'M';

function parseMark(
  subject: any,
  ...keys: string[]
): { value: number; status: MarkStatus } {
  for (const key of keys) {
    const raw = subject?.[key];

    if (
      raw === undefined ||
      raw === null ||
      String(raw).trim() === ''
    ) {
      continue;
    }

    const value = String(raw).trim().toUpperCase();

    if (
      value === 'AB' ||
      value === 'A.B' ||
      value === 'ABSENT'
    ) {
      return { value: 0, status: 'AB' };
    }

    if (
      value === 'M' ||
      value === 'MP' ||
      value === 'M.P'
    ) {
      return { value: 0, status: 'M' };
    }

    const number = Number(raw);

    if (Number.isFinite(number)) {
      return {
        value: number,
        status: 'normal',
      };
    }
  }

  return {
    value: 0,
    status: 'normal',
  };
}

function findStudentSubject(
  student: any,
  paper: PaperConfig,
): any {
  const subjects = student?.subjects;

  if (
    subjects &&
    !Array.isArray(subjects) &&
    typeof subjects === 'object'
  ) {
    if (subjects[paper.code] !== undefined) {
      return subjects[paper.code];
    }
  }

  if (Array.isArray(subjects)) {
    const found = subjects.find(
      (subject: any) =>
        String(
          subject?.code ??
            subject?.paperCode ??
            subject?.courseType ??
            subject?.paper?.code ??
            '',
        )
          .trim()
          .toLowerCase() === paper.code.trim().toLowerCase(),
    );

    if (found) {
      return found;
    }
  }

  if (Array.isArray(student?.courses)) {
    const found = student.courses.find(
      (subject: any) =>
        String(
          subject?.code ??
            subject?.paperCode ??
            subject?.courseType ??
            subject?.paper?.code ??
            '',
        )
          .trim()
          .toLowerCase() === paper.code.trim().toLowerCase(),
    );

    if (found) {
      return found;
    }
  }

  return {};
}

function calculateRawMarks(
  subject: any,
  paper: PaperConfig,
): {
  marks: number;
  status: MarkStatus;
} {
  const final = parseMark(
    subject,
    'FinalMark',
    'finalMark',
    'EndsemMark',
    'endsem',
    'Final-Mark',
  );

  const midsem = parseMark(
    subject,
    'MidsemMark',
    'midsemMark',
    'midsem',
    'Midsem-Mark',
  );

  const attendance = parseMark(
    subject,
    'Attandance',
    'Attendance',
    'attendance',
  );

  const surprise = parseMark(
    subject,
    'SurpriseTest',
    'surpriseTest',
    'surprise',
  );

  const assignment = parseMark(
    subject,
    'Assignment',
    'assignment',
  );

  const practical = parseMark(
    subject,
    'PracticalMark',
    'practicalMark',
    'practical',
  );

  const internalPractical = parseMark(
    subject,
    'I-Practical',
    'IPractical',
    'internalPractical',
    'internalPracticalMark',
  );

  // Preserve absent status if any supplied mark is marked absent.
  if (
    final.status === 'AB' ||
    midsem.status === 'AB' ||
    attendance.status === 'AB' ||
    surprise.status === 'AB' ||
    assignment.status === 'AB' ||
    practical.status === 'AB' ||
    internalPractical.status === 'AB'
  ) {
    return {
      marks: 0,
      status: 'AB',
    };
  }

  // Preserve malpractice status if any supplied mark is marked M.
  if (
    final.status === 'M' ||
    midsem.status === 'M' ||
    attendance.status === 'M' ||
    surprise.status === 'M' ||
    assignment.status === 'M' ||
    practical.status === 'M' ||
    internalPractical.status === 'M'
  ) {
    return {
      marks: 0,
      status: 'M',
    };
  }

  const isPractical =
    paper.type === 'practical' ||
    subject?.isPractical === true ||
    isPracticalSubject(subject?.subject);

  if (isPractical) {
    // Practical formula:
    // FinalMark / 100 * 50
    // + Midsem + Practical + Attendance
    // + Internal Practical + Surprise Test
    const finalContribution =
      (final.value / 100) * 50;

    const total =
      finalContribution +
      midsem.value +
      practical.value +
      attendance.value +
      internalPractical.value +
      surprise.value;

    return {
      marks: Math.round(total),
      status: 'normal',
    };
  }

  // Theory formula:
  // Final exam contribution + Midsem + Attendance
  // + Surprise Test + Assignment
  const finalMax =
    paper.marks.endsem?.max ?? 100;

  const finalContributionMax =
    paper.marks.fullMark -
    (paper.marks.midsem?.max ?? 0) -
    (paper.marks.attendance?.max ?? 0) -
    (paper.marks.surpriseTest?.max ?? 0) -
    (paper.marks.assignment?.max ?? 0);

  const finalContribution =
    finalMax > 0
      ? (final.value / finalMax) * finalContributionMax
      : 0;

  const total =
    finalContribution +
    midsem.value +
    attendance.value +
    surprise.value +
    assignment.value;

  return {
    marks: Math.round(total),
    status: 'normal',
  };
}

function applyGrace(
  subjects: SubjectResult[],
  config: CourseConfig,
): number {
  const grace = config.grace;

  if (!grace?.enabled) {
    return 0;
  }

  const passMark = grace.passMark ?? 40;
  const totalLimit = grace.totalLimit ?? 0;
  const subjectLimit = grace.subjectLimit ?? 0;
  const priority = grace.priority ?? [];

  let remainingGrace = totalLimit;
  let usedGrace = 0;

  for (const priorityGroup of priority) {
    if (remainingGrace <= 0) {
      break;
    }

    for (const subject of subjects) {
      if (remainingGrace <= 0) {
        break;
      }

      if (subject.grade !== 'F') {
        continue;
      }

      const category = subject.category ?? '';

      if (!priorityGroup.includes(category)) {
        continue;
      }

      const required = passMark - subject.marks;

      if (
        required <= 0 ||
        required > subjectLimit ||
        required > remainingGrace
      ) {
        continue;
      }

      subject.marks = Math.round(
        subject.marks + required,
      );

      subject.grace = required;

      usedGrace += required;
      remainingGrace -= required;
    }
  }

  return usedGrace;
}

export function calculateUGStudent(
  student: any,
  config: CourseConfig,
): StudentResult {
  const papers = config.papers ?? [];

  if (!papers.length) {
    throw new Error(
      `No papers configured for UG Semester ${config.semester}`,
    );
  }

  const subjects: SubjectResult[] = [];

  for (const paper of papers) {
    const sourceSubject = findStudentSubject(student, paper);

    const calculated = calculateRawMarks(
      sourceSubject,
      paper,
    );

    let grade = {
      grade: 'F',
      gradePoint: 0,
    };

    if (calculated.status === 'AB') {
      grade = {
        grade: 'AB',
        gradePoint: 0,
      };
    } else if (calculated.status === 'M') {
      grade = {
        grade: 'M',
        gradePoint: 0,
      };
    } else {
      const percentage =
        paper.marks.fullMark > 0
          ? (calculated.marks / paper.marks.fullMark) * 100
          : 0;

      grade = calculateGrade(
        percentage,
        config.grading.scale,
      );
    }

    subjects.push({
      paperCode: paper.code,
      subjectName:
        sourceSubject?.subject ?? paper.title,
      category: paper.category ?? '',
      marks: calculated.marks,
      fullMark: paper.marks.fullMark,
      credit: paper.credit,
      grade: grade.grade,
      gradePoint: grade.gradePoint,
      creditPoint: calculateCreditPoint(
        paper.credit,
        grade.gradePoint,
      ),
    });
  }

  // Apply grace according to the existing configuration.
  const usedGrace = applyGrace(subjects, config);

  // Recalculate grades and credit points after grace.
  for (const subject of subjects) {
    if (
      subject.grade === 'AB' ||
      subject.grade === 'M'
    ) {
      continue;
    }

    const percentage =
      subject.fullMark > 0
        ? (subject.marks / subject.fullMark) * 100
        : 0;

    const grade = calculateGrade(
      percentage,
      config.grading.scale,
    );

    subject.grade = grade.grade;
    subject.gradePoint = grade.gradePoint;
    subject.creditPoint = calculateCreditPoint(
      subject.credit,
      grade.gradePoint,
    );
  }

  const totalCredits = subjects.reduce(
    (total, subject) => total + subject.credit,
    0,
  );

  const totalCreditPoints = subjects.reduce(
    (total, subject) => total + subject.creditPoint,
    0,
  );

  const totalMarks = subjects.reduce(
    (total, subject) => total + subject.marks,
    0,
  );

  const totalFullMarks = subjects.reduce(
    (total, subject) => total + subject.fullMark,
    0,
  );

  const percentage =
    totalFullMarks > 0
      ? roundNumber(
          (totalMarks / totalFullMarks) * 100,
          2,
        )
      : 0;

  const sgpa = calculateSGPA(
    totalCreditPoints,
    totalCredits,
  );

  const totalGraceLimit = config.grace?.enabled
    ? config.grace.totalLimit ?? 0
    : 0;

  const remainingGrace = Math.max(
    0,
    totalGraceLimit - usedGrace,
  );

  return {
    student,
    subjects,
    totalCredits,
    totalCreditPoints: roundNumber(totalCreditPoints, 2),
    sgpa,
    percentage,
    usedGrace,
    remainingGrace,
  };
}