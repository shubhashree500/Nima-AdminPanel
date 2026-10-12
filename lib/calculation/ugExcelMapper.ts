
type UGCourse =
  | 'BA'
  | 'BSC'
  | 'BCOM'
  | 'BCA'
  | 'BBA';

type UGDetectedInfo = {
  course: UGCourse;
  batch: number;
};

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

// =====================================================
// PRACTICAL DETECTION
// =====================================================

export function isPracticalSubject(
  subjectName?: string,
): boolean {
  if (!subjectName) {
    return false;
  }

  const value = String(subjectName)
    .trim()
    .toLowerCase();

  return PRACTICAL_SUBJECTS.some(
    (name) =>
      name.trim().toLowerCase() === value,
  );
}

// =====================================================
// COURSE DETECTION
// =====================================================

export function detectUGCourse(
  rollNo: unknown,
): UGDetectedInfo | null {
  const roll = String(rollNo ?? '')
    .trim()
    .toUpperCase();

  if (!roll) {
    return null;
  }

  // Check longer prefixes first.
  if (roll.startsWith('BCA24')) {
    return { course: 'BCA', batch: 2024 };
  }

  if (roll.startsWith('BBA24')) {
    return { course: 'BBA', batch: 2024 };
  }

  if (roll.startsWith('BA24')) {
    return { course: 'BA', batch: 2024 };
  }

  if (roll.startsWith('BS24')) {
    return { course: 'BSC', batch: 2024 };
  }

  if (roll.startsWith('BC24')) {
    return { course: 'BCOM', batch: 2024 };
  }

  return null;
}

// =====================================================
// EXCEL HELPERS
// =====================================================

function getValue(
  row: any,
  keys: string[],
): any {
  for (const key of keys) {
    if (
      row?.[key] !== undefined &&
      row?.[key] !== null
    ) {
      return row[key];
    }
  }

  return '';
}

/**
 * Reads the exact repeated Excel headers.
 *
 * Index 0 -> MidsemMark
 * Index 1 -> MidsemMark_1
 * Index 2 -> MidsemMark_2
 * Index 3 -> MidsemMark_3
 * Index 4 -> MidsemMark_4
 */
function getRepeatedValue(
  row: any,
  field: string,
  index: number,
): any {
  const key =
    index === 0
      ? field
      : `${field}_${index}`;

  return row?.[key] ?? '';
}

// =====================================================
// SUBJECT CREATION
// =====================================================

function createSubject(
  row: any,
  paperCode: string,
  subjectName: string,
  occurrence: number,
) {
  return {
    code: paperCode,
    paperCode,
    subject: subjectName,

    MidsemMark: getRepeatedValue(
      row,
      'MidsemMark',
      occurrence,
    ),

    PracticalMark: getRepeatedValue(
      row,
      'PracticalMark',
      occurrence,
    ),

    'I-Practical': getRepeatedValue(
      row,
      'I-Practical',
      occurrence,
    ),

    Attandance: getRepeatedValue(
      row,
      'Attandance',
      occurrence,
    ),

    SurpriseTest: getRepeatedValue(
      row,
      'SurpriseTest',
      occurrence,
    ),

    Assignment: getRepeatedValue(
      row,
      'Assignment',
      occurrence,
    ),

    FinalMark: getRepeatedValue(
      row,
      'FinalMark',
      occurrence,
    ),

    // This checks the supplied subject name.
    // Paper labels alone do not identify practicals.
    isPractical: isPracticalSubject(subjectName),
  };
}

// =====================================================
// MAP ONE UG EXCEL ROW
// =====================================================

export function mapUGExcelStudent(
  row: any,
) {
  const rollNo = getValue(row, [
    'Roll No',
    'Roll No.',
    'rollNo',
  ]);

  const detected = detectUGCourse(rollNo);

  if (!detected) {
    throw new Error(
      `Unable to detect UG course from Roll No: ${rollNo}`,
    );
  }

  const department = getValue(row, [
    'Department',
    'department',
  ]);

  const student = {
    'Roll No': rollNo,

    'Autonomous Roll No': getValue(row, [
      'Autonomous Roll No',
      'Autonomous Roll No.',
    ]),

    Examcode: getValue(row, [
      'Examcode',
      'Exam Code',
    ]),

    'Name of the Students': getValue(row, [
      'Name of the Students',
      'Student Name',
      'Name',
    ]),

    Department: department,

    course: detected.course,
    batch: detected.batch,

    subjects: {
      'Major-CP-5': createSubject(
  row,
  'Major-CP-5',
  String(department || 'Major-CP-5'),
  0,
),

'Major-CP-6': createSubject(
  row,
  'Major-CP-6',
  String(department || 'Major-CP-6'),
  1,
),

'Major-CP-7': createSubject(
  row,
  'Major-CP-7',
  String(department || 'Major-CP-7'),
  2,
),

      'MINOR-3': createSubject(
        row,
        'MINOR-3',
        'MINOR-3',
        3,
      ),

      'Multidisciplinary-1': createSubject(
        row,
        'Multidisciplinary-1',
        'Multidisciplinary-1',
        4,
      ),

      'VAC-2': {
        code: 'VAC-2',
        paperCode: 'VAC-2',
        subject: 'VAC-2',

        MidsemMark: '',
        PracticalMark: '',
        'I-Practical': '',
        Attandance: '',
        SurpriseTest: '',
        Assignment: '',

        FinalMark: getRepeatedValue(
          row,
          'FinalMark',
          5,
        ),

        isPractical: false,
      },
    },

    // Retain the original row for troubleshooting.
    rawExcelRow: row,
  };

  return student;
}