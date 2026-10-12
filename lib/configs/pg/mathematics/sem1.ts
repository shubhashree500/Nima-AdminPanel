import type { CourseConfig } from '../../types';

const mathematicsSem1Config: CourseConfig = {
  program: 'PG',
  department: 'Math',
  semester: 1,

  academicVersion: {
    fromBatch: 2025,
  },

  papers: [
    {
      code: '1.1',
      title: 'Real analysis',
      type: 'theory',
      credit: 6,
      marks: {
        fullMark: 100,
        midsem: { max: 30 },
        endsem: { max: 70 },
      },
    },
    {
      code: '1.2',
      title: 'Complex analysis',
      type: 'theory',
      credit: 6,
      marks: {
        fullMark: 100,
        midsem: { max: 30 },
        endsem: { max: 70 },
      },
    },
    {
      code: '1.3',
      title: 'Topology',
      type: 'theory',
      credit: 6,
      marks: {
        fullMark: 100,
        midsem: { max: 30 },
        endsem: { max: 70 },
      },
    },
    {
      code: '1.4',
      title: 'Advance abstract algebra',
      type: 'theory',
      credit: 6,
      marks: {
        fullMark: 100,
        midsem: { max: 30 },
        endsem: { max: 70 },
      },
    },
    {
      code: '1.5',
      title: 'DPNCL',
      type: 'theory',
      credit: 6,
      marks: {
        fullMark: 100,
        midsem: { max: 30 },
        endsem: { max: 70 },
      },
    },
  ],

  grading: {
    scale: [
      {
        minPercentage: 90,
        maxPercentage: 100,
        grade: 'O',
        gradePoint: 10,
      },
      {
        minPercentage: 80,
        maxPercentage: 89,
        grade: 'A+',
        gradePoint: 9,
      },
      {
        minPercentage: 70,
        maxPercentage: 79,
        grade: 'A',
        gradePoint: 8,
      },
      {
        minPercentage: 60,
        maxPercentage: 69,
        grade: 'B+',
        gradePoint: 7,
      },
      {
        minPercentage: 50,
        maxPercentage: 59,
        grade: 'B',
        gradePoint: 6,
      },
      {
        minPercentage: 45,
        maxPercentage: 49,
        grade: 'C',
        gradePoint: 5,
      },
      {
        minPercentage: 40,
        maxPercentage: 44,
        grade: 'D',
        gradePoint: 4,
      },
      {
        minPercentage: 0,
        maxPercentage: 39,
        grade: 'F',
        gradePoint: 0,
      },
    ],
  },
};

export default mathematicsSem1Config;