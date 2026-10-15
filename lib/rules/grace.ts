import type { CourseConfig } from '../configs/types';
import type { SubjectResult } from '../calculation/types';

export interface GraceResult {
  usedGrace: number;
  remainingGrace: number;
  modifiedSubjects: SubjectResult[];
}

/**
 * Apply grace marks according to established college rules:
 * - Checks if grace is enabled in the configuration
 * - Checks pass mark (default 40), total limit, subject limit
 * - Iterates through priority categories (e.g., Major CP, Minor, etc.)
 * - Applies grace only to failed subjects (grade === 'F') within limits
 */
export function applyGraceMarks(
  subjects: SubjectResult[],
  config: CourseConfig,
): number {
  const grace = config.grace;

  if (!grace?.enabled) {
    return 0;
  }

  const passMark = grace.passMark ?? 40;
  const totalLimit = grace.totalLimit ?? 0;
  const subjectLimit = grace.subjectLimit ?? 0;
  const priority = grace.priority ?? [];

  let remainingGrace = totalLimit;
  let usedGrace = 0;

  for (const priorityGroup of priority) {
    if (remainingGrace <= 0) {
      break;
    }

    for (const subject of subjects) {
      if (remainingGrace <= 0) {
        break;
      }

      if (subject.grade !== 'F') {
        continue;
      }

      const category = subject.category ?? '';

      if (!priorityGroup.includes(category)) {
        continue;
      }

      const required = passMark - subject.marks;

      if (
        required <= 0 ||
        required > subjectLimit ||
        required > remainingGrace
      ) {
        continue;
      }

      subject.marks = Math.round(subject.marks + required);
      subject.grace = required;

      usedGrace += required;
      remainingGrace -= required;
    }
  }

  return usedGrace;
}
