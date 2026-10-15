import type { CourseConfig, PaperConfig, RecheckingConfig } from '../configs/types';

export type MarkComponentType =
  | 'sem'
  | 'final'
  | 'endsem'
  | 'midsem'
  | 'practical'
  | 'attendance'
  | 'surpriseTest'
  | 'assignment'
  | 'internalPractical';

export interface ComponentDefinition {
  canonicalName: string;
  keys: string[];
  configKey: string;
  label: string;
}

export const RECHECKING_COMPONENTS: Record<string, ComponentDefinition> = {
  sem: {
    canonicalName: 'sem',
    keys: ['FinalMark', 'finalMark', 'EndsemMark', 'endsem', 'Final-Mark', 'marks'],
    configKey: 'endsem',
    label: 'Semester / Endsem Mark',
  },
  final: {
    canonicalName: 'final',
    keys: ['FinalMark', 'finalMark', 'EndsemMark', 'endsem', 'Final-Mark', 'marks'],
    configKey: 'endsem',
    label: 'Final Mark',
  },
  endsem: {
    canonicalName: 'endsem',
    keys: ['FinalMark', 'finalMark', 'EndsemMark', 'endsem', 'Final-Mark', 'marks'],
    configKey: 'endsem',
    label: 'Endsem Mark',
  },
  midsem: {
    canonicalName: 'midsem',
    keys: ['MidsemMark', 'midsemMark', 'midsem', 'Midsem-Mark'],
    configKey: 'midsem',
    label: 'Midsem Mark',
  },
  practical: {
    canonicalName: 'practical',
    keys: ['PracticalMark', 'practicalMark', 'practical', 'Practical', 'I-Practical', 'finalMark', 'FinalMark'],
    configKey: 'practical',
    label: 'Practical Mark',
  },
  attendance: {
    canonicalName: 'attendance',
    keys: ['Attandance', 'attendance', 'Attendance'],
    configKey: 'attendance',
    label: 'Attendance Mark',
  },
  surpriseTest: {
    canonicalName: 'surpriseTest',
    keys: ['SurpriseTest', 'surpriseTest', 'surprise'],
    configKey: 'surpriseTest',
    label: 'Surprise Test Mark',
  },
  assignment: {
    canonicalName: 'assignment',
    keys: ['Assignment', 'assignment'],
    configKey: 'assignment',
    label: 'Assignment Mark',
  },
  internalPractical: {
    canonicalName: 'internalPractical',
    keys: ['I-Practical', 'internalPractical', 'IPractical'],
    configKey: 'internalPractical',
    label: 'Internal Practical Mark',
  },
};

export const DEFAULT_RECHECKING_CONFIG: RecheckingConfig = {
  enabled: true,
  allowMarkIncrease: true,
  allowMarkDecrease: true,
  recalculateResult: true,
  maxApplications: 10,
};

/**
 * Normalizes component name
 */
export function normalizeComponentName(component: string): string {
  const clean = String(component || '').trim().toLowerCase();
  if (clean === 'sem' || clean === 'endsem' || clean === 'final' || clean === 'semmark' || clean === 'sem mark') {
    return 'endsem';
  }
  if (clean === 'midsem' || clean === 'mid' || clean === 'midsem mark') {
    return 'midsem';
  }
  if (clean === 'practical' || clean === 'practical mark' || clean === 'pract') {
    return 'practical';
  }
  if (clean === 'attendance' || clean === 'attandance') {
    return 'attendance';
  }
  if (clean === 'surprisetest' || clean === 'surprise') {
    return 'surpriseTest';
  }
  if (clean === 'assignment') {
    return 'assignment';
  }
  if (clean === 'internalpractical' || clean === 'i-practical') {
    return 'internalPractical';
  }
  return clean;
}

/**
 * Resolves maximum mark for a given component and paper
 */
export function getComponentMaxMark(
  paper: PaperConfig,
  componentName: string,
): number {
  const norm = normalizeComponentName(componentName);

  if (norm === 'practical') {
    if (paper.type === 'practical') {
      return (
        paper.marks.endsem?.max ??
        paper.marks.fullMark ??
        50
      );
    }
    const practicalConfig = (paper.marks as any)?.practical;
    if (practicalConfig && Number.isFinite(Number(practicalConfig.max))) {
      return Number(practicalConfig.max);
    }
    return 50;
  }

  if (norm === 'endsem' || norm === 'final' || norm === 'sem') {
    if (paper.type === 'practical') {
      return paper.marks.fullMark;
    }
    return (
      paper.marks.endsem?.max ??
      paper.marks.fullMark ??
      100
    );
  }

  if (norm === 'midsem') {
    return paper.marks.midsem?.max ?? 20;
  }

  if (norm === 'attendance') {
    return (paper.marks as any)?.attendance?.max ?? 5;
  }

  if (norm === 'surpriseTest') {
    return (paper.marks as any)?.surpriseTest?.max ?? 10;
  }

  if (norm === 'assignment') {
    return (paper.marks as any)?.assignment?.max ?? 5;
  }

  if (norm === 'internalPractical') {
    return (paper.marks as any)?.internalPractical?.max ?? 20;
  }

  return paper.marks.fullMark;
}

/**
 * Validates requested mark change against rechecking rules
 */
export function validateRecheckingMarkChange(options: {
  oldValue: number | null;
  newValue: number;
  maxMark: number;
  config: CourseConfig;
}): { valid: boolean; error?: string } {
  const { oldValue, newValue, maxMark, config } = options;
  const recheckRules = config.rechecking ?? DEFAULT_RECHECKING_CONFIG;

  if (!recheckRules.enabled) {
    return { valid: false, error: 'Rechecking is disabled for this course configuration.' };
  }

  if (!Number.isFinite(newValue) || newValue < 0 || newValue > maxMark) {
    return { valid: false, error: `New mark must be between 0 and ${maxMark}.` };
  }

  if (oldValue !== null && Number.isFinite(oldValue)) {
    if (newValue === oldValue) {
      return { valid: false, error: 'The new mark is identical to the current mark. No change requested.' };
    }
    if (newValue > oldValue && recheckRules.allowMarkIncrease === false) {
      return { valid: false, error: 'Mark increases are not allowed for this course.' };
    }
    if (newValue < oldValue && recheckRules.allowMarkDecrease === false) {
      return { valid: false, error: 'Mark decreases are not allowed for this course.' };
    }
  }

  return { valid: true };
}
