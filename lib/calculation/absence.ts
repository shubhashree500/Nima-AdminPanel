/**
 * Global Absent Marks Handling Utility
 *
 * Requirements:
 * 1. Excel input will contain 'A' for absent students and '0' for students who appeared but scored zero.
 * 2. During calculations, treat 'A' as numeric 0 so all existing calculation formulas continue working.
 * 3. Preserve absence status separately in MongoDB and calculated-result JSON.
 * 4. Throughout the entire Admin Panel, display:
 *    - Genuine 0 -> 0
 *    - Absent A -> Absent
 * 5. Apply this consistently to Marks Entry, Calculated Results, Grade Sheets, Result Statistics,
 *    Tabular Register, Individual Results, Rechecking, Published Results and PDF/Excel exports.
 * 6. Absent students must remain failed according to existing grading rules.
 * 7. During rechecking, if valid marks replace an absent mark, update the status to PRESENT and recalculate.
 * 8. Maintain backward compatibility. Never assume an old numeric zero means absent.
 * 9. Apply across UG, BBA and PG, all semesters and departments.
 *
 * Important: Never identify absence using marks === 0. Only the original Excel 'A' indicates absence.
 */

/**
 * Checks if a raw mark value explicitly represents Absence.
 * Only 'A', 'AB', 'A.B', 'ABSENT' indicate absence. Numeric 0 or string '0' is NOT absent.
 */
export function isAbsentMark(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toUpperCase();
  return str === 'A' || str === 'AB' || str === 'A.B' || str === 'ABSENT';
}

/**
 * Identifies whether a subject result represents an absence.
 * Checks explicit absence flags, absence status, grade 'AB', or explicit absent raw marks.
 * NEVER assumes marks === 0 means absent (maintains backward compatibility for genuine 0s).
 */
export function isSubjectAbsent(subject: any): boolean {
  if (!subject || typeof subject !== 'object') return false;

  if (subject.isAbsent === true) return true;
  if (String(subject.status || '').trim().toUpperCase() === 'ABSENT') return true;
  if (String(subject.grade || '').trim().toUpperCase() === 'AB') return true;

  if (isAbsentMark(subject.rawMark) || isAbsentMark(subject.marksRaw)) return true;
  if (isAbsentMark(subject.FinalMark) || isAbsentMark(subject.finalMark)) return true;
  if (isAbsentMark(subject.MidsemMark) || isAbsentMark(subject.midsemMark)) return true;
  if (isAbsentMark(subject.PracticalMark) || isAbsentMark(subject.practicalMark)) return true;

  return false;
}

/**
 * Checks whether all subjects for a student are absent.
 * Never uses marks === 0.
 */
export function isStudentAllAbsent(studentResult: any): boolean {
  const subjects = Array.isArray(studentResult?.subjects)
    ? studentResult.subjects
    : [];

  if (subjects.length === 0) return false;

  return subjects.every((s: any) => isSubjectAbsent(s));
}

/**
 * Formats a subject's total marks for user display across UI, PDF, and Excel.
 * Displays:
 *  - Genuine 0 -> 0 (or '0')
 *  - Absent A  -> 'Absent'
 */
export function formatMarkDisplay(subject: any, fallback: string | number = '—'): string | number {
  if (!subject) return fallback;

  if (isSubjectAbsent(subject)) {
    return 'Absent';
  }

  const marks = subject.marks ?? subject.totalMark;
  if (marks !== undefined && marks !== null && String(marks).trim() !== '') {
    const num = Number(marks);
    return Number.isFinite(num) ? num : fallback;
  }

  return fallback;
}

/**
 * Formats an individual component mark (e.g. Midsem, Final, Practical) for display.
 * Displays:
 *  - Genuine 0 -> 0 (or '0')
 *  - Absent A  -> 'Absent'
 */
export function formatComponentMark(value: unknown, fallback: string | number = '—'): string | number {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }

  if (isAbsentMark(value)) {
    return 'Absent';
  }

  const num = Number(value);
  if (Number.isFinite(num)) {
    return num;
  }

  return String(value);
}
