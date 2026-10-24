'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Calculation = {
  id: string;
  program: string;
  semester: number;
  batch?: string | number;
  course?: string;
  department?: string;
  count?: number;
  passed?: number;
  failed?: number;
  status?: string;
  createdAt?: string;
  results?: any[];
};

const PAGE_SIZE = 25;

function studentOf(result: any) {
  return (
    result?.student ??
    result?.studentDetails ??
    result?.studentInfo ??
    result ??
    {}
  );
}

function studentName(result: any): string {
  const student = studentOf(result);

  return (
    student['Applicant Name'] ||
    student['Name of the Students'] ||
    student['Student Name'] ||
    student.name ||
    student.fullName ||
    student.studentName ||
    student['College Roll No'] ||
    student['Roll No'] ||
    'Unknown student'
  );
}

function collegeRoll(result: any): string {
  const student = studentOf(result);

  return String(
    student['College Roll No'] ||
      student['College Roll No.'] ||
      student['College Roll Number'] ||
      student['Roll No'] ||
      student['Roll No.'] ||
      student.collegeRollNo ||
      student.collegeRoll ||
      student.rollNo ||
      student.roll ||
      '-',
  );
}

function autonomousRoll(result: any): string {
  const student = studentOf(result);

  return String(
    student['Autonomous Roll No'] ||
      student['Autonomous Roll No.'] ||
      student.autonomousRollNo ||
      student.autonomousRoll ||
      '-',
  );
}

function studentDepartment(result: any): string {
  const student = studentOf(result);

  return String(
    student.Department ||
      student.department ||
      student.departmentName ||
      student.deptName ||
      student.course ||
      '-',
  );
}

function isFail(result: any): boolean {
  const subjects = Array.isArray(result?.subjects)
    ? result.subjects
    : [];

  return subjects.some((subject: any) => {
    const grade = String(subject?.grade ?? '')
      .trim()
      .toUpperCase();

    return ['F', 'AB', 'M', 'FAIL', 'FAILED'].includes(grade);
  });
}

function hasSubjectResults(result: any): boolean {
  return (
    Array.isArray(result?.subjects) &&
    result.subjects.length > 0
  );
}

function hasZeroMarksInEverySubject(result: any): boolean {
  const subjects = Array.isArray(result?.subjects)
    ? result.subjects
    : [];

  return (
    subjects.length > 0 &&
    subjects.every((subject: any) => {
      const marks = Number(subject?.marks);
      return Number.isFinite(marks) && marks === 0;
    })
  );
}

function getStudentResultStatus(result: any): 'PASS' | 'FAIL' | 'N/A' {
  if (!hasSubjectResults(result)) {
    return 'N/A';
  }

  return isFail(result) ? 'FAIL' : 'PASS';
}

function formatDate(value?: string): string {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

function formatSGPA(value: any): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(2) : String(value);
}

function formatStatus(value?: string): string {
  return (value || 'calculated').toLowerCase();
}

export function PublishView() {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [message, setMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/verify', {
        cache: 'no-store',
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.error || 'Unable to load saved calculations.',
        );
      }

    const data: Calculation[] = (
  (Array.isArray(json.data) ? json.data : []) as Calculation[]
).sort((a: Calculation, b: Calculation) =>
  String(b.createdAt || '').localeCompare(
    String(a.createdAt || ''),
  ),
);

      setRecords(data);

      setSelectedId((current) => {
        // Keep the current selection if it still exists.
        if (current && data.some((item) => item.id === current)) {
          return current;
        }

        // Prefer a verified result ready for publication.
        const verified = data.find(
          (item) => formatStatus(item.status) === 'verified',
        );

        // If no verified result exists, show the latest published one.
        const published = data.find(
          (item) => formatStatus(item.status) === 'published',
        );

        return verified?.id || published?.id || '';
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Unable to load calculations.',
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = records.find((item) => item.id === selectedId);

  const publishableRecords = useMemo(
    () =>
      records.filter((item) =>
        ['verified', 'published'].includes(
          formatStatus(item.status),
        ),
      ),
    [records],
  );

  const stats = useMemo(() => {
    const results = selected?.results || [];

    const failed = results.filter(isFail).length;

    const passed = results.filter(
      (result) =>
        hasSubjectResults(result) && !isFail(result),
    ).length;

    const unclassified = results.length - passed - failed;

    const allZero = results.filter(
      hasZeroMarksInEverySubject,
    ).length;

    return {
      count: results.length,
      passed,
      failed,
      unclassified,
      allZero,
    };
  }, [selected]);

  const totalPages = Math.max(
    1,
    Math.ceil((selected?.results?.length || 0) / PAGE_SIZE),
  );

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const pageResults = (selected?.results || []).slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const publish = async () => {
    if (
      !selected ||
      formatStatus(selected.status) !== 'verified' ||
      busy
    ) {
      return;
    }

    const warning =
      stats.allZero > 0
        ? `\n\nWarning: ${stats.allZero} student(s) have zero marks in every subject.`
        : '';

    const confirmed = window.confirm(
      `Publish ${selected.program} Semester ${selected.semester}, Batch ${selected.batch || '-'}?\n\n` +
        `Students: ${stats.count}\n` +
        `Passed: ${stats.passed}\n` +
        `Failed: ${stats.failed}\n` +
        `Unclassified: ${stats.unclassified}\n\n` +
        `Publishing is a final action. The saved calculation will be locked.` +
        warning +
        `\n\nDo you want to continue?`,
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calculationId: selected.id,
          status: 'published',
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Publication failed.');
      }

      setMessage({
        text:
          'Result published successfully. The calculation has been marked as published.',
        ok: true,
      });

      await load();
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Publication failed.',
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const status = formatStatus(selected?.status);

  return (
    <section className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page heading */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Result Management
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Publish Result
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review verified examination results before making them
              final. Published calculations should be treated as locked.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">↻</span>
            {loading ? 'Refreshing...' : 'Refresh records'}
          </button>
        </header>

        {/* Feedback message */}
        {message && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
              message.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <span className="text-lg" aria-hidden="true">
              {message.ok ? '✓' : '!'}
            </span>

            <p className="leading-6">{message.text}</p>
          </div>
        )}

        {/* Calculation selector */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Select examination
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose a verified calculation to publish or a published
              calculation to review its status.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block text-sm font-medium text-slate-700">
              Verified / published calculation

              <select
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setMessage(null);
                }}
                disabled={loading || publishableRecords.length === 0}
              >
                <option value="">
                  -- Select an examination --
                </option>

                {publishableRecords.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.program} | Semester {item.semester} | Batch{' '}
                    {item.batch || '-'} |{' '}
                    {item.count ?? item.results?.length ?? 0} students |{' '}
                    {formatStatus(item.status).toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {publishableRecords.length}
              </span>{' '}
              available record(s)
            </div>
          </div>
        </section>

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

            <p className="font-medium text-slate-800">
              Loading result records...
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Please wait while saved calculations are retrieved.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !selected && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">
              ↑
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No result ready for publication
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Verify a calculation first. Once its status becomes
              Verified, it will appear here for publication.
            </p>

            <button
              type="button"
              onClick={() => void load()}
              className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Check again
            </button>
          </div>
        )}

        {/* Selected calculation */}
        {!loading && selected && (
          <>
            {/* Status banner */}
            <div
              className={`flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
                status === 'published'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                      status === 'published'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        status === 'published'
                          ? 'bg-emerald-600'
                          : 'bg-blue-600'
                      }`}
                    />
                    {status}
                  </span>

                  <span className="text-sm text-slate-600">
                    {status === 'published'
                      ? 'This calculation is already published.'
                      : 'This calculation is verified and ready to publish.'}
                  </span>
                </div>

                <h2 className="mt-3 text-lg font-bold text-slate-900">
                  {selected.program} — Semester {selected.semester}
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Batch {selected.batch || '-'}
                  {selected.department
                    ? ` · ${selected.department}`
                    : ''}
                </p>
              </div>

              {status === 'published' && (
                <div className="rounded-xl border border-emerald-200 bg-white/70 px-4 py-3 text-sm font-medium text-emerald-800">
                  ✓ Publication completed
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Total students"
                value={stats.count}
                description="Records in this calculation"
                tone="slate"
              />

              <SummaryCard
                label="Passed"
                value={stats.passed}
                description="No failing subject grade found"
                tone="green"
              />

              <SummaryCard
                label="Failed"
                value={stats.failed}
                description="At least one failing grade found"
                tone="red"
              />

              <SummaryCard
                label="Unclassified"
                value={stats.unclassified}
                description="Subject results unavailable"
                tone="amber"
              />

              <SummaryCard
                label="All-zero marks"
                value={stats.allZero}
                description="Every subject has zero marks"
                tone="amber"
              />
            </div>

            {/* Review details */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Publication review
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Confirm that this is the correct examination and
                    that its saved results have been checked.
                  </p>
                </div>

                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Final review
                </span>
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                <Detail
                  label="Examination"
                  value={`${selected.program} Semester ${selected.semester}`}
                />

                <Detail
                  label="Batch"
                  value={String(selected.batch || '-')}
                />

                <Detail
                  label="Department"
                  value={selected.department || 'Multiple / not specified'}
                />

                <Detail
                  label="Calculation ID"
                  value={selected.id}
                  breakAll
                />

                <Detail
                  label="Calculated on"
                  value={formatDate(selected.createdAt)}
                />

                <Detail
                  label="Current status"
                  value={status.toUpperCase()}
                />
              </dl>

              {stats.allZero > 0 && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4"
                >
                  <div className="flex gap-3">
                    <span className="text-xl text-amber-700">⚠</span>

                    <div>
                      <h3 className="font-semibold text-amber-900">
                        Review zero-mark records
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        {stats.allZero} student(s) have zero marks in
                        every subject. Check these against the original
                        mark foil before publishing.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {stats.unclassified > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm leading-6 text-slate-700">
                    <strong>{stats.unclassified} student record(s)</strong>{' '}
                    do not contain enough subject data to classify their
                    result status in this preview. This does not change
                    their saved result.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  {status === 'published'
                    ? 'This calculation is already published. The publish action is disabled to prevent duplicate publication.'
                    : 'Only publish after confirming the examination, student records, and marks.'}
                </p>

                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={busy || status !== 'verified'}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Publishing...
                    </>
                  ) : status === 'published' ? (
                    'Already published'
                  ) : (
                    'Confirm & Publish Result'
                  )}
                </button>
              </div>
            </section>

            {/* Student preview */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Student result preview
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review student identifiers, SGPA, and available
                    subject-result status before publication.
                  </p>
                </div>

                <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {stats.count} student(s)
                </span>
              </div>

              {stats.count === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-medium text-slate-800">
                    No student results found
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    This calculation does not contain a student result array.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-4 font-semibold">#</th>
                          <th className="px-4 py-4 font-semibold">
                            Student
                          </th>
                          <th className="px-4 py-4 font-semibold">
                            College roll
                          </th>
                          <th className="px-4 py-4 font-semibold">
                            Autonomous roll
                          </th>
                          <th className="px-4 py-4 font-semibold">
                            Department
                          </th>
                          <th className="px-4 py-4 text-right font-semibold">
                            Total marks
                          </th>
                          <th className="px-4 py-4 text-right font-semibold">
                            SGPA
                          </th>
                          <th className="px-4 py-4 font-semibold">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {pageResults.map((result: any, index: number) => {
                          const resultStatus =
                            getStudentResultStatus(result);

                          const totalMarks =
                            result?.grandTotal ??
                            result?.totalMarks ??
                            result?.totalMark ??
                            result?.total ??
                            '-';

                          return (
                            <tr
                              key={`${result?.id || collegeRoll(result)}-${startIndex + index}`}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-4 py-4 text-slate-400">
                                {startIndex + index + 1}
                              </td>

                              <td className="px-4 py-4">
                                <span className="font-semibold text-slate-900">
                                  {studentName(result)}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-slate-600">
                                {collegeRoll(result)}
                              </td>

                              <td className="px-4 py-4 text-slate-600">
                                {autonomousRoll(result)}
                              </td>

                              <td className="px-4 py-4 text-slate-600">
                                {studentDepartment(result)}
                              </td>

                              <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-800">
                                {totalMarks}
                              </td>

                              <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-800">
                                {formatSGPA(result?.sgpa)}
                              </td>

                              <td className="px-4 py-4">
                                <ResultBadge status={resultStatus} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Showing{' '}
                      <strong className="text-slate-800">
                        {startIndex + 1}–
                        {Math.min(
                          startIndex + PAGE_SIZE,
                          stats.count,
                        )}
                      </strong>{' '}
                      of{' '}
                      <strong className="text-slate-800">
                        {stats.count}
                      </strong>{' '}
                      students
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.max(1, page - 1),
                          )
                        }
                        disabled={currentPage === 1}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ← Previous
                      </button>

                      <span className="whitespace-nowrap text-sm font-medium text-slate-600">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Publication checklist */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-bold text-slate-900">
                Final publication checklist
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Complete these checks before publishing the result.
              </p>

              <ul className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-700">✓</span>
                  Confirm the program, semester, and batch.
                </li>

                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-700">✓</span>
                  Compare marks with the original mark foil.
                </li>

                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-700">✓</span>
                  Review failed and unclassified student records.
                </li>

                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-700">✓</span>
                  Investigate students with zero marks in every subject.
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: 'slate' | 'green' | 'red' | 'amber';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-800',
    green: 'bg-emerald-50 text-emerald-800',
    red: 'bg-red-50 text-red-800',
    amber: 'bg-amber-50 text-amber-800',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </p>

        <span
          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-bold ${tones[tone]}`}
        >
          {value}
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd
        className={`mt-1.5 text-sm font-medium text-slate-800 ${
          breakAll ? 'break-all' : 'break-words'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ResultBadge({
  status,
}: {
  status: 'PASS' | 'FAIL' | 'N/A';
}) {
  const styles = {
    PASS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    FAIL: 'bg-red-50 text-red-700 ring-red-200',
    'N/A': 'bg-slate-100 text-slate-600 ring-slate-200',
  };

  return (
    <span
      className={`inline-flex min-w-16 items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}