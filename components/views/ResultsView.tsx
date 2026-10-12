'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DBData, PROG, ProgramKey, Student } from '@/types';
import { calculateResult, findStudent, formatPct, getSubjects } from '@/lib/calculations';

interface ResultsViewProps {
  db: DBData;
}

export function ResultsView({ db }: ResultsViewProps) {
  const [prog, setProg] = useState<ProgramKey>('UG');
  const [sem, setSem] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoll, setSelectedRoll] = useState<string>('');

  const [csvText, setCsvText] = useState('');
  const [showCsv, setShowCsv] = useState(false);
  const [copyMsg, setCopyMsg] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const csvAreaRef = useRef<HTMLTextAreaElement>(null);

  const allProgStudents = useMemo(() => {
    return db.students.filter((s) => s.p === prog);
  }, [db.students, prog]);

  // Statistics for this program & semester
  const stats = useMemo(() => {
    let pa = 0;
    let fa = 0;
    let pe = 0;
    allProgStudents.forEach((s) => {
      const c = calculateResult(db, s, sem);
      if (c.status === 'Pass') pa++;
      else if (c.status === 'Fail') fa++;
      else pe++;
    });
    return { pa, fa, pe };
  }, [db, allProgStudents, sem]);

  // Filtered by search query
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allProgStudents.filter(
      (s) => !q || s.r.toLowerCase().includes(q) || s.n.toLowerCase().includes(q)
    );
  }, [allProgStudents, searchQuery]);

  const selectedStudent = useMemo(() => {
    return selectedRoll ? findStudent(db, selectedRoll) : null;
  }, [db, selectedRoll]);

  const openSheet = (roll: string) => {
    setSelectedRoll(roll);
    setTimeout(() => {
      sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleCopyCsv = () => {
    const subs = getSubjects(db, prog, sem);
    const lines = [
      ['roll_no', 'name', ...subs, 'total', 'percentage', 'result'].join(','),
    ];

    filteredStudents.forEach((s) => {
      const m = db.marks[`${s.r}|${sem}`] || {};
      const c = calculateResult(db, s, sem);
      const row = [
        s.r,
        `"${s.n.replace(/"/g, '""')}"`,
        ...subs.map((x) => (m[x] !== undefined ? m[x] : '')),
        c.t !== undefined ? c.t : '',
        c.pct !== undefined ? formatPct(c.pct) : '',
        c.status,
      ];
      lines.push(row.join(','));
    });

    const fullCsv = lines.join('\n');
    setCsvText(fullCsv);
    setShowCsv(true);

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullCsv);
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 2500);
    }
  };

  return (
    <>
      <h1>Results (legacy)</h1>
      <div className="card" style={{ marginBottom: 18 }}>
        <b>This screen still uses the old simple mark-sum calculator.</b>
        <p className="hint" style={{ marginBottom: 0 }}>For the verified college calculation rules, use <b>Process Result</b>. Do not use this legacy screen for publishing a result.</p>
      </div>
      <p className="sub">The verified calculation workflow is available from Process Result.</p>

      {/* Filter Card */}
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
                setSelectedRoll('');
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
            Search
            <input
              placeholder="Roll number or name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        <p className="hint">
          {allProgStudents.length} students: {stats.pa} passed, {stats.fa} failed, {stats.pe} waiting for marks.
        </p>
      </div>

      {/* Statement of Marksheet Modal / Detail */}
      <div ref={sheetRef}>
        {selectedStudent && (
          <div className="sheet">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button
                className="btn"
                style={{ minHeight: 28, padding: '4px 10px', fontSize: 13 }}
                onClick={() => window.print()}
              >
                Print marksheet
              </button>
              <button
                className="btn"
                style={{ minHeight: 28, padding: '4px 10px', fontSize: 13, marginLeft: 8 }}
                onClick={() => setSelectedRoll('')}
              >
                Close
              </button>
            </div>

            <h3>{db.college}</h3>
            <div className="cap">Statement of marks, semester {sem}</div>

            <div className="meta">
              <div>
                Name: <b>{selectedStudent.n}</b>
              </div>
              <div>
                Roll number: <b>{selectedStudent.r}</b>
              </div>
              <div>
                Program: <b>{PROG[selectedStudent.p].full}</b>
              </div>
              <div>
                Pass mark: <b>{db.pass} per subject</b>
              </div>
            </div>

            {(() => {
              const subs = getSubjects(db, selectedStudent.p, sem);
              const m = db.marks[`${selectedStudent.r}|${sem}`] || {};
              const c = calculateResult(db, selectedStudent, sem);

              return (
                <>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th className="num">Full marks</th>
                          <th className="num">Obtained</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subs.map((s) => {
                          const v = m[s];
                          const has = v !== undefined && (v as unknown) !== '';
                          const isPass = has && Number(v) >= db.pass;

                          return (
                            <tr key={s}>
                              <td>{s}</td>
                              <td className="num">{db.max}</td>
                              <td className="num">{has ? v : '-'}</td>
                              <td>{has ? isPass ? 'Pass' : 'Fail' : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="final">
                    <div>
                      {c.t !== undefined ? (
                        <>
                          Total: <b>{c.t} / {c.mx}</b>
                          <br />
                          Percentage: <b>{formatPct(c.pct!)}%</b>
                          {c.status === 'Pass' && (
                            <>
                              <br />
                              {c.div}
                            </>
                          )}
                        </>
                      ) : (
                        'Marks are not complete yet.'
                      )}
                    </div>

                    {c.status !== 'Pending' && (
                      <div className={`stamp ${c.status === 'Pass' ? 'pass' : 'fail'}`}>
                        {c.status.toUpperCase()}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="card">
        {filteredStudents.length === 0 ? (
          <div className="empty">No students found for this program.</div>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Roll no.</th>
                  <th>Name</th>
                  <th className="num">Total</th>
                  <th className="num">%</th>
                  <th>Division</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const c = calculateResult(db, s, sem);
                  return (
                    <tr
                      key={s.r}
                      className="click"
                      tabIndex={0}
                      onClick={() => openSheet(s.r)}
                      onKeyDown={(e) => e.key === 'Enter' && openSheet(s.r)}
                      title="Click to view full marksheet"
                    >
                      <td>{s.r}</td>
                      <td>{s.n}</td>
                      <td className="num">
                        {c.t !== undefined ? `${c.t} / ${c.mx}` : '-'}
                      </td>
                      <td className="num">
                        {c.pct !== undefined ? formatPct(c.pct) : '-'}
                      </td>
                      <td>{c.div && c.status === 'Pass' ? c.div : '-'}</td>
                      <td>
                        <span
                          className={`chip ${
                            c.status === 'Pass'
                              ? 'pass'
                              : c.status === 'Fail'
                              ? 'fail'
                              : 'pend'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={handleCopyCsv}>
            Copy results as CSV
          </button>
          {copyMsg && <span className="msg ok" style={{ margin: 0, alignSelf: 'center' }}>Copied to clipboard!</span>}
        </div>

        {showCsv && (
          <textarea
            ref={csvAreaRef}
            readOnly
            value={csvText}
            style={{ marginTop: 10 }}
            rows={Math.min(10, filteredStudents.length + 2)}
            aria-label="Results as CSV"
            onFocus={(e) => e.target.select()}
          />
        )}
      </div>
    </>
  );
}
