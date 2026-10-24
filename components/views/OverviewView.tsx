
'use client';

import React, { useMemo } from 'react';
import { DBData, PROG, ProgramKey } from '@/types';
import {
  calculateResult,
  findStudent,
  formatPct,
} from '@/lib/calculations';

interface OverviewViewProps {
  db: DBData;
}

function resultStatus(result: any): 'Pass' | 'Fail' | 'Pending' {
  const subjects = Array.isArray(result?.subjects)
    ? result.subjects
    : [];

  if (!subjects.length) return 'Pending';

  return subjects.some((subject: any) =>
    ['F', 'AB', 'M'].includes(
      String(subject?.grade || '').toUpperCase()
    )
  )
    ? 'Fail'
    : 'Pass';
}

function displayPct(value: number): string {
  return `${formatPct(value).replace(/%+$/, '')}%`;
}

export function OverviewView({ db }: OverviewViewProps) {
  const latestByProgram = useMemo(() => {
    const latest: Record<string, any> = {};

    [...(db.calculatedResults || [])]
      .sort((a, b) =>
        String(b.createdAt || '').localeCompare(
          String(a.createdAt || '')
        )
      )
      .forEach((record) => {
        if (!latest[record.program]) {
          latest[record.program] = record;
        }
      });

    return latest;
  }, [db.calculatedResults]);

  const dashboard = useMemo(() => {
    const saved = Object.values(latestByProgram);

    if (saved.length) {
      const all = saved.flatMap(
        (record: any) =>
          Array.isArray(record.results) ? record.results : []
      );

      const passed = all.filter(
        (result: any) => resultStatus(result) === 'Pass'
      ).length;

      const failed = all.filter(
        (result: any) => resultStatus(result) === 'Fail'
      ).length;

      const pending = all.filter(
        (result: any) => resultStatus(result) === 'Pending'
      ).length;

      const evaluatedCount = passed + failed;

      const rows = (
        Object.keys(PROG) as ProgramKey[]
      ).map((program) => {
        const record: any = latestByProgram[program];

        const results = Array.isArray(record?.results)
          ? record.results
          : [];

        const p = results.filter(
          (result: any) => resultStatus(result) === 'Pass'
        ).length;

        const f = results.filter(
          (result: any) => resultStatus(result) === 'Fail'
        ).length;

        const evaluated = p + f;

        return {
          program,
          students: results.length,
          results: results.length,
          passed: p,
          failed: f,
          rate: evaluated
            ? displayPct((p / evaluated) * 100)
            : '—',
          status: record?.status || '—',
          semester: record?.semester,
        };
      });

      return {
        totalStudents: all.length,
        evaluatedCount,
        passCount: passed,
        failCount: failed,
        pending,
        passRate: evaluatedCount
          ? displayPct((passed / evaluatedCount) * 100)
          : '—',
        rows,
        source: 'latest' as const,
      };
    }

    // Fallback for existing student and marks records.
    const totalStudents = db.students.length;

    let passCount = 0;
    let failCount = 0;

    Object.keys(db.marks || {}).forEach((key) => {
      const [roll, sem] = key.split('|');
      const student = findStudent(db, roll);

      if (!student || !sem || !Number.isFinite(Number(sem))) {
        return;
      }

      const result = calculateResult(db, student, Number(sem));

      if (result.status === 'Pass') passCount++;
      else if (result.status === 'Fail') failCount++;
    });

    const evaluatedCount = passCount + failCount;

    const rows = (
      Object.keys(PROG) as ProgramKey[]
    ).map((program) => {
      const students = db.students.filter(
        (student) => student.p === program
      );

      let passed = 0;
      let failed = 0;

      Object.keys(db.marks || {}).forEach((key) => {
        const [roll, sem] = key.split('|');
        const student = findStudent(db, roll);

        if (
          !student ||
          student.p !== program ||
          !sem ||
          !Number.isFinite(Number(sem))
        ) {
          return;
        }

        const result = calculateResult(db, student, Number(sem));

        if (result.status === 'Pass') passed++;
        else if (result.status === 'Fail') failed++;
      });

      const evaluated = passed + failed;

      return {
        program,
        students: students.length,
        results: evaluated,
        passed,
        failed,
        rate: evaluated
          ? displayPct((passed / evaluated) * 100)
          : '—',
        status: 'legacy data',
        semester: undefined,
      };
    });

    return {
      totalStudents,
      evaluatedCount,
      passCount,
      failCount,
      pending: 0,
      passRate: evaluatedCount
        ? displayPct((passCount / evaluatedCount) * 100)
        : '—',
      rows,
      source: 'legacy' as const,
    };
  }, [db, latestByProgram]);

  const recent = useMemo(
    () =>
      [...(db.calculatedResults || [])]
        .sort((a, b) =>
          String(b.createdAt || '').localeCompare(
            String(a.createdAt || '')
          )
        )
        .slice(0, 5),
    [db.calculatedResults]
  );

  const overviewSubtitle =
    dashboard.source === 'latest'
      ? 'Latest saved calculation for each program'
      : 'Student and result activity from existing marks records';

  return (
    <div className="dashboard-overview">
      {/* Dashboard header */}
      <header className="dashboard-header">
        <div className="dashboard-header-copy">
          <div className="page-eyebrow">Administration</div>

          <h1>Dashboard</h1>

          <p className="sub">
            Examination, student and result activity across the institution.
          </p>
        </div>

        <div className="dashboard-status">
          <span className="dashboard-status-dot" />
          System online
        </div>
      </header>

      {/* Five compact summary cards */}
      <section
        aria-label="Result summary"
        className="dashboard-summary-grid"
      >
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-top">
            <small>Student Results</small>
            <span className="summary-icon summary-icon-blue">♙</span>
          </div>
          <strong>
            {dashboard.totalStudents.toLocaleString('en-IN')}
          </strong>
          <p>Result records</p>
        </div>

        <div className="dashboard-summary-card">
          <div className="dashboard-summary-top">
            <small>Evaluated Results</small>
            <span className="summary-icon summary-icon-purple">▤</span>
          </div>
          <strong>
            {dashboard.evaluatedCount.toLocaleString('en-IN')}
          </strong>
          <p>Passed and failed</p>
        </div>

        <div className="dashboard-summary-card summary-card-passed">
          <div className="dashboard-summary-top">
            <small>Passed</small>
            <span className="summary-icon summary-icon-green">✓</span>
          </div>
          <strong>
            {dashboard.passCount.toLocaleString('en-IN')}
          </strong>
          <p>Successful results</p>
        </div>

        <div className="dashboard-summary-card summary-card-failed">
          <div className="dashboard-summary-top">
            <small>Failed</small>
            <span className="summary-icon summary-icon-red">!</span>
          </div>
          <strong>
            {dashboard.failCount.toLocaleString('en-IN')}
          </strong>
          <p>Failed results</p>
        </div>

        <div className="dashboard-summary-card summary-card-rate">
          <div className="dashboard-summary-top">
            <small>Pass Rate</small>
            <span className="summary-icon summary-icon-blue">%</span>
          </div>
          <strong>{dashboard.passRate}</strong>
          <p>Among evaluated results</p>
        </div>
      </section>

      {dashboard.pending > 0 && (
        <div className="dashboard-pending" role="status">
          <strong>Results awaiting evaluation</strong>
          <span>
            {dashboard.pending.toLocaleString('en-IN')} pending records
          </span>
        </div>
      )}

      {/* Academic overview */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <h2>Academic Overview</h2>
            <small>{overviewSubtitle}</small>
          </div>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Program</th>
                <th className="num">Semester</th>
                <th className="num">Students / Records</th>
                <th className="num">Results</th>
                <th className="num">Passed</th>
                <th className="num">Failed</th>
                <th className="num">Pass Rate</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {dashboard.rows.map((row) => (
                <tr key={row.program}>
                  <td>
                    <strong>
                      {PROG[row.program as ProgramKey].full}
                    </strong>
                  </td>

                  <td className="num">
                    {row.semester !== undefined &&
                    row.semester !== null &&
                    row.semester !== ''
                      ? `${row.semester} (latest)`
                      : `All ${PROG[row.program as ProgramKey].sems}`}
                  </td>

                  <td className="num">{row.students}</td>
                  <td className="num">{row.results}</td>
                  <td className="num">{row.passed}</td>
                  <td className="num">{row.failed}</td>
                  <td className="num">{row.rate}</td>

                  <td>
                    <span className="capitalize">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent calculations */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <h2>Recent Calculations</h2>
            <small>Saved result records, newest first</small>
          </div>
        </div>

        {recent.length > 0 ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Calculation</th>
                  <th>Exam</th>
                  <th>Batch</th>
                  <th className="num">Students</th>
                  <th className="num">Pass</th>
                  <th className="num">Fail</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {recent.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.id}</strong></td>

                    <td>
                      {record.program} Sem {record.semester}
                    </td>

                    <td>{record.batch || '—'}</td>

                    <td className="num">
                      {record.count ?? record.results?.length ?? 0}
                    </td>

                    <td className="num">{record.passed ?? '—'}</td>
                    <td className="num">{record.failed ?? '—'}</td>

                    <td className="capitalize">
                      {record.status || 'calculated'}
                    </td>

                    <td>
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleString('en-IN')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-sm text-gray-500">
            No saved calculation records yet.
          </p>
        )}
      </section>

      {/* Result workflow */}
      {/* <section className="card">
        <div className="card-header">
          <div className="card-title">
            <h2>Result Workflow</h2>
            <small>Standard examination processing pipeline</small>
          </div>
        </div>

        <div className="dashboard-workflow">
          {[
            ['01', 'Exam Session', 'Configure examination details'],
            ['02', 'Marks Entry', 'Manage student mark foils'],
            ['03', 'Calculation', 'Calculate marks and grades'],
            ['04', 'Verification', 'Verify calculated results'],
            ['05', 'Publication', 'Publish approved results'],
          ].map(([number, label, description]) => (
            <div className="dashboard-workflow-step" key={number}>
              <span>{number}</span>
              <strong>{label}</strong>
              <small>{description}</small>
            </div>
          ))}
        </div>
      </section> */}
    </div>
  );
}
