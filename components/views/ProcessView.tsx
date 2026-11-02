'use client';

import React, {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as XLSX from 'xlsx';
import { ProgramKey, PROG, DBData, Student } from '@/types';

interface ProcessViewProps {
  db?: DBData;
  onProceedToVerify?: () => void;
}

type EntryMode = 'individual' | 'bulk';

interface StagedPaperMark {
  code: string;
  title: string;
  midsem: string;
  practical: string;
  final: string;
  maxMid: number;
  maxFinal: number;
  maxPrac: number;
  isPrac: boolean;
}

const PG_DEPARTMENTS = [
  'ALL',
  'Chemistry',
  'Commerce',
  'Geology',
  'Mathematics',
  'MFC',
  'Odia',
  'Physics',
];

const UG_COURSES = ['ALL', 'BSC', 'BA', 'BCOM', 'BCA', 'BBA'];

function getSuggestedPapers(prog: ProgramKey, sem: number, dept: string): StagedPaperMark[] {
  if (prog === 'PG') {
    const d = (dept || '').toLowerCase();
    if (d.includes('chem')) {
      return [
        { code: '1.1', title: 'Inorganic chem 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 50, maxPrac: 0, isPrac: false },
        { code: '1.2', title: 'Organic chem 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 50, maxPrac: 0, isPrac: false },
        { code: '1.3', title: 'Physical chemistry 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 50, maxPrac: 0, isPrac: false },
        { code: '1.4', title: 'ICP-1 (Practical)', midsem: '', practical: '', final: '', maxMid: 0, maxFinal: 50, maxPrac: 50, isPrac: true },
        { code: '1.5', title: 'OCP-1 (Practical)', midsem: '', practical: '', final: '', maxMid: 0, maxFinal: 50, maxPrac: 50, isPrac: true },
        { code: '1.6', title: 'Spectroscopy 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 50, maxPrac: 0, isPrac: false },
        { code: '1.7', title: 'Computer for chemist', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 50, maxPrac: 0, isPrac: false },
      ];
    }
    if (d.includes('com')) {
      return [
        { code: '1.1', title: 'Management concepts and practices', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.2', title: 'Statistics for management', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.3', title: 'Corporate financial accounting', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.4', title: 'Financial management', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.5', title: 'Accounting for managerial decision making', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.6', title: 'Risk and insurance management', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      ];
    }
    if (d.includes('math')) {
      return [
        { code: '1.1', title: 'Real analysis', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.2', title: 'Complex analysis', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.3', title: 'Topology', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.4', title: 'Advance abstract algebra', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.5', title: 'DPNCL', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      ];
    }
    if (d.includes('odia')) {
      return [
        { code: '1.1', title: 'PPKK', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.2', title: 'Adhunika kabya kabita 1', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.3', title: 'Katha sahitya', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.4', title: 'Gadya sahitya', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      ];
    }
    if (d.includes('geo')) {
      return [
        { code: '1.1', title: 'Crystallography, mineralogy and mineral optics', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.2', title: 'Mineral deposits', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.3', title: 'Applied economic geology', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: '1.4', title: 'Practical 1', midsem: '', practical: '', final: '', maxMid: 0, maxFinal: 100, maxPrac: 100, isPrac: true },
        { code: '1.5', title: 'Practical 2', midsem: '', practical: '', final: '', maxMid: 0, maxFinal: 100, maxPrac: 100, isPrac: true },
      ];
    }
    if (d.includes('mfc')) {
      return [
        { code: 'MCOB', title: 'MCOB', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'EADM', title: 'EADM', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'FAR', title: 'FAR', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'QT', title: 'QT', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'MM', title: 'MM', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'FM', title: 'FM', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'BFE', title: 'BFE', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
        { code: 'FMI', title: 'FMI', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      ];
    }
    // Default PG: Midsem Max 30, Endsem/Final Max 70
    return [
      { code: '1.1', title: 'Paper 1.1', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      { code: '1.2', title: 'Paper 1.2', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      { code: '1.3', title: 'Paper 1.3', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      { code: '1.4', title: 'Paper 1.4', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
      { code: '1.5', title: 'Paper 1.5', midsem: '', practical: '', final: '', maxMid: 30, maxFinal: 70, maxPrac: 0, isPrac: false },
    ];
  } else {
    // UG Sem 3 default
    if (sem === 3) {
      return [
        { code: 'Major-CP-5', title: 'Major CP 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 70, maxPrac: 10, isPrac: true },
        { code: 'Major-CP-6', title: 'Major CP 2', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 70, maxPrac: 10, isPrac: true },
        { code: 'Major-CP-7', title: 'Major CP 3', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 70, maxPrac: 10, isPrac: true },
        { code: 'MINOR-3', title: 'Minor 3', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
        { code: 'Multidisciplinary-1', title: 'Multidisciplinary 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
        { code: 'VAC-2', title: 'Value Added Course 2', midsem: '', practical: '', final: '', maxMid: 0, maxFinal: 50, maxPrac: 0, isPrac: false },
      ];
    }
    // Other UG Sems
    return [
      { code: 'Core-1', title: 'Major Core 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
      { code: 'Core-2', title: 'Major Core 2', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
      { code: 'Minor-1', title: 'Minor 1', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
      { code: 'MDC-1', title: 'Multidisciplinary', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
      { code: 'AEC-1', title: 'Ability Enhancement', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
      { code: 'VAC-1', title: 'Value Added Course', midsem: '', practical: '', final: '', maxMid: 20, maxFinal: 80, maxPrac: 0, isPrac: false },
    ];
  }
}

export function ProcessView({ db, onProceedToVerify }: ProcessViewProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('individual');

  const [program, setProgram] = useState<ProgramKey>('UG');
  const [semester, setSemester] = useState(3);
  const [batch, setBatch] = useState('2024');
  const [department, setDepartment] = useState('ALL');
  const [course, setCourse] = useState('ALL');

  // Excel bulk rows
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');

  // JSON bulk text
  const [jsonPasteText, setJsonPasteText] = useState('');

  // Individual Form State & Search
  const [searchRoll, setSearchRoll] = useState('');
  const [foundStudentInfo, setFoundStudentInfo] = useState<Student | null>(null);
  const [searchStatus, setSearchStatus] = useState<{
    text: string;
    type: 'found' | 'not-found';
  } | null>(null);

  const [studentName, setStudentName] = useState('');
  const [autonomousRoll, setAutonomousRoll] = useState('');
  const [collegeRoll, setCollegeRoll] = useState('');
  const [studentDept, setStudentDept] = useState('Physics');

  const [paperMarks, setPaperMarks] = useState<StagedPaperMark[]>(() =>
    getSuggestedPapers('UG', 3, 'Physics')
  );

  const [result, setResult] = useState<any>(null);
  const [savedCalculations, setSavedCalculations] = useState<any[]>([]);
  const [selectedCalculationId, setSelectedCalculationId] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);

  // Update suggested papers whenever program, semester, or active department changes
  useEffect(() => {
    const activeDept = studentDept || (department !== 'ALL' ? department : 'Chemistry');
    setPaperMarks(getSuggestedPapers(program, semester, activeDept));
  }, [program, semester, studentDept, department]);

  // -----------------------------------------
  // FIND STUDENT FUNCTIONALITY
  // -----------------------------------------
  const handleFindStudent = (customRoll?: string) => {
    setMessage(null);
    const query = (customRoll !== undefined ? customRoll : searchRoll).trim().toLowerCase();

    if (!query) {
      setSearchStatus({
        text: 'Please enter a Roll Number (Autonomous or College Roll No.) to search.',
        type: 'not-found',
      });
      return;
    }

    if (!db?.students || db.students.length === 0) {
      setSearchStatus({
        text: 'No students currently registered in database. Enter details manually below.',
        type: 'not-found',
      });
      setAutonomousRoll(searchRoll.trim());
      return;
    }

    const found = db.students.find((s) => {
      const sAuto = String(s.autonomousRollNo || s.r || '').trim().toLowerCase();
      const sCol = String(s.collegeRollNo || '').trim().toLowerCase();
      return sAuto === query || sCol === query;
    });

    if (found) {
      setFoundStudentInfo(found);
      setSearchStatus({
        text: `Student found: ${found.name || found.n} (${found.autonomousRollNo || found.r})`,
        type: 'found',
      });

      // Populate student details
      setStudentName(found.name || found.n || '');
      setAutonomousRoll(found.autonomousRollNo || found.r || '');
      setCollegeRoll(found.collegeRollNo || '');

      const foundProg = (found.programme || found.p || '').toUpperCase() === 'PG' ? 'PG' : 'UG';
      if (foundProg !== program) {
        setProgram(foundProg);
      }

      if (found.batch) setBatch(String(found.batch));
      if (found.course && found.course !== 'ALL') setCourse(found.course);

      const resolvedDept = found.department || found.course || (foundProg === 'PG' ? 'Chemistry' : 'Physics');
      setStudentDept(resolvedDept);

      // Re-initialize paper marks for this department
      setPaperMarks(getSuggestedPapers(foundProg, semester, resolvedDept));
    } else {
      setFoundStudentInfo(null);
      setSearchStatus({
        text: `No student registered with Roll Number "${searchRoll.trim()}". You may enter details and marks manually below.`,
        type: 'not-found',
      });
      setAutonomousRoll(searchRoll.trim());
    }
  };

  const handleResetIndividualForm = () => {
    setSearchRoll('');
    setFoundStudentInfo(null);
    setSearchStatus(null);
    setStudentName('');
    setAutonomousRoll('');
    setCollegeRoll('');
    setPaperMarks((prev) =>
      prev.map((p) => ({ ...p, midsem: '', practical: '', final: '' }))
    );
    setMessage(null);
  };

  // -----------------------------------------
  // SAVED CALCULATIONS
  // -----------------------------------------
  const loadSavedCalculations = async () => {
    setLoadingSaved(true);

    try {
      const response = await fetch('/api/verify', {
        cache: 'no-store',
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error || 'Failed to load saved calculations.',
        );
      }

      const records = (Array.isArray(json.data) ? json.data : []).sort(
        (a: any, b: any) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
      setSavedCalculations(records);
    } catch (error: any) {
      setMessage({
        text: error.message || 'Failed to load saved calculations.',
        type: 'bad',
      });
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    void loadSavedCalculations();
  }, []);

  const loadSelectedCalculation = () => {
    const record = savedCalculations.find(
      (item) => item.id === selectedCalculationId,
    );

    if (!record) {
      setMessage({
        text: 'Please select a saved calculation.',
        type: 'bad',
      });
      return;
    }

    setProgram(record.program === 'PG' ? 'PG' : 'UG');
    setSemester(Number(record.semester) || 1);
    setBatch(String(record.batch || '2025'));
    setDepartment(record.department || 'ALL');
    if (record.course) setCourse(record.course);

    setResult({
      ...record,
      results: Array.isArray(record.results) ? record.results : [],
      departments: Array.isArray(record.departments) ? record.departments : [],
    });

    setExcelRows([]);
    setFileName('');

    setMessage({
      text: `Loaded saved calculation ${record.id}.`,
      type: 'ok',
    });
  };

  // -----------------------------------------
  // DEPARTMENT NORMALIZATION FOR PG BULK
  // -----------------------------------------
  const normalizeDepartment = (value: unknown) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'department' || raw === 'department name') return '';

    const map: Record<string, string> = {
      odia: 'Odia',
      chemistry: 'Chemistry',
      math: 'Mathematics',
      mathematics: 'Mathematics',
      commerce: 'Commerce',
      geology: 'Geology',
      mfc: 'MFC',
    };

    return map[raw] || String(value ?? '').trim();
  };

  const detectedDepartments = useMemo(() => {
    if (program !== 'PG' || !excelRows.length) return [];

    const counts = new Map<string, number>();

    for (const row of excelRows) {
      const value =
        row?.Department ??
        row?.department ??
        row?.['Department Name'] ??
        row?.['department name'];

      const departmentName = normalizeDepartment(value);
      if (!departmentName) continue;

      counts.set(departmentName, (counts.get(departmentName) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([department, count]) => ({
      department,
      count,
    }));
  }, [program, excelRows]);

  // -----------------------------------------
  // DIRECT INDIVIDUAL STUDENT CALCULATION
  // -----------------------------------------
  const handleCalculateIndividual = async () => {
    setMessage(null);
    setResult(null);

    const name = studentName.trim();
    const auto = autonomousRoll.trim();
    const college = collegeRoll.trim();

    if (!name || (!auto && !college)) {
      setMessage({
        text: 'Please enter Student Name and Roll Number before calculating.',
        type: 'bad',
      });
      return;
    }

    const activeDept = studentDept.trim() || (department !== 'ALL' ? department : (program === 'PG' ? 'Chemistry' : 'Physics'));

    // Construct student calculation payload
    let studentObj: any = {};

    if (program === 'PG') {
      studentObj = {
        'College Roll No': college || auto,
        'College Roll No.': college || auto,
        'Autonomous Roll No': auto || college,
        'Autonomous Roll No.': auto || college,
        'Name of the Students': name,
        'Applicant Name': name,
        Department: activeDept,
        department: activeDept,
        batch: batch || '2025',
        semester: Number(semester) || 1,
        courses: paperMarks.map((p) => {
          if (p.isPrac) {
            const practicalMark = p.practical !== '' ? Number(p.practical) : (p.final !== '' ? Number(p.final) : 0);
            return {
              paper: p.code,
              code: p.code,
              title: p.title,
              practical: practicalMark,
              practicalMark,
              finalMark: practicalMark,
            };
          }
          return {
            paper: p.code,
            code: p.code,
            title: p.title,
            midsemMark: p.midsem !== '' ? Number(p.midsem) : undefined,
            finalMark: Number(p.final || 0),
            endsem: Number(p.final || 0),
          };
        }),
      };

      // Add flat Excel format keys as backup
      paperMarks.forEach((p) => {
        if (p.isPrac) {
          const pVal = p.practical !== '' ? Number(p.practical) : Number(p.final || 0);
          studentObj[`PAPER-${p.code}-END`] = pVal;
          studentObj[`PAPER-${p.code}-PRAC`] = pVal;
        } else {
          if (p.midsem !== '') studentObj[`PAPER-${p.code}-MID`] = Number(p.midsem);
          if (p.final !== '') studentObj[`PAPER-${p.code}-END`] = Number(p.final);
        }
      });
    } else {
      // UG NEP Format
      const subjectsMap: Record<string, any> = {};

      paperMarks.forEach((p) => {
        subjectsMap[p.code] = {
          code: p.code,
          paperCode: p.code,
          subject: p.title || p.code,
          MidsemMark: p.midsem !== '' ? Number(p.midsem) : '',
          PracticalMark: p.practical !== '' ? Number(p.practical) : '',
          'I-Practical': '',
          Attandance: '5',
          SurpriseTest: '5',
          Assignment: '5',
          FinalMark: p.final !== '' ? Number(p.final) : 0,
          isPractical: Boolean(p.isPrac),
        };
      });

      studentObj = {
        'Roll No': college || auto,
        'Roll No.': college || auto,
        'Autonomous Roll No': auto || college,
        'Autonomous Roll No.': auto || college,
        'Name of the Students': name,
        Department: activeDept,
        department: activeDept,
        course: course === 'ALL' ? 'BSC' : course,
        batch: Number(batch) || 2024,
        subjects: subjectsMap,
      };
    }

    setBusy(true);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculationId: selectedCalculationId || undefined,
          program,
          semester,
          batch,
          course: course === 'ALL' ? (program === 'UG' ? 'AUTO' : '') : course,
          department: activeDept,
          students: [studentObj],
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Calculation failed.');
      }

      setResult(json);

      if (json.calculationId) {
        setSelectedCalculationId(json.calculationId);
      }

      setMessage({
        text: `Result calculated successfully for "${name}" (${auto || college}) and stored under batch ${batch} (Sem ${semester})! Total students in batch: ${json.count}.`,
        type: 'ok',
      });

      await loadSavedCalculations();
    } catch (e: any) {
      setMessage({
        text: e.message || 'Calculation failed.',
        type: 'bad',
      });
    } finally {
      setBusy(false);
    }
  };

  // -----------------------------------------
  // BULK FILE UPLOAD & CALCULATION
  // -----------------------------------------
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) {
        throw new Error('The Excel file does not contain a readable worksheet.');
      }

      const rows = XLSX.utils.sheet_to_json(firstSheet, {
        defval: '',
        raw: true,
        blankrows: false,
      }) as any[];

      if (!rows.length) {
        throw new Error('The selected Excel sheet is empty.');
      }

      setExcelRows(rows);
      setFileName(file.name);

      setMessage({
        text: `Loaded ${rows.length} row(s) from "${file.name}". Click "Calculate Results" below to process.`,
        type: 'ok',
      });
    } catch (err: any) {
      setExcelRows([]);
      setFileName('');
      setMessage({
        text: err?.message || 'Could not read the spreadsheet file.',
        type: 'bad',
      });
    }
  };

  const handleLoadJsonPaste = () => {
    try {
      const parsed = JSON.parse(jsonPasteText);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (!rows.length) throw new Error('JSON array is empty.');
      setExcelRows(rows);
      setFileName('pasted-data.json');
      setMessage({
        text: `Successfully parsed ${rows.length} student record(s) from JSON. Ready to calculate.`,
        type: 'ok',
      });
    } catch (err: any) {
      setMessage({
        text: `Invalid JSON format: ${err.message}`,
        type: 'bad',
      });
    }
  };

  const calculateBulk = async () => {
    setMessage(null);
    setResult(null);

    if (!excelRows || !excelRows.length) {
      setMessage({
        text: 'Upload an Excel mark foil spreadsheet or paste JSON student records first.',
        type: 'bad',
      });
      return;
    }

    setBusy(true);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program,
          semester,
          batch,
          course: course === 'ALL' ? 'AUTO' : course,
          department: department === 'ALL' ? 'AUTO' : department,
          students: excelRows,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Calculation failed.');
      }

      setResult(json);

      if (json.calculationId) {
        setSelectedCalculationId(json.calculationId);
      }

      setMessage({
        text: `Calculation completed successfully for ${json.count} student(s)!`,
        type: 'ok',
      });

      await loadSavedCalculations();
    } catch (e: any) {
      setMessage({
        text: e.message || 'Calculation failed.',
        type: 'bad',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '20px' }}>Step 1: Ingest Marks & Calculate Result</h2>
        <p className="hint">
          Enter student marks individually (lookup by Roll Number with all subject marks) or upload bulk Excel / JSON mark foils.
        </p>
      </div>

      {/* SAVED CALCULATIONS SELECTOR */}
      <div className="card">
        <h2>Saved Calculations</h2>
        <p className="hint">Load a previously calculated UG or PG result to review or inspect.</p>
        <div className="row">
          <label style={{ flex: 2 }}>
            Select Calculation
            <select
              value={selectedCalculationId}
              onChange={(e) => setSelectedCalculationId(e.target.value)}
            >
              <option value="">-- Select a saved calculation --</option>
              {savedCalculations.map((record: any) => (
                <option key={record.id} value={record.id}>
                  {record.program} | Sem {record.semester} | Batch {record.batch || '-'} | {record.count ?? record.results?.length ?? 0} students | {record.status || 'calculated'} | {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : record.id}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn"
            onClick={loadSelectedCalculation}
            disabled={!selectedCalculationId}
          >
            Load Calculation
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => void loadSavedCalculations()}
            disabled={loadingSaved}
          >
            {loadingSaved ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>
      </div>

      {/* EXAM SCOPE CONFIGURATION */}
      <div className="card">
        <h2>Examination Scope & Parameters</h2>
        <div className="row">
          <label>
            Program
            <select
              value={program}
              onChange={(e) => {
                const newProg = e.target.value as ProgramKey;
                setProgram(newProg);
                setDepartment('ALL');
                setCourse('ALL');
                setStudentDept(newProg === 'PG' ? 'Chemistry' : 'Physics');
                setResult(null);
              }}
            >
              {(Object.keys(PROG) as ProgramKey[]).map((p) => (
                <option key={p} value={p}>
                  {PROG[p].full}
                </option>
              ))}
            </select>
          </label>

          <label>
            Semester
            <select
              value={semester}
              onChange={(e) => {
                setSemester(Number(e.target.value));
                setResult(null);
              }}
            >
              {Array.from({ length: PROG[program].sems }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Batch Year
            <select
              value={batch}
              onChange={(e) => {
                setBatch(e.target.value);
                setResult(null);
              }}
            >
              {Array.from({ length: 8 }, (_, i) => 2022 + i).map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          {program === 'PG' ? (
            <label>
              Department
              <select
                value={department}
                onChange={(e) => {
                  const val = e.target.value;
                  setDepartment(val);
                  if (val !== 'ALL') {
                    setStudentDept(val);
                  }
                  setResult(null);
                }}
              >
                {PG_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d === 'ALL' ? 'ALL (All Departments)' : d}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Course
                <select
                  value={course}
                  onChange={(e) => {
                    setCourse(e.target.value);
                    setResult(null);
                  }}
                >
                  {UG_COURSES.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'ALL (All Courses)' : c}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Department / Stream
                <input
                  value={studentDept}
                  onChange={(e) => setStudentDept(e.target.value)}
                  placeholder="e.g. Physics, History, Commerce"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* ENTRY MODE SELECTOR */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setEntryMode('individual')}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            border: entryMode === 'individual' ? '2px solid #2563eb' : '1px solid #d1d5db',
            background: entryMode === 'individual' ? '#2563eb' : 'transparent',
            color: entryMode === 'individual' ? '#ffffff' : 'inherit',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📝</span>
          <span>Individual Student Marks Entry</span>
        </button>

        <button
          type="button"
          onClick={() => setEntryMode('bulk')}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            border: entryMode === 'bulk' ? '2px solid #2563eb' : '1px solid #d1d5db',
            background: entryMode === 'bulk' ? '#2563eb' : 'transparent',
            color: entryMode === 'bulk' ? '#ffffff' : 'inherit',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📂</span>
          <span>Bulk Spreadsheet / JSON Entry</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* MODE 1: INDIVIDUAL ENTRY WITH FIND & DIRECT CALCULATION */}
      {/* ==================================================== */}
      {entryMode === 'individual' && (
        <div className="card">
          <h2>Individual Student Marks Entry &amp; Direct Calculation</h2>
          <p className="hint">
            Search for a registered student by Roll Number, enter their paper marks, and calculate results directly.
          </p>

          {/* FIND BAR */}
          <div style={{
            background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1d4ed8' }}>
              🔍 Find Student by Roll Number
            </h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: 2, minWidth: '220px' }}>
                Roll Number (Autonomous or College Roll)
                <input
                  type="text"
                  value={searchRoll}
                  onChange={(e) => setSearchRoll(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFindStudent();
                    }
                  }}
                  placeholder={program === 'PG' ? 'e.g. NACPG25001 or CHEM25-001' : 'e.g. BS24-001 or BA24-001'}
                />
              </label>

              <button
                type="button"
                className="btn primary"
                onClick={() => handleFindStudent()}
                style={{ padding: '9px 20px', fontWeight: 700 }}
              >
                🔍 Find
              </button>

              {db?.students && db.students.length > 0 && (
                <label style={{ flex: 2, minWidth: '220px' }}>
                  Quick Select from Registered List:
                  <select
                    value={searchRoll}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchRoll(val);
                      if (val) handleFindStudent(val);
                    }}
                  >
                    <option value="">-- Or choose from registered students --</option>
                    {db.students.map((s) => {
                      const auto = s.autonomousRollNo || s.r || '';
                      const col = s.collegeRollNo || '';
                      const rKey = auto || col;
                      return (
                        <option key={rKey} value={auto || col}>
                          {s.name || s.n} | {auto} {col ? `(${col})` : ''} | {s.programme || s.p} | {s.department || s.course || ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              <button
                type="button"
                className="btn"
                onClick={handleResetIndividualForm}
                style={{ padding: '9px 16px' }}
              >
                Clear
              </button>
            </div>

            {/* Search Feedback Notification */}
            {searchStatus && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                background: searchStatus.type === 'found' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${searchStatus.type === 'found' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                color: searchStatus.type === 'found' ? '#065f46' : '#92400e',
              }}>
                {searchStatus.text}
              </div>
            )}
          </div>

          {/* Student Details Row */}
          <div className="row" style={{ marginBottom: '16px' }}>
            <label>
              Student Name *
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Priyabrata Nayak"
                required
              />
            </label>

            <label>
              Autonomous Roll No. *
              <input
                type="text"
                value={autonomousRoll}
                onChange={(e) => setAutonomousRoll(e.target.value)}
                placeholder={program === 'PG' ? 'NACPG25001' : 'BA24-001'}
                required
              />
            </label>

            <label>
              College Roll No.
              <input
                type="text"
                value={collegeRoll}
                onChange={(e) => setCollegeRoll(e.target.value)}
                placeholder={program === 'PG' ? 'CHEM25-001' : 'BS24-001'}
              />
            </label>

            <label>
              {program === 'PG' ? 'Department' : 'Course / Stream'}
              <input
                type="text"
                value={studentDept}
                onChange={(e) => {
                  setStudentDept(e.target.value);
                  setPaperMarks(getSuggestedPapers(program, semester, e.target.value));
                }}
                placeholder={program === 'PG' ? 'e.g. Chemistry, Commerce, Math' : 'e.g. Physics, History'}
              />
            </label>
          </div>

          {/* Subject / Paper Marks Table */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                Subject / Paper Marks ({paperMarks.length} papers configured)
              </h3>
              <span className="hint">
                {program} Semester {semester} {studentDept}
              </span>
            </div>

            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Paper Code</th>
                    <th>Subject / Paper Title</th>
                    <th style={{ width: '150px' }}>
                      Midsem Mark {program === 'PG' ? '(Max 30)' : '(Max 20)'}
                    </th>
                    {paperMarks.some((p) => p.isPrac || p.maxPrac > 0) && (
                      <th style={{ width: '150px' }}>Practical Mark</th>
                    )}
                    <th style={{ width: '150px' }}>
                      Endsem / Final Mark {program === 'PG' ? '(Max 70)' : '(Max 70/80)'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paperMarks.map((p, idx) => (
                    <tr key={p.code}>
                      <td>
                        <strong>{p.code}</strong>
                      </td>
                      <td>
                        <span>{p.title}</span>
                        {p.isPrac && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            fontWeight: 600,
                          }}>
                            Practical
                          </span>
                        )}
                      </td>
                      <td>
                        {p.maxMid > 0 ? (
                          <input
                            type="number"
                            min="0"
                            max={p.maxMid}
                            value={p.midsem}
                            placeholder={`Max ${p.maxMid}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPaperMarks((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, midsem: val } : item
                                )
                              );
                            }}
                            style={{ width: '100%' }}
                          />
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>
                      {paperMarks.some((pm) => pm.isPrac || pm.maxPrac > 0) && (
                        <td>
                          {p.isPrac || p.maxPrac > 0 ? (
                            <input
                              type="number"
                              min="0"
                              max={p.maxPrac || 50}
                              value={p.practical}
                              placeholder={`Max ${p.maxPrac || 50}`}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPaperMarks((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, practical: val } : item
                                  )
                                );
                              }}
                              style={{ width: '100%' }}
                            />
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                      )}
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={p.maxFinal}
                          value={p.final}
                          placeholder={`Max ${p.maxFinal}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPaperMarks((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, final: val } : item
                              )
                            );
                          }}
                          style={{ width: '100%' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Direct Calculate Action Buttons */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn primary"
                disabled={busy || !studentName.trim() || (!autonomousRoll.trim() && !collegeRoll.trim())}
                onClick={handleCalculateIndividual}
                style={{
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: '15px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                {busy ? 'Calculating Result...' : `⚡ Calculate Result for ${studentName.trim() || 'Student'}`}
              </button>

              <button
                type="button"
                className="btn"
                onClick={handleResetIndividualForm}
                style={{ padding: '12px 18px' }}
              >
                🗑️ Clear &amp; New Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODE 2: BULK SPREADSHEET / JSON ENTRY */}
      {/* ==================================================== */}
      {entryMode === 'bulk' && (
        <div className="card">
          <h2>Bulk Entry: Spreadsheet (Excel) or JSON</h2>
          <p className="hint">
            Upload the college mark foil spreadsheet (.xlsx, .xls) or paste raw JSON student mark records for batch processing.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            marginTop: '16px',
          }}>
            {/* Excel Upload Section */}
            <div style={{
              padding: '16px',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '10px',
              background: 'var(--bg-card, rgba(0,0,0,0.02))',
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Option A: Upload Excel File (.xlsx / .xls)</h3>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFile}
                style={{ width: '100%', marginBottom: '10px' }}
              />

              {fileName && (
                <p className="hint" style={{ marginTop: '6px' }}>
                  File: <strong>{fileName}</strong> · Rows: <strong>{excelRows.length}</strong>
                </p>
              )}
            </div>

            {/* JSON Paste Section */}
            <div style={{
              padding: '16px',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '10px',
              background: 'var(--bg-card, rgba(0,0,0,0.02))',
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Option B: Paste JSON Records</h3>
              <textarea
                rows={3}
                value={jsonPasteText}
                onChange={(e) => setJsonPasteText(e.target.value)}
                placeholder='[{"College Roll No": "CHEM25-001", "Autonomous Roll No": "NACPG25001", "Name of the Students": "TEST", "Department": "Chemistry", "PAPER-1.1-MID": 18, "PAPER-1.1-END": 42}]'
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={handleLoadJsonPaste}
                disabled={!jsonPasteText.trim()}
                style={{ marginTop: '8px' }}
              >
                Load Pasted JSON
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn primary"
              disabled={busy || !excelRows.length}
              onClick={calculateBulk}
              style={{ fontWeight: 700, padding: '12px 24px' }}
            >
              {busy ? 'Calculating...' : `⚡ Calculate Results (${excelRows.length} Records Loaded)`}
            </button>

            {excelRows.length > 0 && (
              <span className="hint">
                Loaded {excelRows.length} student record(s) ready for calculation.
              </span>
            )}
          </div>

          {/* PG Department Detection Preview */}
          {program === 'PG' && detectedDepartments.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '14px',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '8px',
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Detected PG Departments</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {detectedDepartments.map((item) => (
                  <div
                    key={item.department}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      borderRadius: '6px',
                      background: 'var(--bg-card, #fff)',
                    }}
                  >
                    <strong>{item.department}</strong>: <span className="hint">{item.count} student(s)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATUS MESSAGE */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '16px 0',
          background: message.type === 'ok' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'ok' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: message.type === 'ok' ? '#065f46' : '#991b1b',
          fontWeight: 600,
          fontSize: '14px',
        }}>
          {message.text}
        </div>
      )}

      {/* ==================================================== */}
      {/* CALCULATION RESULTS DISPLAY */}
      {/* ==================================================== */}
      {result && (
        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            paddingBottom: '14px',
            marginBottom: '16px',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Calculation Output Summary</h2>
              <p className="hint" style={{ margin: '4px 0 0 0' }}>
                Calculation ID: <strong>{result.calculationId || result.id || 'CALC'}</strong> · Program: <strong>{result.program || program}</strong> · Semester: <strong>{result.semester || semester}</strong> · Batch: <strong>{result.batch || batch}</strong>
              </p>
            </div>

            {onProceedToVerify && (
              <button
                type="button"
                className="btn primary"
                onClick={onProceedToVerify}
                style={{
                  fontWeight: 700,
                  padding: '10px 20px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                Proceed to Step 2 (Verify Result) &rarr;
              </button>
            )}
          </div>

          {/* Stats Badges */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-card, rgba(0,0,0,0.03))', border: '1px solid var(--border-color, #e5e7eb)', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', fontWeight: 600 }}>Total Students</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{result.count ?? result.results?.length ?? 0}</div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#047857', textTransform: 'uppercase', fontWeight: 600 }}>Passed</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46', marginTop: '4px' }}>{result.passed ?? 0}</div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#b91c1c', textTransform: 'uppercase', fontWeight: 600 }}>Failed</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#991b1b', marginTop: '4px' }}>{result.failed ?? 0}</div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#1d4ed8', textTransform: 'uppercase', fontWeight: 600 }}>Pass Rate</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af', marginTop: '4px' }}>
                {result.count ? `${(((result.passed ?? 0) / result.count) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
          </div>

          {/* Department Breakdown if PG */}
          {program === 'PG' && result.departments?.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Department Breakdown</h3>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Students</th>
                      <th>Passed</th>
                      <th>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.departments.map((item: any) => (
                      <tr key={item.department}>
                        <td><strong>{item.department}</strong></td>
                        <td>{item.count}</td>
                        <td style={{ color: '#059669', fontWeight: 600 }}>{item.passed}</td>
                        <td style={{ color: item.failed > 0 ? '#dc2626' : 'inherit', fontWeight: item.failed > 0 ? 600 : 400 }}>{item.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Student Results Table Details */}
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Individual Student Calculations</h3>
            <p className="hint" style={{ marginBottom: '14px' }}>
              Click to expand any student to inspect subject marks, credits, grade points, grace points, and SGPA.
            </p>

            {(result.results || []).map((r: any, i: number) => {
              const s = r.student || {};
              const sName = s.name || s['Applicant Name'] || s['Name of the Students'] || s.n || '-';
              const autoRoll = s.autonomousRollNo || s['Autonomous Roll No'] || s['Autonomous Roll No.'] || s.r || '-';
              const sDept = s.department || s.Department || '-';

              return (
                <details
                  key={`student-${i}`}
                  style={{
                    marginBottom: 10,
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: 8,
                    padding: 12,
                    background: 'var(--bg-card, #fff)',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {i + 1}. {sName} — {autoRoll} {program === 'PG' && `— ${sDept}`}
                    <span style={{ float: 'right', color: r.sgpa && r.sgpa >= 4 ? '#059669' : '#dc2626' }}>
                      SGPA: {typeof r.sgpa === 'number' ? r.sgpa.toFixed(2) : '-'}
                    </span>
                  </summary>

                  <div className="scroll" style={{ marginTop: 14 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Paper Code</th>
                          <th>Subject Name</th>
                          <th>Marks</th>
                          <th>Full Mark</th>
                          <th>Credit</th>
                          <th>Grade</th>
                          <th>Grade Point</th>
                          <th>Credit Point</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(r.subjects || []).map((sub: any, subIdx: number) => (
                          <tr key={subIdx}>
                            <td>{sub.paperCode || `Paper ${subIdx + 1}`}</td>
                            <td>{sub.subjectName || '-'}</td>
                            <td>{sub.marks ?? '-'}</td>
                            <td>{sub.fullMark ?? '-'}</td>
                            <td>{sub.credit ?? '-'}</td>
                            <td>
                              <strong style={{ color: ['F', 'AB', 'M'].includes(sub.grade) ? '#dc2626' : '#059669' }}>
                                {sub.grade || '-'}
                              </strong>
                            </td>
                            <td>{sub.gradePoint ?? '-'}</td>
                            <td>{sub.creditPoint ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 12, fontSize: '13px' }}>
                    <b>Total Marks:</b> {r.grandTotal ?? '-'} ·{' '}
                    <b>Credits:</b> {r.totalCredits ?? '-'} ·{' '}
                    <b>Credit Points:</b> {r.totalCreditPoints ?? '-'} ·{' '}
                    <b>SGPA:</b> {typeof r.sgpa === 'number' ? r.sgpa.toFixed(2) : '-'} ·{' '}
                    <b>Percentage:</b> {typeof r.percentage === 'number' ? `${r.percentage.toFixed(2)}%` : '-'}
                  </div>
                </details>
              );
            })}
          </div>

          {/* Next Step Banner */}
          <div style={{
            marginTop: '24px',
            padding: '16px 20px',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <strong style={{ color: '#1d4ed8', fontSize: '15px' }}>
                Ready for Verification &amp; Official Publication
              </strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-color, #4b5563)' }}>
                Calculation ID {result.calculationId || result.id} has been saved as calculated data. Switch to Tab 2 to verify, then Tab 3 to publish to the main DB.
              </p>
            </div>
            {onProceedToVerify && (
              <button
                type="button"
                className="btn primary"
                onClick={onProceedToVerify}
                style={{ padding: '10px 20px', fontWeight: 700 }}
              >
                Proceed to Step 2 (Verify Result) &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
