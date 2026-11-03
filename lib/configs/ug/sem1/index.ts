import type { CourseConfig } from '../../types';

const grading = {
  scale: [
    { minPercentage: 90, maxPercentage: 100, grade: 'O', gradePoint: 10 },
    { minPercentage: 80, maxPercentage: 89.9999, grade: 'A+', gradePoint: 9 },
    { minPercentage: 70, maxPercentage: 79.9999, grade: 'A', gradePoint: 8 },
    { minPercentage: 60, maxPercentage: 69.9999, grade: 'B+', gradePoint: 7 },
    { minPercentage: 50, maxPercentage: 59.9999, grade: 'B', gradePoint: 6 },
    { minPercentage: 45, maxPercentage: 49.9999, grade: 'C', gradePoint: 5 },
    { minPercentage: 40, maxPercentage: 44.9999, grade: 'D', gradePoint: 4 },
  ],
};

const config: CourseConfig = {
  program: 'UG',
  semester: 1,

  academicVersion: {
    fromBatch: 2024,
  },

  grading,

  grace: {
    enabled: true,
    totalLimit: 8,
    subjectLimit: 5,
    passMark: 40,

    priority: [
      ['Major CP 1'],
      ['Major CP 2'],
      ['Minor'],
      ['MDC', 'MDE'],
      ['AEC'],
      ['VAC'],
    ],
  },

  rechecking: {
    enabled: true,
    allowMarkIncrease: true,
    allowMarkDecrease: true,
    recalculateResult: true,
  },

  papers: [
    {
      code: 'Core-1',
      title: 'Major Core 1',
      type: 'theory',
      credit: 4,
      category: 'Major CP 1',
      marks: {
        fullMark: 100,
        midsem: { max: 20 },
        endsem: { max: 100 },
        attendance: { max: 5 },
        surpriseTest: { max: 10 },
        assignment: { max: 5 },
      },
    },

    {
      code: 'Core-2',
      title: 'Major Core 2',
      type: 'theory',
      credit: 4,
      category: 'Major CP 2',
      marks: {
        fullMark: 100,
        midsem: { max: 20 },
        endsem: { max: 100 },
        attendance: { max: 5 },
        surpriseTest: { max: 10 },
        assignment: { max: 5 },
      },
    },

    {
      code: 'Minor-1',
      title: 'Minor 1',
      type: 'theory',
      credit: 4,
      category: 'Minor',
      marks: {
        fullMark: 100,
        midsem: { max: 20 },
        endsem: { max: 100 },
        attendance: { max: 5 },
        surpriseTest: { max: 10 },
        assignment: { max: 5 },
      },
    },

    {
      code: 'MDC-1',
      title: 'Multidisciplinary',
      type: 'theory',
      credit: 3,
      category: 'MDC',
      marks: {
        fullMark: 100,
        midsem: { max: 20 },
        endsem: { max: 100 },
        attendance: { max: 5 },
        surpriseTest: { max: 10 },
        assignment: { max: 5 },
      },
    },

    {
      code: 'AEC-1',
      title: 'Ability Enhancement',
      type: 'theory',
      credit: 4,
      category: 'AEC',
      marks: {
        fullMark: 100,
        midsem: { max: 20 },
        endsem: { max: 100 },
        attendance: { max: 5 },
        surpriseTest: { max: 10 },
        assignment: { max: 5 },
      },
    },

    {
      code: 'VAC-1',
      title: 'Value Added Course',
      type: 'theory',
      credit: 3,
      category: 'VAC',
      marks: {
        fullMark: 100,
        midsem: { max: 20 },
        endsem: { max: 100 },
        attendance: { max: 5 },
        surpriseTest: { max: 10 },
        assignment: { max: 5 },
      },
    },
  ],
};

export default config;
