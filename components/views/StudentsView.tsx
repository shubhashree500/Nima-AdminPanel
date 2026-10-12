'use client';

import React, { useState, useMemo, ChangeEvent } from 'react';
import { DBData, Student, PROG, ProgramKey } from '@/types';
import { parseCSV, readSpreadsheetFile } from '@/lib/csv';

interface StudentsViewProps {
  db: DBData;
  onAddStudent: (student: Student) => Promise<boolean>;
  onDeleteStudent: (roll: string) => Promise<void>;
  onImportStudents: (students: Student[]) => Promise<void>;
}

export function StudentsView({
  db,
  onAddStudent,
  onDeleteStudent,
  onImportStudents,
}: StudentsViewProps) {
  // Add single student form state
  const [roll, setRoll] = useState('');
  const [name, setName] = useState('');
  const [program, setProgram] = useState<ProgramKey>('UG');
  const [addMsg, setAddMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProg, setFilterProg] = useState<string>('');
  const [pageIndex, setPageIndex] = useState(0);

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [impData, setImpData] = useState<{
    add: Student[];
    upd: number;
    errs: string[];
  } | null>(null);
  const [impMsg, setImpMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // Add single student handler
  const handleAdd = async () => {
    const r = roll.trim();
    const n = name.trim();
    if (!r || !n) {
      setAddMsg({ text: 'Enter a roll number and a name.', type: 'bad' });
      return;
    }

    if (db.students.some((s) => s.r === r)) {
      setAddMsg({ text: `Roll number ${r} already exists.`, type: 'bad' });
      return;
    }

    const success = await onAddStudent({ r, n, p: program });
    if (success) {
      setRoll('');
      setName('');
      setAddMsg({ text: `Added ${n}.`, type: 'ok' });
    }
  };

  // Read file into textarea (supports Excel .xlsx, .xls, .csv, .tsv)
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

  // Preview CSV file
  const handlePreviewCSV = () => {
    const rows = parseCSV(csvText);
    if (!rows.length) {
      setImpMsg({ text: 'Paste or choose a file first.', type: 'bad' });
      setImpData(null);
      return;
    }

    let ci = { r: 0, n: 1, p: 2 };
    let dataRows = [...rows];

    if (/roll/i.test(rows[0][0])) {
      rows[0].forEach((h, i) => {
        const col = h.toLowerCase();
        if (/roll/.test(col)) ci.r = i;
        else if (/name/.test(col)) ci.n = i;
        else if (/prog|class|course/.test(col)) ci.p = i;
      });
      dataRows = rows.slice(1);
    }

    const errs: string[] = [];
    const add: Student[] = [];
    let upd = 0;
    const seen: Record<string, boolean> = {};

    dataRows.forEach((x, i) => {
      const r = x[ci.r] || '';
      const n = x[ci.n] || '';
      const p = (x[ci.p] || '').toUpperCase() as ProgramKey;
      const line = `Row ${i + 1}: `;

      if (!r || !n) {
        errs.push(`${line}roll number or name is empty`);
        return;
      }
      if (!PROG[p]) {
        errs.push(`${line}program "${x[ci.p] || ''}" is not UG, BCA, BBA or PG`);
        return;
      }
      if (seen[r]) {
        errs.push(`${line}roll number ${r} appears twice in the file`);
        return;
      }
      seen[r] = true;
      if (db.students.some((s) => s.r === r)) {
        upd++;
      }
      add.push({ r, n, p });
    });

    setImpData({ add, upd, errs });
    setImpMsg(null);
  };

  // Execute import
  const handleDoImport = async () => {
    if (!impData || !impData.add.length) return;
    await onImportStudents(impData.add);
    setImpMsg({ text: `Imported ${impData.add.length} students.`, type: 'ok' });
    setImpData(null);
    setCsvText('');
  };

  // Filtered and paginated students list
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return db.students.filter((s) => {
      const matchProg = !filterProg || s.p === filterProg;
      const matchQuery = !q || s.r.toLowerCase().includes(q) || s.n.toLowerCase().includes(q);
      return matchProg && matchQuery;
    });
  }, [db.students, searchQuery, filterProg]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const paginatedList = filteredStudents.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <>
      <h1>Students</h1>
      <p className="sub">Add students one at a time, or import a whole list.</p>

      {/* Add a student */}
      <div className="card">
        <h2>Add a student</h2>
        <div className="row">
          <label>
            Roll number
            <input
              placeholder="101"
              value={roll}
              onChange={(e) => {
                setRoll(e.target.value);
                setAddMsg(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </label>
          <label>
            Name
            <input
              placeholder="Ananya Das"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setAddMsg(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </label>
          <label>
            Program
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value as ProgramKey)}
            >
              {(Object.keys(PROG) as ProgramKey[]).map((p) => (
                <option key={p} value={p}>
                  {PROG[p].full}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={handleAdd}>
            Add student
          </button>
        </div>
        {addMsg && <div className={`msg ${addMsg.type}`}>{addMsg.text}</div>}
      </div>

      {/* Import students from Excel / CSV */}
      <div className="card">
        <h2>Import students from Excel / CSV</h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          Columns: <b>roll_no</b>, <b>name</b>, <b>program</b> (UG, BCA, BBA or PG). You can choose an Excel file (.xlsx, .xls), CSV file, or copy cells from Excel and paste them here.
        </p>
        <textarea
          placeholder={'roll_no,name,program\n101,Ananya Das,UG\n102,Rohit Sahoo,BCA'}
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
            <p className="msg ok">
              {impData.add.length - impData.upd} new, {impData.upd} existing will be updated.
            </p>

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

            {impData.add.length > 0 && (
              <button
                className="btn primary"
                style={{ marginTop: 12 }}
                onClick={handleDoImport}
              >
                Import {impData.add.length} students
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter and Table */}
      <div className="card">
        <div className="row">
          <label>
            Search
            <input
              placeholder="Roll number or name"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPageIndex(0);
              }}
            />
          </label>
          <label>
            Program
            <select
              value={filterProg}
              onChange={(e) => {
                setFilterProg(e.target.value);
                setPageIndex(0);
              }}
            >
              <option value="">All programs</option>
              {(Object.keys(PROG) as ProgramKey[]).map((p) => (
                <option key={p} value={p}>
                  {PROG[p].full}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          {filteredStudents.length === 0 ? (
            <div className="empty">No students found. Add one above or import a CSV file.</div>
          ) : (
            <>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Roll no.</th>
                      <th>Name</th>
                      <th>Program</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.map((s) => (
                      <tr key={s.r}>
                        <td>{s.r}</td>
                        <td>{s.n}</td>
                        <td>{s.p}</td>
                        <td className="num">
                          <button
                            className="btn danger"
                            onClick={() => onDeleteStudent(s.r)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <span>{filteredStudents.length} students</span>
                <button
                  className="btn"
                  disabled={currentPage <= 0}
                  onClick={() => setPageIndex(Math.max(0, currentPage - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  className="btn"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPageIndex(Math.min(totalPages - 1, currentPage + 1))}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
