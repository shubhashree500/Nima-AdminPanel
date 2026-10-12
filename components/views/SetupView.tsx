'use client';

import React, { useState, useEffect } from 'react';
import { DBData, PROG, ProgramKey } from '@/types';
import { getSubjects } from '@/lib/calculations';

interface SetupViewProps {
  db: DBData;
  onSaveSetup: (college: string, max: number, pass: number) => Promise<boolean>;
  onAddSubject: (prog: ProgramKey, sem: number, name: string) => Promise<boolean>;
  onRemoveSubject: (prog: ProgramKey, sem: number, index: number) => Promise<boolean>;
  onCopySubjects: (prog: ProgramKey, sem: number) => Promise<boolean>;
  onResetDemo: () => Promise<void>;
  onClearAll: () => Promise<void>;
}

export function SetupView({
  db,
  onSaveSetup,
  onAddSubject,
  onRemoveSubject,
  onCopySubjects,
  onResetDemo,
  onClearAll,
}: SetupViewProps) {
  // College config
  const [collegeName, setCollegeName] = useState(db.college);
  const [maxMarks, setMaxMarks] = useState(String(db.max));
  const [passMarks, setPassMarks] = useState(String(db.pass));
  const [cfgMsg, setCfgMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // Subject manager
  const [subjProg, setSubjProg] = useState<ProgramKey>('UG');
  const [subjSem, setSubjSem] = useState<number>(1);
  const [newSubj, setNewSubj] = useState('');
  const [subjMsg, setSubjMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // Danger actions confirm state
  const [confirmAction, setConfirmAction] = useState<'' | 'demo' | 'all'>('');

  useEffect(() => {
    setCollegeName(db.college);
    setMaxMarks(String(db.max));
    setPassMarks(String(db.pass));
  }, [db.college, db.max, db.pass]);

  // Click outside reset confirmation
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.btn.danger')) {
        setConfirmAction('');
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleSaveConfig = async () => {
    const m = Number(maxMarks);
    const p = Number(passMarks);

    if (isNaN(m) || !(m > 0) || isNaN(p) || p < 0 || p > m) {
      setCfgMsg({ text: 'Pass marks must be between 0 and full marks.', type: 'bad' });
      return;
    }

    const success = await onSaveSetup(collegeName.trim() || 'Your College Name', m, p);
    if (success) {
      setCfgMsg({ text: 'Saved.', type: 'ok' });
    } else {
      setCfgMsg({ text: 'Failed to save configuration.', type: 'bad' });
    }
  };

  const handleAddSubject = async () => {
    const trimmed = newSubj.trim();
    if (!trimmed) return;

    const currentSubs = getSubjects(db, subjProg, subjSem);
    if (currentSubs.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSubjMsg({ text: 'That subject is already in the list.', type: 'bad' });
      return;
    }

    const success = await onAddSubject(subjProg, subjSem, trimmed);
    if (success) {
      setNewSubj('');
      setSubjMsg(null);
    }
  };

  const handleRemoveSubject = async (index: number) => {
    await onRemoveSubject(subjProg, subjSem, index);
  };

  const handleCopySubjects = async () => {
    const success = await onCopySubjects(subjProg, subjSem);
    if (success) {
      setSubjMsg({
        text: `Copied to every semester of ${PROG[subjProg].full}.`,
        type: 'ok',
      });
    }
  };

  const handleResetDemo = async () => {
    if (confirmAction !== 'demo') {
      setConfirmAction('demo');
      return;
    }
    setConfirmAction('');
    await onResetDemo();
    setCfgMsg({ text: 'Reset to demo data complete.', type: 'ok' });
  };

  const handleClearAll = async () => {
    if (confirmAction !== 'all') {
      setConfirmAction('all');
      return;
    }
    setConfirmAction('');
    await onClearAll();
    setCfgMsg({ text: 'Deleted all students and marks.', type: 'ok' });
  };

  const subjects = getSubjects(db, subjProg, subjSem);

  return (
    <>
      <h1>Setup</h1>
      <p className="sub">Set the college name, marks rules and the subjects for each semester.</p>

      {/* College & Marks rules */}
      <div className="card">
        <h2>College and marks rules</h2>
        <div className="row">
          <label>
            College name
            <input
              value={collegeName}
              onChange={(e) => {
                setCollegeName(e.target.value);
                setCfgMsg(null);
              }}
            />
          </label>
          <label>
            Full marks per subject
            <input
              type="number"
              min={1}
              value={maxMarks}
              onChange={(e) => {
                setMaxMarks(e.target.value);
                setCfgMsg(null);
              }}
            />
          </label>
          <label>
            Pass marks per subject
            <input
              type="number"
              min={0}
              value={passMarks}
              onChange={(e) => {
                setPassMarks(e.target.value);
                setCfgMsg(null);
              }}
            />
          </label>
          <button className="btn primary" onClick={handleSaveConfig}>
            Save
          </button>
        </div>

        {cfgMsg && <div className={`msg ${cfgMsg.type}`}>{cfgMsg.text}</div>}

        <p className="hint">
          Result rule: a student passes when every subject is at or above the pass mark. Division: First from 60%, Second from 45%, otherwise Third.
        </p>
      </div>

      {/* Subjects */}
      <div className="card">
        <h2>Subjects</h2>
        <div className="row">
          <label>
            Program
            <select
              value={subjProg}
              onChange={(e) => {
                setSubjProg(e.target.value as ProgramKey);
                setSubjSem(1);
                setSubjMsg(null);
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
              value={subjSem}
              onChange={(e) => {
                setSubjSem(Number(e.target.value));
                setSubjMsg(null);
              }}
            >
              {Array.from({ length: PROG[subjProg].sems }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          {subjects.length ? (
            subjects.map((s, i) => (
              <span key={`${s}-${i}`} className="tag">
                {s}
                <button
                  aria-label={`Remove ${s}`}
                  onClick={() => handleRemoveSubject(i)}
                >
                  &times;
                </button>
              </span>
            ))
          ) : (
            <div className="empty">No subjects yet.</div>
          )}
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <label>
            New subject
            <input
              placeholder="Zoology"
              value={newSubj}
              onChange={(e) => {
                setNewSubj(e.target.value);
                setSubjMsg(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
            />
          </label>
          <button className="btn" onClick={handleAddSubject}>
            Add subject
          </button>
          <button className="btn" onClick={handleCopySubjects}>
            Copy list to all semesters
          </button>
        </div>

        {subjMsg && <div className={`msg ${subjMsg.type}`}>{subjMsg.text}</div>}
      </div>

      {/* Data Management */}
      <div className="card">
        <h2>Data</h2>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          This panel stores everything on the Node.js server. Reset brings back the demo students.
        </p>
        <div className="row">
          <button className="btn danger" onClick={handleResetDemo}>
            {confirmAction === 'demo' ? 'Click again to confirm' : 'Reset to demo data'}
          </button>
          <button className="btn danger" onClick={handleClearAll}>
            {confirmAction === 'all' ? 'Click again to confirm' : 'Delete all students and marks'}
          </button>
        </div>
      </div>
    </>
  );
}
