
import * as oldEngine from '../lib/engines/pg2025Sem1';
import { calculatePGStudent } from '../lib/calculation/pgCalculator';

import chemistryConfig from '../lib/configs/pg/chemistry/sem1';

import students from '../sample-data/pg-2025-sem1-example.json';

function normalize(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'number') {
    return Number(value.toFixed(6));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      return Number(Number(trimmed).toFixed(6));
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (typeof value === 'object') {
    const result: any = {};

    for (const key of Object.keys(value).sort()) {
      result[key] = normalize(value[key]);
    }

    return result;
  }

  return value;
}

function compare(
  name: string,
  oldValue: any,
  newValue: any,
): boolean {
  const oldNormalized = normalize(oldValue);
  const newNormalized = normalize(newValue);

  const oldJson = JSON.stringify(oldNormalized);
  const newJson = JSON.stringify(newNormalized);

  if (oldJson === newJson) {
    console.log(`✅ ${name}: MATCH`);
    return true;
  }

  console.log(`❌ ${name}: MISMATCH`);

  console.log('\nOLD:');
  console.dir(oldNormalized, {
    depth: null,
  });

  console.log('\nNEW:');
  console.dir(newNormalized, {
    depth: null,
  });

  return false;
}

/*
 * Only compare fields that represent
 * actual calculation results.
 */
function normalizeOldSubjects(subjects: any[]): any[] {
  return (subjects || []).map((subject: any) => ({
    credit: Number(subject.credit ?? 0),

    creditPoint: Number(
      subject.creditPoint ?? 0,
    ),

    marks: Number(
      subject.totalMark ??
      subject.marks ??
      0,
    ),

    grade: subject.grade,

    gradePoint: Number(
      subject.gradePoint ?? 0,
    ),
  }));
}

function normalizeNewSubjects(subjects: any[]): any[] {
  return (subjects || []).map((subject: any) => ({
    credit: Number(
      subject.credit ?? 0,
    ),

    creditPoint: Number(
      subject.creditPoint ?? 0,
    ),

    marks: Number(
      subject.marks ?? 0,
    ),

    grade: subject.grade,

    gradePoint: Number(
      subject.gradePoint ?? 0,
    ),
  }));
}

console.log('================================');
console.log('PG 2025 SEM 1 PARITY TEST');
console.log('================================');

let passed = true;

for (const student of students as any[]) {
  console.log(
    '\nTesting PG student...',
  );

  /*
   * OLD PG 2025 ENGINE
   */
  const oldResult =
    oldEngine.calculateStudent(student);

  /*
   * NEW UNIVERSAL PG ENGINE
   */
  const newResult =
    calculatePGStudent(
      student,
      chemistryConfig,
    );

  /*
   * SGPA
   */
  passed =
    compare(
      'SGPA',
      oldResult.sgpa,
      newResult.sgpa,
    ) && passed;

  /*
   * Percentage
   */
  passed =
    compare(
      'Percentage',
      oldResult.percentage,
      newResult.percentage,
    ) && passed;

  /*
   * Subject calculation results
   */
  const oldSubjects =
    normalizeOldSubjects(
      oldResult.subjects,
    );

  const newSubjects =
    normalizeNewSubjects(
      newResult.subjects,
    );

  passed =
    compare(
      'Subject Results',
      oldSubjects,
      newSubjects,
    ) && passed;
}

console.log('\n==============================');
console.log('PG 2025 SEM 1 PARITY TEST');
console.log('==============================');

if (passed) {
  console.log(
    '\n✅ OLD AND NEW PG ENGINE MATCH',
  );
} else {
  console.log(
    '\n❌ OLD AND NEW PG ENGINE DO NOT MATCH',
  );

  process.exitCode = 1;
}