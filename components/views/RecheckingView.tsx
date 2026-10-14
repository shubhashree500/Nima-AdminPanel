'use client';

import { useCallback, useEffect, useState } from 'react';

type Application = { id: string; studentRoll: string; studentName: string; program: 'UG' | 'PG'; semester: number; batch?: string; paperCode?: string; reason: string; requestedMarks?: number | null; status: string; decisionNotes?: string; createdAt?: string };
const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed'];
const EMPTY = { studentRoll: '', studentName: '', program: 'PG', semester: '1', batch: '2025', paperCode: '', reason: '', requestedMarks: '' };

export function RecheckingView() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch('/api/rechecking', { cache: 'no-store' }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Unable to load applications.'); setApplications(json.applications || []); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load applications.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!form.studentRoll.trim() || !form.studentName.trim() || !form.reason.trim()) { setMessage('Enter the student roll, student name and application reason.'); return; }
    setSaving(true); setMessage('');
    try { const res = await fetch('/api/rechecking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, semester: Number(form.semester), requestedMarks: form.requestedMarks === '' ? null : Number(form.requestedMarks) }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Unable to save application.'); setApplications((prev) => [json.application, ...prev]); setForm(EMPTY); setMessage('Application registered successfully.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save application.'); }
    finally { setSaving(false); }
  };

  const update = async (app: Application, changes: Record<string, unknown>) => {
    try { const res = await fetch('/api/rechecking', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: app.id, ...changes }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Unable to update application.'); setApplications((prev) => prev.map((item) => item.id === app.id ? json.application : item)); setMessage('Application updated.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update application.'); }
  };

  return <section className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-7xl space-y-6"><header><h1 className="text-2xl font-bold text-gray-900">Rechecking & Revaluation</h1><p className="mt-2 text-sm text-gray-600">Register applications and track decisions. Recording an approved application here does not silently alter a published mark; the result must be updated through a controlled recalculation workflow.</p></header>
    {message && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
    <div className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">New application</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{([['studentRoll','College roll'],['studentName','Student name'],['batch','Batch'],['paperCode','Paper code']] as const).map(([key,label]) => <label key={key} className="text-sm font-medium text-gray-700">{label}<input className="mt-1 w-full rounded-lg border p-2.5" value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} /></label>)}<label className="text-sm font-medium text-gray-700">Program<select className="mt-1 w-full rounded-lg border p-2.5" value={form.program} onChange={(e) => setForm((p) => ({ ...p, program: e.target.value }))}><option>UG</option><option>PG</option></select></label><label className="text-sm font-medium text-gray-700">Semester<input type="number" min="1" max={form.program === 'UG' ? 6 : 4} className="mt-1 w-full rounded-lg border p-2.5" value={form.semester} onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))} /></label><label className="text-sm font-medium text-gray-700">Requested mark (optional)<input type="number" min="0" className="mt-1 w-full rounded-lg border p-2.5" value={form.requestedMarks} onChange={(e) => setForm((p) => ({ ...p, requestedMarks: e.target.value }))} /></label><label className="text-sm font-medium text-gray-700 sm:col-span-2 lg:col-span-3">Reason<textarea className="mt-1 w-full rounded-lg border p-2.5" rows={2} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} /></label></div><button onClick={() => void submit()} disabled={saving} className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Register Application'}</button></div>
    <div className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Applications ({applications.length})</h2><button onClick={() => void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-sm">Refresh</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-sm"><thead><tr className="bg-gray-50"><th className="border p-2">Application</th><th className="border p-2">Student</th><th className="border p-2">Exam / Paper</th><th className="border p-2">Reason</th><th className="border p-2">Requested mark</th><th className="border p-2">Status</th><th className="border p-2">Decision notes</th><th className="border p-2">Action</th></tr></thead><tbody>{applications.map((app) => <tr key={app.id}><td className="border p-2"><div className="font-semibold">{app.id}</div><div className="text-xs text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''}</div></td><td className="border p-2">{app.studentName}<div className="text-xs text-gray-500">{app.studentRoll}</div></td><td className="border p-2">{app.program} Sem {app.semester}<div className="text-xs text-gray-500">Batch {app.batch || '-'} · {app.paperCode || 'All papers'}</div></td><td className="border p-2 max-w-56">{app.reason}</td><td className="border p-2">{app.requestedMarks ?? '-'}</td><td className="border p-2"><select className="rounded border p-1.5" value={app.status} disabled={app.status === 'Completed'} onChange={(e) => void update(app, { status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td><td className="border p-2"><input className="w-52 rounded border p-1.5" value={notes[app.id] ?? app.decisionNotes ?? ''} disabled={app.status === 'Completed'} onChange={(e) => setNotes((p) => ({ ...p, [app.id]: e.target.value }))} placeholder="Review / decision note" /></td><td className="border p-2"><button className="rounded border px-2.5 py-1.5" disabled={app.status === 'Completed'} onClick={() => void update(app, { decisionNotes: notes[app.id] ?? app.decisionNotes ?? '' })}>Save note</button></td></tr>)}{!loading && applications.length === 0 && <tr><td colSpan={8} className="border p-5 text-center text-gray-500">No applications registered yet.</td></tr>}</tbody></table></div></div>
  </div></section>;
}
