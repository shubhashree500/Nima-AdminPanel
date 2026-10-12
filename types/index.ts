export type ProgramKey = 'UG' | 'PG';

export type ExamType =
  | 'Regular'
  | 'Back'
  | 'Improvement'
  | 'Special';

export type ExamSessionStatus =
  | 'Draft'
  | 'Marks Entry'
  | 'Processing'
  | 'Verification'
  | 'Published'
  | 'Closed';

export interface Student {
  r: string; // Roll number
  n: string; // Name
  p: ProgramKey; // Program
}

export type SubjectsMap = Record<
  string,
  string[]
>;

// e.g. "UG|1" -> ["Physics", "Chemistry"]
export type MarksMap = Record<
  string,
  Record<string, number>
>;

// e.g. "101|1" -> { "Physics": 85 }

/* =========================
   EXAM SESSION
   ========================= */

export interface ExamSession {
  id: string;

  // Academic information
  academicYear: string; // e.g. "2025-26"
  batch: number; // e.g. 2025

  // Top-level program
  program: ProgramKey;

  // Used internally for UG course detection
  // such as B.A., B.Sc., BCA and BBA.
  course?: string;

  // Used for PG departments
  // such as Chemistry/Mathematics.
  department?: string;

  semester: number;

  // Examination information
  examType: ExamType;

  // Current workflow status
  status: ExamSessionStatus;

  // Optional dates
  examStartDate?: string;
  examEndDate?: string;

  createdAt?: string;
  updatedAt?: string;
}

/* =========================
   DATABASE
   ========================= */

export interface DBData {
  college: string;
  max: number;
  pass: number;

  subjects: SubjectsMap;

  students: Student[];

  marks: MarksMap;

  // All examination/result sessions
  examSessions?: ExamSession[];

  // Saved universal calculation records are stored alongside legacy data.
  calculatedResults?: Array<{
    id: string; program: string; semester: number; batch?: string | number;
    course?: string; department?: string; status?: string; createdAt?: string;
    count?: number; passed?: number; failed?: number; results?: any[];
    [key: string]: any;
  }>;
  recheckingApplications?: any[];
  masterData?: { courses?: string[]; departments?: string[]; batches?: string[]; subjects?: string[] };
}

/* =========================
   PROGRAM CONFIG
   ========================= */

export interface ProgramConfig {
  full: string;
  sems: number;
}

export interface CalcResult {
  t?: number;
  mx?: number;
  pct?: number;
  status: 'Pass' | 'Fail' | 'Pending';
  div?: string;
}

/* =========================
   PROGRAMS
   ========================= */

export const PROG: Record<
  ProgramKey,
  ProgramConfig
> = {
  UG: {
    full: 'UG',
    sems: 6,
  },

  PG: {
    full: 'PG',
    sems: 4,
  },
};

/* =========================
   DEFAULT SUBJECTS
   ========================= */

export const DEF_SUBJECTS: Record<
  ProgramKey,
  string[]
> = {
  UG: [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Odia',
    'History',
    'Education',
  ],

  PG: [
    'Paper 1',
    'Paper 2',
    'Paper 3',
    'Paper 4',
    'Project',
  ],
};