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

export function generateInitialData(): DBData {
  const d: DBData = {
    college: 'Your College Name',
    max: 100,
    pass: 40,
    subjects: {},
    students: [],
    marks: {},
    examSessions: [],
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
