'use client';

import React, { useMemo, useState } from 'react';
import { DBData, PROG, ProgramKey, Student } from '@/types';
import {
  calculateResult,
  findStudent,
  formatPct,
} from '@/lib/calculations';

interface OverviewViewProps {
  db: DBData;
  onDeleteCalculation?: (calcId: string) => Promise<boolean | void>;
}

export interface DashboardStudentRow {
  key: string;
  autonomousRollNo: string;
  collegeRollNo: string;
  name: string;
  programme: string;
  batch: string;
  department: string;
  course: string;
  semester?: number | string;
  status: 'Pass' | 'Fail' | 'Enrolled' | 'Pending';
  source: 'Registry' | 'Calculation' | 'Both';
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

export function OverviewView({ db, onDeleteCalculation }: OverviewViewProps) {
  const [studentSearch, setStudentSearch] = useState('');
  const [studentProgFilter, setStudentProgFilter] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('');
  const [studentPage, setStudentPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 15;

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

  // Aggregate all unique students across Registry (db.students) and Calculations (db.calculatedResults)
  const allStudents = useMemo(() => {
    const studentMap = new Map<string, DashboardStudentRow>();

    // 1. Add students from Student Registry
    (db.students || []).forEach((s) => {
      const autoRoll = String(s.autonomousRollNo || s.r || '').trim();
      const colRoll = String(s.collegeRollNo || '').trim();
      const key = (autoRoll || colRoll || s.name || s.n).toUpperCase();
      if (!key) return;

      studentMap.set(key, {
        key,
        autonomousRollNo: autoRoll || '—',
        collegeRollNo: colRoll || '—',
        name: s.name || s.n || 'Unnamed Student',
        programme: s.programme || s.p || 'UG',
        batch: s.batch || '—',
        department: s.department || '—',
        course: s.course || '—',
        status: 'Enrolled',
        source: 'Registry',
      });
    });

    // 2. Add or update with students from Calculated Results
    (db.calculatedResults || []).forEach((calc) => {
      const results = Array.isArray(calc.results) ? calc.results : [];
      results.forEach((r) => {
        const s = r.student || r;
        const autoRoll = String(
          s['Autonomous Roll No'] ??
          s['Autonomous Roll No.'] ??
          s.autonomousRollNo ??
          s.r ??
          ''
        ).trim();

        const colRoll = String(
          s['College Roll No'] ??
          s['College Roll No.'] ??
          s.collegeRollNo ??
          ''
        ).trim();

        const name = String(
          s['Applicant Name'] ??
          s['Name of the Students'] ??
          s['Student Name'] ??
          s.name ??
          s.n ??
          ''
        ).trim() || 'Student';

        const key = (autoRoll || colRoll || name).toUpperCase();
        if (!key) return;

        let resStatus: 'Pass' | 'Fail' | 'Pending' = 'Pass';
        if (r.status === 'Pass' || r.status === 'Fail') {
          resStatus = r.status;
        } else {
          resStatus = resultStatus(r);
        }

        const dept = String(
          s.Department ??
          s.department ??
          calc.department ??
          ''
        ).trim();

        const course = String(
          s.Course ??
          s.course ??
          calc.course ??
          ''
        ).trim();

        const prog = calc.program || (s.programme || s.p || 'UG');
        const batch = String(calc.batch || s.batch || '').trim();

        const existing = studentMap.get(key);
        if (existing) {
          studentMap.set(key, {
            ...existing,
            autonomousRollNo: autoRoll || existing.autonomousRollNo,
            collegeRollNo: colRoll || existing.collegeRollNo,
            status: resStatus,
            semester: calc.semester,
            department: dept || existing.department,
            course: course || existing.course,
            source: 'Both',
          });
        } else {
          studentMap.set(key, {
            key,
            autonomousRollNo: autoRoll || '—',
            collegeRollNo: colRoll || '—',
            name,
            programme: prog,
            batch: batch || '—',
            department: dept || '—',
            course: course || '—',
            status: resStatus,
            semester: calc.semester,
            source: 'Calculation',
          });
        }
      });
    });

    return Array.from(studentMap.values()).sort((a, b) =>
      a.autonomousRollNo.localeCompare(b.autonomousRollNo)
    );
  }, [db.students, db.calculatedResults]);

  // Filtered students for display in the dashboard table
  const filteredStudents = useMemo(() => {
    return allStudents.filter((student) => {
      if (studentProgFilter && student.programme !== studentProgFilter) {
        return false;
      }
      if (studentStatusFilter && student.status !== studentStatusFilter) {
        return false;
      }
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const matchAuto = student.autonomousRollNo.toLowerCase().includes(q);
        const matchCol = student.collegeRollNo.toLowerCase().includes(q);
        const matchName = student.name.toLowerCase().includes(q);
        const matchDept = student.department.toLowerCase().includes(q);
        const matchCourse = student.course.toLowerCase().includes(q);
        const matchBatch = student.batch.toLowerCase().includes(q);
        if (!matchAuto && !matchCol && !matchName && !matchDept && !matchCourse && !matchBatch) {
          return false;
        }
      }
      return true;
    });
  }, [allStudents, studentSearch, studentProgFilter, studentStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPage = Math.min(studentPage, totalPages - 1);
  const paginatedStudents = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Summary statistics calculations
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

        const enrolledCount = (db.students || []).filter(
          (student) => student.p === program
        ).length;

        return {
          program,
          students: record ? results.length : enrolledCount,
          results: results.length,
          passed: p,
          failed: f,
          rate: evaluated
            ? displayPct((p / evaluated) * 100)
            : '—',
          status: record?.status || (enrolledCount ? 'uncalculated' : '—'),
          semester: record?.semester,
        };
      });

      return {
        totalStudents: allStudents.length,
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

    // Fallback for existing student and marks records
    const totalStudents = allStudents.length;

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
      const students = (db.students || []).filter(
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
  }, [db, latestByProgram, allStudents.length]);

  const recent = useMemo(
    () =>
      [...(db.calculatedResults || [])]
        .sort((a, b) =>
          String(b.createdAt || '').localeCompare(
            String(a.createdAt || '')
          )
        ),
    [db.calculatedResults]
  );

  const overviewSubtitle =
    dashboard.source === 'latest'
      ? 'Latest saved calculation for each program'
      : 'Student and result activity from existing marks records';

  const handleDeleteCalculation = async (record: any) => {
    const confirmText =
      `Are you sure you want to delete this calculation?\n\n` +
      `Calculation ID: ${record.id}\n` +
      `Exam: ${record.program} Semester ${record.semester} (${record.batch || 'Batch'})\n` +
      `Processed Students: ${record.count ?? record.results?.length ?? 0}\n\n` +
      `This will remove the calculated results. If this was made by mistake, it will be discarded immediately.`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setDeletingId(record.id);
    try {
      if (onDeleteCalculation) {
        await onDeleteCalculation(record.id);
      } else {
        const res = await fetch(`/api/process?id=${encodeURIComponent(record.id)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Failed to delete calculation.');
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Error deleting calculation:', err);
      alert('Failed to delete calculation.');
    } finally {
      setDeletingId(null);
    }
  };

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

      {/* Summary statistics cards */}
      <section
        aria-label="Result summary"
        className="dashboard-summary-grid"
      >
        <div className="dashboard-summary-card">
          <div className="dashboard-summary-top">
            <small>Total Students</small>
            <span className="summary-icon summary-icon-blue">👥</span>
          </div>
          <strong>
            {dashboard.totalStudents.toLocaleString('en-IN')}
          </strong>
          <p>Enrolled &amp; processed students</p>
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

      {/* Total Students Section on the Dashboard */}
      <section className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0 }}>Total Students Directory</h2>
              <span style={{
                backgroundColor: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: '999px',
              }}>
                {allStudents.length} Total Registered &amp; Evaluated
              </span>
            </div>
            <small>
              Complete institutional roster of enrolled and calculated students
            </small>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search by roll number, name, department, batch..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setStudentPage(0);
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ width: '160px' }}>
            <select
              value={studentProgFilter}
              onChange={(e) => {
                setStudentProgFilter(e.target.value);
                setStudentPage(0);
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Programmes</option>
              <option value="UG">Undergraduate (UG)</option>
              <option value="PG">Postgraduate (PG)</option>
            </select>
          </div>

          <div style={{ width: '160px' }}>
            <select
              value={studentStatusFilter}
              onChange={(e) => {
                setStudentStatusFilter(e.target.value);
                setStudentPage(0);
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Statuses</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Enrolled">Enrolled (Not Evaluated)</option>
            </select>
          </div>
        </div>

        {/* Students Table */}
        {filteredStudents.length > 0 ? (
          <>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '45px' }}>#</th>
                    <th>Autonomous Roll No.</th>
                    <th>College Roll No.</th>
                    <th>Student Name</th>
                    <th>Prog / Batch</th>
                    <th>Department / Course</th>
                    <th>Semester</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((st, idx) => {
                    const rowNum = currentPage * pageSize + idx + 1;
                    return (
                      <tr key={`${st.key}-${idx}`}>
                        <td style={{ color: '#94a3b8', fontSize: '12px' }}>{rowNum}</td>
                        <td>
                          <strong>{st.autonomousRollNo}</strong>
                        </td>
                        <td>{st.collegeRollNo}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {st.name}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: st.programme === 'PG' ? '#fdf2f8' : '#eff6ff',
                            color: st.programme === 'PG' ? '#be185d' : '#1d4ed8',
                            border: `1px solid ${st.programme === 'PG' ? '#fbcfe8' : '#bfdbfe'}`,
                            marginRight: '6px',
                          }}>
                            {st.programme}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {st.batch}
                          </span>
                        </td>
                        <td>
                          <div>{st.department}</div>
                          {st.course && st.course !== st.department && (
                            <small style={{ color: '#64748b', fontSize: '11px' }}>
                              {st.course}
                            </small>
                          )}
                        </td>
                        <td>
                          {st.semester ? `Sem ${st.semester}` : '—'}
                        </td>
                        <td>
                          {st.status === 'Pass' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                            }}>
                              ✓ Pass
                            </span>
                          ) : st.status === 'Fail' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: '#fef2f2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                            }}>
                              ! Fail
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                            }}>
                              Enrolled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid var(--line)',
              fontSize: '12px',
              color: '#64748b',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <div>
                Showing {Math.min(filteredStudents.length, currentPage * pageSize + 1)}–
                {Math.min(filteredStudents.length, (currentPage + 1) * pageSize)} of {filteredStudents.length} students
                {filteredStudents.length !== allStudents.length && ` (filtered from ${allStudents.length})`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ minHeight: '30px', padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => setStudentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  &larr; Previous
                </button>
                <span>
                  Page <strong>{currentPage + 1}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  type="button"
                  className="btn"
                  style={{ minHeight: '30px', padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => setStudentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
          }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#334155' }}>
              No students found
            </p>
            <span style={{ fontSize: '13px' }}>
              {studentSearch || studentProgFilter || studentStatusFilter
                ? 'Try clearing your search or status filters to view all students.'
                : 'Enrolled students from the registry and calculated examination files will appear here.'}
            </span>
          </div>
        )}
      </section>

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

      {/* Recent calculations with Delete button */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0 }}>Recent Calculations</h2>
              {recent.length > 0 && (
                <span style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}>
                  {recent.length} {recent.length === 1 ? 'Record' : 'Records'}
                </span>
              )}
            </div>
            <small>Saved result records, newest first. Delete any calculation made mistakenly.</small>
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
                  <th style={{ textAlign: 'center', width: '110px' }}>Action</th>
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
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: record.status === 'published' ? '#ecfdf5' : '#eff6ff',
                        color: record.status === 'published' ? '#065f46' : '#1e40af',
                        border: `1px solid ${record.status === 'published' ? '#a7f3d0' : '#bfdbfe'}`,
                      }}>
                        {record.status || 'calculated'}
                      </span>
                    </td>

                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleString('en-IN')
                        : '—'}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={deletingId === record.id}
                        onClick={() => handleDeleteCalculation(record)}
                        title={`Delete calculation ${record.id}`}
                        style={{
                          minHeight: '28px',
                          padding: '3px 10px',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        {deletingId === record.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            padding: '24px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            color: '#64748b',
          }}>
            No saved calculation records yet.
          </div>
        )}
      </section>
    </div>
  );
}
