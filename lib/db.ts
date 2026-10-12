import fs from 'fs';
import path from 'path';
import { DBData, PROG, DEF_SUBJECTS, ProgramKey } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

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
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initial = generateInitialData();

      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(initial, null, 2),
        'utf-8'
      );

      return initial;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Keep compatibility with older db.json files
    if (!parsed.examSessions) {
      parsed.examSessions = [];
    }

    return parsed;
  } catch (error) {
    console.error(
      'Error reading DB, falling back to clean data:',
      error
    );

    return generateInitialData();
  }
}

export function saveDB(data: DBData): void {
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

    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Error saving DB:', error);
    throw error;
  }
}