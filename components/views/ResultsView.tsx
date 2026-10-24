'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DBData, PROG, ProgramKey } from '@/types';
import {
  calculateResult,
  findStudent,
  formatPct,
  getSubjects,
} from '@/lib/calculations';

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

  // Statistics for this program and semester
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

  // Filter students by roll number or name
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return allProgStudents.filter(
      (s) =>
        !q ||
        s.r.toLowerCase().includes(q) ||
        s.n.toLowerCase().includes(q)
    );
  }, [allProgStudents, searchQuery]);

  const selectedStudent = useMemo(() => {
    return selectedRoll ? findStudent(db, selectedRoll) : null;
  }, [db, selectedRoll]);

  const openSheet = (roll: string) => {
    setSelectedRoll((current) => (current === roll ? '' : roll));
  };

  const closeSheet = () => {
    setSelectedRoll('');
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
      navigator.clipboard
        .writeText(fullCsv)
        .then(() => {
          setCopyMsg(true);
          setTimeout(() => setCopyMsg(false), 2500);
        })
        .catch(() => {
          setCopyMsg(false);
        });
    }
  };

  return (
    <>
      <h1>Results (legacy)</h1>

      <div className="card" style={{ marginBottom: 18 }}>
        <b>This screen still uses the old simplemark-sum calculator.</b>
        <p className="hint" style={{ marginBottom: 0 }}>
          For the verified college calculation rules, use{' '}
          <b>Process Result</b>. Do not use this legacy screen for publishing a
          result.
        </p>
      </div>

      <p className="sub">
        The verified calculation workflow is available from Process Result.
      </p>

      {/* Filters */}
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
              {Array.from({ length: PROG[prog].sems }, (_, i) => i + 1).map(
                (s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                )
              )}
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
          {allProgStudents.length} students: {stats.pa} passed, {stats.fa}{' '}
          failed, {stats.pe} waiting for marks.
        </p>
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
                  const isSelected = selectedRoll === s.r;

                  return (
                    <React.Fragment key={s.r}>
                      <tr
                        className="click"
                        tabIndex={0}
                        onClick={() => openSheet(s.r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openSheet(s.r);
                          }
                        }}
                        title="Click to view full marksheet"
                        aria-expanded={isSelected}
                      >
                        <td>{s.r}</td>
                        <td>
                          {s.n}
                          {isSelected && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 12,
                                color: '#3157a6',
                                fontWeight: 600,
                              }}
                            >
                              Viewing
                            </span>
                          )}
                        </td>
                        <td className="num">
                          {c.t !== undefined ? `${c.t} / ${c.mx}` : '-'}
                        </td>
                        <td className="num">
                          {c.pct !== undefined ? formatPct(c.pct) : '-'}
                        </td>
                        <td>
                          {c.div && c.status === 'Pass' ? c.div : '-'}
                        </td>
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

                      {/* The selected student's marksheet appears directly
                          beneath that student's row. */}
                      {isSelected && (
                        <tr className="result-detail-row">
                          <td colSpan={6} style={{ padding: 12 }}>
                            <div ref={sheetRef} className="sheet">
                              <div
                                className="no-print"
                                style={{
                                  display: 'flex',
                                  justifyContent: 'flex-end',
                                  marginBottom: 6,
                                }}
                              >
                                <button
                                  className="btn"
                                  style={{
                                    minHeight: 28,
                                    padding: '4px 10px',
                                    fontSize: 13,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.print();
                                  }}
                                >
                                  Print marksheet
                                </button>

                                <button
                                  className="btn"
                                  style={{
                                    minHeight: 28,
                                    padding: '4px 10px',
                                    fontSize: 13,
                                    marginLeft: 8,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeSheet();
                                  }}
                                >
                                  Close
                                </button>
                              </div>

                              <h3>{db.college}</h3>

                              <div className="cap">
                                Statement of marks, semester {sem}
                              </div>

                              <div className="meta">
                                <div>
                                  Name: <b>{s.n}</b>
                                </div>
                                <div>
                                  Roll number: <b>{s.r}</b>
                                </div>
                                <div>
                                  Program: <b>{PROG[s.p].full}</b>
                                </div>
                                <div>
                                  Pass mark: <b>{db.pass} per subject</b>
                                </div>
                              </div>

                              {(() => {
                                const subs = getSubjects(db, s.p, sem);
                                const m = db.marks[`${s.r}|${sem}`] || {};
                                const result = calculateResult(db, s, sem);

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
                                          {subs.map((subject) => {
                                            const v = m[subject];
                                            const has =
                                              v !== undefined &&
                                              (v as unknown) !== '';
                                            const isPass =
                                              has && Number(v) >= db.pass;

                                            return (
                                              <tr key={subject}>
                                                <td>{subject}</td>
                                                <td className="num">
                                                  {db.max}
                                                </td>
                                                <td className="num">
                                                  {has ? v : '-'}
                                                </td>
                                                <td>
                                                  {has
                                                    ? isPass
                                                      ? 'Pass'
                                                      : 'Fail'
                                                    : '-'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="final">
                                      <div>
                                        {result.t !== undefined ? (
                                          <>
                                            Total:{' '}
                                            <b>
                                              {result.t} / {result.mx}
                                            </b>
                                            <br />
                                            Percentage:{' '}
                                            <b>
                                              {formatPct(result.pct!)}%
                                            </b>

                                            {result.status === 'Pass' && (
                                              <>
                                                <br />
                                                {result.div}
                                              </>
                                            )}
                                          </>
                                        ) : (
                                          'Marks are not complete yet.'
                                        )}
                                      </div>

                                      {result.status !== 'Pending' && (
                                        <div
                                          className={`stamp ${
                                            result.status === 'Pass'
                                              ? 'pass'
                                              : 'fail'
                                          }`}
                                        >
                                          {result.status.toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

          {copyMsg && (
            <span
              className="msg ok"
              style={{ margin: 0, alignSelf: 'center' }}
            >
              Copied to clipboard!
            </span>
          )}
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

      <style jsx>{`
        .result-detail-row > td {
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        @media print {
          body * {
            visibility: hidden;
          }

          .sheet,
          .sheet * {
            visibility: visible;
          }

          .sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}