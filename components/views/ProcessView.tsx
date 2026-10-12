'use client';

import React, {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as XLSX from 'xlsx';
import { ProgramKey, PROG } from '@/types';

export function ProcessView() {
  const [program, setProgram] =
    useState<ProgramKey>('UG');

  const [semester, setSemester] =
    useState(1);

  const [batch, setBatch] =
    useState('2025');

  const [department, setDepartment] =
    useState('');

  const [excelRows, setExcelRows] =
    useState<any[]>([]);

  const [fileName, setFileName] =
    useState('');

  const [result, setResult] =
    useState<any>(null);

const [savedCalculations, setSavedCalculations] =
  useState<any[]>([]);

const [selectedCalculationId, setSelectedCalculationId] =
  useState('');

const [loadingSaved, setLoadingSaved] =
  useState(false);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<{
      text: string;
      type: 'ok' | 'bad';
    } | null>(null);

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

      const records = (Array.isArray(json.data) ? json.data : []).sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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
    setDepartment(record.department || '');

    setResult({
      ...record,
      results: Array.isArray(record.results) ? record.results : [],
      departments: Array.isArray(record.departments)
        ? record.departments
        : [],
    });

    setExcelRows([]);
    setFileName('');

    setMessage({
      text: `Loaded saved calculation ${record.id}.`,
      type: 'ok',
    });
  };

  // -----------------------------------------
  // EXAMPLE DATA
  // -----------------------------------------

  const example = useMemo(
    () =>
      program === 'PG'
        ? [
            {
              'College Roll No.':
                'CHEM25-001',

              'Autonomous Roll No.':
                'NACPG25001',

              'Name of the Students':
                'STUDENT NAME',

              Department:
                'Chemistry',

              'PAPER-1.1-MID': 18,

              'PAPER-1.1-END': 42,
            },
          ]
        : [
            {
              'Roll No':
                'UG25-001',

              'Autonomous Roll No':
                'NACUG25001',

              'Name of the Students':
                'STUDENT NAME',

              Department:
                'Physics',
            },
          ],
    [program],
  );

  // -----------------------------------------
  // DEPARTMENT NORMALIZATION
  // -----------------------------------------

  const normalizeDepartment = (
    value: unknown,
  ) => {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();

    // IMPORTANT:
    // Repeated Excel header rows contain
    // "Department" in the Department column.
    // This is NOT a real department.
    if (
      raw === 'department' ||
      raw === 'department name'
    ) {
      return '';
    }

    const map: Record<
      string,
      string
    > = {
      odia: 'Odia',
      chemistry: 'Chemistry',
      math: 'Mathematics',
      mathematics: 'Mathematics',
      commerce: 'Commerce',
      geology: 'Geology',
      mfc: 'MFC',
    };

    return (
      map[raw] ||
      String(value ?? '').trim()
    );
  };

  // -----------------------------------------
  // DETECT PG DEPARTMENTS
  // -----------------------------------------

  const detectedDepartments =
    useMemo(() => {
      if (
        program !== 'PG' ||
        !excelRows.length
      ) {
        return [];
      }

      const counts = new Map<
        string,
        number
      >();

      for (const row of excelRows) {
        const value =
          row?.Department ??
          row?.department ??
          row?.['Department Name'] ??
          row?.['department name'];

        const departmentName =
          normalizeDepartment(value);

        // Ignore blank / repeated headers
        if (!departmentName) {
          continue;
        }

        counts.set(
          departmentName,
          (counts.get(
            departmentName,
          ) || 0) + 1,
        );
      }

      return Array.from(
        counts.entries(),
      ).map(
        ([department, count]) => ({
          department,
          count,
        }),
      );
    }, [excelRows, program]);

  // -----------------------------------------
  // FILE UPLOAD
  // -----------------------------------------

  const handleFile = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    setMessage(null);
    setResult(null);

    const ext = file.name
      .toLowerCase()
      .split('.')
      .pop();

    if (
      !['xlsx', 'xls'].includes(
        ext || '',
      )
    ) {
      setMessage({
        text:
          'Please select an Excel file (.xlsx or .xls).',
        type: 'bad',
      });

      return;
    }

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook = XLSX.read(
        buffer,
        {
          type: 'array',
          cellDates: false,
        },
      );

      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      if (!firstSheet) {
        throw new Error(
          'The Excel file does not contain a readable worksheet.',
        );
      }

      const rows =
        XLSX.utils.sheet_to_json(
          firstSheet,
          {
            defval: '',
            raw: true,
            blankrows: false,
          },
        ) as any[];

      if (!rows.length) {
        throw new Error(
          'The selected Excel sheet is empty.',
        );
      }

      setExcelRows(rows);
      setFileName(file.name);

      if (program === 'PG') {
        const departments =
          new Map<
            string,
            number
          >();

        for (const row of rows) {
          const value =
            row?.Department ??
            row?.department ??
            row?.[
              'Department Name'
            ] ??
            row?.[
              'department name'
            ];

          const departmentName =
            normalizeDepartment(
              value,
            );

          // Ignore blank / repeated
          // header rows.
          if (!departmentName) {
            continue;
          }

          departments.set(
            departmentName,
            (departments.get(
              departmentName,
            ) || 0) + 1,
          );
        }

        const departmentText =
          Array.from(
            departments.entries(),
          )
            .map(
              ([name, count]) =>
                `${name}: ${count}`,
            )
            .join(' · ');

        setMessage({
          text: `Excel loaded successfully. ${
            departmentText
              ? `Departments detected — ${departmentText}`
              : 'No department column detected.'
          }`,
          type: 'ok',
        });
      } else {
        setMessage({
          text: `Excel loaded successfully: ${rows.length} row(s) found from "${workbook.SheetNames[0]}".`,
          type: 'ok',
        });
      }
    } catch (err: any) {
      setExcelRows([]);
      setFileName('');

      setMessage({
        text:
          err?.message ||
          'Could not read the Excel file.',
        type: 'bad',
      });
    }
  };

  // -----------------------------------------
  // CALCULATE
  // -----------------------------------------

  const calculate =
    async () => {
      setMessage(null);
      setResult(null);

      if (!excelRows.length) {
        setMessage({
          text:
            'Upload an Excel mark foil first.',
          type: 'bad',
        });

        return;
      }

      if (
        program === 'PG' &&
        !detectedDepartments.length
      ) {
        setMessage({
          text:
            'No PG departments were detected. Please check the Department column in the Excel file.',
          type: 'bad',
        });

        return;
      }

      setBusy(true);

      try {
        const res =
          await fetch(
            '/api/process',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                program,
                semester,
                batch,

                // PG automatically detects
                // departments from the Excel.
                department:
                  program === 'PG'
                    ? 'AUTO'
                    : department,

                students:
                  excelRows,
              }),
            },
          );

        const json =
          await res.json();

        if (
          !res.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              'Calculation failed.',
          );
        }

       setResult(json);

if (json.calculationId) {
  setSelectedCalculationId(json.calculationId);
}

setMessage({
  text: `Calculation completed for ${json.count} student(s).`,
  type: 'ok',
});

await loadSavedCalculations();

      } catch (e: any) {
        setMessage({
          text:
            e.message ||
            'Calculation failed.',
          type: 'bad',
        });
      } finally {
        setBusy(false);
      }
    };

  // -----------------------------------------
  // LOAD EXAMPLE
  // -----------------------------------------

  const loadExample =
    () => {
      setExcelRows(example);
      setFileName(
        'Example Excel data',
      );
      setResult(null);

      setMessage({
        text:
          'Example rows loaded for UI testing. Real college Excel columns must match the selected calculation engine.',
        type: 'ok',
      });
    };

  // -----------------------------------------
  // PROGRAM CHANGE
  // -----------------------------------------

  const handleProgramChange =
    (
      value: ProgramKey,
    ) => {
      setProgram(value);
      setSemester(1);
      setResult(null);
      setExcelRows([]);
      setFileName('');
      setDepartment('');
      setMessage(null);
    };

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <>
      <h1>
        Process Result
      </h1>

  {/* SAVED CALCULATIONS */}
  <div className="card">
    <h2>Saved Calculations</h2>

    <p className="hint">
      Load a previously calculated UG or PG result.
    </p>

    <div className="row">
      <label>
        Select Calculation

        <select
          value={selectedCalculationId}
          onChange={(e) =>
            setSelectedCalculationId(e.target.value)
          }
        >
          <option value="">
            -- Select a saved calculation --
          </option>

          {savedCalculations.map((record: any) => (
            <option key={record.id} value={record.id}>
              {record.program} | Semester {record.semester} |
              Batch {record.batch || '-'} |
              {record.count ?? record.results?.length ?? 0} students |
              {record.createdAt
                ? new Date(record.createdAt).toLocaleString()
                : record.id}
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

    <p className="hint">
      {loadingSaved
        ? 'Loading saved calculations...'
        : `${savedCalculations.length} saved calculation(s)`}
    </p>
  </div>

      <p className="sub">
        Upload the college mark foil
        as Excel. The panel converts
        the worksheet internally and
        sends it to the verified
        college calculation engine.
      </p>

      {/* ------------------------------------- */}
      {/* PROCESS SETUP */}
      {/* ------------------------------------- */}

      <div className="card">
        <div className="row">
          <label>
            Program

            <select
              value={program}
              onChange={(e) =>
                handleProgramChange(
                  e.target
                    .value as ProgramKey,
                )
              }
            >
              {(
                Object.keys(
                  PROG,
                ) as ProgramKey[]
              ).map((p) => (
                <option
                  key={p}
                  value={p}
                >
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
                setSemester(
                  Number(
                    e.target.value,
                  ),
                );
                setResult(null);
              }}
            >
              {Array.from(
                {
                  length:
                    PROG[program]
                      .sems,
                },
                (_, i) =>
                  i + 1,
              ).map((s) => (
                <option
                  key={s}
                  value={s}
                >
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
              {Array.from({ length: 10 }, (_, i) => 2022 + i).map((year) => (
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
                value="AUTO"
                disabled
              >
                <option value="AUTO">
                  Auto Detect
                </option>
              </select>
            </label>
          ) : (
            <label>
              Department

              <input
                value={department}
                onChange={(e) =>
                  setDepartment(
                    e.target.value,
                  )
                }
                placeholder="Department"
              />
            </label>
          )}
        </div>

        <p className="hint">
          {program === 'PG' ? (
            <>
              <b>
                PG Mode:
              </b>{' '}
              Upload one Excel
              containing all
              departments. The
              system automatically
              detects each
              student's department
              and applies the correct
              calculation
              configuration.
            </>
          ) : (
            <>
              <b>
                Currently enabled:
              </b>{' '}
              UG/BBA Semester 1
              and PG 2025 Semester
              1.
            </>
          )}
        </p>
      </div>

      {/* ------------------------------------- */}
      {/* UPLOAD */}
      {/* ------------------------------------- */}

      <div className="card">
        <h2>
          Upload Mark Foil
        </h2>

        <p className="hint">
          Upload the Excel mark
          foil supplied by the
          college. Supported
          formats:{' '}
          <b>.xlsx</b> and{' '}
          <b>.xls</b>. JSON is no
          longer required from the
          admin user.
        </p>

        <div className="row">
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFile}
          />

          <button
            className="btn"
            onClick={
              loadExample
            }
          >
            Load Example
          </button>

          <button
            className="btn primary"
            disabled={
              busy ||
              !excelRows.length
            }
            onClick={
              calculate
            }
          >
            {busy
              ? 'Calculating...'
              : 'Process Mark Foil'}
          </button>
        </div>

        {fileName && (
          <p
            className="hint"
            style={{
              marginTop: 12,
            }}
          >
            File:{' '}
            <b>
              {fileName}
            </b>{' '}
            · Rows detected:{' '}
            <b>
              {excelRows.length}
            </b>
          </p>
        )}

        {/* ------------------------------------- */}
        {/* PG DEPARTMENT DETECTION */}
        {/* ------------------------------------- */}

        {program === 'PG' &&
          detectedDepartments.length >
            0 && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                border:
                  '1px solid #ddd',
                borderRadius: 8,
              }}
            >
              <h3>
                Detected PG
                Departments
              </h3>

              <div
                className="row"
                style={{
                  marginTop: 10,
                  gap: 10,
                }}
              >
                {detectedDepartments.map(
                  (item) => (
                    <div
                      key={
                        item.department
                      }
                      style={{
                        padding:
                          '10px 14px',
                        border:
                          '1px solid #ddd',
                        borderRadius: 6,
                      }}
                    >
                      <b>
                        {
                          item.department
                        }
                      </b>

                      <br />

                      <span className="hint">
                        {
                          item.count
                        }{' '}
                        student(s)
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

        {/* ------------------------------------- */}
        {/* EXCEL PREVIEW */}
        {/* ------------------------------------- */}

        {excelRows.length >
          0 && (
          <div
            className="scroll"
            style={{
              marginTop: 14,
            }}
          >
            <table>
              <thead>
                <tr>
                  {Object.keys(
                    excelRows[0],
                  )
                    .slice(0, 12)
                    .map((key) => (
                      <th
                        key={key}
                      >
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>

              <tbody>
                {excelRows
                  .slice(0, 5)
                  .map(
                    (
                      row,
                      i,
                    ) => (
                      <tr
                        key={i}
                      >
                        {Object.keys(
                          excelRows[0],
                        )
                          .slice(
                            0,
                            12,
                          )
                          .map(
                            (
                              key,
                            ) => (
                              <td
                                key={
                                  key
                                }
                              >
                                {String(
                                  row[
                                    key
                                  ] ??
                                    '',
                                )}
                              </td>
                            ),
                          )}
                      </tr>
                    ),
                  )}
              </tbody>
            </table>
          </div>
        )}

        {excelRows.length >
          5 && (
          <p className="hint">
            Showing the first 5
            rows as a preview. The
            complete worksheet will
            be processed.
          </p>
        )}

        {message && (
          <p
            className={
              message.type ===
              'ok'
                ? 'success'
                : 'error'
            }
          >
            {message.text}
          </p>
        )}
      </div>
         
      {/* ------------------------------------- */}
      {/* CALCULATION RESULT */}
      {/* ------------------------------------- */}

      {result && (
        <div className="card">
          <h2>Calculation Results</h2>

          <p className="hint">
            Engine:{' '}
            <b>
              {result.engine?.label || 'Calculation Engine'}
            </b>
            {' · '}
            Students:{' '}
            <b>{result.count ?? result.results?.length ?? 0}</b>
            {' · '}
            Passed:{' '}
            <b>{result.passed ?? 0}</b>
            {' · '}
            Failed:{' '}
            <b>{result.failed ?? 0}</b>
          </p>

          {/* ----------------------------------- */}
          {/* PG DEPARTMENT SUMMARY */}
          {/* ----------------------------------- */}

          {program === 'PG' &&
            result.departments?.length > 0 && (
              <div
                style={{
                  marginTop: 18,
                  marginBottom: 24,
                }}
              >
                <h3>Department Summary</h3>

                <div
                  className="scroll"
                  style={{ marginTop: 10 }}
                >
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
                      {result.departments.map(
                        (item: any) => (
                          <tr
                            key={item.department}
                          >
                            <td>
                              <b>
                                {item.department}
                              </b>
                            </td>

                            <td>
                              {item.count}
                            </td>

                            <td>
                              {item.passed}
                            </td>

                            <td>
                              {item.failed}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* ----------------------------------- */}
          {/* RESULT TABLE */}
          {/* ----------------------------------- */}

          <h3>Student Results</h3>

          <div
            className="scroll"
            style={{ marginTop: 10 }}
          >
            <table>
              <thead>
                <tr>
                  <th>#</th>

                  {program === 'PG' && (
                    <th>Department</th>
                  )}

                  <th>College Roll</th>

                  <th>Autonomous Roll</th>

                  <th>Student Name</th>

                  <th>Total</th>

                  <th>Max</th>

                  <th>Credits</th>

                  <th>Credit Points</th>

                  <th>SGPA</th>

                  <th>Percentage</th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {(result.results || []).map(
                  (
                    r: any,
                    i: number,
                  ) => {
                    const s =
                      r.student || {};

                    const studentDepartment =
                      s.department ||
                      s.Department ||
                      s['Department Name'] ||
                      '-';

                    const collegeRoll =
                      s.collegeRollNo ||
                      s['College Roll No'] ||
                      s['College Roll No.'] ||
                      s.rollNo ||
                      s.roll ||
                      s['Roll No'] ||
                      s['Roll No.'] ||
                      '-';

                    const autonomousRoll =
                      s.autonomousRollNo ||
                      s['Autonomous Roll No'] ||
                      s['Autonomous Roll No.'] ||
                      '-';

                    const studentName =
                      s.name ||
                      s['Applicant Name'] ||
                      s['Name of the Students'] ||
                      s['ApplicantName'] ||
                      '-';

                    const percentage =
                      Number(
                        r.percentage ?? 0,
                      );

                    const status =
                      percentage >= 40
                        ? 'PASS'
                        : 'FAIL';

                    return (
                      <tr key={i}>
                        <td>
                          {i + 1}
                        </td>

                        {program === 'PG' && (
                          <td>
                            <b>
                              {
                                studentDepartment
                              }
                            </b>
                          </td>
                        )}

                        <td>
                          {collegeRoll}
                        </td>

                        <td>
                          {autonomousRoll}
                        </td>

                        <td>
                          {studentName}
                        </td>

                        <td>
                          {r.grandTotal ?? r.totalMarks ?? r.total ?? '-'}
                        </td>

                        <td>
                          {r.totalMaximumMarks ?? r.maxMarks ?? '-'}
                        </td>

                        <td>
                          {r.totalCredits ??
                            '-'}
                        </td>

                        <td>
                          {r.totalCreditPoints ??
                            '-'}
                        </td>

                        <td>
                          {typeof r.sgpa ===
                          'number'
                            ? r.sgpa.toFixed(2)
                            : '-'}
                        </td>

                        <td>
                          {typeof r.percentage ===
                          'number'
                            ? `${r.percentage.toFixed(
                                2,
                              )}%`
                            : '-'}
                        </td>

                        <td>
                          <b>
                            {status}
                          </b>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>

          {/* ----------------------------------- */}
          {/* STUDENT SUBJECT DETAILS */}
          {/* ----------------------------------- */}

          <div
            style={{
              marginTop: 24,
            }}
          >
            <h3>
              Subject-wise Calculation
            </h3>

            <p className="hint">
              Expand a student to view
              individual paper marks,
              grades, credits and credit
              points.
            </p>

            {(result.results || []).map(
              (
                r: any,
                i: number,
              ) => {
                const s =
                  r.student || {};

                const studentName =
                  s.name ||
                  s['Applicant Name'] ||
                  s['Name of the Students'] ||
                  '-';

                const autonomousRoll =
                  s.autonomousRollNo ||
                  s['Autonomous Roll No'] ||
                  s['Autonomous Roll No.'] ||
                  '-';

                const studentDepartment =
                  s.department ||
                  s.Department ||
                  '-';

                return (
                  <details
                    key={`student-${i}`}
                    style={{
                      marginBottom: 10,
                      border:
                        '1px solid #ddd',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {i + 1}.{' '}
                      {studentName}
                      {' — '}
                      {autonomousRoll}
                      {program === 'PG' &&
                        ` — ${studentDepartment}`}
                    </summary>

                    <div
                      className="scroll"
                      style={{
                        marginTop: 14,
                      }}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>
                              Paper
                            </th>

                            <th>
                              Subject
                            </th>

                            <th>
                              Marks
                            </th>

                            <th>
                              Full Mark
                            </th>

                            <th>
                              Credit
                            </th>

                            <th>
                              Grade
                            </th>

                            <th>
                              Grade Point
                            </th>

                            <th>
                              Credit Point
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {(r.subjects || []).map(
                            (
                              subject: any,
                              subjectIndex: number,
                            ) => (
                              <tr
                                key={
                                  subjectIndex
                                }
                              >
                                <td>
                                  {subject.paperCode ||
                                    `Paper ${
                                      subjectIndex +
                                      1
                                    }`}
                                </td>

                                <td>
                                  {subject.subjectName ||
                                    '-'}
                                </td>

                                <td>
                                  {subject.marks ??
                                    '-'}
                                </td>

                                <td>
                                  {subject.fullMark ??
                                    '-'}
                                </td>

                                <td>
                                  {subject.credit ??
                                    '-'}
                                </td>

                                <td>
                                  <b>
                                    {subject.grade ||
                                      '-'}
                                  </b>
                                </td>

                                <td>
                                  {subject.gradePoint ??
                                    '-'}
                                </td>

                                <td>
                                  {subject.creditPoint ??
                                    '-'}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                      }}
                    >
                      <b>
                        Total Marks:
                      </b>{' '}
                      {r.grandTotal ?? '-'}

                      {' · '}

                      <b>
                        Maximum:
                      </b>{' '}
                      {r.totalMaximumMarks ??
                        '-'}

                      {' · '}

                      <b>
                        Credits:
                      </b>{' '}
                      {r.totalCredits ?? '-'}

                      {' · '}

                      <b>
                        Credit Points:
                      </b>{' '}
                      {r.totalCreditPoints ??
                        '-'}

                      {' · '}

                      <b>
                        SGPA:
                      </b>{' '}
                      {typeof r.sgpa ===
                      'number'
                        ? r.sgpa.toFixed(2)
                        : '-'}

                      {' · '}

                      <b>
                        Percentage:
                      </b>{' '}
                      {typeof r.percentage ===
                      'number'
                        ? `${r.percentage.toFixed(
                            2,
                          )}%`
                        : '-'}
                    </div>
                  </details>
                );
              },
            )}
          </div>

          <details
            style={{
              marginTop: 16,
            }}
          >
            <summary>
              View internal calculated data
            </summary>

            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                marginTop: 12,
              }}
            >
              {JSON.stringify(result.results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
}