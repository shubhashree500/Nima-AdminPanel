'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ReportKind = 'grade-sheets' | 'tabular-register' | 'statistics';
type Calculation = { id: string; program: string; semester: number; batch?: string | number; course?: string; department?: string; count?: number; status?: string; createdAt?: string; results?: any[]; departments?: any[] };

function identity(result: any) { return result?.student || result || {}; }
function rollOf(result: any) { const s = identity(result); return s['College Roll No'] || s['College Roll No.'] || s['Roll No'] || s['College Roll'] || s.collegeRollNo || s.roll || s.rollNo || s['Autonomous Roll No'] || s.autonomousRollNo || '-'; }
function nameOf(result: any) { const s = identity(result); return s['Applicant Name'] || s['Name of the Students'] || s['Student Name'] || s.name || s.studentName || rollOf(result); }
function deptOf(result: any) { const s = identity(result); return s.Department || s.department || s.course || '-'; }
function subjectsOf(result: any): any[] { return Array.isArray(result?.subjects) ? result.subjects : []; }
function totalOf(result: any) { return subjectsOf(result).reduce((sum, subject) => sum + (Number(subject?.marks) || 0), 0); }
function maxOf(result: any) { return subjectsOf(result).reduce((sum, subject) => sum + (Number(subject?.fullMark) || 0), 0); }
function statusOf(result: any) { const subjects = subjectsOf(result); if (!subjects.length) return 'PENDING'; return subjects.some((s) => ['F', 'AB', 'M'].includes(String(s?.grade || '').toUpperCase())) ? 'FAIL' : 'PASS'; }
function csvEscape(value: unknown) { const text = String(value ?? ''); return `"${text.replace(/"/g, '""')}"`; }

export function ReportsView({ kind }: { kind: ReportKind }) {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [department, setDepartment] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/verify', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Unable to load result records.');
      const data: Calculation[] = (Array.isArray(json.data) ? json.data : []).sort((a: Calculation, b: Calculation) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setRecords(data);
      setSelectedId((current) => current && data.some((r) => r.id === current) ? current : (data.find((r) => r.status === 'published')?.id || data[0]?.id || ''));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load records.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selected = records.find((r) => r.id === selectedId);
  const departments = useMemo(() => ['All', ...Array.from(new Set((selected?.results || []).map(deptOf).filter((x) => x && x !== '-'))).sort()], [selected]);
  const rows = useMemo(() => (selected?.results || []).filter((r) => (department === 'All' || deptOf(r) === department) && `${nameOf(r)} ${rollOf(r)} ${deptOf(r)}`.toLowerCase().includes(search.toLowerCase())), [selected, department, search]);
  const paperColumns = useMemo(() => Array.from(new Set((selected?.results || []).flatMap((r) => subjectsOf(r).map((s) => String(s.subjectName || s.subject || s.paperCode || 'Paper'))))), [selected]);
  const stats = useMemo(() => {
    const all = selected?.results || [];
    const passed = all.filter((r) => statusOf(r) === 'PASS').length;
    const grades: Record<string, number> = {};
    const byDept: Record<string, { students: number; passed: number; failed: number }> = {};
    all.forEach((r) => {
      const d = deptOf(r); if (!byDept[d]) byDept[d] = { students: 0, passed: 0, failed: 0 };
      byDept[d].students += 1; if (statusOf(r) === 'PASS') byDept[d].passed += 1; else if (statusOf(r) === 'FAIL') byDept[d].failed += 1;
      subjectsOf(r).forEach((s) => { const g = String(s.grade || 'N/A').toUpperCase(); grades[g] = (grades[g] || 0) + 1; });
    });
    const failed = all.filter((r) => statusOf(r) === 'FAIL').length;
    return { total: all.length, passed, failed, passRate: passed + failed ? (passed / (passed + failed) * 100) : 0, grades: Object.entries(grades).sort((a,b) => a[0].localeCompare(b[0])), byDept: Object.entries(byDept).sort((a,b) => a[0].localeCompare(b[0])) };
  }, [selected]);

  const exportCsv = () => {
    if (!selected) return;
    let matrix: unknown[][];
    if (kind === 'tabular-register') {
      matrix = [['No.', 'College Roll', 'Student Name', 'Department', ...paperColumns, 'Total', 'Full Marks', 'Credits', 'SGPA', 'Percentage', 'Status'], ...rows.map((r, i) => [i + 1, rollOf(r), nameOf(r), deptOf(r), ...paperColumns.map((paper) => { const subject = subjectsOf(r).find((s) => String(s.subjectName || s.subject || s.paperCode || 'Paper') === paper); return subject ? `${subject.marks ?? 0}/${subject.fullMark ?? 0} ${subject.grade || ''}` : ''; }), totalOf(r), maxOf(r), r.totalCredits ?? '', r.sgpa ?? '', r.percentage ?? '', statusOf(r)])];
    } else if (kind === 'statistics') {
      matrix = [['Department', 'Students', 'Passed', 'Failed', 'Pass Percentage'], ...stats.byDept.map(([d, v]) => [d, v.students, v.passed, v.failed, v.students ? `${(v.passed / v.students * 100).toFixed(2)}%` : '0%'])];
    } else {
      matrix = [['No.', 'College Roll', 'Student Name', 'Department', 'Paper Code', 'Subject', 'Marks', 'Full Marks', 'Grade', 'Grade Point', 'Credit', 'Credit Point', 'SGPA', 'Percentage', 'Status'], ...rows.flatMap((r, i) => subjectsOf(r).map((s) => [i + 1, rollOf(r), nameOf(r), deptOf(r), s.paperCode || '', s.subjectName || s.subject || '', s.marks ?? 0, s.fullMark ?? 0, s.grade || '', s.gradePoint ?? '', s.credit ?? '', s.creditPoint ?? '', r.sgpa ?? '', r.percentage ?? '', statusOf(r)]))];
    }
    const content = '\ufeff' + matrix.map((line) => line.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `${kind}-${selected.program}-sem${selected.semester}-batch${selected.batch || 'NA'}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const title = kind === 'grade-sheets' ? 'Grade Sheets' : kind === 'tabular-register' ? 'Tabular Register' : 'Result Statistics';
  return <section className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-7xl space-y-6">
    <header><h1 className="text-2xl font-bold text-gray-900">{title}</h1><p className="mt-2 text-sm text-gray-600">Reports are generated from saved calculation records. Confirm the record status before using a report as an official document.</p></header>
    <div className="rounded-xl border bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
      <label className="text-sm font-medium text-gray-700">Calculation<select className="mt-2 w-full rounded-lg border p-3" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setDepartment('All'); }} disabled={loading}><option value="">-- Select calculation --</option>{records.map((r) => <option key={r.id} value={r.id}>{r.program} | Sem {r.semester} | Batch {r.batch || '-'} | {r.count ?? r.results?.length ?? 0} students | {r.status || 'calculated'}</option>)}</select></label>
      <label className="text-sm font-medium text-gray-700">Department<select className="mt-2 w-full rounded-lg border p-3" value={department} onChange={(e) => setDepartment(e.target.value)}>{departments.map((d) => <option key={d}>{d}</option>)}</select></label>
      {kind !== 'statistics' && <label className="text-sm font-medium text-gray-700">Search student<input className="mt-2 w-full rounded-lg border p-3" placeholder="Name or roll number" value={search} onChange={(e) => setSearch(e.target.value)} /></label>}
    </div>
    {message && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{message}</p>}
    <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => void load()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-semibold">Refresh</button><button onClick={exportCsv} disabled={!selected || loading} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Export CSV</button><button onClick={() => window.print()} disabled={!selected} className="rounded-lg border px-4 py-2 text-sm font-semibold">Print / Save PDF</button></div>
    </div>
    {loading ? <p className="text-sm text-gray-600">Loading saved results…</p> : !selected ? <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">No saved calculations found. Calculate a result first.</div> : <>
      <div className="rounded-xl border bg-white p-4 text-sm"><div className="flex flex-wrap justify-between gap-3"><span><strong>{selected.program} Semester {selected.semester}</strong> · Batch {selected.batch || '-'} · {selected.results?.length || 0} students</span><span className={`rounded-full px-3 py-1 font-semibold ${selected.status === 'published' ? 'bg-green-100 text-green-800' : selected.status === 'verified' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{selected.status || 'calculated'}</span></div>{selected.status !== 'published' && <p className="mt-2 text-amber-800">This result is not marked published. Treat this report as a review copy, not an official published result.</p>}</div>
      {kind === 'statistics' ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Students', stats.total], ['Passed', stats.passed], ['Failed', stats.failed], ['Pass Percentage', `${stats.passRate.toFixed(2)}%`]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div><div className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Department-wise results</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="border p-2 text-left">Department</th><th className="border p-2">Students</th><th className="border p-2">Pass</th><th className="border p-2">Fail</th><th className="border p-2">Pass %</th></tr></thead><tbody>{stats.byDept.map(([d,v]) => <tr key={d}><td className="border p-2">{d}</td><td className="border p-2 text-center">{v.students}</td><td className="border p-2 text-center">{v.passed}</td><td className="border p-2 text-center">{v.failed}</td><td className="border p-2 text-center">{(v.passed / v.students * 100).toFixed(2)}%</td></tr>)}</tbody></table></div></div><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Grade distribution (subject grades)</h2><div className="mt-3 space-y-2">{stats.grades.map(([g,n]) => <div key={g} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm"><span className="font-semibold">{g}</span><span>{n}</span></div>)}</div></div></div></> : kind === 'grade-sheets' ? <div className="space-y-5">{rows.map((r, i) => <article key={`${rollOf(r)}-${i}`} className="break-inside-avoid rounded-xl border bg-white p-6 shadow-sm"><div className="border-b pb-4 text-center"><h2 className="text-lg font-bold">{selected.program} SEMESTER {selected.semester} GRADE SHEET</h2><p className="text-sm text-gray-500">Batch {selected.batch || '-'} · Calculation {selected.id}</p></div><dl className="my-4 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-gray-500">Student Name</dt><dd className="font-semibold">{nameOf(r)}</dd></div><div><dt className="text-gray-500">College Roll</dt><dd className="font-semibold">{rollOf(r)}</dd></div><div><dt className="text-gray-500">Department / Course</dt><dd className="font-semibold">{deptOf(r)}</dd></div></dl><table className="w-full border-collapse text-sm"><thead><tr className="bg-gray-50"><th className="border p-2 text-left">Paper</th><th className="border p-2 text-left">Subject</th><th className="border p-2">Marks</th><th className="border p-2">Full Marks</th><th className="border p-2">Grade</th><th className="border p-2">GP</th><th className="border p-2">Credit</th><th className="border p-2">CP</th></tr></thead><tbody>{subjectsOf(r).map((s,j) => <tr key={j}><td className="border p-2">{s.paperCode || j + 1}</td><td className="border p-2">{s.subjectName || s.subject || '-'}</td><td className="border p-2 text-center">{s.marks ?? 0}</td><td className="border p-2 text-center">{s.fullMark ?? '-'}</td><td className="border p-2 text-center">{s.grade || '-'}</td><td className="border p-2 text-center">{s.gradePoint ?? '-'}</td><td className="border p-2 text-center">{s.credit ?? '-'}</td><td className="border p-2 text-center">{s.creditPoint ?? '-'}</td></tr>)}</tbody></table><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><div>Total: <strong>{totalOf(r)} / {maxOf(r)}</strong></div><div>Credits: <strong>{r.totalCredits ?? '-'}</strong></div><div>Credit Points: <strong>{r.totalCreditPoints ?? '-'}</strong></div><div>SGPA: <strong>{r.sgpa ?? '-'}</strong></div><div>Status: <strong>{statusOf(r)}</strong></div></div></article>)}</div> : <div className="rounded-xl border bg-white p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Consolidated tabular register</h2><span className="text-sm text-gray-500">{rows.length} row(s)</span></div><div className="overflow-x-auto"><table className="w-full min-w-max border-collapse text-left text-xs"><thead><tr className="bg-gray-100"><th className="border p-2">#</th><th className="border p-2">Roll</th><th className="border p-2">Student</th><th className="border p-2">Department</th>{paperColumns.map((p) => <th key={p} className="border p-2">{p}</th>)}<th className="border p-2">Total</th><th className="border p-2">SGPA</th><th className="border p-2">Status</th></tr></thead><tbody>{rows.map((r,i) => <tr key={`${rollOf(r)}-${i}`}><td className="border p-2">{i+1}</td><td className="border p-2">{rollOf(r)}</td><td className="border p-2">{nameOf(r)}</td><td className="border p-2">{deptOf(r)}</td>{paperColumns.map((p) => { const s = subjectsOf(r).find((x) => String(x.subjectName || x.subject || x.paperCode || 'Paper') === p); return <td key={p} className="border p-2">{s ? `${s.marks ?? 0} ${s.grade ? `(${s.grade})` : ''}` : '—'}</td>; })}<td className="border p-2">{totalOf(r)}/{maxOf(r)}</td><td className="border p-2">{r.sgpa ?? '-'}</td><td className="border p-2">{statusOf(r)}</td></tr>)}</tbody></table></div></div>}
    </>}
  </div><style jsx global>{`@media print { body { background: white !important; } aside, nav, button, select, input, header p { display: none !important; } main, section { padding: 0 !important; margin: 0 !important; } article, .rounded-xl { box-shadow: none !important; break-inside: avoid; } table { font-size: 9px !important; } }`}</style></section>;
}
