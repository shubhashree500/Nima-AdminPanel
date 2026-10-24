 'use client';

import React, { useMemo, useState, ChangeEvent } from 'react';
import { DBData, Student, PROG, ProgramKey } from '@/types';
import { parseCSV, readSpreadsheetFile } from '@/lib/csv';

interface StudentsViewProps {
  db: DBData;
  onAddStudent: (student: Student) => Promise<boolean>;
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
  department: '',
  course: '',
  stream: '',
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
  batch: ['batch', 'year', 'academicbatch'],
  programme: ['programme', 'program', 'prog'],
  autonomousRollNo: [
    'autonomousrollno',
    'autonomousrollnumber',
    'autonomousroll',
    'rollno',
    'rollnumber',
    'roll',
    'r',
  ],
  collegeRollNo: [
    'collegerollno',
    'collegerollnumber',
    'collegeroll',
  ],
  name: ['name', 'studentname', 'fullname', 'n'],
  dob: ['dob', 'dateofbirth', 'birthdate'],
  abcId: ['abcid', 'abcidnumber', 'academicbankofcreditsid'],
  department: ['department', 'dept'],
  course: ['course', 'subject'],
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
    getStudentValue(student, 'collegeRollNo')
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
  onDeleteStudent,
  onImportStudents,
}: StudentsViewProps) {
  const [form, setForm] = useState<StudentFields>({ ...emptyStudent });
  const [addMsg, setAddMsg] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterProg, setFilterProg] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const [csvText, setCsvText] = useState('');
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

  const handleAdd = async () => {
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
        text: 'Programme must be one of the configured programs.',
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
        text: 'A student with this autonomous or college roll number already exists.',
        type: 'bad',
      });
      return;
    }

    const student = toStudent({ ...form, programme });

    try {
      const success = await onAddStudent(student);

      if (success) {
        setForm({ ...emptyStudent });
        setAddMsg({
          text: `Added ${name} successfully.`,
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
      setImpMsg(null);
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
        text: 'Choose a file or paste student data first.',
        type: 'bad',
      });
      setImpData(null);
      return;
    }

    const header = rows[0].map(normalizeHeader);
    const headerLooksValid = header.some((column) =>
      [
        ...fieldAliases.autonomousRollNo,
        ...fieldAliases.collegeRollNo,
        ...fieldAliases.name,
        ...fieldAliases.programme,
      ].includes(column),
    );

    const columnIndexes = {} as Record<keyof StudentFields, number>;

    if (headerLooksValid) {
      (Object.keys(fieldAliases) as (keyof StudentFields)[]).forEach((field) => {
        columnIndexes[field] = header.findIndex((column) =>
          fieldAliases[field].includes(column),
        );
      });
    } else {
      // Legacy three-column format: roll number, name, program.
      columnIndexes.autonomousRollNo = 0;
      columnIndexes.collegeRollNo = -1;
      columnIndexes.name = 1;
      columnIndexes.programme = 2;

      (
        [
          'batch',
          'dob',
          'abcId',
          'department',
          'course',
          'stream',
        ] as (keyof StudentFields)[]
      ).forEach((field) => {
        columnIndexes[field] = -1;
      });
    }

    const dataRows = headerLooksValid ? rows.slice(1) : rows;
    const errors: string[] = [];
    const students: Student[] = [];
    const seen = new Set<string>();
    let updatedCount = 0;

    dataRows.forEach((row, index) => {
      const value = (field: keyof StudentFields): string => {
        const columnIndex = columnIndexes[field];
        return columnIndex >= 0
          ? String(row[columnIndex] ?? '').trim()
          : '';
      };

      const fields: StudentFields = {
        batch: value('batch') || '2025',
        programme: value('programme').toUpperCase(),
        autonomousRollNo: value('autonomousRollNo'),
        collegeRollNo: value('collegeRollNo'),
        name: value('name'),
        dob: value('dob'),
        abcId: value('abcId'),
        department: value('department'),
        course: value('course'),
        stream: value('stream'),
      };

      const line = `Row ${index + (headerLooksValid ? 2 : 1)}:`;

      if (
        !fields.name ||
        (!fields.autonomousRollNo && !fields.collegeRollNo)
      ) {
        errors.push(
          `${line} student name and at least one roll number are required.`,
        );
        return;
      }

      if (!PROG[fields.programme as ProgramKey]) {
        errors.push(
          `${line} invalid programme "${fields.programme}".`,
        );
        return;
      }

      const keys = [
        fields.autonomousRollNo
          ? `auto:${fields.autonomousRollNo.toLowerCase()}`
          : '',
        fields.collegeRollNo
          ? `college:${fields.collegeRollNo.toLowerCase()}`
          : '',
      ].filter(Boolean);

      if (keys.some((key) => seen.has(key))) {
        errors.push(`${line} duplicate roll number in the imported file.`);
        return;
      }

      keys.forEach((key) => seen.add(key));

      const existing = db.students.some((student) => {
        const existingAuto = getStudentValue(
          student as Student & Record<string, any>,
          'autonomousRollNo',
        ).toLowerCase();
        const existingCollege = getStudentValue(
          student as Student & Record<string, any>,
          'collegeRollNo',
        ).toLowerCase();

        return (
          (fields.autonomousRollNo &&
            existingAuto === fields.autonomousRollNo.toLowerCase()) ||
          (fields.collegeRollNo &&
            existingCollege === fields.collegeRollNo.toLowerCase())
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
        text: `Submitted ${impData.add.length} student records for import.`,
        type: 'ok',
      });
      setImpData(null);
      setCsvText('');
    } catch {
      setImpMsg({
        text: 'Import failed. Please try again.',
        type: 'bad',
      });
    }
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return db.students.filter((student) => {
      const record = student as Student & Record<string, any>;

      const programme = getStudentValue(record, 'programme').toUpperCase();
      const values = (
        Object.keys(fieldLabels) as (keyof StudentFields)[]
      ).map((field) => getStudentValue(record, field));

      // Include legacy fields in the search as well.
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
      <h1>Students</h1>
      <p className="sub">
        Add complete student records or import a student list from Excel/CSV.
      </p>

      <div className="card">
        <h2>Add a student</h2>

        <div className="row">
          {(Object.keys(fieldLabels) as (keyof StudentFields)[]).map(
            (field) => (
              <label key={field}>
                {fieldLabels[field]}
                {field === 'programme' ? (
                  <select
                    value={form.programme}
                    onChange={(event) =>
                      updateField(field, event.target.value)
                    }
                  >
                    {(Object.keys(PROG) as ProgramKey[]).map((programKey) => (
                      <option key={programKey} value={programKey}>
                        {programKey}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder={
                      field === 'autonomousRollNo'
                        ? '153NAC25001'
                        : field === 'collegeRollNo'
                          ? 'CHEM25-001'
                          : field === 'name'
                            ? 'ABINASH SAHOO'
                            : field === 'dob'
                              ? '11-02-2004'
                              : field === 'abcId'
                                ? '37643'
                                : field === 'department'
                                  ? 'Chemistry'
                                  : field === 'course'
                                    ? 'Chemistry'
                                    : field === 'stream'
                                      ? 'SCIENCE'
                                      : field === 'batch'
                                        ? '2025'
                                        : ''
                    }
                    value={form[field]}
                    onChange={(event) =>
                      updateField(field, event.target.value)
                    }
                  />
                )}
              </label>
            ),
          )}

          <button className="btn primary" onClick={handleAdd}>
            Add student
          </button>
        </div>

        {addMsg && (
          <div className={`msg ${addMsg.type}`}>{addMsg.text}</div>
        )}
      </div>

      <div className="card">
        <h2>Import students from Excel / CSV</h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          Include these columns: <b>batch, programme, autonomousRollNo,
          collegeRollNo, name, dob, abcId, department, course, stream</b>.
          Column order does not matter when the headers are included. You can
          also choose an Excel file or paste spreadsheet cells below.
        </p>

        <textarea
          placeholder={
            'batch,programme,autonomousRollNo,collegeRollNo,name,dob,abcId,department,course,stream\n2025,PG,153NAC25001,CHEM25-001,ABINASH SAHOO,11-02-2004,37643,Chemistry,Chemistry,SCIENCE'
          }
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
          <button className="btn" onClick={handlePreviewCSV}>
            Check file
          </button>
        </div>

        {impMsg && (
          <p className={`msg ${impMsg.type}`}>{impMsg.text}</p>
        )}

        {impData && (
          <div style={{ marginTop: 10 }}>
            <p className="msg ok">
              {impData.add.length - impData.upd} new, {impData.upd} existing
              records matched by roll number.
            </p>

            {impData.errs.length > 0 && (
              <>
                <p className="hint" style={{ color: 'var(--bad)' }}>
                  {impData.errs.length} row(s) will be skipped:
                </p>
                <div className="hint">
                  {impData.errs.slice(0, 8).map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                  {impData.errs.length > 8 && (
                    <div>And {impData.errs.length - 8} more.</div>
                  )}
                </div>
              </>
            )}

            {impData.add.length > 0 && (
              <button
                className="btn primary"
                style={{ marginTop: 12 }}
                onClick={handleDoImport}
              >
                Import {impData.add.length} students
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row">
          <label>
            Search student records
            <input
              placeholder="Search roll, name, department, ABC ID..."
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
                  {PROG[programKey].full}
                </option>
              ))}
            </select>
          </label>
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
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedList.map((student) => {
                      const record = student as Student & Record<string, any>;
                      const roll = studentRoll(record);

                      return (
                        <tr key={roll}>
                          <td>{getStudentValue(record, 'batch') || '—'}</td>
                          <td>{getStudentValue(record, 'programme') || '—'}</td>
                          <td>
                            {getStudentValue(record, 'autonomousRollNo') || '—'}
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
                            <button
                              className="btn danger"
                              onClick={() => onDeleteStudent(roll)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <span>{filteredStudents.length} students</span>

                <button
                  className="btn"
                  disabled={currentPage <= 0}
                  onClick={() =>
                    setPageIndex(Math.max(0, currentPage - 1))
                  }
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
                    setPageIndex(
                      Math.min(totalPages - 1, currentPage + 1),
                    )
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
