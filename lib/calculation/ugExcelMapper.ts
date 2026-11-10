import { isValidStudentRecord } from '@/lib/studentValidation';

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
  explicitCourse?: string,
  explicitBatch?: string | number,
  department?: string,
): UGDetectedInfo | null {
  const roll = String(rollNo ?? '')
    .trim()
    .toUpperCase();

  const isInvalidRoll =
    !roll ||
    roll === '-' ||
    roll === '—' ||
    roll === 'ROLL NO' ||
    roll === 'ROLL NO.' ||
    roll === 'ROLL NUMBER' ||
    roll === 'AUTONOMOUS ROLL NO' ||
    roll === 'AUTONOMOUS ROLL NO.' ||
    roll === 'COLLEGE ROLL NO' ||
    roll === 'COLLEGE ROLL NO.';

  if (isInvalidRoll) {
    return null;
  }

  const c = String(explicitCourse ?? '').trim().toUpperCase();
  const b = Number(explicitBatch) || 2024;
  if (c === 'BCA' || c === 'BBA' || c === 'BA' || c === 'BSC' || c === 'BCOM') {
    return { course: c as UGCourse, batch: b };
  }

  // Try extracting 2-digit batch year from roll (e.g. BA24-001 -> 2024, 01NAC25001 -> 2025)
  let detectedBatch = b;
  const yearMatch = roll.match(/(?:BA|BS|BC|BCA|BBA|NAC|UG)[_-]?(\d{2})/i) || roll.match(/(\d{2})NAC/i);
  if (yearMatch && yearMatch[1]) {
    const yr = Number(yearMatch[1]);
    if (yr >= 20 && yr <= 35) {
      detectedBatch = 2000 + yr;
    }
  }

  if (roll) {
    // Check longer prefixes first.
    if (roll.startsWith('BCA')) {
      return { course: 'BCA', batch: detectedBatch };
    }

    if (roll.startsWith('BBA')) {
      return { course: 'BBA', batch: detectedBatch };
    }

    if (roll.startsWith('BA')) {
      return { course: 'BA', batch: detectedBatch };
    }

    if (roll.startsWith('BS') || roll.startsWith('BSC')) {
      return { course: 'BSC', batch: detectedBatch };
    }

    if (roll.startsWith('BC') || roll.startsWith('BCOM')) {
      return { course: 'BCOM', batch: detectedBatch };
    }

    // Check embedded course tokens (e.g. NAC-BA-24-001 or 24BA001)
    if (/\bBCA\b|BCA\d/i.test(roll)) return { course: 'BCA', batch: detectedBatch };
    if (/\bBBA\b|BBA\d/i.test(roll)) return { course: 'BBA', batch: detectedBatch };
    if (/\bBSC\b|BSC\d/i.test(roll)) return { course: 'BSC', batch: detectedBatch };
    if (/\bBCOM\b|BCOM\d/i.test(roll)) return { course: 'BCOM', batch: detectedBatch };
    if (/\bBA\b|BA\d/i.test(roll)) return { course: 'BA', batch: detectedBatch };
  }

  // Fallback: Infer course from Department name
  const dept = String(department ?? '').trim().toLowerCase();
  if (dept && dept !== 'all' && dept !== 'auto') {
    if (dept.includes('bba') || dept.includes('business')) {
      return { course: 'BBA', batch: detectedBatch };
    }
    if (dept.includes('bca') || dept.includes('computer application')) {
      return { course: 'BCA', batch: detectedBatch };
    }
    if (dept.includes('commerce') || dept.includes('com') || dept.includes('accounting') || dept.includes('finance')) {
      return { course: 'BCOM', batch: detectedBatch };
    }
    if (
      dept.includes('botany') ||
      dept.includes('chem') ||
      dept.includes('phys') ||
      dept.includes('math') ||
      dept.includes('geo') ||
      dept.includes('zool') ||
      dept.includes('science') ||
      dept.includes('comp')
    ) {
      return { course: 'BSC', batch: detectedBatch };
    }
    if (
      dept.includes('odia') ||
      dept.includes('hist') ||
      dept.includes('pol') ||
      dept.includes('econ') ||
      dept.includes('edu') ||
      dept.includes('eng') ||
      dept.includes('sans') ||
      dept.includes('hindi') ||
      dept.includes('phil') ||
      dept.includes('psych') ||
      dept.includes('soci') ||
      dept.includes('arts')
    ) {
      return { course: 'BA', batch: detectedBatch };
    }
  }

  // If roll exists, default to BSC instead of failing
  if (roll.length > 0) {
    return { course: 'BSC', batch: detectedBatch };
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
      row?.[key] !== null &&
      String(row[key]).trim() !== ''
    ) {
      return row[key];
    }
  }

  return '';
}

const DIRECT_FIELD_VARIANTS: Record<string, string[]> = {
  MidsemMark: [
    'MidsemMark',
    'Midsem-Mark',
    'Midsem Mark',
    'Midsem_Mark',
    'MidSemMark',
    'Midsem',
    'MID',
    'Mid',
    'idsem-Ma',
    'idsem-Mark',
    'idsem',
  ],
  FinalMark: [
    'FinalMark',
    'Final-Mark',
    'Final Mark',
    'Final_Mark',
    'Final',
    'EndsemMark',
    'Endsem-Mark',
    'Endsem Mark',
    'Endsem_Mark',
    'Endsem',
    'End-Sem',
    'End',
    'END',
  ],
  PracticalMark: [
    'PracticalMark',
    'Practical-Mark',
    'Practical Mark',
    'Practical_Mark',
    'Practical',
    'PRAC',
  ],
  'I-Practical': [
    'I-Practical',
    'IPractical',
    'InternalPractical',
    'Internal-Practical',
    'I Practical',
    'I_Practical',
  ],
  Attandance: [
    'Attandance',
    'Attendance',
    'Attandance-Mark',
    'Attendance-Mark',
    'Attandance Mark',
    'Attendance Mark',
  ],
  SurpriseTest: [
    'SurpriseTest',
    'Surprise-Test',
    'Surprise Test',
    'Surprise_Test',
    'Surprise',
  ],
  Assignment: [
    'Assignment',
    'Assignment-Mark',
    'Assignment Mark',
    'Assignment_Mark',
  ],
};

function normalizeFieldKey(key: string): string {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-_\s.]/g, '');
}

const FIELD_PATTERNS: Record<string, (k: string) => boolean> = {
  MidsemMark: (k) =>
    k.startsWith('midsem') ||
    k.startsWith('midmark') ||
    k.startsWith('idsem') ||
    k.startsWith('idsemma') ||
    k === 'mid',
  FinalMark: (k) =>
    k.startsWith('finalmark') ||
    k.startsWith('final') ||
    k.startsWith('endsem') ||
    k.startsWith('endmark') ||
    k === 'end',
  PracticalMark: (k) =>
    (k.startsWith('practical') || k.startsWith('prac')) &&
    !k.startsWith('ipractical') &&
    !k.startsWith('internalpractical'),
  'I-Practical': (k) =>
    k.startsWith('ipractical') || k.startsWith('internalpractical'),
  Attandance: (k) =>
    k.startsWith('attandance') || k.startsWith('attendance'),
  SurpriseTest: (k) =>
    k.startsWith('surprisetest') || k.startsWith('surprise'),
  Assignment: (k) =>
    k.startsWith('assignment'),
};

/**
 * Reads repeated Excel headers supporting standard keys,
 * hyphenated keys (Midsem-Mark), spaced keys, and positional occurrences.
 */
export function getRepeatedValue(
  row: any,
  field: string,
  index: number,
): any {
  if (!row || typeof row !== 'object') return '';

  // 1. Direct standard key (e.g. MidsemMark or MidsemMark_1)
  const standardKey = index === 0 ? field : `${field}_${index}`;
  if (
    row[standardKey] !== undefined &&
    row[standardKey] !== null &&
    String(row[standardKey]).trim() !== ''
  ) {
    return row[standardKey];
  }

  // 2. Direct variants with index suffix (e.g. Midsem-Mark, Midsem-Mark_1, Final-Mark, Final-Mark_1)
  const variants = DIRECT_FIELD_VARIANTS[field] || [];
  for (const v of variants) {
    const k = index === 0 ? v : `${v}_${index}`;
    if (
      row[k] !== undefined &&
      row[k] !== null &&
      String(row[k]).trim() !== ''
    ) {
      return row[k];
    }
  }

  // 3. Dynamic scan across row keys using normalized matching
  const matcher = FIELD_PATTERNS[field];
  if (matcher) {
    const rowKeys = Object.keys(row);

    // Look for a key ending in _${index} whose base matches matcher
    if (index > 0) {
      const indexedKey = rowKeys.find((k) => {
        if (!k.endsWith(`_${index}`)) return false;
        const base = k.slice(0, -(index.toString().length + 1));
        return matcher(normalizeFieldKey(base));
      });
      if (
        indexedKey &&
        row[indexedKey] !== undefined &&
        row[indexedKey] !== null &&
        String(row[indexedKey]).trim() !== ''
      ) {
        return row[indexedKey];
      }
    } else {
      // index === 0: look for key without any _\d+ suffix or with _0
      const zeroKey = rowKeys.find((k) => {
        if (/_0$/.test(k)) {
          const base = k.slice(0, -2);
          return matcher(normalizeFieldKey(base));
        }
        if (/_([1-9]\d*)$/.test(k)) return false;
        return matcher(normalizeFieldKey(k));
      });
      if (
        zeroKey &&
        row[zeroKey] !== undefined &&
        row[zeroKey] !== null &&
        String(row[zeroKey]).trim() !== ''
      ) {
        return row[zeroKey];
      }
    }

    // 4. Positional fallback: collect all keys matching this field in order
    const matchingKeys = rowKeys.filter((k) => {
      const base = k.replace(/_\d+$/, '');
      return matcher(normalizeFieldKey(base));
    });

    if (matchingKeys[index] !== undefined) {
      const val = row[matchingKeys[index]];
      if (
        val !== undefined &&
        val !== null &&
        String(val).trim() !== ''
      ) {
        return val;
      }
    }
  }

  return '';
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
  if (!isValidStudentRecord(row)) {
    throw new Error('Blank or invalid student row');
  }
  const rollNo = getValue(row, [
    'Roll No',
    'Roll No.',
    'rollNo',
    'College Roll No',
    'College Roll No.',
    'collegeRollNo',
    'Autonomous Roll No',
    'Autonomous Roll No.',
    'autonomousRollNo',
    'r',
    '__EMPTY',
  ]);

  const department = getValue(row, [
    'Department',
    'department',
    'Department Name',
    'department name',
  ]);

  const detected = detectUGCourse(rollNo, row?.course, row?.batch, department);

  if (!detected) {
    throw new Error(
      `Unable to detect UG course from Roll No: ${rollNo}`,
    );
  }

  const autonomousRollNo = getValue(row, [
    'Autonomous Roll No',
    'Autonomous Roll No.',
    'autonomousRollNo',
    'r',
  ]);

  let collegeRollNo = getValue(row, [
    'College Roll No',
    'College Roll No.',
    'collegeRollNo',
    'Roll No',
    'Roll No.',
    'rollNo',
  ]);

  if (!collegeRollNo && row?.__EMPTY && !/^\s*$/.test(String(row.__EMPTY))) {
    collegeRollNo = String(row.__EMPTY).trim();
  }

  const studentName = getValue(row, [
    'Name of the Students',
    'Student Name',
    'Name',
    'Applicant Name',
    'name',
    'studentName',
  ]);

  const student = {
    'Roll No': rollNo,
    rollNo,
    'College Roll No': collegeRollNo,
    collegeRollNo,

    'Autonomous Roll No': autonomousRollNo,
    autonomousRollNo,

    Examcode: getValue(row, [
      'Examcode',
      'Exam Code',
      'examcode',
      'examCode',
    ]),

    'Name of the Students': studentName,
    name: studentName,

    Department: department,
    department: department,

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
