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
  // Existing internal fields used by the current Admin Panel
  r: string;
  n: string;
  p: ProgramKey;

  // Actual student record fields
  batch: string;
  programme: string;
  autonomousRollNo: string;
  collegeRollNo: string;
  name: string;
  dob: string;
  abcId: string;
  department: string;
  course: string;
  stream: string;
}

export type SubjectsMap = Record<string, string[]>;

export type MarksMap = Record<string, Record<string, number>>;

/* =========================
EXAM SESSION
========================= */

export interface ExamSession {
id: string;
academicYear: string;
batch: number;
program: ProgramKey;
course?: string;
department?: string;
semester: number;
examType: ExamType;
status: ExamSessionStatus;
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

examSessions?: ExamSession[];

calculatedResults?: Array<{
id: string;
program: string;
semester: number;
batch?: string | number;
course?: string;
department?: string;
status?: string;
createdAt?: string;
count?: number;
passed?: number;
failed?: number;
results?: any[];
[key: string]: any;
}>;

recheckingApplications?: any[];

// Separate correction records; original published results remain unchanged.
resultCorrections?: any[];

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

export const PROG: Record<ProgramKey, ProgramConfig> = {
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

export const DEF_SUBJECTS: Record<ProgramKey, string[]> = {
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
