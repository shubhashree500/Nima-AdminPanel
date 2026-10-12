
import { calculateUGStudent } from '../lib/calculation/ugCalculator';
import bbaConfig from '../lib/configs/ug/bba/sem1';

const student = {
  r: 'BBA-GRACE-001',
  name: 'GRACE TEST',
  p: 'BBA',

  subjects: {
    'CC-101': {
      FinalMark: 40,
      MidsemMark: 5,
      Attandance: 5,
      SurpriseTest: 4,
      Assignment: 0,
    },

    'CC-102': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },

    'CC-103': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },

    'MDE-101': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },

    'AEC-101': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },

    'AEC-102': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },

    'VAC-101': {
      FinalMark: 80,
      MidsemMark: 18,
      Attandance: 5,
      SurpriseTest: 8,
      Assignment: 5,
    },
  },
};

const result = calculateUGStudent(student, bbaConfig);

const cc101 = result.subjects.find(
  (subject) => subject.paperCode === 'CC-101'
);

console.log('================================');
console.log('UG GRACE TEST');
console.log('================================');

console.log('CC-101:', cc101);
console.log('Grace Used:', result.usedGrace);
console.log('Grace Remaining:', result.remainingGrace);

if (!cc101) {
  throw new Error('CC-101 result not found');
}

if (cc101.marks !== 40) {
  throw new Error(
    `Expected CC-101 marks = 40, got ${cc101.marks}`
  );
}

if (cc101.grace !== 2) {
  throw new Error(
    `Expected CC-101 grace = 2, got ${cc101.grace}`
  );
}

if (cc101.grade !== 'D') {
  throw new Error(
    `Expected CC-101 grade = D, got ${cc101.grade}`
  );
}

if (result.usedGrace !== 2) {
  throw new Error(
    `Expected usedGrace = 2, got ${result.usedGrace}`
  );
}

if (result.remainingGrace !== 6) {
  throw new Error(
    `Expected remainingGrace = 6, got ${result.remainingGrace}`
  );
}

console.log('');
console.log('✅ GRACE TEST PASSED');
console.log('================================');

