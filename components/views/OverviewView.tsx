
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

// Always display exactly one percentage sign.
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
        (record: any) => record.results || []
      );

      const passed = all.filter(
        (result: any) => resultStatus(result) === 'Pass'
      ).length;

      const failed = all.filter(
        (result: any) => resultStatus(result) === 'Fail'
      ).length;

      const pending = all.length - passed - failed;

      const rows = (
        Object.keys(PROG) as ProgramKey[]
      ).map((program) => {
        const record: any = latestByProgram[program];
        const results = record?.results || [];

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
        evaluatedCount: all.length,
        passCount: passed,
        failCount: failed,
        pending,
        passRate:
          passed + failed
            ? displayPct(
                (passed / (passed + failed)) * 100
              )
            : '—',
        rows,
        source: 'latest',
      };
    }

    // Fallback for older student/marks records.
    const totalStudents = db.students.length;

    let passCount = 0;
    let failCount = 0;

    Object.keys(db.marks).forEach((key) => {
      const [roll, sem] = key.split('|');
      const student = findStudent(db, roll);

      if (!student) return;

      const result = calculateResult(
        db,
        student,
        Number(sem)
      );

      if (result.status === 'Pass') {
        passCount++;
      } else if (result.status === 'Fail') {
        failCount++;
      }
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

      Object.keys(db.marks).forEach((key) => {
        const [roll, sem] = key.split('|');
        const student = findStudent(db, roll);

        if (!student || student.p !== program) return;

        const result = calculateResult(
          db,
          student,
          Number(sem)
        );

        if (result.status === 'Pass') {
          passed++;
        } else if (result.status === 'Fail') {
          failed++;
        }
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
        ? displayPct(
            (passCount / evaluatedCount) * 100
          )
        : '—',
      rows,
      source: 'legacy',
    };
  }, [db, latestByProgram]);

  const recent = [...(db.calculatedResults || [])]
    .sort((a, b) =>
      String(b.createdAt || '').localeCompare(
        String(a.createdAt || '')
      )
    )
    .slice(0, 5);

  const overviewSubtitle =
    dashboard.source === 'latest'
      ? 'Latest saved calculation for each program'
      : 'Student and result activity from legacy records';

  return (
    <>
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-copy">
          <div className="page-eyebrow">
            Administration
          </div>

          <h1>Dashboard</h1>

          <p className="sub">
            Examination, student and result activity across
            the institution.
          </p>
        </div>

        <div className="dashboard-status">
          <span className="dashboard-status-dot" />
          System online
        </div>
      </div>

      {/* Summary cards */}
      <div className="tiles">
        <div className="tile">
          <small>Students in latest results</small>
          <strong>{dashboard.totalStudents}</strong>
        </div>

        <div className="tile">
          <small>Results processed</small>
          <strong>{dashboard.evaluatedCount}</strong>
        </div>

        <div className="tile">
          <small>Passed</small>
          <strong>{dashboard.passCount}</strong>
        </div>

        <div className="tile">
          <small>Pass rate</small>
          <strong>{dashboard.passRate}</strong>
        </div>
      </div>

      {/* Academic overview */}
      <div className="card">
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
                <th className="num">Semesters</th>
                <th className="num">Students</th>
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
                    {row.semester
                      ? `${row.semester} (latest)`
                      : PROG[row.program as ProgramKey].sems}
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
      </div>

      {/* Recent calculations */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <h2>Recent Calculations</h2>
            <small>Saved result records, newest first</small>
          </div>
        </div>

        {recent.length ? (
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
                    <td>
                      <strong>{record.id}</strong>
                    </td>

                    <td>
                      {record.program} Sem {record.semester}
                    </td>

                    <td>{record.batch || '—'}</td>

                    <td className="num">
                      {record.count ??
                        record.results?.length ??
                        0}
                    </td>

                    <td className="num">
                      {record.passed ?? '—'}
                    </td>

                    <td className="num">
                      {record.failed ?? '—'}
                    </td>

                    <td className="capitalize">
                      {record.status || 'calculated'}
                    </td>

                    <td>
                      {record.createdAt
                        ? new Date(
                            record.createdAt
                          ).toLocaleString()
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
      </div>

      {/* Result workflow */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <h2>Result Workflow</h2>
            <small>
              Standard examination processing pipeline
            </small>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(5, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {[
            ['01', 'Exam Session'],
            ['02', 'Marks Entry'],
            ['03', 'Calculation'],
            ['04', 'Verification'],
            ['05', 'Publication'],
          ].map(([number, label]) => (
            <div
              key={number}
              style={{
                padding: '14px 12px',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            >
              <small>{number}</small>

              <div
                style={{
                  marginTop: 6,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}