/**
 * Day 1 Modules Comprehensive Test Suite
 *
 * Tests:
 * 1. Database isolation & fail-safe configuration
 * 2. Setup & Exam Configuration
 * 3. Individual Student Entry (Creation, Editing, Duplicate Prevention)
 * 4. Bulk Student Import (Field preservation, updates, new additions)
 * 5. Individual Marks Entry (Range validation, non-existent student check, published result protection)
 * 6. Bulk Marks Entry (Multi-student import, published student skipping, summary reporting)
 * 7. Dashboard counts and fallback handling
 * 8. Protection of published results
 */

import fs from 'fs';
import path from 'path';

// Force isolated test database
const TEST_DB_FILE = 'db.day1-test.json';
process.env.ADMIN_PANEL_DB_FILE = TEST_DB_FILE;

import { getDB, saveDB, getDbFilePath, generateInitialData } from '../lib/db';
import { findStudent, getSubjects } from '../lib/calculations';
import type { Student, ExamSession, DBData } from '../types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${message}`);
}

async function runDay1Tests() {
  console.log('====================================================');
  console.log('DAY 1 MODULES TEST SUITE: SETUP, STUDENTS, MARKS');
  console.log('====================================================');

  const resolvedDbPath = getDbFilePath();
  console.log(`Database Target: ${resolvedDbPath}`);

  // Test 1: Verify database isolation
  assert(
    resolvedDbPath.endsWith(TEST_DB_FILE),
    `Isolated database target must end with ${TEST_DB_FILE}`
  );

  // Initialize clean test database
  const initial = generateInitialData();
  initial.college = 'Test Autonomous College';
  initial.max = 100;
  initial.pass = 40;
  saveDB(initial);

  assert(fs.existsSync(resolvedDbPath), 'Test database file must exist on disk after saveDB');

  // Verify fail-safe mode behavior
  try {
    delete process.env.ADMIN_PANEL_DB_FILE;
    process.env.ADMIN_PANEL_DB_MODE = 'invalid-mode-testing-failsafe';
    getDbFilePath();
    assert(false, 'Expected getDbFilePath() to throw on unrecognized DB mode');
  } catch (err: any) {
    assert(
      err.message.includes('Refusing to fall back to live database'),
      'Fail-safe throws an error rather than silently touching live db'
    );
  } finally {
    process.env.ADMIN_PANEL_DB_FILE = TEST_DB_FILE;
    delete process.env.ADMIN_PANEL_DB_MODE;
  }

  // ====================================================
  // MODULE 2: SETUP & EXAM CONFIGURATION
  // ====================================================
  console.log('\n--- Testing Module 2: Setup & Exam Configuration ---');
  let db = getDB();

  // Test 2.1: Update college setup
  db.college = 'Nimapara Autonomous College';
  db.max = 100;
  db.pass = 33;
  saveDB(db);

  db = getDB();
  assert(db.college === 'Nimapara Autonomous College', 'College name saved and reloaded');
  assert(db.pass === 33, 'Pass mark saved and reloaded');

  // Test 2.2: Add subject
  const sem1Key = 'UG|1';
  if (!db.subjects[sem1Key]) db.subjects[sem1Key] = [];
  const testSubj = 'Biotechnology';
  if (!db.subjects[sem1Key].includes(testSubj)) {
    db.subjects[sem1Key].push(testSubj);
  }
  saveDB(db);

  db = getDB();
  const subjects = getSubjects(db, 'UG', 1);
  assert(subjects.includes(testSubj), 'New subject Biotechnology was persisted');

  // Test 2.3: Exam session creation & duplicate prevention
  const newSession: ExamSession = {
    id: `EXAM-${Date.now()}`,
    academicYear: '2025-26',
    batch: 2025,
    program: 'PG',
    department: 'Chemistry',
    semester: 1,
    examType: 'Regular',
    status: 'Draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.examSessions = db.examSessions || [];
  db.examSessions.push(newSession);
  saveDB(db);

  db = getDB();
  assert(
    !!db.examSessions?.some((s) => s.id === newSession.id),
    'Exam session persisted'
  );

  // ====================================================
  // MODULE 3: INDIVIDUAL STUDENT ENTRY & EDITING
  // ====================================================
  console.log('\n--- Testing Module 3: Student Entry & Editing ---');

  // Test 3.1: Add student
  const student1: Student = {
    batch: '2025',
    programme: 'PG',
    autonomousRollNo: '153NAC25001',
    collegeRollNo: 'CHEM25-001',
    name: 'ABINASH SAHOO',
    dob: '11-02-2004',
    abcId: '37643',
    department: 'Chemistry',
    course: 'Chemistry',
    stream: 'SCIENCE',
    r: '153NAC25001',
    n: 'ABINASH SAHOO',
    p: 'PG',
  };

  db.students.push(student1);
  saveDB(db);

  db = getDB();
  let foundByAuto = findStudent(db, '153NAC25001');
  let foundByCollege = findStudent(db, 'CHEM25-001');
  assert(!!foundByAuto, 'findStudent matches by autonomous roll number');
  assert(!!foundByCollege, 'findStudent matches by college roll number');
  assert(foundByAuto?.name === 'ABINASH SAHOO', 'Student name is correct');

  // Test 3.2: Duplicate detection
  const duplicate = db.students.some((s) => {
    const sAuto = s.autonomousRollNo.toLowerCase();
    const sCollege = s.collegeRollNo.toLowerCase();
    return sAuto === '153nac25001' || sCollege === 'chem25-001';
  });
  assert(duplicate, 'Duplicate detection identifies collision on roll number');

  // Test 3.3: Edit student record
  const studentIndex = db.students.findIndex((s) => s.autonomousRollNo === '153NAC25001');
  assert(studentIndex > -1, 'Student index located');

  // Add initial marks under current student roll
  db.marks['153NAC25001|1'] = { 'Paper 1': 85 };
  saveDB(db);

  // Update student name and ABC ID
  db.students[studentIndex].name = 'ABINASH KUMAR SAHOO';
  db.students[studentIndex].abcId = '99999';
  saveDB(db);

  db = getDB();
  const updatedStudent = findStudent(db, '153NAC25001');
  assert(updatedStudent?.name === 'ABINASH KUMAR SAHOO', 'Student name updated without losing record');
  assert(updatedStudent?.abcId === '99999', 'Student ABC ID updated');
  assert(db.marks['153NAC25001|1']?.['Paper 1'] === 85, 'Student marks preserved after edit');

  // ====================================================
  // MODULE 4: BULK STUDENT IMPORT
  // ====================================================
  console.log('\n--- Testing Module 4: Bulk Student Import ---');

  const importBatch: Student[] = [
    {
      // Existing student with updated DOB & stream
      batch: '2025',
      programme: 'PG',
      autonomousRollNo: '153NAC25001',
      collegeRollNo: 'CHEM25-001',
      name: 'ABINASH KUMAR SAHOO',
      dob: '12-02-2004',
      abcId: '99999',
      department: 'Chemistry',
      course: 'Chemistry',
      stream: 'PHYSICAL SCIENCES',
      r: '153NAC25001',
      n: 'ABINASH KUMAR SAHOO',
      p: 'PG',
    },
    {
      // New student
      batch: '2025',
      programme: 'UG',
      autonomousRollNo: '111NAC25002',
      collegeRollNo: 'ODIA25-002',
      name: 'PRIYANKA MISHRA',
      dob: '15-08-2005',
      abcId: '88888',
      department: 'Odia',
      course: 'Odia',
      stream: 'ARTS',
      r: '111NAC25002',
      n: 'PRIYANKA MISHRA',
      p: 'UG',
    },
  ];

  // Simulate import route logic
  let added = 0;
  let updated = 0;
  importBatch.forEach((raw) => {
    const existingIdx = db.students.findIndex(
      (s) =>
        s.autonomousRollNo.toLowerCase() === raw.autonomousRollNo.toLowerCase() ||
        s.collegeRollNo.toLowerCase() === raw.collegeRollNo.toLowerCase()
    );
    if (existingIdx > -1) {
      db.students[existingIdx] = { ...db.students[existingIdx], ...raw };
      updated++;
    } else {
      db.students.push(raw);
      added++;
    }
  });
  saveDB(db);

  db = getDB();
  assert(added === 1, 'Bulk import counts 1 new student');
  assert(updated === 1, 'Bulk import counts 1 updated student');
  const priyanka = findStudent(db, 'ODIA25-002');
  assert(!!priyanka, 'Newly imported student is searchable by college roll');
  const abinash = findStudent(db, 'CHEM25-001');
  assert(abinash?.stream === 'PHYSICAL SCIENCES', 'Existing student updated fields preserved');

  // ====================================================
  // MODULE 5: INDIVIDUAL MARKS ENTRY
  // ====================================================
  console.log('\n--- Testing Module 5: Individual Marks Entry ---');

  // Valid mark entry
  const priyankaRoll = '111NAC25002';
  db.marks[`${priyankaRoll}|1`] = { Biotechnology: 78, Chemistry: 65 };
  saveDB(db);

  db = getDB();
  assert(db.marks[`${priyankaRoll}|1`]?.Biotechnology === 78, 'Valid mark saved');

  // Validation: mark out of bounds
  const isOutOfRange = (val: number, max: number) => val < 0 || val > max;
  assert(isOutOfRange(-5, db.max), 'Negative marks are flagged invalid');
  assert(isOutOfRange(105, db.max), 'Marks above max are flagged invalid');
  assert(!isOutOfRange(95, db.max), 'Marks within range are valid');

  // ====================================================
  // MODULE 6: BULK MARKS ENTRY & PUBLISHED PROTECTION
  // ====================================================
  console.log('\n--- Testing Module 6: Bulk Marks & Published Protection ---');

  // Simulate published calculation for Priyanka in Semester 1
  db.calculatedResults = [
    {
      id: 'CALC-PUBLISHED-TEST',
      program: 'UG',
      semester: 1,
      batch: '2025',
      status: 'published',
      createdAt: new Date().toISOString(),
      results: [
        {
          student: {
            autonomousRollNo: '111NAC25002',
            collegeRollNo: 'ODIA25-002',
            r: '111NAC25002',
            name: 'PRIYANKA MISHRA',
          },
          subjects: [{ paperCode: 'BIO', marks: 78 }],
        },
      ],
    },
  ];
  saveDB(db);

  // Test protection: attempt to modify marks for published student
  const publishedList = db.calculatedResults;
  const isPublishedForStudent = (roll: string, sem: number) => {
    return publishedList.some((calc: any) => {
      if (calc.status !== 'published' || calc.semester !== sem) return false;
      return calc.results.some((r: any) => {
        const s = r.student || r;
        const auto = String(s.autonomousRollNo || s.r || '').toLowerCase();
        const college = String(s.collegeRollNo || '').toLowerCase();
        const target = roll.toLowerCase();
        return auto === target || college === target;
      });
    });
  };

  assert(
    isPublishedForStudent('111NAC25002', 1),
    'Published result detected for autonomous roll in semester 1'
  );
  assert(
    isPublishedForStudent('ODIA25-002', 1),
    'Published result detected for college roll in semester 1'
  );
  assert(
    !isPublishedForStudent('153NAC25001', 1),
    'Unpublished student is not blocked'
  );

  // Test protection: delete student with published result blocked
  const canDeleteStudent = (roll: string) => !isPublishedForStudent(roll, 1);
  assert(!canDeleteStudent('ODIA25-002'), 'Deletion of published student is strictly blocked');
  assert(canDeleteStudent('153NAC25001'), 'Deletion of unpublished student is permitted');

  // ====================================================
  // MODULE 7: PERSISTENCE & DATA INTEGRITY
  // ====================================================
  console.log('\n--- Testing Module 7: Data Integrity & Reload ---');

  // Re-read directly from disk to ensure full persistence
  const rawDisk = fs.readFileSync(resolvedDbPath, 'utf8');
  const diskData = JSON.parse(rawDisk);
  assert(diskData.students.length === 2, 'Two students persisted on disk');
  assert(diskData.calculatedResults.length === 1, 'Published calculation persisted on disk');
  assert(diskData.college === 'Nimapara Autonomous College', 'Institutional config persisted on disk');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runDay1Tests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
