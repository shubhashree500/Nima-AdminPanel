
'use client';

import { useCallback, useEffect, useState } from 'react';

type Calculation = {
  id: string;
  program: string;
  semester: number;
  batch?: string | number;
  department?: string;
  count?: number;
  status?: string;
  createdAt?: string;
  results?: any[];
  [key: string]: any;
};

/* =========================================================
   HELPERS
========================================================= */

function formatStatus(value?: string) {
  return (value || 'calculated').toLowerCase();
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized === 'published' ||
    normalized === 'verified' ||
    normalized === 'pass' ||
    normalized === 'passed' ||
    normalized === 'accepted'
  ) {
    return 'pass';
  }

  if (
    normalized === 'rejected' ||
    normalized === 'fail' ||
    normalized === 'failed'
  ) {
    return 'fail';
  }

  return 'pend';
}

function getValue(...values: any[]): any {
  return (
    values.find(
      (value) =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== '',
    ) ?? null
  );
}

function displayValue(value: any): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }

  return '-';
}

function getStudentRecord(row: any) {
  return (
    row?.student ??
    row?.studentDetails ??
    row?.studentInfo ??
    row?.personalDetails ??
    row?.Student ??
    row?.['Student Details'] ??
    row ??
    {}
  );
}

function getStudentName(row: any, student: any): string {
  return displayValue(
    getValue(
      student?.name,
      student?.studentName,
      student?.student_name,
      student?.fullName,
      student?.full_name,
      student?.applicantName,
      student?.['Applicant Name'],
      student?.['Name of the Students'],
      student?.['Student Name'],
      student?.['Name'],
      row?.studentName,
      row?.name,
      row?.fullName,
      row?.['Applicant Name'],
    ),
  );
}

function getCollegeRoll(row: any, student: any): string {
  return displayValue(
    getValue(
      student?.collegeRollNo,
      student?.collegeRoll,
      student?.college_roll_no,
      student?.college_roll,
      student?.['College Roll No'],
      student?.['College Roll No.'],
      student?.['College Roll Number'],
      student?.rollNo,
      student?.roll_no,
      student?.roll,
      student?.['Roll No'],
      student?.['Roll No.'],
      student?.['College Roll'],
      row?.collegeRollNo,
      row?.collegeRoll,
      row?.rollNo,
      row?.roll,
    ),
  );
}

function getAutonomousRoll(row: any, student: any): string {
  return displayValue(
    getValue(
      student?.autonomousRollNo,
      student?.autonomousRoll,
      student?.autonomous_roll_no,
      student?.['Autonomous Roll No'],
      student?.['Autonomous Roll No.'],
      student?.['Autonomous Roll Number'],
      row?.autonomousRollNo,
      row?.autonomousRoll,
    ),
  );
}

function getDepartment(
  row: any,
  student: any,
  calculation: Calculation,
): string {
  return displayValue(
    getValue(
      row?.department,
      row?.departmentName,
      row?.deptName,
      row?.subjectDepartment,
      student?.department,
      student?.Department,
      student?.departmentName,
      student?.deptName,
      student?.['Department'],
      student?.['Department Name'],
      calculation.department,
    ),
  );
}

function getTotalMarks(row: any): string {
  return displayValue(
    getValue(
      row?.grandTotal,
      row?.totalMarks,
      row?.totalMark,
      row?.total,
      row?.marksObtained,
      row?.marks_obtained,
      row?.overallTotal,
      row?.summary?.grandTotal,
      row?.summary?.totalMarks,
      row?.totals?.grandTotal,
      row?.totals?.totalMarks,
    ),
  );
}

function getSGPA(row: any): string {
  return displayValue(
    getValue(
      row?.sgpa,
      row?.SGPA,
      row?.sgpaValue,
      row?.summary?.sgpa,
      row?.totals?.sgpa,
    ),
  );
}

function getPercentage(row: any): string {
  const value = getValue(
    row?.percentage,
    row?.Percentage,
    row?.percentageValue,
    row?.summary?.percentage,
    row?.totals?.percentage,
  );

  if (value === null) return '-';

  const formatted = displayValue(value);

  return formatted.endsWith('%') ? formatted : `${formatted}%`;
}

function getStudentStatus(row: any): string {
  const value = getValue(
    row?.resultStatus,
    row?.overallStatus,
    row?.status,
    row?.finalResult,
    row?.passFail,
    row?.result?.status,
    row?.summary?.status,
  );

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof row?.isPassed === 'boolean') {
    return row.isPassed ? 'PASS' : 'FAIL';
  }

  if (typeof row?.passed === 'boolean') {
    return row.passed ? 'PASS' : 'FAIL';
  }

  // Do not guess PASS or FAIL if the saved result has no status.
  return 'Calculated';
}

/* =========================================================
   VERIFY RESULT
========================================================= */

export function VerifyView() {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'bad'>('ok');
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 50;

  const loadRecords = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/verify', {
        cache: 'no-store',
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Could not load calculations.');
      }

      const data: Calculation[] = Array.isArray(json.data)
        ? json.data
        : [];

      setRecords(data);

      setSelectedId((current) => {
        if (current && data.some((item) => item.id === current)) {
          return current;
        }

        const pending = data.find((item) => {
          const currentStatus = formatStatus(item.status);

          return (
            currentStatus === 'calculated' ||
            currentStatus === 'rejected'
          );
        });

        return pending?.id || data[0]?.id || '';
      });

      setMessage('');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not load calculations.',
      );

      setMessageType('bad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  // Reset pagination when a different calculation is selected.
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedId]);

  const selected = records.find((item) => item.id === selectedId);
  const status = formatStatus(selected?.status);

  const canVerify =
    !!selected &&
    status !== 'verified' &&
    status !== 'published';

  const studentResults = Array.isArray(selected?.results)
    ? selected.results
    : [];

  const totalPages = Math.max(
    1,
    Math.ceil(studentResults.length / pageSize),
  );

  const startIndex = (currentPage - 1) * pageSize;

  const visibleStudents = studentResults.slice(
    startIndex,
    startIndex + pageSize,
  );

  const verifyCalculation = async () => {
    if (!selected) return;

    if (
      !window.confirm(
        `Verify this ${selected.program} Semester ${selected.semester} calculation?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/verify', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calculationId: selected.id,
          status: 'verified',
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Verification failed.');
      }

      setMessage('Calculation verified successfully.');
      setMessageType('ok');

      await loadRecords();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Verification failed.',
      );

      setMessageType('bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="verify-page">
      {/* PAGE HEADER */}

      <header className="page-header verify-header">
        <div>
          <p className="page-eyebrow">RESULT MANAGEMENT</p>

          <h1>Verify Result</h1>

          <p className="verify-subtitle">
            Review saved UG and PG calculations before publication.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRecords()}
          disabled={loading || busy}
          className="btn"
        >
          <span aria-hidden="true">↻</span>
          {loading ? 'Refreshing...' : 'Refresh results'}
        </button>
      </header>

      {/* CALCULATION SELECTOR */}

      <section className="card verify-selector">
        <div className="card-header">
          <div className="card-title">
            <strong>Select calculation</strong>
            <small>
              Choose the saved result you want to review.
            </small>
          </div>

          <span className="verify-record-count">
            {records.length} saved{' '}
            {records.length === 1 ? 'calculation' : 'calculations'}
          </span>
        </div>

        <label className="verify-select-label">
          Saved calculations

          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loading || records.length === 0}
          >
            <option value="">-- Select calculation --</option>

            {records.map((item) => (
              <option key={item.id} value={item.id}>
                {item.program} | Semester {item.semester} | Batch{' '}
                {item.batch || '-'} |{' '}
                {item.count ?? item.results?.length ?? 0} students |{' '}
                {item.status || 'calculated'}
              </option>
            ))}
          </select>
        </label>

        {message && (
          <div
            role="status"
            className={`msg ${
              messageType === 'bad' ? 'bad' : 'ok'
            } verify-message`}
          >
            {message}
          </div>
        )}
      </section>

      {/* LOADING / EMPTY STATES */}

      {loading ? (
        <div className="card verify-empty">
          <p>Loading saved calculations...</p>
        </div>
      ) : !selected ? (
        <div className="card verify-empty">
          <div className="verify-empty-icon" aria-hidden="true">
            ▤
          </div>

          <h2>No calculation selected</h2>

          <p>
            {records.length
              ? 'Select a calculation above to review its details.'
              : 'No saved calculations were found. Calculate a result first.'}
          </p>
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}

          <div className="tiles verify-tiles">
            <article className="tile verify-tile">
              <div className="verify-tile-top">
                <small>PROGRAM</small>
                <span className="verify-icon verify-icon-blue">▤</span>
              </div>

              <strong>{selected.program}</strong>
              <p>Academic programme</p>
            </article>

            <article className="tile verify-tile">
              <div className="verify-tile-top">
                <small>SEMESTER</small>
                <span className="verify-icon verify-icon-purple">◷</span>
              </div>

              <strong>{selected.semester}</strong>
              <p>Examination semester</p>
            </article>

            <article className="tile verify-tile">
              <div className="verify-tile-top">
                <small>STUDENTS</small>
                <span className="verify-icon verify-icon-green">♙</span>
              </div>

              <strong>
                {selected.count ?? studentResults.length}
              </strong>

              <p>Records in this calculation</p>
            </article>

            <article className="tile verify-tile">
              <div className="verify-tile-top">
                <small>STATUS</small>
                <span className="verify-icon verify-icon-amber">✓</span>
              </div>

              <div className="verify-status-value">
                <span className={`chip ${statusClass(status)}`}>
                  {status}
                </span>
              </div>

              <p>Current calculation status</p>
            </article>
          </div>

          {/* CALCULATION DETAILS */}

          <section className="card verify-details">
            <div className="card-header">
              <div className="card-title">
                <strong>Calculation details</strong>
                <small>
                  Identification and processing information.
                </small>
              </div>

              <span className={`chip ${statusClass(status)}`}>
                {status}
              </span>
            </div>

            <dl className="verify-detail-grid">
              <div className="verify-detail-item verify-detail-id">
                <dt>Calculation ID</dt>
                <dd>{selected.id}</dd>
              </div>

              <div className="verify-detail-item">
                <dt>Batch</dt>
                <dd>{displayValue(selected.batch)}</dd>
              </div>

              <div className="verify-detail-item">
                <dt>Department</dt>
                <dd>
                  {displayValue(
                    selected.department || 'Multiple / not specified',
                  )}
                </dd>
              </div>

              <div className="verify-detail-item">
                <dt>Calculated on</dt>
                <dd>
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleString()
                    : '-'}
                </dd>
              </div>
            </dl>

            <div className="verify-action-bar">
              <div>
                <strong>Verification</strong>

                <p>
                  Check the saved calculation and source marks before
                  approving.
                </p>
              </div>

              <button
                type="button"
                onClick={verifyCalculation}
                disabled={!canVerify || busy}
                className="btn primary"
              >
                {busy
                  ? 'Saving...'
                  : status === 'verified'
                    ? 'Already verified'
                    : status === 'published'
                      ? 'Already published'
                      : '✓ Verify calculation'}
              </button>
            </div>
          </section>

          {/* STUDENT RESULT PREVIEW */}

          <section className="card verify-preview">
            <div className="card-header">
              <div className="card-title">
                <strong>Student result preview</strong>

                <small>
                  Review student identities and saved result values.
                </small>
              </div>

              <span className="verify-record-count">
                {studentResults.length} students
              </span>
            </div>

            <div className="scroll">
              <table className="verify-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>College Roll No.</th>
                    <th>Autonomous Roll No.</th>
                    <th>Department</th>
                    <th className="num">Total Marks</th>
                    <th className="num">SGPA</th>
                    <th className="num">Percentage</th>
                    <th>Result Status</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleStudents.map((row, index) => {
                    const student = getStudentRecord(row);

                    const name = getStudentName(row, student);
                    const collegeRoll = getCollegeRoll(row, student);
                    const autonomousRoll = getAutonomousRoll(row, student);
                    const department = getDepartment(
                      row,
                      student,
                      selected,
                    );

                    const totalMarks = getTotalMarks(row);
                    const sgpa = getSGPA(row);
                    const percentage = getPercentage(row);
                    const resultStatus = getStudentStatus(row);

                    const studentKey = getValue(
                      row?.id,
                      row?.studentId,
                      row?.student_id,
                      collegeRoll !== '-' ? collegeRoll : null,
                      autonomousRoll !== '-' ? autonomousRoll : null,
                    );

                    return (
                      <tr
                        key={`verify-student-${studentKey ?? index}-${index}`}
                      >
                        <td>{startIndex + index + 1}</td>

                        <td>
                          <strong className="verify-student-name">
                            {name}
                          </strong>
                        </td>

                        <td>{collegeRoll}</td>

                        <td>{autonomousRoll}</td>

                        <td>{department}</td>

                        <td className="num verify-mark-cell">
                          {totalMarks}
                        </td>

                        <td className="num verify-mark-cell">
                          {sgpa}
                        </td>

                        <td className="num verify-mark-cell">
                          {percentage}
                        </td>

                        <td>
                          <span
                            className={`chip ${statusClass(
                              resultStatus.toLowerCase(),
                            )}`}
                          >
                            {resultStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {studentResults.length === 0 && (
                    <tr>
                      <td colSpan={9} className="verify-no-rows">
                        This calculation has no student result array to
                        preview.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            {studentResults.length > 0 && (
              <div className="verify-pagination">
                <p className="hint">
                  Showing {startIndex + 1}–
                  {Math.min(
                    startIndex + pageSize,
                    studentResults.length,
                  )}{' '}
                  of {studentResults.length} students
                </p>

                <div className="verify-pagination-controls">
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>

                  <span className="verify-page-number">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {studentResults.length > 0 && (
              <p className="hint verify-preview-note">
                A dash indicates that the corresponding field was not found
                in the saved result data. Confirm these fields against the
                original marks foil before publication.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
