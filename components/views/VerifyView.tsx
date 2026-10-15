
'use client';

import { useCallback, useEffect, useState } from 'react';

type Calculation = {
  id: string;
  program: string;
  semester: number;
  batch?: string;
  department?: string;
  count?: number;
  status?: string;
  createdAt?: string;
  results?: any[];
};

export function VerifyView() {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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

        const pending = data.find(
          (item) =>
            !item.status ||
            item.status === 'calculated' ||
            item.status === 'rejected'
        );

        return pending?.id || data[0]?.id || '';
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not load calculations.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const selected = records.find((item) => item.id === selectedId);

  const verifyCalculation = async () => {
    if (!selected) return;

    if (
      !window.confirm(
        `Verify this ${selected.program} Semester ${selected.semester} calculation?`
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      await loadRecords();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Verification failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const status = (selected?.status || 'calculated').toLowerCase();
  const canVerify =
    !!selected && status !== 'verified' && status !== 'published';

  return (
    <section className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">
            Verify Result
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Review saved UG and PG calculations before publication.
          </p>
        </header>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-64 flex-1 text-sm font-medium text-gray-700">
              Select calculation
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                disabled={loading || records.length === 0}
              >
                <option value="">-- Select calculation --</option>
                {records.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.program} | Semester {item.semester} | Batch{' '}
                    {item.batch || '-'} | {item.count ?? item.results?.length ?? 0}{' '}
                    students | {item.status || 'calculated'}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void loadRecords()}
              disabled={loading || busy}
              className="rounded-lg border px-4 py-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              {message}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading calculations...</p>
        ) : !selected ? (
          <div className="rounded-xl border bg-white p-8 text-gray-600">
            No saved calculations found. Calculate a result first.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-white p-5">
                <p className="text-sm text-gray-500">Program</p>
                <p className="mt-1 text-xl font-bold">{selected.program}</p>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <p className="text-sm text-gray-500">Semester</p>
                <p className="mt-1 text-xl font-bold">{selected.semester}</p>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <p className="text-sm text-gray-500">Students</p>
                <p className="mt-1 text-xl font-bold">
                  {selected.count ?? selected.results?.length ?? 0}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <p className="text-sm text-gray-500">Status</p>
                <p className="mt-1 text-xl font-bold capitalize">{status}</p>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Calculation details</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Calculation ID</dt>
                  <dd className="mt-1 break-all font-medium">{selected.id}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Batch</dt>
                  <dd className="mt-1 font-medium">{selected.batch || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Department</dt>
                  <dd className="mt-1 font-medium">
                    {selected.department || 'Multiple / not specified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Calculated on</dt>
                  <dd className="mt-1 font-medium">
                    {selected.createdAt
                      ? new Date(selected.createdAt).toLocaleString()
                      : '-'}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={verifyCalculation}
                  disabled={!canVerify || busy}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy
                    ? 'Saving...'
                    : status === 'verified'
                      ? 'Already Verified'
                      : status === 'published'
                        ? 'Already Published'
                        : 'Verify Calculation'}
                </button>

                <span className="text-sm text-gray-500">
                  Verify only after checking the calculation and source marks.
                </span>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Student result preview</h2>
              <p className="mt-1 text-sm text-gray-500">
                Preview of the saved calculated data. Check the complete result
                details before approving publication.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-3">#</th>
                      <th className="border p-3">Student details</th>
                      <th className="border p-3">Marks / result summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.results || []).slice(0, 50).map((student, index) => (
                      <tr key={`verify-student-${student.id || student.roll || index}-${index}`}>
                        <td className="border p-3">{index + 1}</td>
                        <td className="border p-3">
                          {student.name ||
                            student.studentName ||
                            student.roll ||
                            student.rollNo ||
                            student.autonomousRollNo ||
                            student.id ||
                            'Student record'}
                        </td>
                        <td className="border p-3">
                          {student.totalMarks ??
                            student.total ??
                            student.percentage ??
                            student.sgpa ??
                            student.result ??
                            'Open full result in Process Results'}
                        </td>
                      </tr>
                    ))}

                    {(!selected.results || selected.results.length === 0) && (
                      <tr>
                        <td className="border p-4 text-gray-500" colSpan={3}>
                          This saved calculation has no student result array to preview.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(selected.results?.length || 0) > 50 && (
                <p className="mt-3 text-sm text-gray-500">
                  Showing the first 50 of {selected.results?.length} student
                  records.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}