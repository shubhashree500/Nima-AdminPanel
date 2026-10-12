/**
 * Converts the college PG mark-foil worksheet shape into the
 * internal student/courses shape expected by pg2025Sem1.js.
 *
 * The college foil is row-based. Each row contains student details
 * and a repeating set of columns such as:
 *
 *   Paper 1.1 | Midsem-Mark | Final-Mark |
 *   Paper 1.2 | Midsem-Mark_1 | Final-Mark_1 | ...
 *
 * The selected department from the Admin Panel is authoritative.
 */

export type MarkFoilRow = Record<string, any>;

function clean(value: any): string {
  return String(value ?? '').trim();
}

function normalizedHeader(value: any): string {
  return clean(value)
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function isPaperHeader(header: string): { code: string } | null {
  // Supports: Paper 1.1, PAPER-1.1, Paper-1.1, paper 1.1
  const match = normalizedHeader(header).match(
    /^paper\s*[-:]?\s*(\d+)\s*\.\s*(\d+)$/i
  );
  if (!match) return null;
  return { code: `${match[1]}.${match[2]}` };
}

function isMidsemHeader(header: string): boolean {
  const h = normalizedHeader(header);
  return /mid\s*-?\s*sem/.test(h) || h.includes('midsem');
}

function isFinalHeader(header: string): boolean {
  const h = normalizedHeader(header);
  return (
    /final\s*-?\s*mark/.test(h) ||
    /finalmark/.test(h) ||
    /end\s*-?\s*sem/.test(h) ||
    /endsem/.test(h)
  );
}

function findHeader(
  headers: string[],
  start: number,
  end: number,
  predicate: (header: string) => boolean
): string | null {
  for (let i = start; i < end; i += 1) {
    if (predicate(headers[i])) return headers[i];
  }
  return null;
}

function findValue(
  row: MarkFoilRow,
  predicate: (header: string) => boolean
): any {
  const key = Object.keys(row).find(predicate);
  return key ? row[key] : '';
}

function getStudentField(row: MarkFoilRow, kind: string): any {
  const keys = Object.keys(row);

  const predicates: Record<string, (h: string) => boolean> = {
    collegeRoll: (raw) => {
      const h = normalizedHeader(raw);
      return /college.*roll/.test(h) || /roll.*college/.test(h);
    },
    autonomousRoll: (raw) => {
      const h = normalizedHeader(raw);
      return (
        /autonomous.*roll/.test(h) ||
        /roll.*autonomous/.test(h) ||
        /^nac.*roll/.test(h)
      );
    },
    name: (raw) => {
      const h = normalizedHeader(raw);
      return (
        /^name$/.test(h) ||
        /name.*student/.test(h) ||
        /student.*name/.test(h)
      );
    },
    department: (raw) => {
      const h = normalizedHeader(raw);
      return /^department$/.test(h) || /^dept$/.test(h);
    },
    examcode: (raw) => {
      const h = normalizedHeader(raw).replace(/[\s_-]/g, '');
      return h === 'examcode';
    },
  };

  const key = keys.find(predicates[kind]);
  return key ? row[key] : '';
}

function hasInternalCourses(row: MarkFoilRow): boolean {
  return (
    Array.isArray(row.courses) ||
    Array.isArray(row.Papers) ||
    Array.isArray(row.subjects)
  );
}

export function mapPGMarkFoilRows(
  rows: MarkFoilRow[],
  selectedDepartment: string
): MarkFoilRow[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('The Excel worksheet contains no student rows.');
  }

  // Already in the internal format: keep it intact, but make the
  // selected department authoritative for this Process Result run.
  if (hasInternalCourses(rows[0])) {
    return rows.map((row) => ({
      ...row,
      department: selectedDepartment || row.department || row.Department || '',
      semester: row.semester ?? 1,
    }));
  }

  const headers = Object.keys(rows[0]);

  const paperColumns = headers
    .map((header, index) => {
      const paper = isPaperHeader(header);
      return paper ? { header, index, code: paper.code } : null;
    })
    .filter(Boolean) as Array<{
      header: string;
      index: number;
      code: string;
    }>;

  if (!paperColumns.length) {
    const visibleHeaders = headers.slice(0, 20).join(', ');
    throw new Error(
      `No PG paper columns were detected. Expected headers such as "Paper 1.1", "Paper 1.2", etc. Found: ${visibleHeaders}`
    );
  }

  const mapped = rows.map((row, rowIndex) => {
    const courses = paperColumns.map((paper, paperIndex) => {
      const nextPaperIndex =
        paperIndex + 1 < paperColumns.length
          ? paperColumns[paperIndex + 1].index
          : headers.length;

      const midsemHeader = findHeader(
        headers,
        paper.index + 1,
        nextPaperIndex,
        isMidsemHeader
      );

      const finalHeader = findHeader(
        headers,
        paper.index + 1,
        nextPaperIndex,
        isFinalHeader
      );

      // Some mark foils put the marks immediately before/after the paper
      // title but may have an unusual header name. Keep an explicit empty
      // value rather than accidentally reading a student's other field.
      const title = clean(row[paper.header]);
      const midsemMark = midsemHeader ? row[midsemHeader] : '';
      const finalMark = finalHeader ? row[finalHeader] : '';

      return {
        paper: paper.code,
        title,
        midsemMark,
        finalMark,
      };
    });

    const collegeRollNo = getStudentField(row, 'collegeRoll');
    const autonomousRollNo = getStudentField(row, 'autonomousRoll');
    const name = getStudentField(row, 'name');
    const examcode = getStudentField(row, 'examcode');

    if (!collegeRollNo && !autonomousRollNo && !name) {
      throw new Error(
        `Row ${rowIndex + 2}: could not find student identity columns. Expected a college roll, autonomous roll, or student name column.`
      );
    }

    const usableCourses = courses.filter(
      (course) =>
        course.paper &&
        (course.midsemMark !== '' ||
          course.finalMark !== '' ||
          course.title !== '')
    );

    if (!usableCourses.length) {
      throw new Error(
        `Row ${rowIndex + 2}: paper columns were detected, but no paper marks could be read.`
      );
    }

    return {
      collegeRollNo,
      autonomousRollNo,
      name,
      department:
        selectedDepartment ||
        getStudentField(row, 'department') ||
        '',
      examcode,
      semester: 1,
      courses: usableCourses,
    };
  });

  return mapped;
}
