export type Program = 'UG' | 'PG';

export type CalculationMode =
  | 'normal'
  | 'rechecking'
  | 'revaluation';

export type EngineRequest = {
  program: Program;

  // Example: BBA, BA, BSc, etc.
  // Mainly useful for UG because different UG courses
  // can have different subject structures.
  course?: string;

  semester: number;
  batch?: string;
  department?: string;

  mode?: CalculationMode;

  students: any[];
};

export type GradeResult = {
  grade: string;
  gradePoint: number;
};

export type SubjectResult = {
  paperCode?: string;
  subjectName?: string;
  category?: string;
  marks: number;
  fullMark: number;
  credit: number;
  grade: string;
  gradePoint: number;
  creditPoint: number;
  grace?: number;
};

export type StudentResult = {
  student: any;

  subjects: SubjectResult[];

  totalCredits: number;
  totalCreditPoints: number;
  sgpa: number;
 percentage?: number;
  usedGrace?: number;
  remainingGrace?: number;
};