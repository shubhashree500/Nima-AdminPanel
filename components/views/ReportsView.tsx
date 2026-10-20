'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ReportKind = 'grade-sheets' | 'tabular-register' | 'statistics';
type Calculation = { id: string; program: string; semester: number; batch?: string | number; course?: string; department?: string; count?: number; status?: string; createdAt?: string; results?: any[]; hasRevisions?: boolean; departments?: any[] };

function identity(result: any) { return result?.student || result || {}; }
function rollOf(result: any) { const s = identity(result); return s['College Roll No'] || s['College Roll No.'] || s['Roll No'] || s['College Roll'] || s.collegeRollNo || s.roll || s.rollNo || s['Autonomous Roll No'] || s.autonomousRollNo || '-'; }
function nameOf(result: any) { const s = identity(result); return s['Applicant Name'] || s['Name of the Students'] || s['Student Name'] || s.name || s.studentName || rollOf(result); }
function deptOf(result: any) { const s = identity(result); return s.Department || s.department || s.course || '-'; }
function subjectsOf(result: any): any[] { return Array.isArray(result?.subjects) ? result.subjects : []; }
function totalOf(result: any) { return subjectsOf(result).reduce((sum, subject) => sum + (Number(subject?.marks) || 0), 0); }
function maxOf(result: any) { return subjectsOf(result).reduce((sum, subject) => sum + (Number(subject?.fullMark) || 0), 0); }
function statusOf(result: any) { const subjects = subjectsOf(result); if (!subjects.length) return 'PENDING'; return subjects.some((s) => ['F', 'AB', 'M'].includes(String(s?.grade || '').toUpperCase())) ? 'FAIL' : 'PASS'; }
function csvEscape(value: unknown) { const text = String(value ?? ''); return `"${text.replace(/"/g, '""')}"`; }

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
    const roll = String(correction.studentRoll || '')
      .trim()
      .toLowerCase();

    if (roll) {
      latestByRoll.set(roll, correction);
    }
  }

  return originalResults.map((originalResult) => {
    const roll = String(rollOf(originalResult))
      .trim()
      .toLowerCase();

    const correction = latestByRoll.get(roll);

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
    () => (selected?.results || []).some((r: any) => r.isRevised === true),
    [selected]
  );
  const departments = useMemo(() => ['All', ...Array.from(new Set((selected?.results || []).map(deptOf).filter((x) => x && x !== '-'))).sort()], [selected]);
  const rows = useMemo(
    () =>
      (selected?.results || []).filter(
        (r) =>
          (department === 'All' || deptOf(r) === department) &&
          (!revisedOnly || r.isRevised === true) &&
          `${nameOf(r)} ${rollOf(r)} ${deptOf(r)}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [selected, department, search, revisedOnly]
  );
  const paperColumns = useMemo(() => Array.from(new Set((selected?.results || []).flatMap((r) => subjectsOf(r).map((s) => String(s.subjectName || s.subject || s.paperCode || 'Paper'))))), [selected]);
  const stats = useMemo(() => {
    const all = selected?.results || [];
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
  }, [selected]);




const exportTabularRegisterPdf = () => {
  if (!selected || kind !== 'tabular-register' || rows.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  // Adjust this cutoff if your college needs a different layout.
  const MAX_SUBJECTS_FOR_TWO_PER_PAGE = 5;

  const display = (value: unknown) =>
    value === null || value === undefined || value === ''
      ? '—'
      : String(value);

  const field = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj?.[key] !== undefined && obj?.[key] !== null && obj[key] !== '') {
        return obj[key];
      }
    }
    return undefined;
  };

  const getSubjects = (result: any): any[] =>
    Array.isArray(result?.subjects)
      ? result.subjects
      : Array.isArray(result?.courses)
        ? result.courses
        : [];

  const getStudentStatus = (result: any) => {
    const subjects = getSubjects(result);
    if (!subjects.length) return 'PENDING';

    const grades = subjects.map((s) => String(s?.grade || '').toUpperCase());

    if (grades.some((g) => ['F', 'AB', 'M'].includes(g))) return 'FAIL';
    if (grades.some((g) => !g)) return 'PENDING';

    return 'PASS';
  };

  const getClassification = (result: any) => {
    const status = getStudentStatus(result);
    if (status === 'FAIL') return 'Fail';
    if (status === 'PENDING') return 'Pending';

    const sgpa = Number(result?.sgpa);
    if (!Number.isFinite(sgpa)) return '—';
    if (sgpa >= 9) return 'Excellent';
    if (sgpa >= 8) return 'Very Good';
    if (sgpa >= 7) return 'Good';
    if (sgpa >= 6) return 'Average';

    return '—';
  };

  const safeFilename = (value: unknown) =>
    String(value ?? 'NA')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '');

  // Render one student's register inside the supplied vertical area.
  const renderStudent = (
    result: any,
    index: number,
    startY: number,
    compact: boolean,
  ) => {
    const student = identity(result);
    const subjects = getSubjects(result);
    const status = getStudentStatus(result);
    const fontSize = compact ? 6 : 7;
    const cellPadding = compact ? 0.8 : 1.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 9 : 14);
    doc.text(
      'NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA',
      pageWidth / 2,
      startY + (compact ? 4 : 5),
      { align: 'center' },
    );

    doc.setFontSize(compact ? 8 : 12);
    doc.text(
      'TABULATION REGISTER',
      pageWidth / 2,
      startY + (compact ? 8.5 : 11),
      { align: 'center' },
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(compact ? 6.5 : 9);
    doc.text(
      `${selected.program} - SEMESTER ${selected.semester} EXAMINATION`,
      pageWidth / 2,
      startY + (compact ? 12.5 : 17),
      { align: 'center' },
    );

    doc.text(
      `Batch: ${display(selected.batch)}    Department: ${display(deptOf(result))}`,
      pageWidth / 2,
      startY + (compact ? 16 : 22),
      { align: 'center' },
    );

    doc.setFontSize(compact ? 6 : 8);
    doc.text(
      `Student ${index + 1} of ${rows.length}`,
      pageWidth - margin,
      startY + (compact ? 16 : 22),
      { align: 'right' },
    );

    autoTable(doc, {
      startY: startY + (compact ? 18 : 25),
      margin: { left: margin, right: margin },
      theme: 'grid',
      pageBreak: 'avoid',
      styles: {
        fontSize: compact ? 6 : 8,
        cellPadding: compact ? 1 : 2,
        overflow: 'linebreak',
        valign: 'middle',
      },
      body: [
        [
          'Student Name',
          display(nameOf(result)),
          'Department',
          display(deptOf(result)),
        ],
        [
          'College Roll',
          display(rollOf(result)),
          'Autonomous Roll',
          display(
            field(student, [
              'Autonomous Roll No',
              'autonomousRollNo',
              'autonomousRoll',
            ]),
          ),
        ],
        [
          'Exam Roll',
          display(
            field(student, [
              'Exam Roll',
              'Exam Roll No',
              'Exam Roll No.',
              'examRoll',
              'examRollNo',
            ]),
          ),
          'Exam Code',
          display(
            field(student, [
              'Exam Code',
              'Examcode',
              'examCode',
              'examcode',
            ]),
          ),
        ],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 25 },
        1: { cellWidth: 85 },
        2: { fontStyle: 'bold', cellWidth: 25 },
        3: { cellWidth: 'auto' },
      },
    });

    let y = (doc as any).lastAutoTable.finalY + (compact ? 1.5 : 3);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      pageBreak: 'avoid',
      styles: {
        fontSize,
        cellPadding,
        overflow: 'linebreak',
        valign: 'middle',
        minCellHeight: compact ? 3.5 : 4,
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      head: [[
        'Sl.',
        'Paper Code',
        'Subject',
        'Mid Sem',
        'Full Mark',
        'Secured',
        'Total',
        'Grace',
        'Grade',
        'GP',
        'Credit',
        'CP',
        'Result',
      ]],
      body: subjects.map((subject: any, subjectIndex: number) => {
        const marks = field(subject, ['marks', 'totalMarks']);

        return [
          subjectIndex + 1,
          display(field(subject, ['paperCode', 'paper', 'code'])),
          display(field(subject, ['subjectName', 'subject', 'name'])),
          display(field(subject, [
            'midsemMarks',
            'midSemMarks',
            'midsemMark',
            'midSemMark',
            'midsem',
          ])),
          display(field(subject, ['fullMark', 'fullMarks'])),
          display(field(subject, [
            'endSemMarks',
            'endsemMarks',
            'finalMark',
            'finalMarks',
          ]) ?? marks),
          display(marks),
          display(field(subject, ['grace', 'graceMarks'])),
          display(subject.grade),
          display(field(subject, ['gradePoint', 'grade_point'])),
          display(subject.credit),
          display(field(subject, ['creditPoint', 'creditPoints'])),
          display(field(subject, ['result', 'status']) ?? status),
        ];
      }),
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 19 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 17 },
        4: { cellWidth: 17 },
        5: { cellWidth: 17 },
        6: { cellWidth: 15 },
        7: { cellWidth: 12 },
        8: { cellWidth: 13 },
        9: { cellWidth: 10 },
        10: { cellWidth: 14 },
        11: { cellWidth: 12 },
        12: { cellWidth: 17 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + (compact ? 1.5 : 3);

    const totalFullMarks = subjects.reduce(
      (sum, subject) => sum + (Number(subject?.fullMark) || 0),
      0,
    );
    const totalSecuredMarks = subjects.reduce(
      (sum, subject) => sum + (Number(subject?.marks) || 0),
      0,
    );

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      pageBreak: 'avoid',
      styles: {
        fontSize: compact ? 5.8 : 7,
        cellPadding: compact ? 1 : 1.8,
        overflow: 'linebreak',
        halign: 'center',
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      head: [[
        'Full Marks',
        'Secured Total',
        'Total Credits',
        'Total Credit Points',
        'SGPA',
        'Percentage',
        'Result',
        'Classification',
      ]],
      body: [[
        totalFullMarks,
        totalSecuredMarks,
        display(result.totalCredits),
        display(result.totalCreditPoints),
        display(result.sgpa),
        result.percentage == null ? '—' : `${result.percentage}%`,
        status,
        getClassification(result),
      ]],
    });

    // A compact separator helps distinguish the two student records.
    if (compact) {
      const endY = (doc as any).lastAutoTable.finalY;
      doc.setDrawColor(150);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, endY + 2, pageWidth - margin, endY + 2);
      doc.setLineDashPattern([], 0);
    }
  };

  let index = 0;
  let pageStarted = false;

  while (index < rows.length) {
    const current = rows[index];
    const currentSubjects = getSubjects(current);

    const next = rows[index + 1];
    const nextSubjects = next ? getSubjects(next) : [];

    const canSharePage =
      Boolean(next) &&
      currentSubjects.length <= MAX_SUBJECTS_FOR_TWO_PER_PAGE &&
      nextSubjects.length <= MAX_SUBJECTS_FOR_TWO_PER_PAGE;

    if (pageStarted) doc.addPage();
    pageStarted = true;

    if (canSharePage) {
      // Each compact record occupies one half of the landscape page.
      renderStudent(current, index, 4, true);
      renderStudent(next, index + 1, 106, true);
      index += 2;
    } else {
      // Larger subject lists get a full page.
      renderStudent(current, index, 5, false);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(
        `Calculation ID: ${selected.id} | Status: ${display(selected.status)}`,
        margin,
        pageHeight - 5,
      );
      doc.setFont('helvetica', 'bold');
      doc.text(
        'Controller of Examinations',
        pageWidth - margin,
        pageHeight - 5,
        { align: 'right' },
      );

      index += 1;
    }

    // Footer for pages containing two compact student records.
    if (canSharePage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(
        `Calculation ID: ${selected.id} | Status: ${display(selected.status)}`,
        margin,
        pageHeight - 3,
      );
      doc.setFont('helvetica', 'bold');
      doc.text(
        'Controller of Examinations',
        pageWidth - margin,
        pageHeight - 3,
        { align: 'right' },
      );
    }
  }

  doc.save(
    `TR-${safeFilename(selected.program)}-Sem${selected.semester}-Batch${safeFilename(selected.batch || 'NA')}.pdf`,
  );
};

const exportResultStatisticsPdf = () => {
  if (!selected || kind !== 'statistics') return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const LEFT = 10;
  const RIGHT = 10;
  const TABLE_WIDTH = pageWidth - LEFT - RIGHT;

  const numberValue = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeDepartment = (value: unknown): string => {
    const d = String(value ?? '').trim().toLowerCase();

    if (d === 'odia') return 'Odia';
    if (d === 'chemistry' || d === 'chem') return 'Chemistry';
    if (d === 'math' || d === 'mathematics') return 'Mathematics';
    if (d === 'geology') return 'Geology';
    if (d === 'commerce') return 'Commerce';
    if (d === 'mfc' || d === 'master of finance and control') return 'MFC';

    return String(value ?? '').trim() || 'Unassigned';
  };

  const getSubjects = (student: any): any[] =>
    Array.isArray(student?.subjects)
      ? student.subjects
      : Array.isArray(student?.courses)
        ? student.courses
        : [];

  // College convention: zero in every paper means absent.
  const isAbsent = (student: any): boolean => {
    const subjects = getSubjects(student);

    return (
      !subjects.length ||
      subjects.every((subject) =>
        numberValue(
          subject?.totalMark ?? subject?.marks ?? subject?.totalMarks,
        ) === 0
      )
    );
  };

  const isMP = (student: any): boolean =>
    student?.mp === true ||
    String(student?.result ?? '').trim().toUpperCase() === 'MP' ||
    getSubjects(student).some(
      (subject) =>
        String(subject?.grade ?? '').trim().toUpperCase() === 'MP',
    );

  const isFail = (student: any): boolean =>
    getSubjects(student).some((subject) =>
      ['F', 'AB', 'M'].includes(
        String(subject?.grade ?? '').trim().toUpperCase(),
      ),
    );

  const sourceStudents = selected.results || [];

  // Use all departments in the selected calculation, as in the original script.
  const departmentNames = Array.from(
    new Set(sourceStudents.map((student) => normalizeDepartment(deptOf(student)))),
  );

  const streamDefinitions = [
    { name: 'Arts', departments: ['Odia'] },
    { name: 'Science', departments: ['Chemistry', 'Geology', 'Mathematics'] },
    { name: 'Commerce', departments: ['Commerce'] },
    { name: 'MFC', departments: ['MFC'] },
  ];

  const knownDepartments = new Set(
    streamDefinitions.flatMap((stream) => stream.departments),
  );

  const streams = streamDefinitions
    .map((stream) => ({
      name: stream.name,
      departments: stream.departments.filter((name) =>
        departmentNames.includes(name),
      ),
    }))
    .filter((stream) => stream.departments.length > 0);

  const otherDepartments = departmentNames
    .filter((name) => !knownDepartments.has(name))
    .sort((a, b) => a.localeCompare(b));

  if (otherDepartments.length) {
    streams.push({ name: 'Other', departments: otherDepartments });
  }

  const calculateDepartmentStatistics = (department: string) => {
    const students = sourceStudents.filter(
      (student) => normalizeDepartment(deptOf(student)) === department,
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

    return {
      department,
      appeared,
      cleared,
      backFail,
      absent,
      mp,
      successPercentage: appeared
        ? (cleared / appeared) * 100
        : 0,
    };
  };

  const streamStatistics = streams.map((stream) => {
    const departments = stream.departments.map(
      calculateDepartmentStatistics,
    );

    const total = departments.reduce(
      (acc, row) => ({
        appeared: acc.appeared + row.appeared,
        cleared: acc.cleared + row.cleared,
        backFail: acc.backFail + row.backFail,
        absent: acc.absent + row.absent,
        mp: acc.mp + row.mp,
      }),
      { appeared: 0, cleared: 0, backFail: 0, absent: 0, mp: 0 },
    );

    return {
      name: stream.name,
      departments,
      total: {
        ...total,
        successPercentage: total.appeared
          ? (total.cleared / total.appeared) * 100
          : 0,
      },
    };
  });

  const grandTotal = streamStatistics.reduce(
    (acc, stream) => ({
      appeared: acc.appeared + stream.total.appeared,
      cleared: acc.cleared + stream.total.cleared,
      backFail: acc.backFail + stream.total.backFail,
      absent: acc.absent + stream.total.absent,
      mp: acc.mp + stream.total.mp,
    }),
    { appeared: 0, cleared: 0, backFail: 0, absent: 0, mp: 0 },
  );

  const grandSuccessPercentage = grandTotal.appeared
    ? (grandTotal.cleared / grandTotal.appeared) * 100
    : 0;

  const fmt = (value: number) => value.toFixed(2);

  // Header. A logo is optional; add it later if the asset is available.
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    'NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA',
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  y += 6;
  doc.setFontSize(10);
  doc.text('RESULT STATISTICS', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFontSize(7.5);
  doc.text(
    `${String(selected.program).toUpperCase()} — ${selected.semester}${selected.semester === 1 ? 'ST' : selected.semester === 2 ? 'ND' : selected.semester === 3 ? 'RD' : 'TH'} SEMESTER EXAMINATION (${new Date().getFullYear()}) — ${selected.batch ?? 'BATCH NOT SPECIFIED'} ADMISSION BATCH`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  y += 7;

  const COL_WIDTHS = [23, 43, 24, 24, 27, 16, 29];
  const ROW_HEIGHT = 7;
  const HEADERS = [
    'Stream',
    'Subject / Department',
    'Appeared',
    'Cleared',
    'Back / Fail',
    'MP',
    '% of Success',
  ];

  const drawCell = (
    x: number,
    top: number,
    width: number,
    height: number,
    value: unknown,
    options: {
      fill?: number[];
      bold?: boolean;
      align?: 'left' | 'center' | 'right';
      fontSize?: number;
    } = {},
  ) => {
   
    if (options.fill) {
  const [r, g, b] = options.fill;
  doc.setFillColor(r ?? 255, g ?? 255, b ?? 255);
  doc.rect(x, top, width, height, 'F');
}

    doc.setDrawColor(80);
    doc.setLineWidth(0.2);
    doc.rect(x, top, width, height);

    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(options.fontSize ?? 6.5);
    doc.setTextColor(0);

    const text = String(value ?? '');
    const lines = doc.splitTextToSize(text, width - 2);
    const lineHeight = (options.fontSize ?? 6.5) * 0.3528 * 1.15;
    const textY = top + Math.max(1, (height - lines.length * lineHeight) / 2 + 0.7);

    doc.text(lines, x + (options.align === 'left' ? 1.5 : width / 2), textY, {
      align: options.align ?? 'center',
      maxWidth: width - 2,
    });
  };

  const drawTableHeader = (top: number) => {
    let x = LEFT;

    HEADERS.forEach((header, index) => {
      drawCell(x, top, COL_WIDTHS[index], ROW_HEIGHT, header, {
        fill: [229, 229, 229],
        bold: true,
        fontSize: 6,
      });
      x += COL_WIDTHS[index];
    });

    return top + ROW_HEIGHT;
  };

  const drawStatisticsRow = (
    top: number,
    stream: string,
    department: string,
    stats: {
      appeared: number;
      cleared: number;
      backFail: number;
      mp: number;
      successPercentage: number;
    },
    isTotal = false,
    isGrandTotal = false,
  ) => {
    const fill = isGrandTotal
      ? [217, 217, 217]
      : isTotal
        ? [238, 238, 238]
        : undefined;

    const values = [
      stream,
      department,
      stats.appeared,
      stats.cleared,
      stats.backFail,
      stats.mp,
      fmt(stats.successPercentage),
    ];

    let x = LEFT;

    values.forEach((value, index) => {
      drawCell(x, top, COL_WIDTHS[index], ROW_HEIGHT, value, {
        fill,
        bold: isTotal || isGrandTotal,
        align: index === 1 ? 'left' : 'center',
        fontSize: 6.5,
      });
      x += COL_WIDTHS[index];
    });

    return top + ROW_HEIGHT;
  };

  y = drawTableHeader(y);

  streamStatistics.forEach((stream) => {
    stream.departments.forEach((departmentStats, index) => {
      y = drawStatisticsRow(
        y,
        index === 0 ? stream.name : '',
        departmentStats.department.toUpperCase(),
        departmentStats,
      );
    });

    y = drawStatisticsRow(y, '', 'Stream Total', stream.total, true);
  });

  y = drawStatisticsRow(
    y,
    'Grand Total',
    '',
    {
      ...grandTotal,
      successPercentage: grandSuccessPercentage,
    },
    false,
    true,
  );

  // Summary section.
  y += 7;

  const drawSummary = () => {
    if (y + 48 > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Summary', LEFT, y);
    y += 4;

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(LEFT, y, LEFT + TABLE_WIDTH, y);
    y += 2;

    const summaryRows: [string, string | number][] = [
      ['Total Appeared', grandTotal.appeared],
      ['Total Cleared', grandTotal.cleared],
      ['Total Back / Fail', grandTotal.backFail],
      ['Total MP', grandTotal.mp],
      ['Result %', fmt(grandSuccessPercentage)],
    ];

    autoTable(doc, {
      startY: y,
      body: summaryRows,
      margin: { left: LEFT, right: RIGHT },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 2,
        lineWidth: 0.2,
        lineColor: [80, 80, 80],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 125, halign: 'left' },
        1: { halign: 'center', fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  };

  drawSummary();

  if (y + 28 > pageHeight - 5) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(LEFT, y, LEFT + TABLE_WIDTH, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    'Those who secure 0 in all papers are counted as Absent students.',
    LEFT,
    y,
    { maxWidth: TABLE_WIDTH },
  );

  y += 18;

  const signatureWidth = 55;
  const signatureX = pageWidth - RIGHT - signatureWidth;

  doc.line(signatureX, y, signatureX + signatureWidth, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(
    'Controller of Examinations',
    signatureX + signatureWidth,
    y,
    { align: 'right' },
  );

  const safe = (value: unknown) =>
    String(value ?? 'NA')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '');

  doc.save(
    `PG_Result_Statistics-${safe(selected.program)}-Sem${selected.semester}-Batch${safe(selected.batch || 'NA')}.pdf`,
  );
};

  const exportCsv = () => {
    if (!selected) return;
    let matrix: unknown[][];
    if (kind === 'tabular-register') {
      matrix = [['No.', 'College Roll', 'Student Name', 'Department', ...paperColumns, 'Total', 'Full Marks', 'Credits', 'SGPA', 'Percentage', 'Status', 'Revised'], ...rows.map((r, i) => [i + 1, rollOf(r), nameOf(r), deptOf(r), ...paperColumns.map((paper) => { const subject = subjectsOf(r).find((s) => String(s.subjectName || s.subject || s.paperCode || 'Paper') === paper); return subject ? `${subject.marks ?? 0}/${subject.fullMark ?? 0} ${subject.grade || ''}` : ''; }), totalOf(r), maxOf(r), r.totalCredits ?? '', r.sgpa ?? '', r.percentage ?? '', statusOf(r), r.isRevised ? 'YES' : 'NO'])];
    } else if (kind === 'statistics') {
      matrix = [['Department', 'Students', 'Passed', 'Failed', 'Pass Percentage'], ...stats.byDept.map(([d, v]) => [d, v.students, v.passed, v.failed, v.students ? `${(v.passed / v.students * 100).toFixed(2)}%` : '0%'])];
    } else {
      matrix = [['No.', 'College Roll', 'Student Name', 'Department', 'Paper Code', 'Subject', 'Marks', 'Full Marks', 'Grade', 'Grade Point', 'Credit', 'Credit Point', 'SGPA', 'Percentage', 'Status', 'Revised'], ...rows.flatMap((r, i) => subjectsOf(r).map((s) => [i + 1, rollOf(r), nameOf(r), deptOf(r), s.paperCode || '', s.subjectName || s.subject || '', s.marks ?? 0, s.fullMark ?? 0, s.grade || '', s.gradePoint ?? '', s.credit ?? '', s.creditPoint ?? '', r.sgpa ?? '', r.percentage ?? '', statusOf(r), r.isRevised ? 'YES' : 'NO']))];
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
        ['No.', 'College Roll', 'Student Name', 'Department', ...paperColumns, 'Total', 'Full Marks', 'Credits', 'SGPA', 'Percentage', 'Status', 'Revised'],
        ...rows.map((r, i) => [
          i + 1,
          rollOf(r),
          nameOf(r),
          deptOf(r),
          ...paperColumns.map((paper) => {
            const subject = subjectsOf(r).find((s) => String(s.subjectName || s.subject || s.paperCode || 'Paper') === paper);
            return subject ? `${subject.marks ?? 0}/${subject.fullMark ?? 0} ${subject.grade || ''}` : '';
          }),
          totalOf(r),
          maxOf(r),
          r.totalCredits ?? '',
          r.sgpa ?? '',
          r.percentage ?? '',
          statusOf(r),
          r.isRevised ? 'YES' : 'NO',
        ]),
      ];
    } else if (kind === 'statistics') {
      matrix = [
        ['Department', 'Students', 'Passed', 'Failed', 'Pass Percentage'],
        ...stats.byDept.map(([d, v]) => [d, v.students, v.passed, v.failed, v.students ? `${((v.passed / v.students) * 100).toFixed(2)}%` : '0%']),
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(isRev ? 'REVISED SEMESTER GRADE SHEET' : 'SEMESTER GRADE SHEET', 105, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${selected.program} SEMESTER ${selected.semester} EXAMINATION (${selected.batch || ''})`, 105, 25, { align: 'center' });

    // Student Info
    doc.setFontSize(9);
    doc.text(`Roll No: ${rollOf(r)}`, 14, 35);
    doc.text(`Student Name: ${nameOf(r)}`, 14, 41);
    doc.text(`Department / Course: ${deptOf(r)}`, 14, 47);
    if (isRev) {
      doc.setTextColor(180, 0, 0);
      doc.text(`* REVISED RESULT (After Rechecking / Revaluation)`, 14, 53);
      doc.setTextColor(0, 0, 0);
    }

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
      startY: isRev ? 57 : 52,
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
    <section className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Reports are generated from saved calculation records. Confirm the record status before using a report as an official document.
          </p>
        </header>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
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
          <div className="rounded-xl border bg-white p-4 text-sm">
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
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Students', stats.total],
                  ['Passed', stats.passed],
                  ['Failed', stats.failed],
                  ['Pass Percentage', `${stats.passRate.toFixed(2)}%`],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border bg-white p-5"
                  >
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold">Department-wise results</h2>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border p-2 text-left">Department</th>
                          <th className="border p-2">Students</th>
                          <th className="border p-2">Pass</th>
                          <th className="border p-2">Fail</th>
                          <th className="border p-2">Pass %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byDept.map(([d, v]) => (
                          <tr key={d}>
                            <td className="border p-2">{d}</td>
                            <td className="border p-2 text-center">
                              {v.students}
                            </td>
                            <td className="border p-2 text-center">
                              {v.passed}
                            </td>
                            <td className="border p-2 text-center">
                              {v.failed}
                            </td>
                            <td className="border p-2 text-center">
                              {(
                                (v.passed / v.students) *
                                100
                              ).toFixed(2)}
                              %
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold">
                    Grade distribution (subject grades)
                  </h2>
                  <div className="mt-3 space-y-2">
                    {stats.grades.map(([g, n]) => (
                      <div
                        key={g}
                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm"
                      >
                        <span className="font-semibold">{g}</span>
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : kind === 'grade-sheets' ? (
            <div className="space-y-5">
              {rows.map((r, i) => (
                <article
                  key={`${rollOf(r)}-${i}`}
                  className="break-inside-avoid rounded-xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-2">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold">
                          {selected.program} SEMESTER {selected.semester} GRADE
                          SHEET
                        </h2>
                        {r.isRevised && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                            REVISED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Batch {selected.batch || '-'} · Calculation {selected.id}
                      </p>
                    </div>
                    <button
                      onClick={() => exportSingleGradeSheetPdf(r)}
                      className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                    >
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
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Consolidated tabular register</h2>
                <span className="text-sm text-gray-500">
                  {rows.length} row(s)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2">#</th>
                      <th className="border p-2">Roll</th>
                      <th className="border p-2">Student</th>
                      <th className="border p-2">Department</th>
                      {paperColumns.map((p) => (
                        <th key={p} className="border p-2">
                          {p}
                        </th>
                      ))}
                      <th className="border p-2">Total</th>
                      <th className="border p-2">SGPA</th>
                      <th className="border p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${rollOf(r)}-${i}`}>
                        <td className="border p-2">{i + 1}</td>
                        <td className="border p-2">
                          <div className="flex items-center gap-1 font-medium">
                            {rollOf(r)}
                            {r.isRevised && (
                              <span className="rounded bg-purple-100 px-1 py-0.5 text-[10px] font-bold text-purple-800" title="Revised Result">
                                REV
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border p-2">{nameOf(r)}</td>
                        <td className="border p-2">{deptOf(r)}</td>

                        {paperColumns.map((p) => {
                          const s = subjectsOf(r).find(
                            (x) =>
                              String(
                                x.subjectName ||
                                  x.subject ||
                                  x.paperCode ||
                                  'Paper',
                              ) === p,
                          );

                          return (
                            <td key={p} className="border p-2">
                              {s
                                ? `${s.marks ?? 0} ${
                                    s.grade ? `(${s.grade})` : ''
                                  }`
                                : '—'}
                            </td>
                          );
                        })}

                        <td className="border p-2">
                          {totalOf(r)}/{maxOf(r)}
                        </td>
                        <td className="border p-2">{r.sgpa ?? '-'}</td>
                        <td className="border p-2">{statusOf(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>

    <style jsx global>{`
      @media print {
        body {
          background: white !important;
        }
        aside,
        nav,
        button,
        select,
        input,
        header p {
          display: none !important;
        }
        main,
        section {
          padding: 0 !important;
          margin: 0 !important;
        }
        article,
        .rounded-xl {
          box-shadow: none !important;
          break-inside: avoid;
        }
        table {
          font-size: 9px !important;
        }
      }
    `}</style>
  </section>
);
}