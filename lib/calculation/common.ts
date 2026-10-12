import type { GradeResult } from './types';

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const number = Number(value);

  return Number.isNaN(number) ? 0 : number;
}

export function roundNumber(
  value: number,
  decimals = 2,
): number {
  const multiplier = Math.pow(10, decimals);

  return Math.round(value * multiplier) / multiplier;
}

export function calculatePercentage(
  obtained: number,
  fullMark: number,
): number {
  if (fullMark <= 0) {
    return 0;
  }

  return roundNumber((obtained / fullMark) * 100, 2);
}

export function calculateCreditPoint(
  credit: number,
  gradePoint: number,
): number {
  return credit * gradePoint;
}

export function calculateSGPA(
  totalCreditPoints: number,
  totalCredits: number,
): number {
  if (totalCredits <= 0) {
    return 0;
  }

  return roundNumber(
    totalCreditPoints / totalCredits,
    2,
  );
}