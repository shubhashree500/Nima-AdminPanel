import fs from 'fs';
import path from 'path';
import os from 'os';
import { DBData, PROG, DEF_SUBJECTS, ProgramKey } from '../types';

const SOURCE_DATA_DIR = path.join(process.cwd(), 'data');

let resolvedWritableDir: string | null = null;

export function getDataDir(): string {
  if (process.env.ADMIN_PANEL_DATA_DIR) {
    return process.env.ADMIN_PANEL_DATA_DIR;
  }

  if (resolvedWritableDir) {
    return resolvedWritableDir;
  }

  // Detect serverless environments (Vercel, AWS Lambda, Netlify, etc.)
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.NOW_REGION) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT);

  if (isServerless) {
    resolvedWritableDir = path.join(os.tmpdir(), 'admin-panel-data');
    return resolvedWritableDir;
  }

  // Check if SOURCE_DATA_DIR is writable (fails on read-only environments like Vercel)
  try {
    if (!fs.existsSync(SOURCE_DATA_DIR)) {
      fs.mkdirSync(SOURCE_DATA_DIR, { recursive: true });
    }
    const testFile = path.join(
      SOURCE_DATA_DIR,
      `.write-check-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
    );
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
    resolvedWritableDir = SOURCE_DATA_DIR;
    return resolvedWritableDir;
  } catch {
    // Read-only filesystem detected, fallback to writable temp directory
    resolvedWritableDir = path.join(os.tmpdir(), 'admin-panel-data');
    return resolvedWritableDir;
  }
}

export function getDbFilePath(): string {
  const dataDir = getDataDir();

  let resolvedPath: string;
  if (process.env.ADMIN_PANEL_DB_FILE) {
    const rawFile = process.env.ADMIN_PANEL_DB_FILE;
    resolvedPath = path.isAbsolute(rawFile)
      ? rawFile
      : path.join(dataDir, path.basename(rawFile));
  } else {
    const mode = process.env.ADMIN_PANEL_DB_MODE;
    if (!mode || mode === 'production' || mode === 'live' || mode === 'development') {
      resolvedPath = path.join(dataDir, 'db.json');
    } else if (mode === 'rechecking-test') {
      resolvedPath = path.join(dataDir, 'db.recovery-test.json');
    } else if (mode === 'day1-test') {
      resolvedPath = path.join(dataDir, 'db.day1-test.json');
    } else {
      throw new Error(
        `Invalid or unrecognized ADMIN_PANEL_DB_MODE: "${mode}". Refusing to fall back to live database.`
      );
    }
  }

  // If running in a separate writable directory (like /tmp on Vercel),
  // seed from bundled data directory if writable file does not exist yet
  if (dataDir !== SOURCE_DATA_DIR && !fs.existsSync(resolvedPath)) {
    const seedFile = path.join(SOURCE_DATA_DIR, path.basename(resolvedPath));
    if (fs.existsSync(seedFile)) {
      try {
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(seedFile, resolvedPath);
      } catch (err) {
        console.warn(`Could not seed database file from "${seedFile}" to "${resolvedPath}":`, err);
      }
    }
  }

  return resolvedPath;
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
  const dir = path.dirname(dbFile);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(dbFile)) {
      const seedFile = path.join(SOURCE_DATA_DIR, path.basename(dbFile));
      if (fs.existsSync(seedFile)) {
        try {
          fs.copyFileSync(seedFile, dbFile);
        } catch (copyErr) {
          console.warn(`Could not copy seed file from "${seedFile}" to "${dbFile}":`, copyErr);
        }
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
  const dir = path.dirname(dbFile);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Safe atomic write in the same directory as dbFile
    const tempFile = path.join(
      dir,
      `db.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    try {
      fs.renameSync(tempFile, dbFile);
    } catch (renameError) {
      // Fallback in case renameSync fails across filesystem boundaries
      fs.copyFileSync(tempFile, dbFile);
      fs.unlinkSync(tempFile);
    }
  } catch (error) {
    console.error(`Error saving database file "${dbFile}":`, error);
    throw error;
  }
}
