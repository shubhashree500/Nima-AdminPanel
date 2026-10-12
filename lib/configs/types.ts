import type { GradeRule } from '../rules/grading';

export type Program = 'UG' | 'PG';

export type PaperType = 'theory' | 'practical';

export type MarksComponent = {
  max: number;
};

export type PaperMarksConfig = {
  fullMark: number;
  midsem?: MarksComponent;
  endsem?: MarksComponent;
  practical?: MarksComponent;
  internalPractical?: MarksComponent;
  attendance?: MarksComponent;
  surpriseTest?: MarksComponent;
  assignment?: MarksComponent;
};

export type PaperConfig = {
  code: string;
  title: string;
  type: PaperType;
  credit: number;
  category?: string;
  marks: PaperMarksConfig;
};

export type AcademicVersion = {
  fromBatch: number;
  toBatch?: number;
};

export type DepartmentConfig = {
  name: string;
  papers: PaperConfig[];
};

export type GraceConfig = {
  enabled: boolean;
  totalLimit?: number;
  subjectLimit?: number;
  passMark?: number;
  priority?: string[][];
};

export type RecheckingConfig = {
  enabled: boolean;
  maxApplications?: number;
  allowMarkIncrease?: boolean;
  allowMarkDecrease?: boolean;
  recalculateResult?: boolean;
};

export type CourseConfig = {
  program: Program;
  course?: string;
  department?: string;
  semester: number;

  /** Academic batches for which this configuration applies */
  academicVersion: AcademicVersion;

  papers?: PaperConfig[];
  departments?: Record<string, DepartmentConfig>;

  grading: {
    scale: GradeRule[];
  };

  grace?: GraceConfig;
  rechecking?: RecheckingConfig;
};