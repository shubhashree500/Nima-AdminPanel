/**
 * Shared utility for validating student records across the Admin Panel.
 * Filters out blank rows, empty Excel rows, header rows, and placeholder text.
 */

const INVALID_ROLL_PLACEHOLDERS = new Set([
  '',
  '-',
  '—',
  'roll no',
  'roll no.',
  'roll number',
  'roll',
  'autonomous roll no',
  'autonomous roll no.',
  'autonomous roll number',
  'autoroll',
  'autorollno',
  'college roll no',
  'college roll no.',
  'college roll number',
  'collegeroll',
  'r',
]);

const INVALID_NAME_PLACEHOLDERS = new Set([
  '',
  '-',
  '—',
  'student',
  'name',
  'name of the students',
  'name of the student',
  'student name',
  'applicant name',
  'candidate name',
  'full name',
  'unnamed student',
]);

export function isValidStudentRecord(record: any): boolean {
  if (!record || typeof record !== 'object') return false;

  const s = record.student || record;

  const autoRoll = String(
    s.autonomousRollNo ??
    s['Autonomous Roll No'] ??
    s['Autonomous Roll No.'] ??
    s.r ??
    ''
  ).trim();

  const collegeRoll = String(
    s.collegeRollNo ??
    s['College Roll No'] ??
    s['College Roll No.'] ??
    s['College Roll'] ??
    s.rollNo ??
    s['Roll No'] ??
    s['Roll No.'] ??
    s.roll ??
    s.Roll ??
    ''
  ).trim();

  const name = String(
    s.name ??
    s.n ??
    s['Applicant Name'] ??
    s['Name of the Students'] ??
    s['Name of the Student'] ??
    s['Student Name'] ??
    s.studentName ??
    s.fullName ??
    ''
  ).trim();

  const autoLower = autoRoll.toLowerCase();
  const collegeLower = collegeRoll.toLowerCase();
  const nameLower = name.toLowerCase();

  const hasValidAuto = autoLower !== '' && !INVALID_ROLL_PLACEHOLDERS.has(autoLower);
  const hasValidCollege = collegeLower !== '' && !INVALID_ROLL_PLACEHOLDERS.has(collegeLower);
  const hasValidName = nameLower !== '' && !INVALID_NAME_PLACEHOLDERS.has(nameLower);

  // A student record must have at least one valid roll number or a valid name
  if (!hasValidAuto && !hasValidCollege) {
    return false;
  }

  // If both rolls are placeholder/header text, reject it
  if (
    (!autoLower || INVALID_ROLL_PLACEHOLDERS.has(autoLower)) &&
    (!collegeLower || INVALID_ROLL_PLACEHOLDERS.has(collegeLower))
  ) {
    return false;
  }

  // If the name is explicitly a header placeholder, reject it
  if (
    INVALID_NAME_PLACEHOLDERS.has(nameLower) &&
    (INVALID_ROLL_PLACEHOLDERS.has(autoLower) ||
      INVALID_ROLL_PLACEHOLDERS.has(collegeLower) ||
      autoLower.includes('roll') ||
      collegeLower.includes('roll'))
  ) {
    return false;
  }

  // Department check - if department is just header text and rolls are empty or headers
  const dept = String(s.Department ?? s.department ?? '').trim().toLowerCase();
  if (
    (dept === 'department' || dept === 'department name') &&
    (!hasValidAuto || !hasValidCollege)
  ) {
    return false;
  }

  return true;
}
