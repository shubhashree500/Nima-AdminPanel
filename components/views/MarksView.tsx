'use client';

import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { DBData, PROG, ProgramKey } from '@/types';
import { getSubjects, formatPct, findStudent } from '@/lib/calculations';
import { parseCSV, readSpreadsheetFile } from '@/lib/csv';

interface MarksViewProps {
  db: DBData;
  onSaveMarks: (roll: string, sem: number, marks: Record<string, number>) => Promise<boolean>;
  onImportMarks: (sem: number, records: Array<{ r: string; m: Record<string, number> }>) => Promise<void>;
}

export function MarksView({ db, onSaveMarks, onImportMarks }: MarksViewProps) {
  const [prog, setProg] = useState<ProgramKey>('UG');
  const [sem, setSem] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoll, setSelectedRoll] = useState<string>('');

  // Form input values for the currently selected student
  const [inputMarks, setInputMarks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [impData, setImpData] = useState<{
    records: Array<{ r: string; m: Record<string, number> }>;
    missingSubs: string[];
    errs: string[];
  } | null>(null);
  const [impMsg, setImpMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  const subjects = useMemo(() => getSubjects(db, prog, sem), [db, prog, sem]);

  // Students in this program filtered by search query
  const programStudents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return db.students.filter(
      (s) => s.p === prog && (!q || s.r.toLowerCase().includes(q) || s.n.toLowerCase().includes(q))
    );
  }, [db.students, prog, searchQuery]);

  // Ensure selectedRoll is valid
  useEffect(() => {
    if (!programStudents.some((s) => s.r === selectedRoll)) {
      setSelectedRoll(programStudents.length ? programStudents[0].r : '');
    }
  }, [programStudents, selectedRoll]);

  // When selected student, program, or semester changes, load marks into input state
  useEffect(() => {
    if (!selectedRoll) {
      setInputMarks({});
      return;
    }
    const saved = db.marks[`${selectedRoll}|${sem}`] || {};
    const initial: Record<string, string> = {};
    subjects.forEach((s) => {
      initial[s] = saved[s] !== undefined ? String(saved[s]) : '';
    });
    setInputMarks(initial);
    setMsg(null);
  }, [selectedRoll, sem, subjects, db.marks]);

  // Live calculation based on current input values
  const liveCalc = useMemo(() => {
    if (!selectedRoll || !subjects.length) {
      return { total: 0, max: 0, pct: 0, status: 'Pending' as const };
    }

    let t = 0;
    let filledCount = 0;
    let fail = false;

    subjects.forEach((s) => {
      const raw = inputMarks[s];
      if (raw !== undefined && raw.trim() !== '') {
        const val = Math.max(0, Math.min(db.max, Number(raw)));
        filledCount++;
        t += val;
        if (val < db.pass) {
          fail = true;
        }
      }
    });

    const mx = subjects.length * db.max;
    const pct = mx > 0 ? (t / mx) * 100 : 0;
    const status = filledCount < subjects.length ? 'Pending' : fail ? 'Fail' : 'Pass';

    return { total: t, max: mx, pct, status };
  }, [inputMarks, subjects, db.max, db.pass, selectedRoll]);

  const handleInputChange = (sub: string, val: string) => {
    setInputMarks((prev) => ({ ...prev, [sub]: val }));
    setMsg(null);
  };

  const handleSave = async (goToNext: boolean) => {
    if (!selectedRoll) return;

    const marksToSave: Record<string, number> = {};
    let hasInvalid = false;

    for (const s of subjects) {
      const v = inputMarks[s];
      if (v === undefined || v.trim() === '') continue;
      const num = Number(v);
      if (isNaN(num) || num < 0 || num > db.max) {
        hasInvalid = true;
        break;
      }
      marksToSave[s] = num;
    }

    if (hasInvalid) {
      setMsg({ text: `Marks must be between 0 and ${db.max}.`, type: 'bad' });
      return;
    }

    if (Object.keys(marksToSave).length === 0) {
      setMsg({ text: 'Enter at least one mark.', type: 'bad' });
      return;
    }

    const success = await onSaveMarks(selectedRoll, sem, marksToSave);
    if (!success) {
      setMsg({ text: 'Failed to save marks.', type: 'bad' });
      return;
    }

    if (goToNext) {
      const idx = programStudents.findIndex((s) => s.r === selectedRoll);
      if (idx > -1 && idx < programStudents.length - 1) {
        setSelectedRoll(programStudents[idx + 1].r);
        setMsg({ text: 'Saved. Now showing the next student.', type: 'ok' });
      } else {
        setMsg({ text: 'Saved. This was the last student in the list.', type: 'ok' });
      }
    } else {
      setMsg({ text: 'Saved.', type: 'ok' });
    }
  };

  // CSV/Excel Import preview
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readSpreadsheetFile(file);
      setCsvText(content);
      setImpData(null);
      setImpMsg(null);
    } catch (err) {
      setImpMsg({ text: 'Error reading spreadsheet file.', type: 'bad' });
    }
  };

  const handlePreviewCSV = () => {
    const rows = parseCSV(csvText);
    if (!rows.length) {
      setImpMsg({ text: 'Paste or choose a file first.', type: 'bad' });
      setImpData(null);
      return;
    }

    const head = rows[0].map((h) => h.toLowerCase());
    const colMap: number[] = [];
    const missing: string[] = [];

    subjects.forEach((s) => {
      const i = head.indexOf(s.toLowerCase());
      if (i < 1) missing.push(s);
      colMap.push(i);
    });

    if (missing.length === subjects.length) {
      setImpMsg({
        text: `The header row does not match these subjects: ${subjects.join(', ')}.`,
        type: 'bad',
      });
      setImpData(null);
      return;
    }

    const errs: string[] = [];
    const out: Array<{ r: string; m: Record<string, number> }> = [];

    rows.slice(1).forEach((x, i) => {
      const r = x[0] || '';
      const st = findStudent(db, r);
      const line = `Row ${i + 1}: `;

      if (!st) {
        errs.push(`${line}roll number "${r}" not found`);
        return;
      }
      if (st.p !== prog) {
        errs.push(`${line}${r} belongs to ${st.p}, not ${prog}`);
        return;
      }

      const m: Record<string, number> = {};
      let bad = false;

      subjects.forEach((s, k) => {
        if (colMap[k] < 1) return;
        const c = x[colMap[k]];
        if (c === undefined || c === '') return;
        const v = Number(c);
        if (isNaN(v) || v < 0 || v > db.max) {
          bad = true;
          errs.push(`${line}${s} has "${c}", which is not between 0 and ${db.max}`);
        } else {
          m[s] = v;
        }
      });

      if (!bad && Object.keys(m).length) {
        out.push({ r, m });
      }
    });

    setImpData({ records: out, missingSubs: missing, errs });
    setImpMsg(null);
  };

  const handleDoImport = async () => {
    if (!impData || !impData.records.length) return;
    await onImportMarks(sem, impData.records);
    setImpMsg({
      text: `Imported marks for ${impData.records.length} students. Open Results to see them.`,
      type: 'ok',
    });
    setImpData(null);
    setCsvText('');
  };

  return (
    <>
      <h1>Enter marks</h1>
      <p className="sub">Choose program, semester and student, then type the marks the college gave you.</p>

      {/* Selectors */}
      <div className="card">
        <div className="row">
          <label>
            Program
            <select
              value={prog}
              onChange={(e) => {
                setProg(e.target.value as ProgramKey);
                setSem(1);
                setSelectedRoll('');
                setImpData(null);
              }}
            >
              {(Object.keys(PROG) as ProgramKey[]).map((p) => (
                <option key={p} value={p}>
                  {PROG[p].full}
                </option>
              ))}
            </select>
          </label>
          <label>
            Semester
            <select
              value={sem}
              onChange={(e) => {
                setSem(Number(e.target.value));
                setImpData(null);
              }}
            >
              {Array.from({ length: PROG[prog].sems }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Find student
            <input
              placeholder="Roll number or name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <label>
            Student
            <select
              value={selectedRoll}
              onChange={(e) => setSelectedRoll(e.target.value)}
            >
              {programStudents.length === 0 ? (
                <option value="">No students</option>
              ) : (
                programStudents.map((s) => (
                  <option key={s.r} value={s.r}>
                    {s.r} - {s.n}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      {/* Marks Form */}
      <div className="card">
        {subjects.length === 0 ? (
          <div className="empty">No subjects set for this semester. Add them in Setup.</div>
        ) : !selectedRoll ? (
          <div className="empty">Add students to this program first.</div>
        ) : (
          <>
            <div className="subs">
              {subjects.map((s) => {
                const rawVal = inputMarks[s] || '';
                const numVal = Number(rawVal);
                const isLow = rawVal !== '' && !isNaN(numVal) && numVal < db.pass;

                return (
                  <label key={s}>
                    {s} (out of {db.max})
                    <input
                      type="number"
                      min={0}
                      max={db.max}
                      step={1}
                      inputMode="numeric"
                      className={isLow ? 'low' : ''}
                      value={rawVal}
                      onChange={(e) => handleInputChange(s, e.target.value)}
                    />
                  </label>
                );
              })}
            </div>

            <div className="calc">
              <div>
                <small>Total</small>
                <strong>
                  {liveCalc.total} / {liveCalc.max}
                </strong>
              </div>
              <div>
                <small>Percentage</small>
                <strong>{formatPct(liveCalc.pct)}%</strong>
              </div>
              <div>
                <small>Result</small>
                <span
                  className={`chip ${
                    liveCalc.status === 'Pass'
                      ? 'pass'
                      : liveCalc.status === 'Fail'
                      ? 'fail'
                      : 'pend'
                  }`}
                >
                  {liveCalc.status}
                </span>
              </div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => handleSave(false)}>
                Save
              </button>
              <button className="btn primary" onClick={() => handleSave(true)}>
                Save and go to next student
              </button>
            </div>

            {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
          </>
        )}
      </div>

      {/* Excel / CSV Import */}
      <div className="card">
        <h2>Import marks from Excel / CSV</h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          For <b>{PROG[prog].full}</b>, semester <b>{sem}</b>. First column <b>roll_no</b>, then one column per subject: <b>{['roll_no', ...subjects].join(', ')}</b>. You can choose an Excel file (.xlsx, .xls), CSV file, or paste table cells from Excel.
        </p>
        <textarea
          placeholder={`roll_no,${subjects.join(',')}\n101,${subjects.map(() => 75).join(',')}`}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
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

        {impMsg && <p className={`msg ${impMsg.type}`}>{impMsg.text}</p>}

        {impData && (
          <div style={{ marginTop: 10 }}>
            {impData.missingSubs.length > 0 && (
              <p className="hint" style={{ color: 'var(--warn)' }}>
                No column found for: {impData.missingSubs.join(', ')}. Those subjects stay empty.
              </p>
            )}

            <p className="msg ok">{impData.records.length} students ready to import.</p>

            {impData.errs.length > 0 && (
              <>
                <p className="hint" style={{ color: 'var(--bad)' }}>
                  {impData.errs.length} row(s) will be skipped:
                </p>
                <div className="hint">
                  {impData.errs.slice(0, 8).map((e, idx) => (
                    <div key={idx}>{e}</div>
                  ))}
                  {impData.errs.length > 8 && <div>and {impData.errs.length - 8} more</div>}
                </div>
              </>
            )}

            {impData.records.length > 0 && (
              <button
                className="btn primary"
                style={{ marginTop: 12 }}
                onClick={handleDoImport}
              >
                Import marks for {impData.records.length} students
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
