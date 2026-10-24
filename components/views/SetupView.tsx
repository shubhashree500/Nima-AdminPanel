
'use client';

import React, { useEffect, useState } from 'react';
import { PROG, ProgramKey } from '@/types';

interface SetupViewProps {
  db: any;
  onSaveSetup: (college: string, max: number, pass: number) => Promise<boolean>;
  onAddSubject: (prog: ProgramKey, sem: number, name: string) => Promise<boolean>;
  onRemoveSubject: (prog: ProgramKey, sem: number, index: number) => Promise<boolean>;
  onCopySubjects: (prog: ProgramKey, sem: number) => Promise<boolean>;
  onResetDemo: () => Promise<void>;
  onClearAll: () => Promise<void>;
}

export function SetupView({
  onResetDemo,
  onClearAll,
}: SetupViewProps) {
  const [confirmAction, setConfirmAction] = useState<'' | 'demo' | 'all'>('');
  const [message, setMessage] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <>
      <h1>Settings</h1>
      <p className="sub">
        Manage application information, review the academic structure, and
        access data-management actions.
      </p>

      {/* Application information */}
      <section className="card">
        <h2>Application</h2>
        <p className="hint">
          Information about your results administration system.
        </p>

        <div className="row">
          <div>
            <strong>Application name</strong>
            <p className="hint">Admin Panel</p>
          </div>

          <div>
            <strong>Purpose</strong>
            <p className="hint">
              Student records, examination results, and result administration.
            </p>
          </div>
        </div>
      </section>

      {/* Academic structure overview */}
      <section className="card">
        <h2>Academic Structure</h2>
        <p className="hint">
          Overview of the programs currently defined in the application.
          Subject lists, marks rules, and examination structures should be
          managed in their dedicated academic sections.
        </p>

        <div className="row">
          {programs.map((program) => (
            <div className="card" key={program}>
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
          Use these actions carefully. They affect the data stored by the
          application.
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

        <p className="hint" style={{ marginTop: 14 }}>
          Before deleting records, make sure you have any required data saved
          elsewhere. No backup or restore feature is provided by this screen.
        </p>
      </section>
    </>
  );
}
