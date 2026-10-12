import { calculateUGStudent } from '../lib/calculation/ugCalculator';
import bbaConfig from '../lib/configs/ug/bba/sem1';

const student = {
  r: 'BBA-TEST-001',
  name: 'TEST STUDENT',
  p: 'BBA',

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

console.log('================================');
console.log('UG BBA CALCULATION TEST');
console.log('================================');

const result = calculateUGStudent(
  student,
  bbaConfig,
);

for (const subject of result.subjects) {
  console.log(
    `${subject.paperCode} | ` +
      `${subject.marks} | ` +
      `${subject.grade} | ` +
      `GP ${subject.gradePoint} | ` +
      `CP ${subject.creditPoint} | ` +
      `Grace ${subject.grace ?? 0}`,
  );
}

console.log('\n--------------------------------');

console.log(
  `Total Credits: ${result.totalCredits}`,
);

console.log(
  `Total Credit Points: ${result.totalCreditPoints}`,
);

console.log(
  `SGPA: ${result.sgpa}`,
);

console.log(
  `Percentage: ${result.percentage}%`,
);

console.log(
  `Grace Used: ${result.usedGrace}`,
);

console.log(
  `Grace Remaining: ${result.remainingGrace}`,
);

console.log('\n================================');
console.log('TEST COMPLETE');
console.log('================================');