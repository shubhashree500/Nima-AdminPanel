export type GradeRule = {
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  gradePoint: number;
};

export type SpecialGrade = {
  grade: string;
  gradePoint: number;
};

export type GradeResult = {
  grade: string;
  gradePoint: number;
};

/**
 * Calculate grade from percentage using a configurable grading scale.
 */
export function calculateGrade(
  percentage: number,
  scale: GradeRule[],
): GradeResult {
  const rule = scale.find(
    (item) =>
      percentage >= item.minPercentage &&
      percentage <= item.maxPercentage,
  );

  // Keep the existing system's fallback behavior.
  if (!rule) {
    return {
      grade: 'F',
      gradePoint: 0,
    };
  }

  return {
    grade: rule.grade,
    gradePoint: rule.gradePoint,
  };
}