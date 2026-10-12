import type { CourseConfig } from '../../types';

const grading = {
  scale: [
    { minPercentage: 90, maxPercentage: 100, grade: 'O', gradePoint: 10 },
    { minPercentage: 80, maxPercentage: 89.9999, grade: 'A+', gradePoint: 9 },
    { minPercentage: 70, maxPercentage: 79.9999, grade: 'A', gradePoint: 8 },
  { minPercentage: 60, maxPercentage: 69.9999, grade: 'B+', gradePoint: 7 },
{ minPercentage: 50, maxPercentage: 59.9999, grade: 'B', gradePoint: 6 },
{ minPercentage: 45, maxPercentage: 49.9999, grade: 'C', gradePoint: 5 },
{ minPercentage: 40, maxPercentage: 44.9999, grade: 'D', gradePoint: 4 },  ],
};

const config: CourseConfig = {
  program: 'UG',
  course: 'BBA',
  semester: 1,

  academicVersion: {
    fromBatch: 2025,
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
      code: 'CC-101',
      title: 'Major CP 1',
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
      code: 'CC-102',
      title: 'Major CP 2',
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
      code: 'CC-103',
      title: 'Minor',
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
      code: 'MDE-101',
      title: 'Multidisciplinary Elective',
      type: 'theory',
      credit: 4,
      category: 'MDE',

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
      code: 'AEC-101',
      title: 'Ability Enhancement Course I',
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
      code: 'AEC-102',
      title: 'Ability Enhancement Course II',
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
      code: 'VAC-101',
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