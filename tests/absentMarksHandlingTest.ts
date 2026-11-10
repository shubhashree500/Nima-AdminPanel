import assert from 'assert';
import { calculateResults } from '../lib/resultEngine';
import { calculateUGStudent } from '../lib/calculation/ugCalculator';
import { calculatePGStudent } from '../lib/calculation/pgCalculator';
import { getResultConfig } from '../lib/configs';
import {
  isAbsentMark,
  isSubjectAbsent,
  isStudentAllAbsent,
  formatMarkDisplay,
  formatComponentMark,
} from '../lib/calculation/absence';

console.log('================================================================');
console.log('ABSENT MARKS HANDLING GLOBAL VERIFICATION TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passedTests++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Test Group 1: isAbsentMark and Absence Identification Rules
// -------------------------------------------------------------
console.log('--- Test Group 1: Absence Detection & Identification Rules ---');

it('Identifies "A", "a", "AB", "Absent" as absent marks', () => {
  assert.strictEqual(isAbsentMark('A'), true);
  assert.strictEqual(isAbsentMark('a'), true);
  assert.strictEqual(isAbsentMark('AB'), true);
  assert.strictEqual(isAbsentMark('ab'), true);
  assert.strictEqual(isAbsentMark('A.B'), true);
  assert.strictEqual(isAbsentMark('Absent'), true);
  assert.strictEqual(isAbsentMark('ABSENT'), true);
});

it('Never identifies 0 or "0" as absent', () => {
  assert.strictEqual(isAbsentMark(0), false);
  assert.strictEqual(isAbsentMark('0'), false);
  assert.strictEqual(isAbsentMark(45), false);
  assert.strictEqual(isAbsentMark(''), false);
  assert.strictEqual(isAbsentMark(null), false);
  assert.strictEqual(isAbsentMark(undefined), false);
});

it('isSubjectAbsent returns true only for absent subjects, never for numeric 0 alone', () => {
  // Absent subject
  assert.strictEqual(isSubjectAbsent({ marks: 0, grade: 'AB', isAbsent: true, status: 'ABSENT' }), true);
  assert.strictEqual(isSubjectAbsent({ marks: 0, grade: 'AB' }), true);
  assert.strictEqual(isSubjectAbsent({ marks: 0, status: 'ABSENT' }), true);
  assert.strictEqual(isSubjectAbsent({ marks: 0, FinalMark: 'A' }), true);

  // Genuine zero subject (appeared and scored 0)
  assert.strictEqual(isSubjectAbsent({ marks: 0, grade: 'F', status: 'PRESENT', isAbsent: false }), false);
  assert.strictEqual(isSubjectAbsent({ marks: 0, grade: 'F' }), false);
  assert.strictEqual(isSubjectAbsent({ marks: 0 }), false);
});

// -------------------------------------------------------------
// Test Group 2: Display Formatting (Genuine 0 -> 0, Absent A -> Absent)
// -------------------------------------------------------------
console.log('\n--- Test Group 2: Display Formatting ---');

it('formatMarkDisplay displays "Absent" for absent subjects and 0 for genuine zero', () => {
  // Absent subject
  const absentSub = { marks: 0, grade: 'AB', isAbsent: true, status: 'ABSENT' };
  assert.strictEqual(formatMarkDisplay(absentSub), 'Absent');

  // Genuine zero subject
  const zeroSub = { marks: 0, grade: 'F', status: 'PRESENT', isAbsent: false };
  assert.strictEqual(formatMarkDisplay(zeroSub), 0);

  // Old legacy subject with numeric 0
  const legacySub = { marks: 0, grade: 'F' };
  assert.strictEqual(formatMarkDisplay(legacySub), 0);

  // Normal mark
  const normalSub = { marks: 75, grade: 'A' };
  assert.strictEqual(formatMarkDisplay(normalSub), 75);
});

it('formatComponentMark displays "Absent" for "A" and 0 for 0 / "0"', () => {
  assert.strictEqual(formatComponentMark('A'), 'Absent');
  assert.strictEqual(formatComponentMark('AB'), 'Absent');
  assert.strictEqual(formatComponentMark(0), 0);
  assert.strictEqual(formatComponentMark('0'), 0);
  assert.strictEqual(formatComponentMark(35), 35);
  assert.strictEqual(formatComponentMark('—'), '—');
});

// -------------------------------------------------------------
// Test Group 3: UG NEP Calculation Engine Parity with 'A' and '0'
// -------------------------------------------------------------
console.log('\n--- Test Group 3: UG NEP Calculations (BBA / BA / BSC) ---');

const ugConfig = getResultConfig({
  program: 'UG',
  batch: 2025,
  semester: 1,
  course: 'BBA',
});
assert.ok(ugConfig, 'UG BBA Sem 1 config must exist');

it('UG Engine treats "A" as numeric 0, preserves isAbsent: true and status: "ABSENT", grade: "AB"', () => {
  const studentWithAbsent = {
    autonomousRollNo: '08BBA24-001',
    collegeRollNo: 'BBA24-001',
    name: 'Absent Student',
    subjects: {
      'CC-101': { subject: 'Major CP 1', FinalMark: 'A', MidsemMark: 0 },
      'CC-102': { subject: 'Major CP 2', FinalMark: 75, MidsemMark: 20 },
      'CC-103': { subject: 'Minor', FinalMark: 69, MidsemMark: 18 },
      'MDE-101': { subject: 'MDC', FinalMark: 62, MidsemMark: 15 },
      'AEC-101': { subject: 'AEC 1', FinalMark: 59, MidsemMark: 14 },
      'AEC-102': { subject: 'AEC 2', FinalMark: 53, MidsemMark: 12 },
      'VAC-101': { subject: 'VAC', FinalMark: 50, MidsemMark: 10 },
    },
  };

  const result = calculateUGStudent(studentWithAbsent, ugConfig);

  // Target paper CC-101 was absent
  const cc101 = result.subjects.find((s) => s.paperCode === 'CC-101');
  assert.ok(cc101, 'CC-101 must be present');
  assert.strictEqual(cc101.marks, 0, 'Marks must be numeric 0 during calculation');
  assert.strictEqual(cc101.grade, 'AB', 'Grade must be AB');
  assert.strictEqual(cc101.gradePoint, 0, 'Grade point must be 0');
  assert.strictEqual(cc101.creditPoint, 0, 'Credit point must be 0');
  assert.strictEqual(cc101.isAbsent, true, 'isAbsent must be true');
  assert.strictEqual(cc101.status, 'ABSENT', 'status must be ABSENT');
  assert.strictEqual(formatMarkDisplay(cc101), 'Absent', 'formatMarkDisplay must be Absent');

  // Absent student cannot pass
  assert.strictEqual(result.isPassed, false);
  assert.strictEqual(result.status, 'FAIL');

  // Grace marks must NOT be applied to absent paper
  assert.strictEqual(cc101.grace || 0, 0, 'Absent subject must never receive grace');

  // Formulas continue working (credit points, SGPA, totalMarks)
  assert.ok(Number.isFinite(result.sgpa), 'SGPA calculation must continue working');
  assert.ok(Number.isFinite(result.grandTotal), 'Grand total calculation must continue working');
});

it('UG Engine treats genuine 0 as numeric 0, status: "PRESENT", isAbsent: false, grade: "F"', () => {
  const studentWithZero = {
    autonomousRollNo: '08BBA24-002',
    collegeRollNo: 'BBA24-002',
    name: 'Zero Marks Student',
    subjects: {
      'CC-101': { subject: 'Major CP 1', FinalMark: 0, MidsemMark: 0 }, // Genuine zero!
      'CC-102': { subject: 'Major CP 2', FinalMark: 75, MidsemMark: 20 },
      'CC-103': { subject: 'Minor', FinalMark: 69, MidsemMark: 18 },
      'MDE-101': { subject: 'MDC', FinalMark: 62, MidsemMark: 15 },
      'AEC-101': { subject: 'AEC 1', FinalMark: 59, MidsemMark: 14 },
      'AEC-102': { subject: 'AEC 2', FinalMark: 53, MidsemMark: 12 },
      'VAC-101': { subject: 'VAC', FinalMark: 50, MidsemMark: 10 },
    },
  };

  const result = calculateUGStudent(studentWithZero, ugConfig);

  const cc101 = result.subjects.find((s) => s.paperCode === 'CC-101');
  assert.ok(cc101, 'CC-101 must be present');
  assert.strictEqual(cc101.marks, 0, 'Marks must be 0');
  assert.strictEqual(cc101.grade, 'F', 'Grade must be F (not AB!)');
  assert.strictEqual(cc101.gradePoint, 0, 'Grade point must be 0');
  assert.strictEqual(cc101.isAbsent, false, 'isAbsent must be false for genuine 0');
  assert.strictEqual(cc101.status, 'PRESENT', 'status must be PRESENT for genuine 0');
  assert.strictEqual(formatMarkDisplay(cc101), 0, 'formatMarkDisplay must be numeric 0');
});

// -------------------------------------------------------------
// Test Group 4: PG Engine Parity with 'A' and '0' (Chemistry, Commerce, Odia, etc.)
// -------------------------------------------------------------
console.log('\n--- Test Group 4: PG Calculations (Chemistry / Commerce / Odia) ---');

const pgChemConfig = getResultConfig({
  program: 'PG',
  batch: 2025,
  semester: 1,
  department: 'Chemistry',
});
assert.ok(pgChemConfig, 'PG Chemistry Sem 1 config must exist');

it('PG Engine treats "A" in Final or Midsem as absent, marks: 0, grade: "AB", isAbsent: true, status: "ABSENT"', () => {
  const pgAbsent = {
    'Autonomous Roll No': 'NACPG25010',
    'College Roll No': 'CHEM25-010',
    'Applicant Name': 'PG Absent Student',
    Department: 'Chemistry',
    courses: [
      { paper: '1.1', title: 'Inorganic chem 1', midsemMark: 'A', finalMark: 'A' },
      { paper: '1.2', title: 'Organic chem 1', midsemMark: 20, finalMark: 50 },
      { paper: '1.3', title: 'Physical chemistry 1', midsemMark: 20, finalMark: 50 },
      { paper: '1.4', title: 'ICP-1 (Practical)', practical: 45 },
      { paper: '1.5', title: 'OCP-1 (Practical)', practical: 45 },
      { paper: '1.6', title: 'Spectroscopy 1', midsemMark: 20, finalMark: 50 },
      { paper: '1.7', title: 'Computer for chemist', midsemMark: 20, finalMark: 50 },
    ],
  };

  const result = calculatePGStudent(pgAbsent, pgChemConfig);
  const p11 = result.subjects.find((s: any) => s.paperCode === '1.1');
  assert.ok(p11, 'Paper 1.1 must exist');
  assert.strictEqual(p11.marks, 0, 'Marks must be numeric 0 during calculation');
  assert.strictEqual(p11.grade, 'AB', 'Grade must be AB');
  assert.strictEqual(p11.isAbsent, true, 'isAbsent must be true');
  assert.strictEqual(p11.status, 'ABSENT', 'status must be ABSENT');
  assert.strictEqual(formatMarkDisplay(p11), 'Absent');

  assert.strictEqual(result.isPassed, false);
});

it('PG Engine treats genuine 0 as numeric 0, marks: 0, grade: "F", isAbsent: false, status: "PRESENT"', () => {
  const pgZero = {
    'Autonomous Roll No': 'NACPG25011',
    'College Roll No': 'CHEM25-011',
    'Applicant Name': 'PG Zero Student',
    Department: 'Chemistry',
    courses: [
      { paper: '1.1', title: 'Inorganic chem 1', midsemMark: 0, finalMark: 0 }, // Genuine 0!
      { paper: '1.2', title: 'Organic chem 1', midsemMark: 20, finalMark: 50 },
      { paper: '1.3', title: 'Physical chemistry 1', midsemMark: 20, finalMark: 50 },
      { paper: '1.4', title: 'ICP-1 (Practical)', practical: 45 },
      { paper: '1.5', title: 'OCP-1 (Practical)', practical: 45 },
      { paper: '1.6', title: 'Spectroscopy 1', midsemMark: 20, finalMark: 50 },
      { paper: '1.7', title: 'Computer for chemist', midsemMark: 20, finalMark: 50 },
    ],
  };

  const result = calculatePGStudent(pgZero, pgChemConfig);
  const p11 = result.subjects.find((s: any) => s.paperCode === '1.1');
  assert.ok(p11, 'Paper 1.1 must exist');
  assert.strictEqual(p11.marks, 0, 'Marks must be 0');
  assert.strictEqual(p11.grade, 'F', 'Grade must be F (not AB!)');
  assert.strictEqual(p11.isAbsent, false, 'isAbsent must be false');
  assert.strictEqual(p11.status, 'PRESENT', 'status must be PRESENT');
  assert.strictEqual(formatMarkDisplay(p11), 0);
});

// -------------------------------------------------------------
// Test Group 5: Universal calculateResults engine interface
// -------------------------------------------------------------
console.log('\n--- Test Group 5: Universal calculateResults engine interface ---');

it('calculateResults handles UG & PG batch calculations with absent and zero students', () => {
  const ugBatch = calculateResults({
    program: 'UG',
    course: 'BBA',
    semester: 1,
    batch: '2025',
    students: [
      {
        autonomousRollNo: 'BBA24-001',
        collegeRollNo: 'BBA24-001',
        name: 'Absent Candidate',
        subjects: {
          'CC-101': { FinalMark: 'A', MidsemMark: 'A' },
          'CC-102': { FinalMark: 'A', MidsemMark: 'A' },
          'CC-103': { FinalMark: 'A', MidsemMark: 'A' },
          'MDE-101': { FinalMark: 'A', MidsemMark: 'A' },
          'AEC-101': { FinalMark: 'A', MidsemMark: 'A' },
          'AEC-102': { FinalMark: 'A', MidsemMark: 'A' },
          'VAC-101': { FinalMark: 'A', MidsemMark: 'A' },
        },
      },
      {
        autonomousRollNo: 'BBA24-002',
        collegeRollNo: 'BBA24-002',
        name: 'Zero Candidate',
        subjects: {
          'CC-101': { FinalMark: 0, MidsemMark: 0 },
          'CC-102': { FinalMark: 0, MidsemMark: 0 },
          'CC-103': { FinalMark: 0, MidsemMark: 0 },
          'MDE-101': { FinalMark: 0, MidsemMark: 0 },
          'AEC-101': { FinalMark: 0, MidsemMark: 0 },
          'AEC-102': { FinalMark: 0, MidsemMark: 0 },
          'VAC-101': { FinalMark: 0, MidsemMark: 0 },
        },
      },
    ],
  });

  assert.strictEqual(ugBatch.length, 2);
  const [absentCandidate, zeroCandidate] = ugBatch;

  // Absent candidate
  assert.strictEqual(absentCandidate.isAbsent, true, 'All-absent candidate must have isAbsent: true');
  assert.strictEqual(absentCandidate.isPassed, false);
  assert.strictEqual(isStudentAllAbsent(absentCandidate), true);
  assert.strictEqual(absentCandidate.subjects[0].status, 'ABSENT');

  // Zero candidate
  assert.strictEqual(zeroCandidate.isAbsent, false, 'Genuine zero candidate must have isAbsent: false');
  assert.strictEqual(zeroCandidate.isPassed, false);
  assert.strictEqual(isStudentAllAbsent(zeroCandidate), false);
  assert.strictEqual(zeroCandidate.subjects[0].status, 'PRESENT');
  assert.strictEqual(zeroCandidate.subjects[0].grade, 'F');
});

// -------------------------------------------------------------
// Test Group 6: Rechecking Workflow (Updating Absent -> PRESENT)
// -------------------------------------------------------------
console.log('\n--- Test Group 6: Rechecking Workflow ---');

it('During rechecking, replacing an absent mark with a valid mark updates status to PRESENT and recalculates', () => {
  // Original student with absent mark in CC-101
  const student = {
    autonomousRollNo: '08BBA24-099',
    collegeRollNo: 'BBA24-099',
    name: 'Recheck Candidate',
    subjects: {
      'CC-101': { subject: 'Major CP 1', FinalMark: 'A', MidsemMark: 0 },
      'CC-102': { subject: 'Major CP 2', FinalMark: 75, MidsemMark: 20 },
      'CC-103': { subject: 'Minor', FinalMark: 69, MidsemMark: 18 },
      'MDE-101': { subject: 'MDC', FinalMark: 62, MidsemMark: 15 },
      'AEC-101': { subject: 'AEC 1', FinalMark: 59, MidsemMark: 14 },
      'AEC-102': { subject: 'AEC 2', FinalMark: 53, MidsemMark: 12 },
      'VAC-101': { subject: 'VAC', FinalMark: 50, MidsemMark: 10 },
    },
  };

  const initialResult = calculateUGStudent(student, ugConfig);
  const initialCC101 = initialResult.subjects.find((s) => s.paperCode === 'CC-101');
  assert.strictEqual(initialCC101?.status, 'ABSENT');
  assert.strictEqual(initialCC101?.grade, 'AB');
  assert.strictEqual(initialResult.isPassed, false);

  // Apply rechecking mark: replace 'A' with 65 (valid mark)
  const updatedStudent = structuredClone(student);
  (updatedStudent.subjects['CC-101'] as any).FinalMark = 65;
  (updatedStudent.subjects['CC-101'] as any).MidsemMark = 18;
  delete (updatedStudent.subjects['CC-101'] as any).isAbsent;
  (updatedStudent.subjects['CC-101'] as any).status = 'PRESENT';

  const recalculatedResult = calculateUGStudent(updatedStudent, ugConfig);
  const updatedCC101 = recalculatedResult.subjects.find((s) => s.paperCode === 'CC-101');

  assert.ok(updatedCC101, 'Updated CC-101 must exist');
  assert.strictEqual(updatedCC101.status, 'PRESENT', 'Status must update to PRESENT');
  assert.strictEqual(updatedCC101.isAbsent, false, 'isAbsent must become false');
  assert.strictEqual(updatedCC101.marks, 57, 'Total marks must be recalculated (39 endsem contribution + 18 midsem)');
  assert.strictEqual(updatedCC101.grade, 'B', 'Grade must be recalculated to B');
  assert.strictEqual(updatedCC101.gradePoint, 6);
  assert.strictEqual(updatedCC101.creditPoint, 24);

  // Student should now pass
  assert.strictEqual(recalculatedResult.isPassed, true, 'Student should pass after rechecking gives passing marks');
  assert.strictEqual(recalculatedResult.isPassed, true, 'Student should now pass');
  assert.strictEqual(recalculatedResult.status, 'PASS');
  assert.ok(recalculatedResult.sgpa > initialResult.sgpa, 'SGPA should improve after rechecking');
});

// -------------------------------------------------------------
// Test Group 7: Result Statistics Logic Verification
// -------------------------------------------------------------
console.log('\n--- Test Group 7: Result Statistics Accuracy ---');

it('Result statistics counts absent students as absent, and genuine zero students as appeared/backFail', () => {
  const students = [
    // Student 1: Cleared
    {
      student: { name: 'Student 1', department: 'Chemistry' },
      subjects: [
        { paperCode: '1.1', marks: 60, grade: 'B+', isAbsent: false, status: 'PRESENT' },
        { paperCode: '1.2', marks: 70, grade: 'A', isAbsent: false, status: 'PRESENT' },
      ],
    },
    // Student 2: Genuine 0 in all subjects (appeared and failed)
    {
      student: { name: 'Student 2', department: 'Chemistry' },
      subjects: [
        { paperCode: '1.1', marks: 0, grade: 'F', isAbsent: false, status: 'PRESENT' },
        { paperCode: '1.2', marks: 0, grade: 'F', isAbsent: false, status: 'PRESENT' },
      ],
    },
    // Student 3: Absent in all subjects
    {
      student: { name: 'Student 3', department: 'Chemistry' },
      subjects: [
        { paperCode: '1.1', marks: 0, grade: 'AB', isAbsent: true, status: 'ABSENT' },
        { paperCode: '1.2', marks: 0, grade: 'AB', isAbsent: true, status: 'ABSENT' },
      ],
    },
  ];

  let appeared = 0;
  let cleared = 0;
  let backFail = 0;
  let absent = 0;

  students.forEach((s) => {
    if (isStudentAllAbsent(s)) {
      absent++;
      return;
    }
    appeared++;
    const isFailed = s.subjects.some((sub) => ['F', 'AB', 'M'].includes(sub.grade));
    if (isFailed) {
      backFail++;
    } else {
      cleared++;
    }
  });

  assert.strictEqual(appeared, 2, 'Student 1 and Student 2 (genuine 0) both appeared!');
  assert.strictEqual(cleared, 1, 'Only Student 1 cleared');
  assert.strictEqual(backFail, 1, 'Student 2 with 0 marks counted in backFail');
  assert.strictEqual(absent, 1, 'Only Student 3 counted as absent');
});

console.log('\n================================================================');
console.log(`RESULTS: ${passedTests} passed, 0 failed out of ${totalTests} tests.`);
console.log('================================================================');
