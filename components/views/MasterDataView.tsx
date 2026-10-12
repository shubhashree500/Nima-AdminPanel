'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DBData } from '@/types';

type Kind = 'courses' | 'departments' | 'batches' | 'master-subjects' | 'subjects' | 'rules';
type Calculation = { id: string; program: string; semester: number; batch?: string | number; course?: string; department?: string; status?: string; results?: any[] };
type MasterLists = { courses: string[]; departments: string[]; batches: string[]; subjects: string[] };
const EMPTY_LISTS: MasterLists = { courses: [], departments: [], batches: [], subjects: [] };
const TITLES: Record<Kind, string> = { courses: 'Courses', departments: 'Departments', batches: 'Batches', 'master-subjects': 'Master Subjects', subjects: 'Subjects & Papers', rules: 'Result Rules' };
const CATALOG_KIND: Partial<Record<Kind, keyof MasterLists>> = { courses: 'courses', departments: 'departments', batches: 'batches', 'master-subjects': 'subjects' };

export function MasterDataView({ kind, db, onRefresh }: { kind: Kind; db: DBData; onRefresh: () => Promise<void> }) {
  const [catalog, setCatalog] = useState<MasterLists>(EMPTY_LISTS);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [legacyProgram, setLegacyProgram] = useState<'UG' | 'PG'>('UG');
  const [legacySemester, setLegacySemester] = useState('1');
  const [legacySubjectName, setLegacySubjectName] = useState('');
  const catalogKind = CATALOG_KIND[kind];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requests = await Promise.all([fetch('/api/master-data', { cache: 'no-store' }), fetch('/api/verify', { cache: 'no-store' })]);
      const [masterJson, calcJson] = await Promise.all(requests.map((r) => r.json()));
      if (!masterJson.success) throw new Error(masterJson.error || 'Unable to load master data.');
      setCatalog({ ...EMPTY_LISTS, ...(masterJson.data || {}) });
      if (calcJson.success) setCalculations(Array.isArray(calcJson.data) ? calcJson.data : []);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load data.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const inferred = useMemo(() => {
    const set = new Set<string>();
    calculations.forEach((c) => {
      if (kind === 'courses') { if (c.course) set.add(String(c.course)); (c.results || []).forEach((r) => { const s = r.student || r; if (s.course) set.add(String(s.course)); }); }
      if (kind === 'departments') { if (c.department) set.add(String(c.department)); (c.results || []).forEach((r) => { const s = r.student || r; if (s.Department || s.department) set.add(String(s.Department || s.department)); }); }
      if (kind === 'batches' && c.batch) set.add(String(c.batch));
      if (kind === 'master-subjects') { (c.results || []).forEach((r) => { (r.subjects || []).forEach((s: any) => { set.add(String(s.subjectName || s.subject || s.paperCode || '').trim()); }); }); }
    });
    set.delete('');
    return Array.from(set).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [calculations, kind]);

  const add = async () => {
    if (!catalogKind || !value.trim()) return;
    setSaving(true); setMessage('');
    try { const response = await fetch('/api/master-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: catalogKind, value }) }); const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error || 'Unable to add item.'); setCatalog({ ...EMPTY_LISTS, ...(json.data || {}) }); setValue(''); setMessage('Master data saved.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add item.'); }
    finally { setSaving(false); }
  };
  const remove = async (item: string) => {
    if (!catalogKind || !window.confirm(`Remove "${item}" from the master catalogue? Existing calculation records will not be changed.`)) return;
    try { const response = await fetch('/api/master-data', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: catalogKind, value: item }) }); const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error || 'Unable to remove item.'); setCatalog({ ...EMPTY_LISTS, ...(json.data || {}) }); setMessage('Item removed from the catalogue.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to remove item.'); }
  };

  if (kind === 'rules') return <section className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-5xl space-y-6"><header><h1 className="text-2xl font-bold">Result Rules</h1><p className="mt-2 text-sm text-gray-600">Review the rule summary used by the current calculation workflow.</p></header><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Common result checks</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-gray-50"><th className="border p-3">Rule</th><th className="border p-3">Current value</th><th className="border p-3">Notes</th></tr></thead><tbody>{[['UG passing mark','40 / 100','Confirmed college rule'],['UG grace limit','8 marks per student','Maximum 5 marks in one subject; only for failing students; apply after rounding the calculated subject mark'],['Grace priority','Major CP 1 → Major CP 2 → Minor → MDC/MDE → AEC → VAC','Follow the established UG grace priority order'],['UG grade scale','O 90–100 (10); A+ 80–89 (9); A 70–79 (8); B+ 60–69 (7); B 50–59 (6); C 45–49 (5); D 40–44 (4); F below 40 (0)','AB and M receive 0 grade points'],['PG grade scale','O 90–100 (10); A+ 80–89 (9); A 70–79 (8); B+ 60–69 (7); B 50–59 (6); C 45–49 (5); D 40–44 (4); F below 40 (0)','The active semester/department configuration determines paper marks and credits'],['Credit point','Credit × Grade Point','Used for semester grade-point calculations'],['SGPA','Total Credit Points ÷ Total Credits','Calculated by the result engine'],['Rule editing','Versioned calculation configuration','This screen is read-only: changing a label here must not silently change the verified calculation engine']].map(([rule,val,note]) => <tr key={rule}><td className="border p-3 font-medium">{rule}</td><td className="border p-3">{val}</td><td className="border p-3 text-gray-600">{note}</td></tr>)}</tbody></table></div><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The active UG/PG calculation rules remain controlled by versioned engine configurations. Editing those safely requires a new rule version and parity tests before it is used for a live exam.</p></div></div></section>;

  const title = TITLES[kind];
  const activeList = catalogKind ? catalog[catalogKind] || [] : [];
  const legacySubjects = kind === 'subjects' ? Object.entries(db.subjects || {}).flatMap(([key, names]) => names.map((name, index) => ({ key, name, index }))) : [];
  const countLabel = kind === 'subjects' ? `${legacySubjects.length} configured program-semester entries` : `${inferred.length} found in saved calculations`;
  return <section className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-6xl space-y-6"><header><h1 className="text-2xl font-bold text-gray-900">{title}</h1><p className="mt-2 text-sm text-gray-600">Maintain reusable administrative catalogue entries. Existing saved calculation records are never rewritten by catalogue changes.</p></header>
    {message && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
    {kind !== 'subjects' && <div className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">Add {kind === 'master-subjects' ? 'subject' : kind.slice(0, -1)}</h2><div className="mt-3 flex flex-wrap gap-3"><input className="min-w-64 flex-1 rounded-lg border p-3" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Enter ${kind === 'master-subjects' ? 'subject / paper name' : kind.slice(0, -1)}`} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} /><button onClick={() => void add()} disabled={saving || !value.trim()} className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add to catalogue'}</button><button onClick={() => void load()} disabled={loading} className="rounded-lg border px-4 py-3 text-sm font-semibold">Refresh</button></div><p className="mt-2 text-xs text-gray-500">Catalogue entries are saved separately from the versioned calculation configs. Adding an entry here does not automatically create a new UG/PG paper configuration.</p></div>}
    {kind === 'subjects' ? <div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Legacy subject lists</h2><p className="mt-1 text-sm text-gray-500">These lists are used by the older manual marks screen. PG 2025 and the universal calculation workflow use the department/semester engine configurations instead.</p><div className="mt-4 grid gap-3 sm:grid-cols-4"><label className="text-sm">Program<select className="mt-1 w-full rounded-lg border p-2.5" value={legacyProgram} onChange={(e) => setLegacyProgram(e.target.value as 'UG' | 'PG')}><option>UG</option><option>PG</option></select></label><label className="text-sm">Semester<select className="mt-1 w-full rounded-lg border p-2.5" value={legacySemester} onChange={(e) => setLegacySemester(e.target.value)}>{Array.from({length: legacyProgram === 'UG' ? 6 : 4}, (_,i) => String(i+1)).map((sem) => <option key={sem}>{sem}</option>)}</select></label><label className="text-sm sm:col-span-2">Subject name<input className="mt-1 w-full rounded-lg border p-2.5" value={legacySubjectName} onChange={(e) => setLegacySubjectName(e.target.value)} placeholder="Enter subject name" /></label></div><div className="mt-3 flex flex-wrap gap-2"><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white" disabled={!legacySubjectName.trim()} onClick={async () => { try { const res = await fetch('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prog: legacyProgram, sem: Number(legacySemester), name: legacySubjectName }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Unable to add subject.'); setLegacySubjectName(''); await onRefresh(); setMessage('Subject added to the selected program and semester.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add subject.'); } }}>Add subject</button><button className="rounded-lg border px-4 py-2 text-sm" onClick={async () => { if (!window.confirm(`Copy the ${legacyProgram} Semester ${legacySemester} subject list to every semester in ${legacyProgram}?`)) return; try { const res = await fetch('/api/subjects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prog: legacyProgram, sem: Number(legacySemester) }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Unable to copy subject list.'); await onRefresh(); setMessage('Subject list copied to all semesters in this program.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to copy subject list.'); } }}>Copy this list to all semesters</button></div><div className="mt-5 space-y-4">{Object.entries(db.subjects || {}).map(([key,names]) => <div key={key} className="rounded-lg border p-3"><h3 className="font-semibold">{key.replace('|',' · Semester ')}</h3><div className="mt-2 flex flex-wrap gap-2">{names.map((name,index) => <span key={`${key}-${name}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm">{name}<button aria-label={`Remove ${name}`} className="font-bold text-red-700" onClick={async () => { if (!window.confirm(`Remove ${name} from ${key}?`)) return; try { const [prog, sem] = key.split('|'); const res = await fetch(`/api/subjects?prog=${encodeURIComponent(prog)}&sem=${encodeURIComponent(sem)}&index=${index}`, { method: 'DELETE' }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Unable to remove subject.'); await onRefresh(); setMessage('Subject removed from the selected list.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to remove subject.'); } }}>×</button></span>)}</div></div>)}</div></div> : <div className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Saved catalogue ({activeList.length})</h2>{loading ? <p className="mt-3 text-sm text-gray-500">Loading…</p> : activeList.length ? <ul className="mt-3 divide-y">{activeList.map((item) => <li key={item} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{item}</span><button onClick={() => void remove(item)} className="rounded border px-2 py-1 text-red-700">Remove</button></li>)}</ul> : <p className="mt-3 text-sm text-gray-500">No entries saved in this catalogue yet.</p>}</div><div className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Detected from saved calculations ({inferred.length})</h2><p className="mt-1 text-xs text-gray-500">This is a read-only view of actual calculation records; use it to seed the reusable catalogue.</p><div className="mt-3 flex flex-wrap gap-2">{inferred.map((item) => <button key={item} onClick={() => setValue(item)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50">{item}</button>)}</div>{inferred.length === 0 && <p className="mt-2 text-sm text-gray-500">No values found in saved calculations.</p>}</div></div>}
    <div className="text-xs text-gray-500">{countLabel}. {calculations.length} saved calculation record(s) checked.</div>
  </div></section>;
}
