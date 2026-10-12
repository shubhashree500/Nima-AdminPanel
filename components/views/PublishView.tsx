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

function studentName(result: any) {
  const s = result?.student || result || {};
  return s['Applicant Name'] || s['Name of the Students'] || s['Student Name'] || s.name || s.studentName || s['College Roll No'] || s['Roll No'] || 'Unknown student';
}

function isFail(result: any) {
  return (result?.subjects || []).some((subject: any) => ['F', 'AB', 'M'].includes(String(subject?.grade || '').toUpperCase()));
}

export function PublishView() {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/verify', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to load saved calculations.');
      const data: Calculation[] = (Array.isArray(json.data) ? json.data : []).sort((a: Calculation, b: Calculation) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setRecords(data);
      setSelectedId((current) => current && data.some((r: Calculation) => r.id === current) ? current : (data.find((r: Calculation) => r.status === 'verified')?.id || ''));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to load calculations.', ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = records.find((r) => r.id === selectedId);
  const stats = useMemo(() => {
    const results = selected?.results || [];
    const failed = results.filter(isFail).length;
    const allZero = results.filter((r: any) => Array.isArray(r?.subjects) && r.subjects.length > 0 && r.subjects.every((s: any) => Number(s?.marks || 0) === 0)).length;
    return { count: results.length, failed, passed: results.length - failed, allZero };
  }, [selected]);

  const publish = async () => {
    if (!selected || selected.status !== 'verified') return;
    const warning = stats.allZero > 0 ? `\n\nWarning: ${stats.allZero} student(s) have zero marks in every subject.` : '';
    const confirmed = window.confirm(`Publish ${selected.program} Semester ${selected.semester}, Batch ${selected.batch || '-'} (${stats.count} students)?\n\nPublishing is a final action and the saved calculation will be locked.${warning}`);
    if (!confirmed) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch('/api/verify', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calculationId: selected.id, status: 'published' }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Publication failed.');
      setMessage({ text: 'Result published successfully. The published calculation is now locked.', ok: true });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Publication failed.', ok: false });
    } finally { setBusy(false); }
  };

  return <section className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-bold text-gray-900">Publish Result</h1><p className="mt-2 text-sm text-gray-600">Only verified calculations can be published. Published records are locked against further status changes.</p></header>
    <div className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end gap-3">
      <label className="min-w-64 flex-1 text-sm font-medium text-gray-700">Verified calculation<select className="mt-2 w-full rounded-lg border p-3" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading}><option value="">-- Select verified calculation --</option>{records.filter((r) => r.status === 'verified' || r.status === 'published').map((r) => <option key={r.id} value={r.id}>{r.program} | Sem {r.semester} | Batch {r.batch || '-'} | {r.count ?? r.results?.length ?? 0} students | {r.status}</option>)}</select></label>
      <button onClick={() => void load()} disabled={loading || busy} className="rounded-lg border px-4 py-3 text-sm font-semibold">{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
    {message && <p className={`mt-4 rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{message.text}</p>}
    </div>
    {!loading && !selected && <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">There are no verified calculations ready to publish. Verify a calculation first.</div>}
    {selected && <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Students', stats.count], ['Passed', stats.passed], ['Failed', stats.failed], ['All-subject zero marks', stats.allZero]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
      <div className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Publication review</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm"><div><dt className="text-gray-500">Calculation ID</dt><dd className="mt-1 font-semibold break-all">{selected.id}</dd></div><div><dt className="text-gray-500">Examination</dt><dd className="mt-1 font-semibold">{selected.program} Semester {selected.semester}</dd></div><div><dt className="text-gray-500">Batch / Department</dt><dd className="mt-1 font-semibold">{selected.batch || '-'} / {selected.department || 'All departments'}</dd></div><div><dt className="text-gray-500">Current status</dt><dd className="mt-1 font-semibold capitalize">{selected.status}</dd></div><div><dt className="text-gray-500">Calculated on</dt><dd className="mt-1 font-semibold">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</dd></div></dl>
      {stats.allZero > 0 && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Review required: {stats.allZero} student(s) have zero marks in every subject. Confirm these against the original mark foil before publishing.</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={publish} disabled={busy || selected.status !== 'verified'} className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Publishing…' : selected.status === 'published' ? 'Already Published' : 'Confirm & Publish Result'}</button><span className="text-sm text-gray-500">{selected.status === 'published' ? 'This record is already published and locked.' : 'Calculated records must be verified before they can be published.'}</span></div>
      </div>
      <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Student sample</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="bg-gray-50"><th className="border p-3">#</th><th className="border p-3">Student</th><th className="border p-3">Roll</th><th className="border p-3">Department</th><th className="border p-3">SGPA</th><th className="border p-3">Status</th></tr></thead><tbody>{(selected.results || []).slice(0, 10).map((r: any, i) => { const s = r.student || r; const failed = isFail(r); return <tr key={i}><td className="border p-3">{i + 1}</td><td className="border p-3">{studentName(r)}</td><td className="border p-3">{s['College Roll No'] || s['Roll No'] || s.collegeRollNo || s.roll || '-'}</td><td className="border p-3">{s.Department || s.department || s.course || '-'}</td><td className="border p-3">{r.sgpa ?? '-'}</td><td className="border p-3"><span className={failed ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>{failed ? 'FAIL' : 'PASS'}</span></td></tr>; })}</tbody></table></div></div>
    </>}
  </div></section>;
}
