import fs from 'fs';
import path from 'path';
import { DBData, PROG, DEF_SUBJECTS, ProgramKey } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');

export function getDbFilePath(): string {
  if (process.env.ADMIN_PANEL_DB_FILE) {
    const rawFile = process.env.ADMIN_PANEL_DB_FILE;
    return path.isAbsolute(rawFile)
      ? rawFile
      : path.join(DATA_DIR, path.basename(rawFile));
  }

  const mode = process.env.ADMIN_PANEL_DB_MODE;
  if (!mode || mode === 'production' || mode === 'live' || mode === 'development') {
    return path.join(DATA_DIR, 'db.json');
  }

  if (mode === 'rechecking-test') {
    return path.join(DATA_DIR, 'db.recovery-test.json');
  }

  if (mode === 'day1-test') {
    return path.join(DATA_DIR, 'db.day1-test.json');
  }

  throw new Error(
    `Invalid or unrecognized ADMIN_PANEL_DB_MODE: "${mode}". Refusing to fall back to live database.`
  );
}

export function generateInitialData(includeDemo = true): DBData {
  const d: DBData = {
    college: 'Nimapara Autonomous College',
    max: 100,
    pass: 40,
    subjects: {},
    students: includeDemo ? [
      {
        r: 'NACPG25001',
        n: 'Aarav Patel',
        p: 'PG',
        batch: '2025',
        programme: 'PG',
        autonomousRollNo: 'NACPG25001',
        collegeRollNo: 'CHEM25-001',
        name: 'Aarav Patel',
        dob: '2002-05-14',
        abcId: 'ABC-1029384756',
        department: 'Chemistry',
        course: 'M.Sc Chemistry',
        stream: 'Science',
      },
      {
        r: 'NACPG25002',
        n: 'Diya Sharma',
        p: 'PG',
        batch: '2025',
        programme: 'PG',
        autonomousRollNo: 'NACPG25002',
        collegeRollNo: 'CHEM25-002',
        name: 'Diya Sharma',
        dob: '2002-08-22',
        abcId: 'ABC-2039485761',
        department: 'Chemistry',
        course: 'M.Sc Chemistry',
        stream: 'Science',
      },
      {
        r: 'NACUG25001',
        n: 'Rohan Jena',
        p: 'UG',
        batch: '2024',
        programme: 'UG',
        autonomousRollNo: 'NACUG25001',
        collegeRollNo: 'BS24-001',
        name: 'Rohan Jena',
        dob: '2004-03-10',
        abcId: 'ABC-3049586712',
        department: 'Physics',
        course: 'BSC',
        stream: 'Science',
      },
      {
        r: 'NACUG25002',
        n: 'Priya Nayak',
        p: 'UG',
        batch: '2024',
        programme: 'UG',
        autonomousRollNo: 'NACUG25002',
        collegeRollNo: 'BA24-001',
        name: 'Priya Nayak',
        dob: '2004-11-05',
        abcId: 'ABC-4059687123',
        department: 'History',
        course: 'BA',
        stream: 'Arts',
      },
      {
        r: 'NACUG25003',
        n: 'Subham Dash',
        p: 'UG',
        batch: '2024',
        programme: 'UG',
        autonomousRollNo: 'NACUG25003',
        collegeRollNo: 'BC24-001',
        name: 'Subham Dash',
        dob: '2004-07-19',
        abcId: 'ABC-5069781234',
        department: 'Commerce',
        course: 'BCOM',
        stream: 'Commerce',
      },
    ] : [],
    marks: {},
    examSessions: [],
    calculatedResults: [],
    recheckingApplications: [],
    resultCorrections: [],
  };

  (Object.keys(PROG) as ProgramKey[]).forEach((p) => {
    for (let s = 1; s <= PROG[p].sems; s++) {
      d.subjects[`${p}|${s}`] = [...DEF_SUBJECTS[p]];
    }
  });

  return d;
}

export function getDB(): DBData {
  const dbFile = getDbFilePath();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(dbFile)) {
      const initial = generateInitialData();

      fs.writeFileSync(
        dbFile,
        JSON.stringify(initial, null, 2),
        'utf-8'
      );

      return initial;
    }

    const raw = fs.readFileSync(dbFile, 'utf-8');
    const parsed = JSON.parse(raw);

    // Keep compatibility with older db.json files
    if (!parsed.examSessions) {
      parsed.examSessions = [];
    }

    if (!Array.isArray(parsed.recheckingApplications)) {
      parsed.recheckingApplications = [];
    }

    if (!Array.isArray(parsed.resultCorrections)) {
      parsed.resultCorrections = [];
    }

    if (!Array.isArray(parsed.calculatedResults)) {
      parsed.calculatedResults = [];
    }

    return parsed;
    } catch (error) {
    console.error(`Error reading database file "${dbFile}":`, error);
    throw error;
  }
}

export function saveDB(data: DBData): void {
  const dbFile = getDbFilePath();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Safe atomic write
    const tempFile = path.join(
      DATA_DIR,
      `db.${Date.now()}.tmp`
    );

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    fs.renameSync(tempFile, dbFile);
  } catch (error) {
    console.error('Error saving DB:', error);
    throw error;
  }
}
