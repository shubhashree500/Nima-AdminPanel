'use client';

import React, { useEffect, useState } from 'react';
import { PROG, ProgramKey, DBData } from '@/types';
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
  // College & marks configuration
  const [collegeName, setCollegeName] = useState(db?.college || 'Your College Name');
  const [maxMarks, setMaxMarks] = useState(String(db?.max || 100));
  const [passMarks, setPassMarks] = useState(String(db?.pass || 40));
  const [cfgMsg, setCfgMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // Subject manager
  const [subjProg, setSubjProg] = useState<ProgramKey>('UG');
  const [subjSem, setSubjSem] = useState<number>(1);
  const [newSubj, setNewSubj] = useState('');
  const [subjMsg, setSubjMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);

  // Danger actions confirm state
  const [confirmAction, setConfirmAction] = useState<'' | 'demo' | 'all'>('');
  const [message, setMessage] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (db) {
      setCollegeName(db.college || 'Your College Name');
      setMaxMarks(String(db.max || 100));
      setPassMarks(String(db.pass || 40));
    }
  }, [db?.college, db?.max, db?.pass]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.btn.danger')) {
        setConfirmAction('');
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const handleSaveConfig = async () => {
    const m = Number(maxMarks);
    const p = Number(passMarks);

    if (isNaN(m) || !(m > 0) || isNaN(p) || p < 0 || p > m) {
      setCfgMsg({
        text: 'Pass marks must be between 0 and full marks.',
        type: 'bad',
      });
      return;
    }

    try {
      const success = await onSaveSetup(
        collegeName.trim() || 'Your College Name',
        m,
        p
      );
      if (success) {
        setCfgMsg({ text: 'Configuration saved successfully.', type: 'ok' });
      } else {
        setCfgMsg({ text: 'Failed to save configuration.', type: 'bad' });
      }
    } catch {
      setCfgMsg({ text: 'An error occurred while saving setup.', type: 'bad' });
    }
  };

  const handleAddSubject = async () => {
    const trimmed = newSubj.trim();
    if (!trimmed) return;

    const currentSubs = getSubjects(db, subjProg, subjSem);
    if (currentSubs.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSubjMsg({
        text: 'That subject is already in the list.',
        type: 'bad',
      });
      return;
    }

    try {
      const success = await onAddSubject(subjProg, subjSem, trimmed);
      if (success) {
        setNewSubj('');
        setSubjMsg({ text: `Subject "${trimmed}" added.`, type: 'ok' });
      }
    } catch {
      setSubjMsg({ text: 'Failed to add subject.', type: 'bad' });
    }
  };

  const handleRemoveSubject = async (index: number) => {
    try {
      await onRemoveSubject(subjProg, subjSem, index);
      setSubjMsg({ text: 'Subject removed.', type: 'ok' });
    } catch {
      setSubjMsg({ text: 'Failed to remove subject.', type: 'bad' });
    }
  };

  const handleCopySubjects = async () => {
    try {
      const success = await onCopySubjects(subjProg, subjSem);
      if (success) {
        setSubjMsg({
          text: `Copied to every semester of ${PROG[subjProg].full}.`,
          type: 'ok',
        });
      }
    } catch {
      setSubjMsg({ text: 'Failed to copy subjects.', type: 'bad' });
    }
  };

  const handleResetDemo = async () => {
    if (busy) return;

    if (confirmAction !== 'demo') {
      setConfirmAction('demo');
      setMessage({
        text: 'Click the button again to confirm resetting the demo data.',
        type: 'bad',
      });
      return;
    }

    setConfirmAction('');
    setBusy(true);
    setMessage(null);

    try {
      await onResetDemo();
      setMessage({
        text: 'Demo data reset successfully.',
        type: 'ok',
      });
    } catch {
      setMessage({
        text: 'Could not reset demo data. Please try again.',
        type: 'bad',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (busy) return;

    if (confirmAction !== 'all') {
      setConfirmAction('all');
      setMessage({
        text: 'Warning: this action deletes all students and marks. Click again to confirm.',
        type: 'bad',
      });
      return;
    }

    setConfirmAction('');
    setBusy(true);
    setMessage(null);

    try {
      await onClearAll();
      setMessage({
        text: 'The delete request completed.',
        type: 'ok',
      });
    } catch {
      setMessage({
        text: 'Could not delete the data. Please try again.',
        type: 'bad',
      });
    } finally {
      setBusy(false);
    }
  };

  const programs = Object.keys(PROG) as ProgramKey[];
  const subjects = getSubjects(db, subjProg, subjSem);

  return (
    <>
      <h1>Setup &amp; Settings</h1>
      <p className="sub">
        Configure institutional details, examination marks rules, semester subjects, and administrative settings.
      </p>

      {/* College & Marks rules */}
      <section className="card">
        <h2>College and Marks Rules</h2>
        <p className="hint">
          Set the official college name and global marks criteria for calculating pass/fail statuses and divisions.
        </p>

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
            Save Rules
          </button>
        </div>

        {cfgMsg && <div className={`msg ${cfgMsg.type}`}>{cfgMsg.text}</div>}
      </section>

      {/* Subjects Configuration */}
      <section className="card">
        <h2>Semester Subjects</h2>
        <p className="hint">
          Manage the active subject foil for each program and semester.
        </p>

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
              {programs.map((p) => (
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {subjects.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="tag"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: '#eef2f6',
                    border: '1px solid #ccd',
                  }}
                >
                  {s}
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                    }}
                    aria-label={`Remove ${s}`}
                    onClick={() => handleRemoveSubject(i)}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="empty">No subjects configured for this semester yet.</div>
          )}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <label>
            New subject name
            <input
              placeholder="e.g. Inorganic Chemistry"
              value={newSubj}
              onChange={(e) => {
                setNewSubj(e.target.value);
                setSubjMsg(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
            />
          </label>

          <button className="btn" onClick={handleAddSubject}>
            Add Subject
          </button>

          <button className="btn" onClick={handleCopySubjects}>
            Copy List to All Semesters
          </button>
        </div>

        {subjMsg && <div className={`msg ${subjMsg.type}`}>{subjMsg.text}</div>}
      </section>

      {/* Academic structure overview */}
      <section className="card">
        <h2>Academic Structure Overview</h2>
        <p className="hint">
          Standard programs and semester limits registered in the system.
        </p>

        <div className="row">
          {programs.map((program) => (
            <div className="card" key={program} style={{ flex: '1 1 200px' }}>
              <h3>{PROG[program].full}</h3>
              <p className="hint">
                {PROG[program].sems} semesters configured
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Data management */}
      <section className="card">
        <h2>Data Management</h2>
        <p className="hint">
          Actions affect the current database state. Exercise caution before clearing data.
        </p>

        <div className="row">
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={handleResetDemo}
          >
            {busy
              ? 'Please wait...'
              : confirmAction === 'demo'
                ? 'Confirm demo reset'
                : 'Reset to demo data'}
          </button>

          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={handleClearAll}
          >
            {busy
              ? 'Please wait...'
              : confirmAction === 'all'
                ? 'Confirm delete all data'
                : 'Delete all students and marks'}
          </button>
        </div>

        {message && (
          <div
            role="status"
            className={`msg ${message.type}`}
            style={{ marginTop: 12 }}
          >
            {message.text}
          </div>
        )}
      </section>
    </>
  );
}
