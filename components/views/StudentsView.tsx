'use client';

import React, { useMemo, useState, ChangeEvent } from 'react';
import { DBData, Student, PROG, ProgramKey } from '@/types';
import { parseCSV, readSpreadsheetFile } from '@/lib/csv';
import { isValidStudentRecord } from '@/lib/studentValidation';

interface StudentsViewProps {
  db: DBData;
  onAddStudent: (student: Student) => Promise<boolean>;
  onUpdateStudent?: (originalRoll: string, student: Student) => Promise<boolean>;
  onDeleteStudent: (roll: string) => Promise<void>;
  onImportStudents: (students: Student[]) => Promise<void>;
}

type StudentFields = {
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
};

const emptyStudent: StudentFields = {
  batch: '2025',
  programme: 'PG',
  autonomousRollNo: '',
  collegeRollNo: '',
  name: '',
  dob: '',
  abcId: '',
  department: 'Chemistry',
  course: 'M.Sc Chemistry',
  stream: 'Science',
};

const fieldLabels: Record<keyof StudentFields, string> = {
  batch: 'Batch',
  programme: 'Programme',
  autonomousRollNo: 'Autonomous Roll No.',
  collegeRollNo: 'College Roll No.',
  name: 'Student Name',
  dob: 'Date of Birth',
  abcId: 'ABC ID',
  department: 'Department',
  course: 'Course',
  stream: 'Stream',
};

const fieldAliases: Record<keyof StudentFields, string[]> = {
  batch: ['batch', 'year', 'academicbatch', 'admissionyear', 'adm_year', 'session'],
  programme: ['programme', 'program', 'prog', 'degree'],
  autonomousRollNo: [
    'autonomousrollno',
    'autonomousrollnumber',
    'autonomousroll',
    'autorollno',
    'autorollnumber',
    'autoroll',
  ],
  collegeRollNo: [
    'collegerollno',
    'collegerollnumber',
    'collegeroll',
    'rollno',
    'rollnumber',
    'roll',
    'r',
  ],
  name: [
    'nameofthestudents',
    'nameofthestudent',
    'nameofstudent',
    'studentname',
    'applicantname',
    'candidatename',
    'fullname',
    'name',
    'n',
  ],
  dob: ['dob', 'dateofbirth', 'birthdate'],
  abcId: ['abcid', 'abcidnumber', 'academicbankofcreditsid', 'abc_id'],
  department: ['department', 'dept', 'major', 'subject', 'honours', 'hons', 'departmentname'],
  course: ['course', 'degree', 'streamcourse', 'coursename'],
  stream: ['stream', 'faculty'],
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getStudentValue(
  student: Partial<Student> & Record<string, any>,
  field: keyof StudentFields,
): string {
  const direct = student[field];
  if (direct !== undefined && direct !== null && String(direct).trim()) {
    return String(direct).trim();
  }

  // Support records created using the older Admin Panel structure.
  if (field === 'autonomousRollNo') return String(student.r ?? '').trim();
  if (field === 'name') return String(student.n ?? '').trim();
  if (field === 'programme') return String(student.p ?? '').trim();

  return '';
}

function studentRoll(student: Partial<Student> & Record<string, any>): string {
  return (
    getStudentValue(student, 'autonomousRollNo') ||
    getStudentValue(student, 'collegeRollNo') ||
    String(student.r ?? '').trim()
  );
}

function toStudent(fields: StudentFields): Student {
  const programme = fields.programme.trim().toUpperCase() as ProgramKey;

  return {
    ...fields,
    batch: fields.batch.trim(),
    programme,
    autonomousRollNo: fields.autonomousRollNo.trim(),
    collegeRollNo: fields.collegeRollNo.trim(),
    name: fields.name.trim(),
    dob: fields.dob.trim(),
    abcId: fields.abcId.trim(),
    department: fields.department.trim(),
    course: fields.course.trim(),
    stream: fields.stream.trim(),

    // Backward compatibility with existing Admin Panel code.
    r: fields.autonomousRollNo.trim() || fields.collegeRollNo.trim(),
    n: fields.name.trim(),
    p: programme,
  } as Student;
}

export function StudentsView({
  db,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onImportStudents,
}: StudentsViewProps) {
  const [form, setForm] = useState<StudentFields>({ ...emptyStudent });
  const [editingRoll, setEditingRoll] = useState<string | null>(null);
  const [addMsg, setAddMsg] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterProg, setFilterProg] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  // Bulk import state
  const [csvText, setCsvText] = useState('');
  const [importTargetProg, setImportTargetProg] = useState<'UG' | 'PG'>('UG');
  const [importTargetBatch, setImportTargetBatch] = useState('2024');
  const [impData, setImpData] = useState<{
    add: Student[];
    upd: number;
    errs: string[];
  } | null>(null);
  const [impMsg, setImpMsg] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);

  const updateField = (field: keyof StudentFields, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setAddMsg(null);
  };

  // Program switch auto-refresh
  const handleProgrammeChange = (newProg: string) => {
    const isPG = newProg.toUpperCase() === 'PG';
    setForm({
      programme: newProg,
      batch: isPG ? '2025' : '2024',
      autonomousRollNo: '',
      collegeRollNo: '',
      name: '',
      dob: '',
      abcId: '',
      department: isPG ? 'Chemistry' : 'Physics',
      course: isPG ? 'M.Sc Chemistry' : 'BSC',
      stream: 'Science',
    });
    setEditingRoll(null);
    setAddMsg({
      text: `Switched to ${newProg} programme. Fields refreshed with ${newProg} defaults.`,
      type: 'ok',
    });
  };

  // Start Edit Mode with visual highlight
  const handleStartEdit = (record: Partial<Student> & Record<string, any>) => {
    const roll = studentRoll(record);
    const sName = getStudentValue(record, 'name');
    setEditingRoll(roll);
    setForm({
      batch: getStudentValue(record, 'batch') || '2025',
      programme: getStudentValue(record, 'programme') || 'UG',
      autonomousRollNo: getStudentValue(record, 'autonomousRollNo'),
      collegeRollNo: getStudentValue(record, 'collegeRollNo'),
      name: sName,
      dob: getStudentValue(record, 'dob'),
      abcId: getStudentValue(record, 'abcId'),
      department: getStudentValue(record, 'department'),
      course: getStudentValue(record, 'course'),
      stream: getStudentValue(record, 'stream'),
    });

    setAddMsg({
      text: `Editing mode active for "${sName}" (${roll}). Modify details and click "Save changes".`,
      type: 'ok',
    });

    // Smooth scroll to form card
    const formCard = document.getElementById('student-form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    const isPG = form.programme === 'PG';
    setEditingRoll(null);
    setForm({
      programme: form.programme,
      batch: isPG ? '2025' : '2024',
      autonomousRollNo: '',
      collegeRollNo: '',
      name: '',
      dob: '',
      abcId: '',
      department: isPG ? 'Chemistry' : 'Physics',
      course: isPG ? 'M.Sc Chemistry' : 'BSC',
      stream: 'Science',
    });
    setAddMsg(null);
  };

  const handleSaveEdit = async () => {
    if (!editingRoll) return;

    const autoRoll = form.autonomousRollNo.trim();
    const collegeRoll = form.collegeRollNo.trim();
    const name = form.name.trim();
    const programme = form.programme.trim().toUpperCase() as ProgramKey;

    if (!name || !programme || (!autoRoll && !collegeRoll)) {
      setAddMsg({
        text: 'Enter the student name, programme, and at least one roll number.',
        type: 'bad',
      });
      return;
    }

    if (!PROG[programme]) {
      setAddMsg({
        text: 'Programme must be one of the configured programs (UG / PG).',
        type: 'bad',
      });
      return;
    }

    const student = toStudent({ ...form, programme });

    try {
      let success = false;
      if (onUpdateStudent) {
        success = await onUpdateStudent(editingRoll, student);
      } else {
        const res = await fetch('/api/students', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalRoll: editingRoll, ...student }),
        });
        const json = await res.json();
        success = res.ok && json.success;
      }

      if (success) {
        setEditingRoll(null);
        setForm({ ...emptyStudent, programme: form.programme });
        setAddMsg({
          text: `Updated student "${name}" successfully.`,
          type: 'ok',
        });
      } else {
        setAddMsg({
          text: 'Failed to update student. Please check details.',
          type: 'bad',
        });
      }
    } catch {
      setAddMsg({
        text: 'An error occurred while updating the student.',
        type: 'bad',
      });
    }
  };

  const handleAdd = async () => {
    // If edit mode was on, clear it to prevent replacing
    if (editingRoll) {
      setEditingRoll(null);
    }

    const autoRoll = form.autonomousRollNo.trim();
    const collegeRoll = form.collegeRollNo.trim();
    const name = form.name.trim();
    const programme = form.programme.trim().toUpperCase();

    if (!name || !programme || (!autoRoll && !collegeRoll)) {
      setAddMsg({
        text: 'Enter the student name, programme, and at least one roll number.',
        type: 'bad',
      });
      return;
    }

    if (!PROG[programme as ProgramKey]) {
      setAddMsg({
        text: 'Programme must be one of the configured programs (UG / PG).',
        type: 'bad',
      });
      return;
    }

    const duplicate = db.students.some((student) => {
      const existingAuto = getStudentValue(
        student as Student & Record<string, any>,
        'autonomousRollNo',
      );
      const existingCollege = getStudentValue(
        student as Student & Record<string, any>,
        'collegeRollNo',
      );

      return (
        (autoRoll && existingAuto.toLowerCase() === autoRoll.toLowerCase()) ||
        (collegeRoll &&
          existingCollege.toLowerCase() === collegeRoll.toLowerCase())
      );
    });

    if (duplicate) {
      setAddMsg({
        text: 'A student with this autonomous or college roll number already exists in the database.',
        type: 'bad',
      });
      return;
    }

    const student = toStudent({ ...form, programme });

    try {
      const success = await onAddStudent(student);

      if (success) {
        setForm({
          ...emptyStudent,
          programme: form.programme,
          batch: form.programme === 'PG' ? '2025' : '2024',
          department: form.department,
          course: form.course,
          stream: form.stream,
        });
        setPageIndex(0); // Move to first page so the new student is seen immediately
        setAddMsg({
          text: `Added "${name}" successfully! Record saved to main database.`,
          type: 'ok',
        });
      } else {
        setAddMsg({
          text: 'Student could not be added. Please check the details.',
          type: 'bad',
        });
      }
    } catch {
      setAddMsg({
        text: 'An error occurred while saving the student.',
        type: 'bad',
      });
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readSpreadsheetFile(file);
      setCsvText(content);
      setImpData(null);
      setImpMsg({
        text: `File "${file.name}" loaded successfully. Click "Check & Preview" to validate.`,
        type: 'ok',
      });
    } catch {
      setImpMsg({
        text: 'Error reading spreadsheet file.',
        type: 'bad',
      });
    }
  };

  const handlePreviewCSV = () => {
    const rows = parseCSV(csvText);

    if (!rows.length) {
      setImpMsg({
        text: 'Choose an Excel/CSV file or paste student rows first.',
        type: 'bad',
      });
      setImpData(null);
      return;
    }

    const header = rows[0].map(normalizeHeader);

    // Identify columns
    const columnIndexes = {} as Record<keyof StudentFields, number>;
    (Object.keys(fieldAliases) as (keyof StudentFields)[]).forEach((field) => {
      columnIndexes[field] = header.findIndex((column) =>
        fieldAliases[field].includes(column),
      );
    });

    // Handle disambiguation between 'Roll No' and 'Autonomous Roll No'
    const autoIdx = header.findIndex((c) =>
      ['autonomousrollno', 'autonomousrollnumber', 'autonomousroll', 'autorollno'].includes(c)
    );
    const colIdx = header.findIndex((c) =>
      ['collegerollno', 'collegerollnumber', 'collegeroll', 'rollno', 'rollnumber', 'roll', 'r'].includes(c)
    );

    if (autoIdx >= 0) {
      columnIndexes.autonomousRollNo = autoIdx;
    }
    if (colIdx >= 0 && colIdx !== autoIdx) {
      columnIndexes.collegeRollNo = colIdx;
    } else if (columnIndexes.collegeRollNo === autoIdx) {
      columnIndexes.collegeRollNo = -1;
    }

    const headerLooksValid =
      columnIndexes.autonomousRollNo >= 0 ||
      columnIndexes.collegeRollNo >= 0 ||
      columnIndexes.name >= 0;

    const dataRows = headerLooksValid ? rows.slice(1) : rows;
    const errors: string[] = [];
    const students: Student[] = [];
    const seen = new Set<string>();
    let updatedCount = 0;

    dataRows.forEach((row, index) => {
      const val = (field: keyof StudentFields): string => {
        const col = columnIndexes[field];
        return col !== undefined && col >= 0 ? String(row[col] ?? '').trim() : '';
      };

      let autoRoll = val('autonomousRollNo');
      let colRoll = val('collegeRollNo');
      const sName = val('name');

      // If only one roll is present, assign appropriately
      if (!autoRoll && colRoll) {
        if (colRoll.toUpperCase().includes('NAC') || colRoll.toUpperCase().startsWith('0') || colRoll.length > 8) {
          autoRoll = colRoll;
        }
      }

      // Target Programme from selection or explicit column
      let prog = val('programme').toUpperCase();
      if (!prog || !PROG[prog as ProgramKey]) {
        prog = importTargetProg;
      }

      // Auto-detect Batch
      let batchVal = val('batch');
      if (!batchVal) {
        const checkRoll = (autoRoll || colRoll).toUpperCase();
        if (checkRoll.includes('24')) batchVal = '2024';
        else if (checkRoll.includes('25')) batchVal = '2025';
        else if (checkRoll.includes('26')) batchVal = '2026';
        else batchVal = importTargetBatch || '2024';
      }

      // Auto-detect Course and Stream
      let courseVal = val('course');
      let streamVal = val('stream');
      const deptVal = val('department');

      if (!courseVal) {
        const checkRoll = (autoRoll || colRoll).toUpperCase();
        if (checkRoll.startsWith('BA')) {
          courseVal = 'BA';
          if (!streamVal) streamVal = 'Arts';
        } else if (checkRoll.startsWith('BS')) {
          courseVal = 'BSC';
          if (!streamVal) streamVal = 'Science';
        } else if (checkRoll.startsWith('BC')) {
          courseVal = 'BCOM';
          if (!streamVal) streamVal = 'Commerce';
        } else if (checkRoll.startsWith('BCA')) {
          courseVal = 'BCA';
          if (!streamVal) streamVal = 'Science';
        } else if (checkRoll.startsWith('BBA')) {
          courseVal = 'BBA';
          if (!streamVal) streamVal = 'Commerce';
        } else {
          courseVal = prog === 'PG' ? (deptVal || 'PG') : 'UG';
          if (!streamVal) streamVal = 'Science';
        }
      }

      const fields: StudentFields = {
        batch: batchVal,
        programme: prog,
        autonomousRollNo: autoRoll,
        collegeRollNo: colRoll,
        name: sName,
        dob: val('dob'),
        abcId: val('abcId'),
        department: deptVal || courseVal || 'General',
        course: courseVal,
        stream: streamVal || 'General',
      };

      // If completely blank row, silently skip
      if (!autoRoll && !colRoll && !sName) {
        return;
      }

      if (!isValidStudentRecord({ ...fields, name: sName, autonomousRollNo: autoRoll, collegeRollNo: colRoll })) {
        return;
      }

      const line = `Row ${index + (headerLooksValid ? 2 : 1)}:`;

      if (!fields.name || (!fields.autonomousRollNo && !fields.collegeRollNo)) {
        errors.push(`${line} Missing name or roll number.`);
        return;
      }

      const keys = [
        fields.autonomousRollNo ? `auto:${fields.autonomousRollNo.toLowerCase()}` : '',
        fields.collegeRollNo ? `col:${fields.collegeRollNo.toLowerCase()}` : '',
      ].filter(Boolean);

      if (keys.some((k) => seen.has(k))) {
        errors.push(`${line} Duplicate roll in spreadsheet.`);
        return;
      }
      keys.forEach((k) => seen.add(k));

      const existing = db.students.some((student) => {
        const exAuto = getStudentValue(student as Student & Record<string, any>, 'autonomousRollNo').toLowerCase();
        const exCol = getStudentValue(student as Student & Record<string, any>, 'collegeRollNo').toLowerCase();
        return (
          (fields.autonomousRollNo && exAuto === fields.autonomousRollNo.toLowerCase()) ||
          (fields.collegeRollNo && exCol === fields.collegeRollNo.toLowerCase())
        );
      });

      if (existing) updatedCount++;

      students.push(toStudent(fields));
    });

    setImpData({
      add: students,
      upd: updatedCount,
      errs: errors,
    });
    setImpMsg(null);
  };

  const handleDoImport = async () => {
    if (!impData || !impData.add.length) return;

    try {
      await onImportStudents(impData.add);
      setImpMsg({
        text: `Successfully imported ${impData.add.length} student records into database!`,
        type: 'ok',
      });
      setImpData(null);
      setCsvText('');
    } catch {
      setImpMsg({
        text: 'Import failed. Please check spreadsheet data and try again.',
        type: 'bad',
      });
    }
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return db.students.filter(isValidStudentRecord).filter((student) => {
      const record = student as Student & Record<string, any>;
      const programme = getStudentValue(record, 'programme').toUpperCase();
      const values = (
        Object.keys(fieldLabels) as (keyof StudentFields)[]
      ).map((field) => getStudentValue(record, field));

      values.push(
        String(record.r ?? ''),
        String(record.n ?? ''),
        String(record.p ?? ''),
      );

      const matchesProgram = !filterProg || programme === filterProg;
      const matchesSearch =
        !query || values.some((value) => value.toLowerCase().includes(query));

      return matchesProgram && matchesSearch;
    });
  }, [db.students, searchQuery, filterProg]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const paginatedList = filteredStudents.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px' }}>Examination — Students Registry</h1>
        <p className="sub" style={{ margin: 0 }}>
          Manage enrolled students for examination batches. Add individual students with all details or import bulk lists from Excel/CSV.
        </p>
      </div>

      {/* Add / Edit Student Form Card */}
      <div
        id="student-form-card"
        className="card"
        style={{
          border: editingRoll ? '2px solid #2563eb' : undefined,
          boxShadow: editingRoll
            ? '0 0 0 4px rgba(37, 99, 235, 0.2), 0 8px 24px rgba(0,0,0,0.06)'
            : undefined,
          transition: 'all 0.3s ease',
        }}
      >
        {/* Edit Mode Notice Banner */}
        {editingRoll && (
          <div
            style={{
              background: 'linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>✏️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '15px' }}>
                  EDITING STUDENT: {form.name || editingRoll}
                </div>
                <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '2px' }}>
                  Roll Key: <strong>{editingRoll}</strong> · Modify the fields below and click "Save changes" or cancel to add a new student.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn"
              onClick={handleCancelEdit}
              style={{
                background: '#ffffff',
                border: '1px solid #93c5fd',
                color: '#1e40af',
                fontWeight: 600,
                padding: '6px 14px',
              }}
            >
              ✕ Cancel Edit / New Student
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ margin: 0 }}>
            {editingRoll ? `Edit Student (${editingRoll})` : 'Add Student (Individual Entry)'}
          </h2>
          <span className="hint">
            {editingRoll ? 'Updating existing record' : 'Creates new main batch data in database'}
          </span>
        </div>

        <div className="row">
          {(Object.keys(fieldLabels) as (keyof StudentFields)[]).map((field) => (
            <label key={field}>
              {fieldLabels[field]}
              {field === 'programme' ? (
                <select
                  value={form.programme}
                  onChange={(event) => handleProgrammeChange(event.target.value)}
                >
                  {(Object.keys(PROG) as ProgramKey[]).map((programKey) => (
                    <option key={programKey} value={programKey}>
                      {PROG[programKey].full} ({programKey})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder={
                    field === 'autonomousRollNo'
                      ? (form.programme === 'PG' ? 'NACPG25001' : '03NAC24001')
                      : field === 'collegeRollNo'
                      ? (form.programme === 'PG' ? 'CHEM25-001' : 'BA24-001')
                      : field === 'name'
                      ? 'Student Full Name'
                      : field === 'dob'
                      ? 'YYYY-MM-DD'
                      : field === 'abcId'
                      ? 'ABC ID (12 digits)'
                      : field === 'department'
                      ? (form.programme === 'PG' ? 'Chemistry' : 'Physics')
                      : field === 'course'
                      ? (form.programme === 'PG' ? 'M.Sc Chemistry' : 'BSC')
                      : field === 'stream'
                      ? 'Science'
                      : field === 'batch'
                      ? (form.programme === 'PG' ? '2025' : '2024')
                      : ''
                  }
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              )}
            </label>
          ))}

          {editingRoll ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={handleSaveEdit} style={{ fontWeight: 700 }}>
                💾 Save changes
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  if (editingRoll) {
                    await onDeleteStudent(editingRoll);
                    handleCancelEdit();
                  }
                }}
                style={{ fontWeight: 600 }}
              >
                🗑️ Delete Student
              </button>
              <button className="btn" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 10 }}>
              <button className="btn primary" onClick={handleAdd} style={{ fontWeight: 700 }}>
                ➕ Add Student
              </button>
            </div>
          )}
        </div>

        {addMsg && <div className={`msg ${addMsg.type}`}>{addMsg.text}</div>}
      </div>

      {/* Bulk Import Card */}
      <div className="card">
        <h2>Bulk Import Students from Excel / CSV</h2>
        <p className="hint" style={{ margin: '0 0 12px' }}>
          Upload any official examination spreadsheet (.xlsx, .xls, .csv). Columns are matched automatically including <b>Roll No, Autonomous Roll No, Name of the Students, Department</b>, etc.
        </p>

        {/* Import Preferences Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: 'var(--bg-card, rgba(0,0,0,0.02))',
          borderRadius: '8px',
          border: '1px solid var(--border-color, #e5e7eb)',
          marginBottom: '12px',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
            <span>Target Programme:</span>
            <select
              value={importTargetProg}
              onChange={(e) => setImportTargetProg(e.target.value as 'UG' | 'PG')}
              style={{ padding: '4px 8px', borderRadius: '6px' }}
            >
              <option value="UG">Undergraduate (UG)</option>
              <option value="PG">Postgraduate (PG)</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
            <span>Default Batch:</span>
            <select
              value={importTargetBatch}
              onChange={(e) => setImportTargetBatch(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '6px' }}
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2023">2023</option>
            </select>
          </label>
        </div>

        <textarea
          rows={3}
          placeholder={`Roll No,Autonomous Roll No,Name of the Students,Department\nBA24-001,01NAC24001,SUBHAM DASH,ECONOMICS\nBA24-002,02NAC24002,PRIYA NAYAK,HISTORY`}
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setImpData(null);
            setImpMsg(null);
          }}
        />

        <div className="row" style={{ marginTop: 10 }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            style={{ flex: '1 1 200px' }}
            onChange={handleFileChange}
          />
          <button className="btn primary" onClick={handlePreviewCSV} style={{ fontWeight: 600 }}>
            🔍 Check &amp; Preview File
          </button>
        </div>

        {impMsg && <p className={`msg ${impMsg.type}`}>{impMsg.text}</p>}

        {impData && (
          <div style={{ marginTop: 12, padding: '14px', borderRadius: '8px', background: 'var(--bg-card, rgba(0,0,0,0.02))', border: '1px solid var(--border-color, #e5e7eb)' }}>
            <p className="msg ok" style={{ margin: '0 0 10px 0' }}>
              ✓ <strong>{impData.add.length} valid student record(s)</strong> ready for import ({impData.add.length - impData.upd} new, {impData.upd} updates to existing rolls).
            </p>

            {impData.errs.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <p className="hint" style={{ color: 'var(--bad)', fontWeight: 600 }}>
                  ⚠️ {impData.errs.length} row(s) skipped due to missing required data:
                </p>
                <div className="hint" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {impData.errs.slice(0, 5).map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                  {impData.errs.length > 5 && (
                    <div>...and {impData.errs.length - 5} more.</div>
                  )}
                </div>
              </div>
            )}

            {impData.add.length > 0 && (
              <button
                className="btn primary"
                style={{ fontWeight: 700, padding: '10px 20px' }}
                onClick={handleDoImport}
              >
                📥 Confirm &amp; Save {impData.add.length} Students to Database
              </button>
            )}
          </div>
        )}
      </div>

      {/* Student Registry Table */}
      <div className="card">
        <div className="row">
          <label style={{ flex: 2 }}>
            Search student records
            <input
              placeholder="Search by roll number, name, department, ABC ID..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPageIndex(0);
              }}
            />
          </label>

          <label>
            Programme
            <select
              value={filterProg}
              onChange={(event) => {
                setFilterProg(event.target.value);
                setPageIndex(0);
              }}
            >
              <option value="">All programmes</option>
              {(Object.keys(PROG) as ProgramKey[]).map((programKey) => (
                <option key={programKey} value={programKey}>
                  {PROG[programKey].full} ({programKey})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Total Students display under search and programs */}
        <div style={{
          marginTop: '10px',
          marginBottom: '6px',
          padding: '8px 14px',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
        }}>
          <div>
            <strong style={{ color: '#1e40af' }}>Total Students:</strong>{' '}
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{filteredStudents.length}</span> students enrolled
            {db.students.length !== filteredStudents.length && (
              <span style={{ color: '#64748b', fontSize: '12px' }}>
                {' '}(filtered from {db.students.length} total)
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {filteredStudents.length === 0 ? (
            <div className="empty">
              No students found. Add a student above or import a spreadsheet.
            </div>
          ) : (
            <>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Programme</th>
                      <th>Autonomous Roll No.</th>
                      <th>College Roll No.</th>
                      <th>Name</th>
                      <th>Date of Birth</th>
                      <th>ABC ID</th>
                      <th>Department</th>
                      <th>Course</th>
                      <th>Stream</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedList.map((student) => {
                      const record = student as Student & Record<string, any>;
                      const roll = studentRoll(record);
                      const isRowEditing = editingRoll === roll;

                      return (
                        <tr
                          key={roll}
                          style={{
                            background: isRowEditing ? 'rgba(37, 99, 235, 0.08)' : undefined,
                            fontWeight: isRowEditing ? 600 : undefined,
                          }}
                        >
                          <td>{getStudentValue(record, 'batch') || '—'}</td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: getStudentValue(record, 'programme') === 'PG' ? '#f3e8ff' : '#dbeafe',
                              color: getStudentValue(record, 'programme') === 'PG' ? '#7e22ce' : '#1e40af',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}>
                              {getStudentValue(record, 'programme') || '—'}
                            </span>
                          </td>
                          <td>
                            <strong>{getStudentValue(record, 'autonomousRollNo') || '—'}</strong>
                          </td>
                          <td>
                            {getStudentValue(record, 'collegeRollNo') || '—'}
                          </td>
                          <td>{getStudentValue(record, 'name') || '—'}</td>
                          <td>{getStudentValue(record, 'dob') || '—'}</td>
                          <td>{getStudentValue(record, 'abcId') || '—'}</td>
                          <td>{getStudentValue(record, 'department') || '—'}</td>
                          <td>{getStudentValue(record, 'course') || '—'}</td>
                          <td>{getStudentValue(record, 'stream') || '—'}</td>
                          <td className="num">
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                className={`btn ${isRowEditing ? 'primary' : ''}`}
                                onClick={() => handleStartEdit(record)}
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                              >
                                {isRowEditing ? '✏️ Editing...' : 'Edit'}
                              </button>
                              <button
                                className="btn danger"
                                onClick={async () => {
                                  await onDeleteStudent(roll);
                                  if (editingRoll === roll) {
                                    handleCancelEdit();
                                  }
                                }}
                                style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
                                title="Delete student"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pager" style={{ marginTop: 14 }}>
                <button
                  className="btn"
                  disabled={currentPage <= 0}
                  onClick={() => setPageIndex(Math.max(0, currentPage - 1))}
                >
                  Previous
                </button>

                <span>
                  Page {currentPage + 1} of {totalPages}
                </span>

                <button
                  className="btn"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() =>
                    setPageIndex(Math.min(totalPages - 1, currentPage + 1))
                  }
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
