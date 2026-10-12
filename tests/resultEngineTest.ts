import { calculateResults } from '../lib/resultEngine';
import pgStudents from '../sample-data/pg-2025-sem1-example.json';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ ${message}`);
  }
}

// -----------------------------
// UG BBA TEST STUDENT
// -----------------------------
const bbaStudent = {
  autonomousRollNo: 'BBA-TEST-001',
  collegeRollNo: 'BBA-COL-001',
  name: 'Test BBA Student',

  subjects: {
    'CC-101': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },
    'CC-102': {
      FinalMark: 70,
      MidsemMark: 15,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },
    'CC-103': {
      FinalMark: 60,
      MidsemMark: 15,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },
    'MDE-101': {
      FinalMark: 55,
      MidsemMark: 12,
      Attandance: 5,
      SurpriseTest: 7,
      Assignment: 5,
    },
    'AEC-101': {
      FinalMark: 50,
      MidsemMark: 12,
      Attandance: 5,
      SurpriseTest: 7,
      Assignment: 5,
    },
    'AEC-102': {
      FinalMark: 45,
      MidsemMark: 10,
      Attandance: 5,
      SurpriseTest: 6,
      Assignment: 5,
    },
    'VAC-101': {
      FinalMark: 40,
      MidsemMark: 10,
      Attandance: 5,
      SurpriseTest: 6,
      Assignment: 5,
    },
  },
};

// -----------------------------
// TEST START
// -----------------------------
console.log('================================');
console.log('UNIVERSAL RESULT ENGINE TEST');
console.log('================================');

// -----------------------------
// UG TEST
// -----------------------------
console.log('\nTesting UG BBA...');

const ugResults = calculateResults({
  program: 'UG',
  course: 'BBA',
  semester: 1,
  batch: '2025',
  students: [bbaStudent],
});

assert(ugResults.length === 1, 'UG result count should be 1');

const ugResult = ugResults[0];

assert(ugResult.subjects.length === 7, 'UG should have 7 subjects');

assert(
  ugResult.sgpa === 7.04,
  `UG SGPA should be 7.04, got ${ugResult.sgpa}`
);

assert(
  ugResult.percentage === 64.57,
  `UG percentage should be 64.57, got ${ugResult.percentage}`
);

console.log('✅ UG config resolver: PASS');
console.log('✅ UG calculator: PASS');
console.log(`✅ UG subjects: ${ugResult.subjects.length}`);
console.log(`✅ UG SGPA: ${ugResult.sgpa}`);
console.log(`✅ UG Percentage: ${ugResult.percentage}`);

// -----------------------------
// PG TEST
// -----------------------------
console.log('\nTesting PG Chemistry...');

const pgStudent = pgStudents[0];

const pgResults = calculateResults({
  program: 'PG',
  semester: 1,
  batch: '2025',
  department: 'Chemistry',
  students: [pgStudent],
});

assert(pgResults.length === 1, 'PG result count should be 1');

const pgResult = pgResults[0];

assert(
  pgResult.subjects.length === 7,
  `PG Chemistry should have 7 subjects, got ${pgResult.subjects.length}`
);

assert(
  typeof pgResult.sgpa === 'number',
  'PG SGPA should be a number'
);

assert(
  typeof pgResult.percentage === 'number',
  'PG percentage should be a number'
);

console.log('✅ PG config resolver: PASS');
console.log('✅ PG calculator: PASS');
console.log(`✅ PG subjects: ${pgResult.subjects.length}`);
console.log(`✅ PG SGPA: ${pgResult.sgpa}`);
console.log(`✅ PG Percentage: ${pgResult.percentage}`);

// -----------------------------
// FINAL
// -----------------------------
console.log('\n================================');
console.log('UNIVERSAL RESULT ENGINE TEST');
console.log('================================');

console.log('✅ UG BBA → resolver → calculator → result: PASS');
console.log('✅ PG Chemistry → resolver → calculator → result: PASS');
console.log('\n🎉 UNIVERSAL RESULT ENGINE IS WORKING');