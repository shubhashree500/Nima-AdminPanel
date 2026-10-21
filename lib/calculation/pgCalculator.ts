import type {
  CourseConfig,
  PaperConfig,
} from '../configs/types';

import type {
  SubjectResult,
} from './types';
/* =========================================================
   MARK PARSER
   ========================================================= */

type ParsedMark =
  | { type: 'number'; value: number }
  | { type: 'absent' }
  | { type: 'malpractice' }
  | { type: 'other' };

function parseMark(value: unknown): ParsedMark {
  if (value === null || value === undefined || value === '') {
    return { type: 'other' };
  }

  const text = String(value).trim().toUpperCase();

  if (!text) {
    return { type: 'other' };
  }

  if (
    text === 'AB' ||
    text === 'A.B' ||
    text === 'ABSENT'
  ) {
    return { type: 'absent' };
  }

  if (
    text === 'M' ||
    text === 'MP' ||
    text === 'M.P'
  ) {
    return { type: 'malpractice' };
  }

  const number = Number(value);

  if (Number.isFinite(number)) {
    return {
      type: 'number',
      value: number,
    };
  }

  return { type: 'other' };
}

/* =========================================================
   DEPARTMENT NORMALIZATION
   ========================================================= */

function normalizeDepartment(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();

  const aliases: Record<string, string> = {
    odia: 'Odia',

    chemistry: 'Chemistry',

    math: 'Mathematics',
    mathematics: 'Mathematics',

    commerce: 'Commerce',

    geology: 'Geology',

    mfc: 'MFC',
    'mfc department': 'MFC',
  };

  return aliases[raw] ?? String(value ?? '').trim();
}

/* =========================================================
   STUDENT FIELD HELPERS
   ========================================================= */

function getStudentValue(
  student: any,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (
      student &&
      Object.prototype.hasOwnProperty.call(student, key)
    ) {
      const value = student[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        return value;
      }
    }
  }

  return undefined;
}

function getCollegeRoll(student: any): string {
  return String(
    getStudentValue(
      student,
      'College Roll No',
      'collegeRollNo',
      'college_roll_no',
      'rollNo',
      'Roll No',
    ) ?? '',
  ).trim();
}

function getAutonomousRoll(student: any): string {
  return String(
    getStudentValue(
      student,
      'Autonomous Roll No',
      'autonomousRollNo',
      'autonomous_roll_no',
      'Autonomous Roll',
    ) ?? '',
  ).trim();
}

function getExamCode(student: any): string {
  return String(
    getStudentValue(
      student,
      'ExamCode',
      'Exam Code',
      'examCode',
      'exam_code',
    ) ?? '',
  ).trim();
}

function getStudentName(student: any): string {
  return String(
    getStudentValue(
      student,
      'Applicant Name',
      'ApplicantName',
      'applicantName',
      'Name',
      'name',
    ) ?? '',
  ).trim();
}

function getDepartment(student: any): string {
  return normalizeDepartment(
    getStudentValue(
      student,
      'Department',
      'department',
      'Department Name',
      'departmentName',
    ),
  );
}

/* =========================================================
   COMBINED PG EXCEL FIELD MAPPINGS
   ========================================================= */

type PaperFieldMapping = {
  mid?: string;
  final?: string;
  practical?: string;
};

/*
  The uploaded PG workbook contains all departments in one sheet.

  Because Excel/SheetJS creates duplicate column names such as:

    Midsem-Mark
    Midsem-Mark_1
    Midsem-Mark_2

  and unnamed columns such as:

    __EMPTY
    __EMPTY_1
    __EMPTY_2

  we explicitly map the columns for each department.
*/

const PG_FIELD_MAPPINGS: Record<
  string,
  PaperFieldMapping[]
> = {
  /* -------------------------------------------------------
     ODIA
     ------------------------------------------------------- */

  Odia: [
    {
      mid: 'Midsem-Mark',
      final: 'Final-Mark',
    },
    {
      mid: 'Midsem-Mark_1',
      final: 'Final-Mark_1',
    },
    {
      mid: 'Midsem-Mark_2',
      final: 'Final-Mark_2',
    },
    {
      mid: 'Midsem-Mark_3',
      final: 'Final-Mark_3',
    },
  ],

  /* -------------------------------------------------------
     CHEMISTRY
     ------------------------------------------------------- */

  Chemistry: [
    {
      mid: 'Midsem-Mark',
      final: 'Final-Mark',
    },
    {
      mid: 'Midsem-Mark_1',
      final: 'Final-Mark_1',
    },
    {
      mid: 'Midsem-Mark_2',
      final: 'Final-Mark_2',
    },

    // Practical 1.4
    {
      practical: 'Midsem-Mark_3',
    },

    // Practical 1.5
    {
      practical: '__EMPTY',
    },

    // Theory 1.6
    {
      mid: '__EMPTY_2',
      final: '__EMPTY_3',
    },

    // Theory 1.7
    {
      mid: '__EMPTY_5',
      final: '__EMPTY_6',
    },
  ],

  /* -------------------------------------------------------
     MATHEMATICS
     ------------------------------------------------------- */

  Mathematics: [
    {
      mid: 'Midsem-Mark',
      final: 'Final-Mark',
    },
    {
      mid: 'Midsem-Mark_1',
      final: 'Final-Mark_1',
    },
    {
      mid: 'Midsem-Mark_2',
      final: 'Final-Mark_2',
    },
    {
      mid: 'Midsem-Mark_3',
      final: 'Final-Mark_3',
    },
    {
      mid: '__EMPTY_1',
      final: '__EMPTY_2',
    },
  ],

  /* -------------------------------------------------------
     COMMERCE
     ------------------------------------------------------- */

  Commerce: [
    {
      mid: 'Midsem-Mark',
      final: 'Final-Mark',
    },
    {
      mid: 'Midsem-Mark_1',
      final: 'Final-Mark_1',
    },
    {
      mid: 'Midsem-Mark_2',
      final: 'Final-Mark_2',
    },
    {
      mid: 'Midsem-Mark_3',
      final: 'Final-Mark_3',
    },
    {
      mid: '__EMPTY_1',
      final: '__EMPTY_2',
    },
    {
      mid: '__EMPTY_4',
      final: '__EMPTY_5',
    },
  ],

  /* -------------------------------------------------------
     GEOLOGY
     ------------------------------------------------------- */

  Geology: [
    {
      mid: 'Midsem-Mark',
      final: 'Final-Mark',
    },
    {
      mid: 'Midsem-Mark_1',
      final: 'Final-Mark_1',
    },
    {
      mid: 'Midsem-Mark_2',
      final: 'Final-Mark_2',
    },
    {
      mid: 'Midsem-Mark_3',
      final: 'Final-Mark_3',
    },
    {
      mid: '__EMPTY_1',
      final: '__EMPTY_2',
    },
  ],

  /* -------------------------------------------------------
     MFC
     ------------------------------------------------------- */

  MFC: [
    {
      mid: 'Midsem-Mark',
      final: 'Final-Mark',
    },
    {
      mid: 'Midsem-Mark_1',
      final: 'Final-Mark_1',
    },
    {
      mid: 'Midsem-Mark_2',
      final: 'Final-Mark_2',
    },
    {
      mid: 'Midsem-Mark_3',
      final: 'Final-Mark_3',
    },
    {
      mid: '__EMPTY_1',
      final: '__EMPTY_2',
    },
    {
      mid: '__EMPTY_4',
      final: '__EMPTY_5',
    },
    {
      mid: '__EMPTY_7',
      final: '__EMPTY_8',
    },
    {
      mid: '__EMPTY_10',
      final: '__EMPTY_11',
    },
  ],
};

export function getPgPaperSourceKeys(
  department: string,
  paperIndex: number,
  paperType?: string,
): {
  midsem?: string;
  endsem?: string;
  practical?: string;
} {
  const mapping =
    PG_FIELD_MAPPINGS[department]?.[paperIndex];

  if (!mapping) {
    return {};
  }

  if (paperType === 'practical') {
    const practical = mapping.practical ?? mapping.final;
    return practical ? { practical } : {};
  }

  return {
    ...(mapping.mid ? { midsem: mapping.mid } : {}),
    ...(mapping.final ? { endsem: mapping.final } : {}),
    ...(mapping.practical ? { practical: mapping.practical } : {}),
  };
}

/* =========================================================
   GET PAPER MARKS
   ========================================================= */

function getPaperMarks(
  student: any,
  department: string,
  paperIndex: number,
  paper: PaperConfig,
): {
  midsem: ParsedMark;
  final: ParsedMark;
} {
  /*
    1. Structured courses/papers/subjects array
  */
  const courseList = Array.isArray(student?.courses)
    ? student.courses
    : Array.isArray(student?.Papers)
    ? student.Papers
    : Array.isArray(student?.subjects)
    ? student.subjects
    : null;

  if (courseList && courseList.length > 0) {
    const paperCodeClean = String(paper.code || '')
      .trim()
      .toLowerCase();
    const paperTitleClean = String(paper.title || '')
      .trim()
      .toLowerCase();

    const found =
      courseList.find((c: any) => {
        const rawCode = String(
          c?.paper?.code || c?.code || c?.paper || c?.Paper || '',
        )
          .trim()
          .toLowerCase();
        const strippedCode = rawCode.replace(/^paper\s*[-:]?\s*/, '');
        if (
          rawCode === paperCodeClean ||
          strippedCode === paperCodeClean ||
          strippedCode === paperCodeClean.replace(/^paper\s*[-:]?\s*/, '')
        ) {
          return true;
        }

        const rawTitle = String(
          c?.paper?.title || c?.title || c?.subjectName || '',
        )
          .trim()
          .toLowerCase();
        if (
          rawTitle &&
          paperTitleClean &&
          (rawTitle === paperTitleClean ||
            paperTitleClean.includes(rawTitle) ||
            rawTitle.includes(paperTitleClean))
        ) {
          return true;
        }

        return false;
      }) ?? courseList[paperIndex];

    if (found) {
      if (paper.type === 'practical') {
        const practicalValue =
          found.practical ??
          found.practicalMark ??
          found.finalMark ??
          found.endsem ??
          found.FinalMark ??
          found['Final-Mark'] ??
          found.totalMark ??
          found.marks;

        return {
          midsem: { type: 'other' },
          final: parseMark(practicalValue),
        };
      }

      const midVal =
        found.midsemMark ??
        found.midsem ??
        found.MidsemMark ??
        found['Midsem-Mark'];
      const finalVal =
        found.finalMark ??
        found.endsem ??
        found.FinalMark ??
        found['Final-Mark'] ??
        found.marks;

      return {
        midsem: parseMark(midVal),
        final: parseMark(finalVal),
      };
    }
  }

  /*
    2. Structured subjects object (keyed by paper code or title)
  */
  if (
    student?.subjects &&
    typeof student.subjects === 'object' &&
    !Array.isArray(student.subjects)
  ) {
    const entry =
      student.subjects[paper.code] ??
      student.subjects[paper.title] ??
      student.subjects[`Paper ${paper.code}`];

    if (entry !== undefined && entry !== null) {
      if (typeof entry === 'number' || typeof entry === 'string') {
        return {
          midsem: { type: 'other' },
          final: parseMark(entry),
        };
      }

      if (paper.type === 'practical') {
        const practicalValue =
          entry.practical ??
          entry.practicalMark ??
          entry.finalMark ??
          entry.endsem ??
          entry.FinalMark ??
          entry['Final-Mark'] ??
          entry.totalMark ??
          entry.marks;

        return {
          midsem: { type: 'other' },
          final: parseMark(practicalValue),
        };
      }

      const midVal =
        entry.midsemMark ??
        entry.midsem ??
        entry.MidsemMark ??
        entry['Midsem-Mark'];
      const finalVal =
        entry.finalMark ??
        entry.endsem ??
        entry.FinalMark ??
        entry['Final-Mark'] ??
        entry.marks;

      return {
        midsem: parseMark(midVal),
        final: parseMark(finalVal),
      };
    }
  }

  /*
    3. Flat Excel column mappings
  */
  const mappings =
    PG_FIELD_MAPPINGS[department] ?? [];

  const mapping =
    mappings[paperIndex];

  if (!mapping) {
    return {
      midsem: { type: 'other' },
      final: { type: 'other' },
    };
  }

  /*
    Practical papers in the current Excel structure have
    their actual mark in the `practical` field.

    Theory papers use:
      mid + final
  */

  if (paper.type === 'practical') {
    const practicalKey =
      mapping.practical ?? mapping.final;

    const practicalValue =
      practicalKey
        ? student[practicalKey]
        : undefined;

    return {
      midsem: { type: 'other' },
      final: parseMark(practicalValue),
    };
  }

  return {
    midsem: parseMark(
      mapping.mid
        ? student[mapping.mid]
        : undefined,
    ),

    final: parseMark(
      mapping.final
        ? student[mapping.final]
        : undefined,
    ),
  };
}

/* =========================================================
   GRADE CALCULATION
   ========================================================= */

function getGrade(
  percentage: number,
  config: CourseConfig,
): {
  grade: string;
  gradePoint: number;
} {
  const rules = config.grading?.scale ?? [];

  for (const rule of rules) {
    if (
      percentage >= rule.minPercentage &&
      percentage <= rule.maxPercentage
    ) {
      return {
        grade: rule.grade,
        gradePoint: rule.gradePoint,
      };
    }
  }

  return {
    grade: 'F',
    gradePoint: 0,
  };
}

/* =========================================================
   PAPER CALCULATION
   ========================================================= */

function calculatePaper(
  student: any,
  department: string,
  paperIndex: number,
  paper: PaperConfig,
  config: CourseConfig,
): SubjectResult {
  const marks = getPaperMarks(
    student,
    department,
    paperIndex,
    paper,
  );

  /* -------------------------------------------------------
     ABSENT
     ------------------------------------------------------- */

  if (
    marks.final.type === 'absent' ||
    marks.midsem.type === 'absent'
  ) {
    return {
      paperCode: paper.code,
      subjectName: paper.title,
      category: paper.category,
      marks: 0,
      fullMark: paper.marks.fullMark,
      credit: paper.credit,
      grade: 'AB',
      gradePoint: 0,
      creditPoint: 0,
    };
  }

  /* -------------------------------------------------------
     MALPRACTICE
     ------------------------------------------------------- */

  if (
    marks.final.type === 'malpractice' ||
    marks.midsem.type === 'malpractice'
  ) {
    return {
      paperCode: paper.code,
      subjectName: paper.title,
      category: paper.category,
      marks: 0,
      fullMark: paper.marks.fullMark,
      credit: paper.credit,
      grade: 'M',
      gradePoint: 0,
      creditPoint: 0,
    };
  }

  /* -------------------------------------------------------
     FINAL MARK MUST BE NUMERIC
     ------------------------------------------------------- */

  if (marks.final.type !== 'number') {
    return {
      paperCode: paper.code,
      subjectName: paper.title,
      category: paper.category,
      marks: 0,
      fullMark: paper.marks.fullMark,
      credit: paper.credit,
      grade: 'F',
      gradePoint: 0,
      creditPoint: 0,
    };
  }

  const finalMark = marks.final.value;

  let total = 0;

  /* -------------------------------------------------------
     PRACTICAL
     ------------------------------------------------------- */

  if (paper.type === 'practical') {
    total = finalMark;
  }

  /* -------------------------------------------------------
     THEORY
     ------------------------------------------------------- */

  else {
    const midsem =
      marks.midsem.type === 'number'
        ? marks.midsem.value
        : 0;

    total = midsem + finalMark;
  }

  const fullMark = paper.marks.fullMark;

  const percentage =
    fullMark > 0
      ? (total / fullMark) * 100
      : 0;

  const gradeResult = getGrade(
    percentage,
    config,
  );

  const creditPoint =
    paper.credit * gradeResult.gradePoint;

  return {
    paperCode: paper.code,
    subjectName: paper.title,
    category: paper.category,
    marks: total,
    fullMark,
    credit: paper.credit,
    grade: gradeResult.grade,
    gradePoint: gradeResult.gradePoint,
    creditPoint,
  };
}

/* =========================================================
   STUDENT CALCULATION
   ========================================================= */

export function calculatePGStudent(
  student: any,
  config: CourseConfig,
): any {
  const department =
    getDepartment(student);

  const papers: PaperConfig[] =
    config.papers ?? [];

  if (papers.length === 0) {
    throw new Error(
      `No PG papers configured for department "${department}".`,
    );
  }

  const subjects: SubjectResult[] =
    papers.map(
      (
        paper: PaperConfig,
        paperIndex: number,
      ) =>
        calculatePaper(
          student,
          department,
          paperIndex,
          paper,
          config,
        ),
    );

  /* -------------------------------------------------------
     TOTAL CREDITS
     ------------------------------------------------------- */

  const totalCredits =
    subjects.reduce(
      (
        total: number,
        subject: SubjectResult,
      ) => total + subject.credit,
      0,
    );

  /* -------------------------------------------------------
     TOTAL CREDIT POINTS
     ------------------------------------------------------- */

  const totalCreditPoints =
    subjects.reduce(
      (
        total: number,
        subject: SubjectResult,
      ) => total + subject.creditPoint,
      0,
    );

  /* -------------------------------------------------------
     GRAND TOTAL
     ------------------------------------------------------- */

  const grandTotal =
    subjects.reduce(
      (
        total: number,
        subject: SubjectResult,
      ) => total + subject.marks,
      0,
    );

  /* -------------------------------------------------------
     TOTAL MAXIMUM MARKS
     ------------------------------------------------------- */

  const totalMaximumMarks =
    subjects.reduce(
      (
        total: number,
        subject: SubjectResult,
      ) => total + subject.fullMark,
      0,
    );

  /* -------------------------------------------------------
     SGPA & PERCENTAGE
     ------------------------------------------------------- */

  const round2 = (val: number) => Math.round(val * 100) / 100;

  const roundedGrandTotal = round2(grandTotal);
  const roundedCreditPoints = round2(totalCreditPoints);

  const sgpa =
    totalCredits > 0
      ? round2(roundedCreditPoints / totalCredits)
      : 0;

  /* -------------------------------------------------------
     SEMESTER PERCENTAGE
     ------------------------------------------------------- */

  const percentage =
    totalMaximumMarks > 0
      ? round2((roundedGrandTotal / totalMaximumMarks) * 100)
      : 0;

  /* -------------------------------------------------------
     FINAL RESULT
     ------------------------------------------------------- */

  return {
    student: {
      ...student,

      collegeRollNo:
        getCollegeRoll(student),

      autonomousRollNo:
        getAutonomousRoll(student),

      examCode:
        getExamCode(student),

      name:
        getStudentName(student),

      department,
    },

    subjects,

    grandTotal,

    totalMaximumMarks,

    totalCredits,

    totalCreditPoints,

    sgpa,

    percentage,
  };
}