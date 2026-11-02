'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { COLLEGE_LOGO } from '@/lib/logo';

type ReportKind = 'grade-sheets' | 'tabular-register' | 'statistics';
type Calculation = { id: string; program: string; semester: number; batch?: string | number; course?: string; department?: string; count?: number; status?: string; createdAt?: string; results?: any[]; hasRevisions?: boolean; departments?: any[] };

function identity(result: any) { return result?.student || result || {}; }
function rollsOf(result: any): string[] {
  const s = identity(result);
  return [
    s['College Roll No'],
    s['College Roll No.'],
    s['Roll No'],
    s['Roll No.'],
    s['College Roll'],
    s.collegeRollNo,
    s.roll,
    s.rollNo,
    s.r,
    s.Roll,
    s['Autonomous Roll No'],
    s['Autonomous Roll No.'],
    s.autonomousRollNo,
    result?.studentRoll,
    result?.roll,
  ]
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean);
}
function rollOf(result: any) { const s = identity(result); return s['College Roll No'] || s['College Roll No.'] || s['Roll No'] || s['College Roll'] || s.collegeRollNo || s.roll || s.rollNo || s['Autonomous Roll No'] || s.autonomousRollNo || '-'; }
function nameOf(result: any) { const s = identity(result); return s['Applicant Name'] || s['Name of the Students'] || s['Student Name'] || s.name || s.studentName || rollOf(result); }
function deptOf(result: any) { const s = identity(result); return s.Department || s.department || s.course || '-'; }
function subjectsOf(result: any): any[] { return Array.isArray(result?.subjects) ? result.subjects : []; }
function totalOf(result: any) { return subjectsOf(result).reduce((sum, subject) => sum + (Number(subject?.marks) || 0), 0); }
function maxOf(result: any) { return subjectsOf(result).reduce((sum, subject) => sum + (Number(subject?.fullMark) || 0), 0); }
function statusOf(result: any) { const subjects = subjectsOf(result); if (!subjects.length) return 'PENDING'; return subjects.some((s) => ['F', 'AB', 'M'].includes(String(s?.grade || '').toUpperCase())) ? 'FAIL' : 'PASS'; }
function csvEscape(value: unknown) { const text = String(value ?? ''); return `"${text.replace(/"/g, '""')}"`; }

function normalizeDepartment(department: unknown): string {
  if (!department) return '';
  const value = String(department).trim().toLowerCase();
  if (value === 'odia') return 'Odia';
  if (value === 'chemistry' || value === 'chem') return 'Chemistry';
  if (value === 'math' || value === 'mathematics') return 'Mathematics';
  if (value === 'geology') return 'Geology';
  if (value === 'commerce') return 'Commerce';
  if (value === 'mfc' || value === 'master of finance and control') return 'MFC';
  return String(department).trim();
}

function autoRollOf(result: any): string {
  const s = identity(result);
  return s.autonomousRollNo || s['Autonomous Roll No'] || s['Autonomous Roll No.'] || s.examRoll || s.r || '-';
}

function collegeRollOf(result: any): string {
  const s = identity(result);
  return s.collegeRollNo || s['College Roll No'] || s['College Roll No.'] || s.roll || s.rollNo || '-';
}

function examCodeOf(result: any): string {
  const s = identity(result);
  return s.examcode || s.examCode || s.ExamCode || s['Exam Code'] || s['ExamCode'] || '-';
}

function getFullMark(department: string, subject: any, index: number): number {
  if (subject?.fullMark || subject?.fullMarks) {
    return Number(subject.fullMark || subject.fullMarks);
  }
  const dept = String(department || '').toLowerCase();
  if (dept === 'chemistry' && (index === 3 || index === 4)) {
    return 50;
  }
  if (dept === 'chemistry') {
    return 70;
  }
  return 100;
}

function getMidsemMark(subject: any, student: any, index: number): string | number {
  if (subject?.midsemMark !== undefined && subject?.midsemMark !== null && subject?.midsemMark !== '') {
    return subject.midsemMark;
  }
  if (subject?.midsemMarks !== undefined && subject?.midsemMarks !== null) {
    return subject.midsemMarks;
  }
  const suffix = index === 0 ? '' : `_${index}`;
  const key = `Midsem-Mark${suffix}`;
  if (student?.[key] !== undefined && student?.[key] !== null && student?.[key] !== '') {
    return student[key];
  }
  return '—';
}

function getFinalMark(subject: any, student: any, index: number): string | number {
  if (subject?.finalMark !== undefined && subject?.finalMark !== null && subject?.finalMark !== '') {
    return subject.finalMark;
  }
  if (subject?.endSemMarks !== undefined && subject?.endSemMarks !== null) {
    return subject.endSemMarks;
  }
  const suffix = index === 0 ? '' : `_${index}`;
  const key = `Final-Mark${suffix}`;
  if (student?.[key] !== undefined && student?.[key] !== null && student?.[key] !== '') {
    return student[key];
  }
  return subject?.marks ?? '—';
}

function getClassification(student: any): string {
  const subjects = Array.isArray(student?.subjects) ? student.subjects : [];
  const failed = subjects.some((subject: any) => {
    const grade = String(subject?.grade || '').toUpperCase();
    return grade === 'F' || grade === 'AB' || grade === 'M';
  });

  if (failed || student.status === 'FAIL' || student.status === 'Fail') {
    return 'Fail';
  }

  const sgpa = Number(student?.sgpa || 0);
  if (sgpa >= 9) return 'Excellent';
  if (sgpa >= 8) return 'Very Good';
  if (sgpa >= 7) return 'Good';
  if (sgpa >= 6) return 'Average';
  return '—';
}

export function ReportsView({ kind }: { kind: ReportKind }) {
  const [records, setRecords] = useState<Calculation[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [department, setDepartment] = useState('All');
  const [search, setSearch] = useState('');
  const [revisedOnly, setRevisedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

const load = useCallback(async () => {
  setLoading(true);

  try {
    const [response, correctionsResponse] = await Promise.all([
      fetch('/api/verify', { cache: 'no-store' }),
      fetch('/api/result-corrections', { cache: 'no-store' }),
    ]);

    const json = await response.json();
    const correctionsJson = await correctionsResponse.json();

    if (!response.ok || !json.success) {
      throw new Error(
        json.error || 'Unable to load result records.'
      );
    }

    if (!correctionsResponse.ok || !correctionsJson.success) {
      throw new Error(
        correctionsJson.error || 'Unable to load result corrections.'
      );
    }

    const data: Calculation[] = (
      Array.isArray(json.data) ? json.data : []
    ).sort((a: Calculation, b: Calculation) =>
      String(b.createdAt || '').localeCompare(
        String(a.createdAt || '')
      )
    );

    setRecords(data);
    setCorrections(
      Array.isArray(correctionsJson.data)
        ? correctionsJson.data
        : []
    );

    setSelectedId((current) =>
      current && data.some((r) => r.id === current)
        ? current
        : data.find((r) => r.status === 'published')?.id ||
          data[0]?.id ||
          ''
    );

    setMessage('');
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : 'Unable to load records.'
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => { void load(); }, [load]);

  const selected = records.find((r) => r.id === selectedId);
  
const reportResults = useMemo(() => {
  const originalResults = selected?.results || [];

  if (!selected) return [];

  const latestByRoll = new Map<string, any>();

  const matchingCorrections = corrections
    .filter(
      (correction) =>
        correction.status === 'applied' &&
        correction.originalCalculationId === selected.id &&
        correction.revisedStudentResult
    )
    .sort(
      (a, b) =>
        String(a.appliedAt || a.createdAt || '').localeCompare(
          String(b.appliedAt || b.createdAt || '')
        )
    );

  for (const correction of matchingCorrections) {
    const candidateRolls = [
      String(correction.studentRoll || '').trim().toLowerCase(),
      ...rollsOf(correction.revisedStudentResult),
      ...rollsOf(correction.originalStudentResult),
    ].filter(Boolean);

    for (const roll of candidateRolls) {
      latestByRoll.set(roll, correction);
    }
  }

  return originalResults.map((originalResult) => {
    const candidateRolls = rollsOf(originalResult);
    let correction: any = null;

    for (const roll of candidateRolls) {
      if (latestByRoll.has(roll)) {
        correction = latestByRoll.get(roll);
        break;
      }
    }

    if (!correction) return originalResult;

    return {
      ...correction.revisedStudentResult,
      isRevised: true,
      revisedAt: correction.appliedAt || correction.createdAt,
      revisedPaper: correction.paperCode,
      correctionId: correction.id,
    };
  });
}, [selected, corrections]);

  const hasRevisedStudents = useMemo(
    () => reportResults.some((r: any) => r.isRevised === true),
    [reportResults]
  );
  const departments = useMemo(() => ['All', ...Array.from(new Set(reportResults.map(deptOf).filter((x) => x && x !== '-'))).sort()], [reportResults]);
  const rows = useMemo(
    () =>
      reportResults.filter(
        (r) =>
          (department === 'All' || deptOf(r) === department) &&
          (!revisedOnly || r.isRevised === true) &&
          `${nameOf(r)} ${rollOf(r)} ${deptOf(r)}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [reportResults, department, search, revisedOnly]
  );
  const paperColumns = useMemo(() => Array.from(new Set(reportResults.flatMap((r) => subjectsOf(r).map((s) => String(s.subjectName || s.subject || s.paperCode || 'Paper'))))), [reportResults]);
  const stats = useMemo(() => {
    const all = reportResults;
    const passed = all.filter((r) => statusOf(r) === 'PASS').length;
    const grades: Record<string, number> = {};
    const byDept: Record<string, { students: number; passed: number; failed: number }> = {};
    all.forEach((r) => {
      const d = deptOf(r); if (!byDept[d]) byDept[d] = { students: 0, passed: 0, failed: 0 };
      byDept[d].students += 1; if (statusOf(r) === 'PASS') byDept[d].passed += 1; else if (statusOf(r) === 'FAIL') byDept[d].failed += 1;
      subjectsOf(r).forEach((s) => { const g = String(s.grade || 'N/A').toUpperCase(); grades[g] = (grades[g] || 0) + 1; });
    });
    const failed = all.filter((r) => statusOf(r) === 'FAIL').length;
    return { total: all.length, passed, failed, passRate: passed + failed ? (passed / (passed + failed) * 100) : 0, grades: Object.entries(grades).sort((a,b) => a[0].localeCompare(b[0])), byDept: Object.entries(byDept).sort((a,b) => a[0].localeCompare(b[0])) };
  }, [reportResults]);




  const STREAMS = [
    { name: 'Arts', departments: ['Odia'] },
    { name: 'Science', departments: ['Chemistry', 'Geology', 'Mathematics'] },
    { name: 'Commerce', departments: ['Commerce'] },
    { name: 'MFC', departments: ['MFC'] },
  ];

  const PREFERRED_DEPT_ORDER = [
    'Odia',
    'Chemistry',
    'Mathematics',
    'Commerce',
    'Geology',
    'MFC',
  ];

  const streamStatsData = useMemo(() => {
    if (!selected) {
      return {
        streams: [],
        grandTotal: {
          appeared: 0,
          cleared: 0,
          backFail: 0,
          absent: 0,
          mp: 0,
          successPercentage: 0,
        },
      };
    }

    const sourceStudents = reportResults;

    const isAbsent = (student: any): boolean => {
      const subjects = subjectsOf(student);
      if (!subjects.length) return true;
      return subjects.every((s) => Number(s.marks ?? s.totalMark ?? 0) === 0);
    };

    const isFail = (student: any): boolean => {
      const subjects = subjectsOf(student);
      return subjects.some((s) =>
        ['F', 'AB', 'M'].includes(String(s.grade || '').trim().toUpperCase())
      );
    };

    const isMP = (student: any): boolean => {
      return (
        student.mp === true ||
        String(student.result || '').trim().toUpperCase() === 'MP'
      );
    };

    const calculateDeptStats = (department: string) => {
      const students = sourceStudents.filter(
        (s) => normalizeDepartment(deptOf(s)) === department
      );
      let appeared = 0;
      let cleared = 0;
      let backFail = 0;
      let absent = 0;
      let mp = 0;

      students.forEach((student) => {
        if (isAbsent(student)) {
          absent++;
          return;
        }
        appeared++;
        if (isMP(student)) {
          mp++;
          return;
        }
        if (isFail(student)) {
          backFail++;
        } else {
          cleared++;
        }
      });

      const successPercentage =
        appeared > 0 ? (cleared / appeared) * 100 : 0;

      return {
        department,
        appeared,
        cleared,
        backFail,
        absent,
        mp,
        successPercentage,
      };
    };

    const presentDepts = Array.from(
      new Set(sourceStudents.map((s) => normalizeDepartment(deptOf(s))))
    ).filter(Boolean);

    const knownDepts = new Set(STREAMS.flatMap((s) => s.departments));

    const streams = STREAMS.map((stream) => {
      const depts = stream.departments.filter((d) =>
        presentDepts.includes(d)
      );
      const departmentStats = depts.map(calculateDeptStats);
      const total = departmentStats.reduce(
        (acc, r) => {
          acc.appeared += r.appeared;
          acc.cleared += r.cleared;
          acc.backFail += r.backFail;
          acc.absent += r.absent;
          acc.mp += r.mp;
          return acc;
        },
        {
          department: 'Stream Total',
          appeared: 0,
          cleared: 0,
          backFail: 0,
          absent: 0,
          mp: 0,
          successPercentage: 0,
        }
      );
      total.successPercentage =
        total.appeared > 0 ? (total.cleared / total.appeared) * 100 : 0;

      return {
        name: stream.name,
        departments: departmentStats,
        total,
      };
    }).filter((s) => s.departments.length > 0);

    const otherDepts = presentDepts.filter((d) => !knownDepts.has(d));
    if (otherDepts.length > 0) {
      const otherStats = otherDepts.map(calculateDeptStats);
      const otherTotal = otherStats.reduce(
        (acc, r) => {
          acc.appeared += r.appeared;
          acc.cleared += r.cleared;
          acc.backFail += r.backFail;
          acc.absent += r.absent;
          acc.mp += r.mp;
          return acc;
        },
        {
          department: 'Stream Total',
          appeared: 0,
          cleared: 0,
          backFail: 0,
          absent: 0,
          mp: 0,
          successPercentage: 0,
        }
      );
      otherTotal.successPercentage =
        otherTotal.appeared > 0
          ? (otherTotal.cleared / otherTotal.appeared) * 100
          : 0;

      streams.push({
        name: 'Other',
        departments: otherStats,
        total: otherTotal,
      });
    }

    const grandTotal = streams.reduce(
      (acc, s) => {
        acc.appeared += s.total.appeared;
        acc.cleared += s.total.cleared;
        acc.backFail += s.total.backFail;
        acc.absent += s.total.absent;
        acc.mp += s.total.mp;
        return acc;
      },
      {
        department: 'Grand Total',
        appeared: 0,
        cleared: 0,
        backFail: 0,
        absent: 0,
        mp: 0,
        successPercentage: 0,
      }
    );
    grandTotal.successPercentage =
      grandTotal.appeared > 0
        ? (grandTotal.cleared / grandTotal.appeared) * 100
        : 0;

    return { streams, grandTotal };
  }, [selected, reportResults]);

  const studentsByDepartment = useMemo(() => {
    if (!selected) return [];
    const depts: Record<string, any[]> = {};
    rows.forEach((r) => {
      const d = normalizeDepartment(deptOf(r)) || 'General';
      if (!depts[d]) depts[d] = [];
      depts[d].push(r);
    });

    const ordered: { department: string; students: any[] }[] = [];
    PREFERRED_DEPT_ORDER.forEach((dept) => {
      if (depts[dept]) {
        ordered.push({ department: dept, students: depts[dept] });
      }
    });

    Object.keys(depts).forEach((dept) => {
      if (!PREFERRED_DEPT_ORDER.includes(dept)) {
        ordered.push({ department: dept, students: depts[dept] });
      }
    });

    return ordered;
  }, [selected, rows]);

  const exportTabularRegisterPdf = () => {
    if (!selected || kind !== 'tabular-register' || rows.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const MARGIN = 10;
    const TABLE_X = MARGIN;
    const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

    const semNum = Number(selected.semester) || 1;
    const semSuffix = semNum === 1 ? '1ST' : semNum === 2 ? '2ND' : semNum === 3 ? '3RD' : `${semNum}TH`;
    const batchYear = selected.batch || '2025';
    const progName = String(selected.program || 'PG').toUpperCase();
    const examYear = new Date().getFullYear();

    const drawCell = (
      x: number,
      y: number,
      width: number,
      height: number,
      text: unknown,
      options: {
        bold?: boolean;
        size?: number;
        color?: string;
        align?: 'center' | 'left' | 'right';
        fill?: string;
        top?: number;
      } = {}
    ) => {
      if (options.fill) {
        const hex = options.fill.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        doc.setFillColor(r, g, b);
        doc.rect(x, y, width, height, 'F');
      }

      doc.setDrawColor(60);
      doc.setLineWidth(0.2);
      doc.rect(x, y, width, height, 'S');

      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(options.size || 7);
      if (options.color === '#8B4513') {
        doc.setTextColor(139, 69, 19);
      } else {
        doc.setTextColor(0, 0, 0);
      }

      const str = String(text ?? '');
      const align = options.align || 'center';
      const textX = align === 'left' ? x + 2 : align === 'right' ? x + width - 2 : x + width / 2;
      const textY = y + (options.top || height / 2 + 1);

      doc.text(str, textX, textY, { align, maxWidth: width - 3 });
    };

    let pageCount = 0;

    studentsByDepartment.forEach((deptGroup) => {
      const { department, students } = deptGroup;

      students.forEach((studentResult, studentIndex) => {
        if (pageCount > 0) {
          doc.addPage();
        }
        pageCount++;

        const student = identity(studentResult);
        const slNo = studentIndex + 1;

        // Header with Logo
        try {
          doc.addImage(COLLEGE_LOGO, 'PNG', PAGE_WIDTH / 2 - 8, 7, 16, 16);
        } catch {}

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA', PAGE_WIDTH / 2, 28, { align: 'center' });

        doc.setFontSize(10.5);
        doc.text('TABULATION REGISTER', PAGE_WIDTH / 2, 34, { align: 'center' });

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `${progName} — ${semSuffix} SEMESTER EXAMINATION (${examYear}) — ${batchYear} ADMISSION BATCH`,
          PAGE_WIDTH / 2,
          40,
          { align: 'center' }
        );

        // Department heading box
        drawCell(
          TABLE_X,
          44,
          TABLE_WIDTH,
          8,
          `${String(department).toUpperCase()} (${students.length})`,
          { bold: true, size: 9, top: 5.5 }
        );

        // Student Details (2 rows)
        const infoY = 54;
        const rowH = 7;

        drawCell(MARGIN, infoY, 50, rowH, `Sl. ${slNo}`, { bold: true, align: 'left', size: 8, top: 4.8 });
        drawCell(
          MARGIN + 50,
          infoY,
          TABLE_WIDTH - 50 - 70,
          rowH,
          `Name: ${nameOf(studentResult)}`,
          { bold: true, align: 'left', size: 8, top: 4.8 }
        );
        drawCell(
          MARGIN + TABLE_WIDTH - 70,
          infoY,
          70,
          rowH,
          `Dept: ${department}`,
          { bold: true, align: 'left', size: 8, top: 4.8 }
        );

        const infoY2 = infoY + rowH;
        const third = TABLE_WIDTH / 3;
        drawCell(MARGIN, infoY2, third, rowH, `College Roll: ${collegeRollOf(studentResult)}`, { bold: true, align: 'left', size: 8, top: 4.8 });
        drawCell(MARGIN + third, infoY2, third, rowH, `Exam Roll: ${autoRollOf(studentResult)}`, { bold: true, align: 'left', size: 8, top: 4.8 });
        drawCell(MARGIN + third * 2, infoY2, third, rowH, `Exam Code: ${examCodeOf(studentResult)}`, { bold: true, align: 'left', size: 8, top: 4.8 });

        // Tabulation Table (Two-tier header)
        const tableTop = 70;
        const headerH1 = 6;
        const headerH2 = 8;
        const subjectRowH = 8;

        const originalWidths = [18, 58, 19, 19, 19, 19, 15, 16, 12, 12, 13, 17];
        const origTotal = originalWidths.reduce((a, b) => a + b, 0);
        const scale = TABLE_WIDTH / origTotal;
        const widths = originalWidths.map((w) => w * scale);

        let x = MARGIN;
        drawCell(x, tableTop, widths[0], headerH1 + headerH2, 'Paper', { bold: true, size: 7, top: 8 });
        x += widths[0];

        drawCell(x, tableTop, widths[1], headerH1 + headerH2, 'Subject', { bold: true, size: 7, top: 8, align: 'left' });
        x += widths[1];

        drawCell(x, tableTop, widths[2], headerH1, 'MID SEM', { bold: true, size: 7, top: 4.2 });
        drawCell(x, tableTop + headerH1, widths[2], headerH2, 'Midsem\n(30)', { bold: true, size: 6.2, top: 3.5 });
        x += widths[2];

        const endSemW = widths[3] + widths[4];
        drawCell(x, tableTop, endSemW, headerH1, 'END SEM', { bold: true, size: 7, top: 4.2 });
        drawCell(x, tableTop + headerH1, widths[3], headerH2, 'Full Mark', { bold: true, size: 6.2, top: 5 });
        drawCell(x + widths[3], tableTop + headerH1, widths[4], headerH2, 'Secured', { bold: true, size: 6.2, top: 5 });
        x += endSemW;

        const totalGroupW = widths[5] + widths[6] + widths[7] + widths[8] + widths[9] + widths[10] + widths[11];
        drawCell(x, tableTop, totalGroupW, headerH1, 'TOTAL', { bold: true, size: 7, top: 4.2 });

        const totalSubLabels = ['Total', 'Grace', 'Grade', 'GP', 'Cr', 'CP', 'Result'];
        const totalSubWidths = [widths[5], widths[6], widths[7], widths[8], widths[9], widths[10], widths[11]];
        let subX = x;
        totalSubLabels.forEach((lbl, idx) => {
          drawCell(subX, tableTop + headerH1, totalSubWidths[idx], headerH2, lbl, { bold: true, size: 6.2, top: 5 });
          subX += totalSubWidths[idx];
        });

        // Subject Rows
        let rowY = tableTop + headerH1 + headerH2;
        const subjects = subjectsOf(studentResult);

        subjects.forEach((subj: any, sIdx: number) => {
          const paper = subj.paperCode || subj.courseType || `Paper ${sIdx + 1}`;
          const subjName = subj.subjectName || subj.subject || '-';
          const midsem = getMidsemMark(subj, student, sIdx);
          const fullMark = getFullMark(department, subj, sIdx);
          const finalMark = getFinalMark(subj, student, sIdx);
          const totalMark = subj.marks ?? subj.totalMark ?? 0;
          const grace = subj.grace || subj.graceMarks || '';
          const grade = subj.grade || '';
          const gradeUpper = String(grade).toUpperCase();
          const gp = subj.gradePoint ?? '';
          const cr = subj.credit ?? '';
          const cp = subj.creditPoint ?? '';
          const result = (gradeUpper === 'F' || gradeUpper === 'AB' || gradeUpper === 'M') ? 'FAIL' : 'PASS';

          const rowValues = [
            paper,
            subjName,
            midsem,
            fullMark,
            finalMark,
            totalMark,
            grace,
            grade,
            gp,
            cr,
            cp,
            result,
          ];

          let currX = MARGIN;
          rowValues.forEach((val, colIdx) => {
            const isResultCol = colIdx === 11;
            const isFail = isResultCol && result === 'FAIL';
            drawCell(currX, rowY, widths[colIdx], subjectRowH, val, {
              size: colIdx === 1 ? 6.5 : 7,
              align: colIdx === 1 ? 'left' : 'center',
              top: 5,
              color: isFail ? '#8B4513' : undefined,
              bold: isResultCol,
            });
            currX += widths[colIdx];
          });

          rowY += subjectRowH;
        });

        // Summary Row (7 boxes)
        const sumY = rowY + 3;
        const totalMarks = subjects.reduce((sum: number, s: any, idx: number) => sum + getFullMark(department, s, idx), 0);
        const securedTotal = studentResult.grandTotal ?? totalOf(studentResult);
        const totalCredits = studentResult.totalCredits ?? subjects.reduce((sum: number, s: any) => sum + Number(s.credit || 0), 0);
        const totalCP = studentResult.totalCreditPoints ?? subjects.reduce((sum: number, s: any) => sum + Number(s.creditPoint || 0), 0);
        const sgpaVal = studentResult.sgpa ?? 0;
        const pctVal = studentResult.percentage ?? (totalMarks ? ((securedTotal / totalMarks) * 100).toFixed(2) : 0);
        const classification = getClassification(studentResult);

        const summaryCells: [string, number][] = [
          [`Total Marks: ${totalMarks}`, 1.35],
          [`Secured Total: ${securedTotal}`, 1.35],
          [`Total Credits: ${totalCredits}`, 1.15],
          [`Total Credit Points: ${totalCP}`, 1.45],
          [`SGPA: ${sgpaVal}`, 0.95],
          [`%: ${pctVal}`, 0.95],
          [`Classification: ${classification}`, 1.00],
        ];

        const ratioTotal = summaryCells.reduce((sum, c) => sum + c[1], 0);
        let sumX = MARGIN;
        summaryCells.forEach(([txt], idx) => {
          const cellW = (TABLE_WIDTH * summaryCells[idx][1]) / ratioTotal;
          const isClassFail = idx === 6 && classification === 'Fail';
          drawCell(sumX, sumY, cellW, 8, txt, {
            bold: true,
            size: 7.2,
            align: 'left',
            top: 5.2,
            color: isClassFail ? '#8B4513' : undefined,
          });
          sumX += cellW;
        });

        // Signature
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('Controller of Examinations', PAGE_WIDTH - MARGIN - 5, PAGE_HEIGHT - 10, { align: 'right' });
      });
    });

    const safe = (value: unknown) =>
      String(value ?? 'NA')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '');

    doc.save(`PG_Tabulation_Register-${safe(selected.program)}-Sem${selected.semester}-Batch${safe(selected.batch || 'NA')}.pdf`);
  };

  const exportResultStatisticsPdf = () => {
    if (!selected || kind !== 'statistics') return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const LEFT = 14;
    const RIGHT = 14;
    const TABLE_WIDTH = PAGE_WIDTH - LEFT - RIGHT;

    const semNum = Number(selected.semester) || 1;
    const semSuffix = semNum === 1 ? '1ST' : semNum === 2 ? '2ND' : semNum === 3 ? '3RD' : `${semNum}TH`;
    const batchYear = selected.batch || '2025';
    const progName = String(selected.program || 'PG').toUpperCase();
    const examYear = new Date().getFullYear();

    const drawCell = (
      x: number,
      y: number,
      width: number,
      height: number,
      text: unknown,
      options: {
        fill?: string;
        bold?: boolean;
        align?: 'center' | 'left' | 'right';
        fontSize?: number;
        top?: number;
      } = {}
    ) => {
      if (options.fill) {
        const hex = options.fill.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        doc.setFillColor(r, g, b);
        doc.rect(x, y, width, height, 'F');
      }

      doc.setDrawColor(80);
      doc.setLineWidth(0.2);
      doc.rect(x, y, width, height, 'S');

      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(options.fontSize || 7);
      doc.setTextColor(0, 0, 0);

      const str = String(text ?? '');
      const align = options.align || 'center';
      const textX = align === 'left' ? x + 2 : align === 'right' ? x + width - 2 : x + width / 2;
      const textY = y + (options.top || height / 2 + 1);

      doc.text(str, textX, textY, { align, maxWidth: width - 3 });
    };

    // Header with Logo
    let y = 12;
    try {
      doc.addImage(COLLEGE_LOGO, 'PNG', PAGE_WIDTH / 2 - 8, y, 16, 16);
      y += 18;
    } catch {
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA', PAGE_WIDTH / 2, y, { align: 'center' });
    y += 5.5;

    doc.setFontSize(10);
    doc.text('RESULT STATISTICS', PAGE_WIDTH / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(7.5);
    doc.text(
      `${progName} — ${semSuffix} SEMESTER EXAMINATION (${examYear}) — ${batchYear} ADMISSION BATCH`,
      PAGE_WIDTH / 2,
      y,
      { align: 'center' }
    );
    y += 6;

    // Table Headers
    const COL_WIDTHS = [28, 50, 20, 20, 23, 15, 26];
    const ROW_HEIGHT = 7;
    const HEADERS = ['Stream', 'Subject / Department', 'Appeared', 'Cleared', 'Back / Fail', 'MP', '% of Success'];

    let headerX = LEFT;
    HEADERS.forEach((hdr, idx) => {
      drawCell(headerX, y, COL_WIDTHS[idx], ROW_HEIGHT, hdr, {
        fill: '#e5e5e5',
        bold: true,
        fontSize: 6.5,
      });
      headerX += COL_WIDTHS[idx];
    });
    y += ROW_HEIGHT;

    // Streams & Departments
    const { streams, grandTotal } = streamStatsData;

    streams.forEach((stream) => {
      stream.departments.forEach((deptStats, dIdx) => {
        const streamText = dIdx === 0 ? stream.name : '';
        let rx = LEFT;

        drawCell(rx, y, COL_WIDTHS[0], ROW_HEIGHT, streamText, { fontSize: 7 });
        rx += COL_WIDTHS[0];

        drawCell(rx, y, COL_WIDTHS[1], ROW_HEIGHT, deptStats.department.toUpperCase(), { align: 'left', fontSize: 7 });
        rx += COL_WIDTHS[1];

        const vals = [
          deptStats.appeared,
          deptStats.cleared,
          deptStats.backFail,
          deptStats.mp,
          deptStats.successPercentage.toFixed(2),
        ];
        vals.forEach((v, vIdx) => {
          drawCell(rx, y, COL_WIDTHS[vIdx + 2], ROW_HEIGHT, v, { fontSize: 7 });
          rx += COL_WIDTHS[vIdx + 2];
        });
        y += ROW_HEIGHT;
      });

      // Stream Total
      let stX = LEFT;
      drawCell(stX, y, COL_WIDTHS[0], ROW_HEIGHT, '', { bold: true, fill: '#eeeeee', fontSize: 7 });
      stX += COL_WIDTHS[0];
      drawCell(stX, y, COL_WIDTHS[1], ROW_HEIGHT, 'Stream Total', { bold: true, fill: '#eeeeee', align: 'left', fontSize: 7 });
      stX += COL_WIDTHS[1];

      const streamVals = [
        stream.total.appeared,
        stream.total.cleared,
        stream.total.backFail,
        stream.total.mp,
        stream.total.successPercentage.toFixed(2),
      ];
      streamVals.forEach((v, vIdx) => {
        drawCell(stX, y, COL_WIDTHS[vIdx + 2], ROW_HEIGHT, v, { bold: true, fill: '#eeeeee', fontSize: 7 });
        stX += COL_WIDTHS[vIdx + 2];
      });
      y += ROW_HEIGHT;
    });

    // Grand Total
    let gtX = LEFT;
    const gtLabelW = COL_WIDTHS[0] + COL_WIDTHS[1];
    drawCell(gtX, y, gtLabelW, ROW_HEIGHT, 'Grand Total', { fill: '#d9d9d9', bold: true, align: 'center', fontSize: 7 });
    gtX += gtLabelW;

    const gtVals = [
      grandTotal.appeared,
      grandTotal.cleared,
      grandTotal.backFail,
      grandTotal.mp,
      grandTotal.successPercentage.toFixed(2),
    ];
    gtVals.forEach((v, vIdx) => {
      drawCell(gtX, y, COL_WIDTHS[vIdx + 2], ROW_HEIGHT, v, { fill: '#d9d9d9', bold: true, fontSize: 7 });
      gtX += COL_WIDTHS[vIdx + 2];
    });
    y += ROW_HEIGHT + 5;

    // Summary Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Summary', LEFT, y);
    y += 3;

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(LEFT, y, LEFT + TABLE_WIDTH, y);
    y += 2;

    const summaryRows: [string, string | number][] = [
      ['Total Appeared', grandTotal.appeared],
      ['Total Cleared', grandTotal.cleared],
      ['Total Back / Fail', grandTotal.backFail],
      ['Total MP', grandTotal.mp],
      ['Result %', grandTotal.successPercentage.toFixed(2)],
    ];

    const sumLeftW = TABLE_WIDTH - 40;
    const sumValW = 40;

    summaryRows.forEach(([lbl, val]) => {
      drawCell(LEFT, y, sumLeftW, ROW_HEIGHT, lbl, { align: 'left', fontSize: 7 });
      drawCell(LEFT + sumLeftW, y, sumValW, ROW_HEIGHT, val, { bold: true, fontSize: 7 });
      y += ROW_HEIGHT;
    });
    y += 3;

    // Footnote
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(LEFT, y, LEFT + TABLE_WIDTH, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Those who secure 0 in all papers are counted as Absent students.', LEFT, y);
    y += 12;

    // Signature
    const sigW = 55;
    const sigX = LEFT + TABLE_WIDTH - sigW;
    doc.line(sigX, y, sigX + sigW, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Controller of Examinations', sigX + sigW, y, { align: 'right' });

    const safe = (value: unknown) =>
      String(value ?? 'NA')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '');

    doc.save(`PG_Result_Statistics-${safe(selected.program)}-Sem${selected.semester}-Batch${safe(selected.batch || 'NA')}.pdf`);
  };

  const exportCsv = () => {
    if (!selected) return;
    let matrix: unknown[][];
    if (kind === 'tabular-register') {
      matrix = [
        [
          'Sl. No',
          'Department',
          'Exam Roll (Auto Roll)',
          'College Roll',
          'Exam Code',
          'Student Name',
          'Paper Code',
          'Subject Name',
          'Mid Sem (30)',
          'End Sem Full Mark',
          'End Sem Secured',
          'Total Marks',
          'Grace',
          'Grade',
          'GP',
          'Credit',
          'CP',
          'Subject Result',
          'Total Full Marks',
          'Total Secured',
          'Total Credits',
          'Total CP',
          'SGPA',
          'Percentage',
          'Classification',
          'Overall Result',
          'Revised',
        ],
        ...studentsByDepartment.flatMap((deptGroup) =>
          deptGroup.students.flatMap((student, sIdx) => {
            const subjects = subjectsOf(student);
            const autoRoll = autoRollOf(student);
            const colRoll = collegeRollOf(student);
            const examCode = examCodeOf(student);
            const sName = nameOf(student);
            const classification = getClassification(student);
            const deptName = deptGroup.department;
            const fullTotal = subjects.reduce((sum, s, idx) => sum + getFullMark(deptName, idx, s), 0);
            const securedTotal = totalOf(student);
            const totalCredits = student.totalCredits ?? subjects.reduce((sum, s) => sum + (Number(s.credit) || 0), 0);
            const totalCP = subjects.reduce((sum, s) => sum + (Number(s.creditPoint) || 0), 0);

            return subjects.map((sub, subIdx) => {
              const fullMark = getFullMark(deptName, subIdx, sub);
              const midMark = getMidsemMark(student, sub, subIdx);
              const finMark = getFinalMark(student, sub, subIdx);
              const isFail = ['F', 'AB', 'M'].includes(String(sub.grade || '').trim().toUpperCase());
              return [
                sIdx + 1,
                deptName,
                autoRoll,
                colRoll,
                examCode,
                sName,
                sub.paperCode || '',
                sub.subjectName || sub.subject || '',
                midMark !== '' ? midMark : '-',
                fullMark,
                finMark !== '' ? finMark : '-',
                sub.marks ?? 0,
                '-',
                sub.grade || '',
                sub.gradePoint ?? '',
                sub.credit ?? '',
                sub.creditPoint ?? '',
                isFail ? 'FAIL' : 'PASSED',
                fullTotal,
                securedTotal,
                totalCredits,
                totalCP,
                student.sgpa ?? '',
                student.percentage ? `${student.percentage}%` : '',
                classification,
                statusOf(student),
                student.isRevised ? 'YES' : 'NO',
              ];
            });
          })
        ),
      ];
    } else if (kind === 'statistics') {
      matrix = [
        ['Stream', 'Department', 'Appeared', 'Cleared', 'Back / Fail', 'MP', '% of Success'],
        ...streamStatsData.streams.flatMap((s) => [
          ...s.departments.map((d) => [s.name, d.department, d.appeared, d.cleared, d.backFail, d.mp, `${d.successPercentage.toFixed(2)}%`]),
          [`TOTAL (${s.name})`, '', s.total.appeared, s.total.cleared, s.total.backFail, s.total.mp, `${s.total.successPercentage.toFixed(2)}%`],
        ]),
        ['GRAND TOTAL', '', streamStatsData.grandTotal.appeared, streamStatsData.grandTotal.cleared, streamStatsData.grandTotal.backFail, streamStatsData.grandTotal.mp, `${streamStatsData.grandTotal.successPercentage.toFixed(2)}%`],
      ];
    } else {
      matrix = [
        ['No.', 'College Roll', 'Student Name', 'Department', 'Paper Code', 'Subject', 'Marks', 'Full Marks', 'Grade', 'Grade Point', 'Credit', 'Credit Point', 'SGPA', 'Percentage', 'Status', 'Revised'],
        ...rows.flatMap((r, i) =>
          subjectsOf(r).map((s) => [
            i + 1,
            rollOf(r),
            nameOf(r),
            deptOf(r),
            s.paperCode || '',
            s.subjectName || s.subject || '',
            s.marks ?? 0,
            s.fullMark ?? 0,
            s.grade || '',
            s.gradePoint ?? '',
            s.credit ?? '',
            s.creditPoint ?? '',
            r.sgpa ?? '',
            r.percentage ?? '',
            statusOf(r),
            r.isRevised ? 'YES' : 'NO',
          ])
        ),
      ];
    }
    const content = '\ufeff' + matrix.map((line) => line.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    const revTag = (selected.hasRevisions || rows.some((r) => r.isRevised)) ? 'REVISED-' : '';
    a.download = `${revTag}${kind}-${selected.program}-sem${selected.semester}-batch${selected.batch || 'NA'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!selected) return;
    let matrix: unknown[][];
    if (kind === 'tabular-register') {
      matrix = [
        [
          'Sl. No',
          'Department',
          'Exam Roll (Auto Roll)',
          'College Roll',
          'Exam Code',
          'Student Name',
          'Paper Code',
          'Subject Name',
          'Mid Sem (30)',
          'End Sem Full Mark',
          'End Sem Secured',
          'Total Marks',
          'Grace',
          'Grade',
          'GP',
          'Credit',
          'CP',
          'Subject Result',
          'Total Full Marks',
          'Total Secured',
          'Total Credits',
          'Total CP',
          'SGPA',
          'Percentage',
          'Classification',
          'Overall Result',
          'Revised',
        ],
        ...studentsByDepartment.flatMap((deptGroup) =>
          deptGroup.students.flatMap((student, sIdx) => {
            const subjects = subjectsOf(student);
            const autoRoll = autoRollOf(student);
            const colRoll = collegeRollOf(student);
            const examCode = examCodeOf(student);
            const sName = nameOf(student);
            const classification = getClassification(student);
            const deptName = deptGroup.department;
            const fullTotal = subjects.reduce((sum, s, idx) => sum + getFullMark(deptName, idx, s), 0);
            const securedTotal = totalOf(student);
            const totalCredits = student.totalCredits ?? subjects.reduce((sum, s) => sum + (Number(s.credit) || 0), 0);
            const totalCP = subjects.reduce((sum, s) => sum + (Number(s.creditPoint) || 0), 0);

            return subjects.map((sub, subIdx) => {
              const fullMark = getFullMark(deptName, subIdx, sub);
              const midMark = getMidsemMark(student, sub, subIdx);
              const finMark = getFinalMark(student, sub, subIdx);
              const isFail = ['F', 'AB', 'M'].includes(String(sub.grade || '').trim().toUpperCase());
              return [
                sIdx + 1,
                deptName,
                autoRoll,
                colRoll,
                examCode,
                sName,
                sub.paperCode || '',
                sub.subjectName || sub.subject || '',
                midMark !== '' ? midMark : '-',
                fullMark,
                finMark !== '' ? finMark : '-',
                sub.marks ?? 0,
                '-',
                sub.grade || '',
                sub.gradePoint ?? '',
                sub.credit ?? '',
                sub.creditPoint ?? '',
                isFail ? 'FAIL' : 'PASSED',
                fullTotal,
                securedTotal,
                totalCredits,
                totalCP,
                student.sgpa ?? '',
                student.percentage ? `${student.percentage}%` : '',
                classification,
                statusOf(student),
                student.isRevised ? 'YES' : 'NO',
              ];
            });
          })
        ),
      ];
    } else if (kind === 'statistics') {
      matrix = [
        ['Stream', 'Department', 'Appeared', 'Cleared', 'Back / Fail', 'MP', '% of Success'],
        ...streamStatsData.streams.flatMap((s) => [
          ...s.departments.map((d) => [s.name, d.department, d.appeared, d.cleared, d.backFail, d.mp, `${d.successPercentage.toFixed(2)}%`]),
          [`TOTAL (${s.name})`, '', s.total.appeared, s.total.cleared, s.total.backFail, s.total.mp, `${s.total.successPercentage.toFixed(2)}%`],
        ]),
        ['GRAND TOTAL', '', streamStatsData.grandTotal.appeared, streamStatsData.grandTotal.cleared, streamStatsData.grandTotal.backFail, streamStatsData.grandTotal.mp, `${streamStatsData.grandTotal.successPercentage.toFixed(2)}%`],
      ];
    } else {
      matrix = [
        ['No.', 'College Roll', 'Student Name', 'Department', 'Paper Code', 'Subject', 'Marks', 'Full Marks', 'Grade', 'Grade Point', 'Credit', 'Credit Point', 'SGPA', 'Percentage', 'Status', 'Revised'],
        ...rows.flatMap((r, i) =>
          subjectsOf(r).map((s) => [
            i + 1,
            rollOf(r),
            nameOf(r),
            deptOf(r),
            s.paperCode || '',
            s.subjectName || s.subject || '',
            s.marks ?? 0,
            s.fullMark ?? 0,
            s.grade || '',
            s.gradePoint ?? '',
            s.credit ?? '',
            s.creditPoint ?? '',
            r.sgpa ?? '',
            r.percentage ?? '',
            statusOf(r),
            r.isRevised ? 'YES' : 'NO',
          ])
        ),
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(matrix);
    const wb = XLSX.utils.book_new();
    const sheetName = kind === 'tabular-register' ? 'TabularRegister' : kind === 'statistics' ? 'ResultStatistics' : 'GradeSheets';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const revTag = (selected.hasRevisions || rows.some((r) => r.isRevised)) ? 'REVISED-' : '';
    XLSX.writeFile(wb, `${revTag}${kind}-${selected.program}-sem${selected.semester}-batch${selected.batch || 'NA'}.xlsx`);
  };

  const exportSingleGradeSheetPdf = (r: any) => {
    if (!selected) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const isRev = r.isRevised === true;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Institutional Logo
    try {
      doc.addImage(COLLEGE_LOGO, 'PNG', 14, 9, 20, 20);
    } catch (e) {
      console.warn('Could not add logo to PDF:', e);
    }

    // Header Format: NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA TABULATION REGISTER PG — 1ST SEMESTER EXAMINATION (2026) — 2025 ADMISSION BATCH
    const semNum = Number(selected.semester) || 1;
    const semSuffix = semNum === 1 ? '1ST' : semNum === 2 ? '2ND' : semNum === 3 ? '3RD' : `${semNum}TH`;
    const batchYear = selected.batch || '2025';
    const progName = String(selected.program || 'PG').toUpperCase();
    const examYear = new Date().getFullYear();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.text('TABULATION REGISTER', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${progName} — ${semSuffix} SEMESTER EXAMINATION (${examYear}) — ${batchYear} ADMISSION BATCH`,
      pageWidth / 2,
      26,
      { align: 'center' }
    );

    if (isRev) {
      doc.setFontSize(8);
      doc.setTextColor(180, 0, 0);
      doc.text('* REVISED RESULT (After Rechecking / Tabulation Correction)', pageWidth / 2, 31, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    // Student Info
    doc.setFontSize(9);
    doc.text(`Roll No: ${rollOf(r)}`, 14, isRev ? 39 : 36);
    doc.text(`Student Name: ${nameOf(r)}`, 14, isRev ? 45 : 42);
    doc.text(`Department / Course: ${deptOf(r)}`, 14, isRev ? 51 : 48);

    const tableData = subjectsOf(r).map((s, idx) => [
      s.paperCode || idx + 1,
      s.subjectName || s.subject || '-',
      s.marks ?? 0,
      s.fullMark ?? '-',
      s.grade || '-',
      s.gradePoint ?? '-',
      s.credit ?? '-',
      s.creditPoint ?? '-',
    ]);

    autoTable(doc, {
      startY: isRev ? 56 : 53,
      head: [['Paper Code', 'Subject Title', 'Marks', 'Full Marks', 'Grade', 'GP', 'Credit', 'Credit Points']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 50, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5, halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Marks: ${totalOf(r)} / ${maxOf(r)}`, 14, finalY);
    doc.text(`Total Credits: ${r.totalCredits ?? '-'}`, 70, finalY);
    doc.text(`Total Credit Points: ${r.totalCreditPoints ?? '-'}`, 120, finalY);
    doc.text(`SGPA: ${r.sgpa ?? '-'}`, 14, finalY + 6);
    doc.text(`Percentage: ${r.percentage ? Number(r.percentage).toFixed(2) + '%' : '-'}`, 70, finalY + 6);
    doc.text(`Result: ${statusOf(r)}`, 120, finalY + 6);

    doc.setFont('helvetica', 'normal');
    doc.text('Controller of Examinations', 196, finalY + 28, { align: 'right' });
    doc.save(`GradeSheet-${rollOf(r)}${isRev ? '-REVISED' : ''}.pdf`);
  };

  const title = kind === 'grade-sheets' ? 'Grade Sheets' : kind === 'tabular-register' ? 'Tabular Register' : 'Result Statistics';

  return (
    <section className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl space-y-6 print:max-w-none print:space-y-4">
        <header className="print:hidden">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Reports are generated from saved calculation records. Confirm the record status before using a report as an official document.
          </p>
        </header>

        <div className="rounded-xl border bg-white p-5 shadow-sm print:hidden">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="text-sm font-medium text-gray-700">
              Calculation
              <select
                className="mt-2 w-full rounded-lg border p-3"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setDepartment('All');
                }}
                disabled={loading}
              >
                <option value="">-- Select calculation --</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.program} | Sem {r.semester} | Batch {r.batch || '-'} |{' '}
                    {r.count ?? r.results?.length ?? 0} students |{' '}
                    {r.status || 'calculated'}
                    {r.hasRevisions ? ' (Revised)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Department
              <select
                className="mt-2 w-full rounded-lg border p-3"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>

            {kind !== 'statistics' && (
              <label className="text-sm font-medium text-gray-700">
                Search student
                <input
                  className="mt-2 w-full rounded-lg border p-3"
                  placeholder="Name or roll number"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            )}
          </div>

          {/* Revised Filter Toggle */}
          {hasRevisedStudents && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-purple-50 p-3 text-sm text-purple-900 border border-purple-200">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded text-purple-600"
                  checked={revisedOnly}
                  onChange={(e) => setRevisedOnly(e.target.checked)}
                />
                Show Revised Students Only
              </label>
              <span className="text-xs text-purple-700">
                (This calculation contains results updated via rechecking / scrutiny)
              </span>
            </div>
          )}

          {message && (
            <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
              {message}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              Refresh
            </button>

            <button
              onClick={exportCsv}
              disabled={!selected || loading}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Export CSV
            </button>

            <button
              onClick={exportExcel}
              disabled={!selected || loading}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Export Excel (.xlsx)
            </button>

            {/* Download Result Statistics PDF */}
            {kind === 'statistics' && (
              <button
                onClick={exportResultStatisticsPdf}
            disabled={!selected || loading || !reportResults.length}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Download RS PDF
              </button>
            )}

            {kind === 'tabular-register' && (
              <button
                onClick={exportTabularRegisterPdf}
                disabled={!selected || loading || rows.length === 0}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Download TR PDF
              </button>
            )}

          
            <button
              onClick={() => window.print()}
              disabled={!selected}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">
            Loading saved results…
          </p>
        ) : !selected ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            No saved calculations found. Calculate a result first.
          </div>
        ) : (

        <>
          <div className="rounded-xl border bg-white p-4 text-sm print:hidden">
            <div className="flex flex-wrap justify-between gap-3">
              <span>
                <strong>
                  {selected.program} Semester {selected.semester}
                </strong>{' '}
                · Batch {selected.batch || '-'} ·{' '}
                {reportResults.length} students
              </span>

              <span
                className={`rounded-full px-3 py-1 font-semibold ${
                  selected.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : selected.status === 'verified'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selected.status || 'calculated'}
              </span>
            </div>

            {selected.status !== 'published' && (
              <p className="mt-2 text-amber-800">
                This result is not marked published. Treat this report as a
                review copy, not an official published result.
              </p>
            )}
          </div>

          {kind === 'statistics' ? (
            <div className="space-y-6">
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col items-center justify-center text-center sm:flex-row sm:items-center sm:justify-start gap-4 pb-4 border-b">
                  <img src="/assets/image.png" alt="Logo" className="h-16 w-16 object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  <div>
                    <h1 className="text-xl font-bold tracking-wide text-gray-900">NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA</h1>
                    <h2 className="text-sm font-semibold tracking-wider text-gray-700 uppercase">RESULT STATISTICS</h2>
                    <p className="text-xs font-medium text-gray-500">
                      {String(selected.program || 'PG').toUpperCase()} — {Number(selected.semester) === 1 ? '1ST' : Number(selected.semester) === 2 ? '2ND' : Number(selected.semester) === 3 ? '3RD' : `${selected.semester}TH`} SEMESTER EXAMINATION ({new Date().getFullYear()}) — {selected.batch || '2025'} ADMISSION BATCH
                    </p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100 text-gray-800">
                        <th className="border border-gray-300 px-4 py-2 text-left font-bold">Stream</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-bold">Department</th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-bold">Appeared</th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-bold">Cleared</th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-bold">Back / Fail</th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-bold">MP</th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-bold">% of Success</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streamStatsData.streams.map((stream) => (
                        <React.Fragment key={stream.name}>
                          {stream.departments.map((dept, dIdx) => (
                            <tr key={dept.department} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2 font-medium text-gray-700">{dIdx === 0 ? stream.name : ''}</td>
                              <td className="border border-gray-300 px-4 py-2 text-gray-800">{dept.department}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center">{dept.appeared}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center text-emerald-700 font-medium">{dept.cleared}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center text-rose-700 font-medium">{dept.backFail}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center">{dept.mp}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{dept.successPercentage.toFixed(2)}%</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50/80 font-semibold text-gray-900 border-t border-b border-gray-300">
                            <td colSpan={2} className="border border-gray-300 px-4 py-2 text-right">TOTAL ({stream.name})</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">{stream.total.appeared}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-emerald-700">{stream.total.cleared}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-rose-700">{stream.total.backFail}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">{stream.total.mp}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">{stream.total.successPercentage.toFixed(2)}%</td>
                          </tr>
                        </React.Fragment>
                      ))}
                      <tr className="bg-slate-100 font-bold text-gray-900 border-t-2 border-gray-400">
                        <td colSpan={2} className="border border-gray-300 px-4 py-2.5 text-right tracking-wide">GRAND TOTAL</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center">{streamStatsData.grandTotal.appeared}</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center text-emerald-700">{streamStatsData.grandTotal.cleared}</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center text-rose-700">{streamStatsData.grandTotal.backFail}</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center">{streamStatsData.grandTotal.mp}</td>
                        <td className="border border-gray-300 px-4 py-2.5 text-center text-blue-700">{streamStatsData.grandTotal.successPercentage.toFixed(2)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-800">
                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    <span>Total Appeared: <strong className="text-gray-900">{streamStatsData.grandTotal.appeared}</strong></span>
                    <span>|</span>
                    <span>Cleared: <strong className="text-emerald-700">{streamStatsData.grandTotal.cleared}</strong></span>
                    <span>|</span>
                    <span>Back / Fail: <strong className="text-rose-700">{streamStatsData.grandTotal.backFail}</strong></span>
                    <span>|</span>
                    <span>MP: <strong className="text-gray-900">{streamStatsData.grandTotal.mp}</strong></span>
                    <span>|</span>
                    <span>Result: <strong className="text-blue-700">{streamStatsData.grandTotal.successPercentage.toFixed(2)}%</strong></span>
                  </div>
                </div>

                <p className="mt-4 text-xs italic text-gray-500">
                  * Those who secure 0 in all papers are counted as Absent students.
                </p>

                <div className="mt-12 flex justify-end">
                  <div className="text-center font-serif text-sm">
                    <p className="font-bold text-gray-800">Controller of Examinations</p>
                    <p className="text-xs text-gray-500">Nimapara Autonomous College</p>
                  </div>
                </div>
              </div>
            </div>
          ) : kind === 'grade-sheets' ? (
            <div className="space-y-6">
              {rows.map((r, i) => {
                const semNum = Number(selected.semester) || 1;
                const semSuffix = semNum === 1 ? '1ST' : semNum === 2 ? '2ND' : semNum === 3 ? '3RD' : `${semNum}TH`;
                const batchYear = selected.batch || '2025';
                const progName = String(selected.program || 'PG').toUpperCase();
                const examYear = new Date().getFullYear();

                return (
                  <article
                    key={`${rollOf(r)}-${i}`}
                    className="break-inside-avoid rounded-xl border bg-white p-6 shadow-sm"
                  >
                    {/* Header: NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA TABULATION REGISTER PG — 1ST SEMESTER EXAMINATION (2026) — 2025 ADMISSION BATCH */}
                    <div className="flex flex-col sm:flex-row items-center justify-between border-b pb-4 gap-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={COLLEGE_LOGO}
                          alt="College Logo"
                          className="h-16 w-16 object-contain"
                        />
                        <div>
                          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-wide uppercase">
                            NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA
                          </h1>
                          <h2 className="text-sm sm:text-base font-bold text-blue-900 tracking-wider">
                            TABULATION REGISTER
                          </h2>
                          <p className="text-xs sm:text-sm font-semibold text-slate-600">
                            {progName} — {semSuffix} SEMESTER EXAMINATION ({examYear}) — {batchYear} ADMISSION BATCH
                          </p>
                          {r.isRevised && (
                            <span className="inline-block mt-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                              REVISED GRADE SHEET
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => exportSingleGradeSheetPdf(r)}
                        className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 shadow-sm shrink-0 flex items-center gap-1.5 print:hidden"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download PDF
                      </button>
                    </div>

                  <dl className="my-4 grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-gray-500">Student Name</dt>
                      <dd className="font-semibold">{nameOf(r)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">College Roll</dt>
                      <dd className="font-semibold">{rollOf(r)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Department / Course</dt>
                      <dd className="font-semibold">{deptOf(r)}</dd>
                    </div>
                  </dl>

                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-2 text-left">Paper</th>
                        <th className="border p-2 text-left">Subject</th>
                        <th className="border p-2">Marks</th>
                        <th className="border p-2">Full Marks</th>
                        <th className="border p-2">Grade</th>
                        <th className="border p-2">GP</th>
                        <th className="border p-2">Credit</th>
                        <th className="border p-2">CP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectsOf(r).map((s, j) => (
                        <tr key={j}>
                          <td className="border p-2">
                            {s.paperCode || j + 1}
                          </td>
                          <td className="border p-2">
                            {s.subjectName || s.subject || '-'}
                          </td>
                          <td className="border p-2 text-center">
                            {s.marks ?? 0}
                          </td>
                          <td className="border p-2 text-center">
                            {s.fullMark ?? '-'}
                          </td>
                          <td className="border p-2 text-center">
                            {s.grade || '-'}
                          </td>
                          <td className="border p-2 text-center">
                            {s.gradePoint ?? '-'}
                          </td>
                          <td className="border p-2 text-center">
                            {s.credit ?? '-'}
                          </td>
                          <td className="border p-2 text-center">
                            {s.creditPoint ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                    <div>
                      Total: <strong>{totalOf(r)} / {maxOf(r)}</strong>
                    </div>
                    <div>
                      Credits: <strong>{r.totalCredits ?? '-'}</strong>
                    </div>
                    <div>
                      Credit Points:{' '}
                      <strong>{r.totalCreditPoints ?? '-'}</strong>
                    </div>
                    <div>
                      SGPA: <strong>{r.sgpa ?? '-'}</strong>
                    </div>
                    <div>
                      Status: <strong>{statusOf(r)}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-4 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Consolidated Tabulation Register</h2>
                  <p className="text-xs text-gray-500">
                    {selected.program} — {Number(selected.semester) === 1 ? '1ST' : Number(selected.semester) === 2 ? '2ND' : Number(selected.semester) === 3 ? '3RD' : `${selected.semester}TH`} Semester Examination ({new Date().getFullYear()}) — {selected.batch || '2025'} Batch
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {rows.length} Total Enrolled
                </span>
              </div>

              {studentsByDepartment.map((deptGroup) => (
                <div key={deptGroup.department} className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-slate-700 pb-2">
                    <h3 className="text-base font-bold uppercase tracking-wider text-slate-800">
                      DEPARTMENT OF {deptGroup.department}
                    </h3>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                      {deptGroup.students.length} Candidates
                    </span>
                  </div>

                  <div className="space-y-6">
                    {deptGroup.students.map((student, sIdx) => {
                      const subjects = subjectsOf(student);
                      const autoRoll = autoRollOf(student);
                      const colRoll = collegeRollOf(student);
                      const examCode = examCodeOf(student);
                      const sName = nameOf(student);
                      const classification = getClassification(student);
                      const deptName = deptGroup.department;
                      const fullTotal = subjects.reduce((sum, s, idx) => sum + getFullMark(deptName, idx, s), 0);
                      const securedTotal = totalOf(student);
                      const totalCredits = student.totalCredits ?? subjects.reduce((sum, s) => sum + (Number(s.credit) || 0), 0);
                      const totalCP = subjects.reduce((sum, s) => sum + (Number(s.creditPoint) || 0), 0);
                      const isStudentFail = classification === 'Fail';

                      return (
                        <div key={`${autoRoll}-${sIdx}`} className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
                          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-700">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span>Sl. No: <strong>{sIdx + 1}</strong></span>
                                <span>Name: <strong className="text-gray-900">{sName}</strong></span>
                                <span>Dept: <strong>{deptName}</strong></span>
                                {student.isRevised && (
                                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                                    REVISED
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600">
                                <span>College Roll: <strong>{colRoll || '—'}</strong></span>
                                <span>Exam Roll: <strong className="text-gray-900">{autoRoll || '—'}</strong></span>
                                <span>Exam Code: <strong>{examCode || '—'}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-100 text-gray-700 border-b border-gray-300">
                                  <th rowSpan={2} className="border-r border-gray-300 px-2.5 py-1.5 text-center font-bold">Paper</th>
                                  <th rowSpan={2} className="border-r border-gray-300 px-3 py-1.5 text-left font-bold">Subject</th>
                                  <th colSpan={1} className="border-r border-gray-300 px-2 py-1 text-center font-bold bg-amber-50/50">MID SEM</th>
                                  <th colSpan={2} className="border-r border-gray-300 px-2 py-1 text-center font-bold bg-blue-50/50">END SEM</th>
                                  <th colSpan={7} className="px-2 py-1 text-center font-bold bg-emerald-50/50">TOTAL</th>
                                </tr>
                                <tr className="bg-gray-50 text-[11px] text-gray-600 border-b border-gray-300">
                                  <th className="border-r border-gray-300 px-2 py-1 text-center font-medium bg-amber-50/30">30</th>
                                  <th className="border-r border-gray-300 px-2 py-1 text-center font-medium bg-blue-50/30">Full Mark</th>
                                  <th className="border-r border-gray-300 px-2 py-1 text-center font-medium bg-blue-50/30">Secured</th>
                                  <th className="border-r border-gray-200 px-2 py-1 text-center font-medium">Total</th>
                                  <th className="border-r border-gray-200 px-2 py-1 text-center font-medium">Grace</th>
                                  <th className="border-r border-gray-200 px-2 py-1 text-center font-medium">Grade</th>
                                  <th className="border-r border-gray-200 px-2 py-1 text-center font-medium">GP</th>
                                  <th className="border-r border-gray-200 px-2 py-1 text-center font-medium">Cr</th>
                                  <th className="border-r border-gray-200 px-2 py-1 text-center font-medium">CP</th>
                                  <th className="px-2 py-1 text-center font-medium">Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subjects.map((sub, subIdx) => {
                                  const fullMark = getFullMark(deptName, subIdx, sub);
                                  const midMark = getMidsemMark(student, sub, subIdx);
                                  const finMark = getFinalMark(student, sub, subIdx);
                                  const gradeStr = String(sub.grade || '').trim().toUpperCase();
                                  const isFail = ['F', 'AB', 'M'].includes(gradeStr);

                                  return (
                                    <tr key={`${sub.paperCode || subIdx}`} className="border-b border-gray-200 hover:bg-gray-50/60">
                                      <td className="border-r border-gray-200 px-2.5 py-1.5 text-center font-medium text-gray-700">{sub.paperCode || `P${subIdx + 1}`}</td>
                                      <td className="border-r border-gray-200 px-3 py-1.5 font-medium text-gray-800">{sub.subjectName || sub.subject || '—'}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">{midMark !== '' ? midMark : '—'}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-600">{fullMark}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">{finMark !== '' ? finMark : '—'}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-800">{sub.marks ?? 0}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-400">—</td>
                                      <td className={`border-r border-gray-200 px-2 py-1.5 text-center font-bold ${isFail ? 'text-[#8B4513]' : 'text-gray-800'}`}>{sub.grade || '—'}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">{sub.gradePoint ?? '—'}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">{sub.credit ?? '—'}</td>
                                      <td className="border-r border-gray-200 px-2 py-1.5 text-center text-gray-700">{sub.creditPoint ?? '—'}</td>
                                      <td className={`px-2 py-1.5 text-center font-bold ${isFail ? 'text-[#8B4513]' : 'text-emerald-700'}`}>{isFail ? 'FAILED' : 'PASSED'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-t border-gray-300 bg-gray-50/80 text-xs">
                            <div className="border-r border-b sm:border-b-0 border-gray-200 px-3 py-2 text-center">
                              <span className="block text-[10px] text-gray-500 uppercase">Total Marks</span>
                              <strong className="text-gray-800">{fullTotal}</strong>
                            </div>
                            <div className="border-r border-b sm:border-b-0 border-gray-200 px-3 py-2 text-center">
                              <span className="block text-[10px] text-gray-500 uppercase">Secured Total</span>
                              <strong className="text-gray-900">{securedTotal}</strong>
                            </div>
                            <div className="border-r border-b sm:border-b-0 border-gray-200 px-3 py-2 text-center">
                              <span className="block text-[10px] text-gray-500 uppercase">Total Credits</span>
                              <strong className="text-gray-800">{totalCredits}</strong>
                            </div>
                            <div className="border-r border-b sm:border-b-0 border-gray-200 px-3 py-2 text-center">
                              <span className="block text-[10px] text-gray-500 uppercase">Total CP</span>
                              <strong className="text-gray-800">{totalCP}</strong>
                            </div>
                            <div className="border-r border-b sm:border-b-0 border-gray-200 px-3 py-2 text-center">
                              <span className="block text-[10px] text-gray-500 uppercase">SGPA</span>
                              <strong className="text-blue-700">{student.sgpa ?? '—'}</strong>
                            </div>
                            <div className="border-r border-b sm:border-b-0 border-gray-200 px-3 py-2 text-center">
                              <span className="block text-[10px] text-gray-500 uppercase">Percentage</span>
                              <strong className="text-gray-800">{student.percentage ? `${student.percentage}%` : '—'}</strong>
                            </div>
                            <div className={`px-3 py-2 text-center ${isStudentFail ? 'bg-amber-100/70 text-[#8B4513]' : 'bg-emerald-50/70 text-emerald-800'}`}>
                              <span className="block text-[10px] uppercase opacity-75">Classification</span>
                              <strong className="font-bold">{classification}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>

    <style jsx global>{`
      @media print {
        @page {
          margin: 10mm;
          size: auto;
        }
        body {
          background: white !important;
        }
        header,
        aside,
        nav,
        button,
        select,
        input,
        label,
        .print\\:hidden,
        .no-print {
          display: none !important;
        }
        main,
        section {
          padding: 0 !important;
          margin: 0 !important;
        }
        article {
          box-shadow: none !important;
          break-inside: avoid !important;
          page-break-after: always;
          break-after: page;
        }
        .rounded-xl {
          box-shadow: none !important;
        }
        table {
          font-size: 9px !important;
        }
      }
    `}</style>
  </section>
);
}