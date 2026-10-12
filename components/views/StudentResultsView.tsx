 'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Calculation = {
  id: string;
  program: string;
  semester: number;
  batch?: string | number;
  status?: string;
  createdAt?: string;
  count?: number;
  results?: any[];
};

function studentOf(record: any) {
  return record?.student || record || {};
}

function rollOf(record: any): string {
  const student = studentOf(record);

  return String(
    student['College Roll No'] ||
      student['Roll No'] ||
      student['College Roll'] ||
      student.collegeRollNo ||
      student.roll ||
      student.rollNo ||
      student['Autonomous Roll No'] ||
      student.autonomousRollNo ||
      '-'
  );
}

function nameOf(record: any): string {
  const student = studentOf(record);

  return String(
    student['Applicant Name'] ||
      student['Name of the Students'] ||
      student['Student Name'] ||
      student.name ||
      student.studentName ||
      rollOf(record)
  );
}

function deptOf(record: any): string {
  const student = studentOf(record);

  return String(
    student.Department || student.department || student.course || '-'
  );
}

function papersOf(record: any): any[] {
  return Array.isArray(record?.subjects) ? record.subjects : [];
}

function totalOf(record: any): number {
  return papersOf(record).reduce(
    (total, subject) => total + (Number(subject.marks) || 0),
    0
  );
}

function fullOf(record: any): number {
  return papersOf(record).reduce(
    (total, subject) => total + (Number(subject.fullMark) || 0),
    0
  );
}

function statusOf(record: any): string {
  const papers = papersOf(record);

  if (!papers.length) return 'PENDING';

  return papers.some((subject) =>
    ['F', 'AB', 'M'].includes(String(subject.grade || '').toUpperCase())
  )
    ? 'FAIL'
    : 'PASS';
}

export function StudentResultsView() {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setSelectedIndex(null);

    try {
      const response = await fetch('/api/verify', {
        cache: 'no-store',
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Unable to load saved results.');
      }

      const data: Calculation[] = (
        Array.isArray(json.data) ? json.data : []
      ).sort((a: Calculation, b: Calculation) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );

      setRecords(data);

      setSelectedId((current) =>
        current && data.some((record) => record.id === current)
          ? current
          : data.find((record) => record.status === 'published')?.id ||
            data[0]?.id ||
            ''
      );

      setDepartment('All');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to load results.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = records.find((record) => record.id === selectedId);

  const departments = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          (selected?.results || [])
            .map(deptOf)
            .filter((value) => value && value !== '-')
        )
      ).sort(),
    ],
    [selected]
  );

  const rows = useMemo(
    () =>
      (selected?.results || []).filter(
        (record) =>
          (department === 'All' || deptOf(record) === department) &&
          `${nameOf(record)} ${rollOf(record)} ${deptOf(record)}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
      ),
    [selected, department, query]
  );

  // Resolve the selected student from the current filtered list.
  const selectedStudent =
    selectedIndex !== null ? rows[selectedIndex] ?? null : null;

  function selectStudent(index: number) {
    const record = rows[index];

    if (!record) {
      setSelectedIndex(null);
      setMessage('Unable to find that student in the current list.');
      return;
    }

    setSelectedIndex(index);
    setMessage(`Showing result for ${nameOf(record)} (${rollOf(record)}).`);
  }

  function clearStudentSelection() {
    setSelectedIndex(null);
    setMessage('');
  }

  return (
    <section className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">
            Student Results
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Search saved UG/PG calculation records and inspect a student's
            paper-wise result. Only records marked published are official
            published results.
          </p>
        </header>

        <div className="rounded-xl border bg-white p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">
              Calculation
              <select
                className="mt-1 w-full rounded-lg border p-3"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  clearStudentSelection();
                  setDepartment('All');
                }}
                disabled={loading}
              >
                <option value="">-- Select result record --</option>
                {records.map((record, index) => (
                  <option
                    key={`${record.id}-${index}`}
                    value={record.id}
                  >
                    {record.program} Sem {record.semester} · Batch{' '}
                    {record.batch || '-'} ·{' '}
                    {record.count ?? record.results?.length ?? 0} students ·{' '}
                    {record.status || 'calculated'}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Department
              <select
                className="mt-1 w-full rounded-lg border p-3"
                value={department}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  clearStudentSelection();
                }}
              >
                {departments.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Search
              <input
                className="mt-1 w-full rounded-lg border p-3"
                placeholder="Student name or roll"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  clearStudentSelection();
                }}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>

            {selected && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  selected.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Record status: {selected.status || 'calculated'}
              </span>
            )}
          </div>

          {selected && selected.status !== 'published' && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Review copy only — this record has not been published.
            </p>
          )}

          {message && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"
            >
              {message}
            </p>
          )}
        </div>

        {loading ? (
          <p>Loading results…</p>
        ) : !selected ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
            No saved calculation records are available.
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Students ({rows.length})</h2>
                <p className="text-sm text-gray-500">
                  Click View result to open the student's details.
                </p>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2">#</th>
                      <th className="border p-2">College Roll</th>
                      <th className="border p-2">Student</th>
                      <th className="border p-2">Department</th>
                      <th className="border p-2">Total</th>
                      <th className="border p-2">Full Marks</th>
                      <th className="border p-2">Credits</th>
                      <th className="border p-2">SGPA</th>
                      <th className="border p-2">Status</th>
                      <th className="border p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((record, index) => (
                      <tr
                        key={`${rollOf(record)}-${index}`}
                        className={`transition-colors ${
                          selectedIndex === index
                            ? 'bg-blue-100'
                            : 'hover:bg-blue-50'
                        }`}
                      >
                        <td className="border p-2">{index + 1}</td>
                        <td className="border p-2">{rollOf(record)}</td>
                        <td className="border p-2">{nameOf(record)}</td>
                        <td className="border p-2">{deptOf(record)}</td>
                        <td className="border p-2">{totalOf(record)}</td>
                        <td className="border p-2">{fullOf(record)}</td>
                        <td className="border p-2">
                          {record.totalCredits ?? '-'}
                        </td>
                        <td className="border p-2">{record.sgpa ?? '-'}</td>
                        <td className="border p-2">{statusOf(record)}</td>
                        <td className="border p-2">
                          <button
                            type="button"
                            onClick={() => selectStudent(index)}
                            className="cursor-pointer rounded border bg-white px-3 py-1.5 font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            View result
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rows.length === 0 && (
                  <p className="p-4 text-sm text-gray-500">
                    No matching students.
                  </p>
                )}
              </div>
            </div>

            {selectedStudent !== null && (
              <div
                id="student-result-details"
                className="rounded-xl border-2 border-blue-300 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Student Result Details
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                      {nameOf(selectedStudent)} · {rollOf(selectedStudent)} ·{' '}
                      {deptOf(selectedStudent)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={clearStudentSelection}
                    className="rounded-lg border px-4 py-2 font-semibold hover:bg-gray-50"
                  >
                    Close Details
                  </button>
                </div>

                {papersOf(selectedStudent).length > 0 ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border p-2">Paper Code</th>
                          <th className="border p-2">Subject</th>
                          <th className="border p-2">Marks</th>
                          <th className="border p-2">Full Marks</th>
                          <th className="border p-2">Grade</th>
                          <th className="border p-2">Grade Point</th>
                          <th className="border p-2">Credit</th>
                          <th className="border p-2">Credit Point</th>
                        </tr>
                      </thead>
                      <tbody>
                        {papersOf(selectedStudent).map((subject, index) => (
                          <tr key={`${subject.paperCode || 'paper'}-${index}`}>
                            <td className="border p-2">
                              {subject.paperCode || index + 1}
                            </td>
                            <td className="border p-2">
                              {subject.subjectName || subject.subject || '-'}
                            </td>
                            <td className="border p-2">{subject.marks ?? 0}</td>
                            <td className="border p-2">
                              {subject.fullMark ?? '-'}
                            </td>
                            <td className="border p-2">
                              {subject.grade || '-'}
                            </td>
                            <td className="border p-2">
                              {subject.gradePoint ?? '-'}
                            </td>
                            <td className="border p-2">
                              {subject.credit ?? '-'}
                            </td>
                            <td className="border p-2">
                              {subject.creditPoint ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                    This student record has no `subjects` array. The details
                    panel is working, but paper-wise marks are not available
                    in this record's current structure.
                  </p>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    Total Marks
                    <strong className="mt-1 block">
                      {totalOf(selectedStudent)} / {fullOf(selectedStudent)}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    Total Credits
                    <strong className="mt-1 block">
                      {selectedStudent.totalCredits ?? '-'}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    SGPA
                    <strong className="mt-1 block">
                      {selectedStudent.sgpa ?? '-'}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    Percentage
                    <strong className="mt-1 block">
                      {selectedStudent.percentage == null
                        ? '-'
                        : `${selectedStudent.percentage}%`}
                    </strong>
                  </div>
                </div>

                <p className="mt-4 font-bold">
                  Result: {statusOf(selectedStudent)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          aside,
          nav,
          button,
          select,
          input,
          header p {
            display: none !important;
          }

          section {
            padding: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}