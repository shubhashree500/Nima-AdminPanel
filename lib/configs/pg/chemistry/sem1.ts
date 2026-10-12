import type { CourseConfig } from '../../types';
const chemistrySem1Config: CourseConfig = {
  program: 'PG',
  department: 'Chemistry',
  semester: 1,

  academicVersion: {
    fromBatch: 2025,
  },

  papers: [
    {
      code: '1.1',
      title: 'Inorganic chem 1',
      type: 'theory',
      credit: 3,
      marks: {
        fullMark: 70,
        midsem: { max: 20 },
        endsem: { max: 50 },
      },
    },

    {
      code: '1.2',
      title: 'Organic chem 1',
      type: 'theory',
      credit: 3,
      marks: {
        fullMark: 70,
        midsem: { max: 20 },
        endsem: { max: 50 },
      },
    },

    {
      code: '1.3',
      title: 'Physical chemistry 1',
      type: 'theory',
      credit: 3,
      marks: {
        fullMark: 70,
        midsem: { max: 20 },
        endsem: { max: 50 },
      },
    },

    {
      code: '1.4',
      title: 'ICP-1',
      type: 'practical',
      credit: 4,
      marks: {
        fullMark: 50,
        endsem: { max: 50 },
      },
    },

    {
      code: '1.5',
      title: 'OCP-1',
      type: 'practical',
      credit: 4,
      marks: {
        fullMark: 50,
        endsem: { max: 50 },
      },
    },

    {
      code: '1.6',
      title: 'Spectroscopy 1',
      type: 'theory',
      credit: 3,
      marks: {
        fullMark: 70,
        midsem: { max: 20 },
        endsem: { max: 50 },
      },
    },

    {
      code: '1.7',
      title: 'Computer for chemist',
      type: 'theory',
      credit: 3,
      marks: {
        fullMark: 70,
        midsem: { max: 20 },
        endsem: { max: 50 },
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

export default chemistrySem1Config;