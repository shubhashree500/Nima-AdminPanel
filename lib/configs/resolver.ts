import type { CourseConfig, Program } from './types';

// UG
import ugBbaSem1 from './ug/bba/sem1';
import ugSem3 from './ug/sem3';

// PG
import pgChemistrySem1 from './pg/chemistry/sem1';
import pgMathematicsSem1 from './pg/mathematics/sem1';
import pgCommerceSem1 from './pg/commerce/sem1';
import pgGeologySem1 from './pg/geology/sem1';
import pgOdiaSem1 from './pg/odia/sem1';
import pgMfcSem1 from './pg/mfc/sem1';

const configs: CourseConfig[] = [
  // UG
  ugBbaSem1,
  ugSem3,

  // PG
  pgChemistrySem1,
  pgMathematicsSem1,
  pgCommerceSem1,
  pgGeologySem1,
  pgOdiaSem1,
  pgMfcSem1,
];

type ResolveRequest = {
  program: Program;
  batch: number;
  semester: number;
  course?: string;
  department?: string;
};

function normalizeDepartment(value?: string): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  const aliases: Record<string, string> = {
    odia: 'odia',
    chemistry: 'chemistry',

    math: 'mathematics',
    mathematics: 'mathematics',

    commerce: 'commerce',
    geology: 'geology',
    mfc: 'mfc',
    'mfc department': 'mfc',
  };

  return aliases[raw] || raw;
}

export function getResultConfig(
  request: ResolveRequest,
): CourseConfig | undefined {
  return configs.find((config) => {
    if (config.program !== request.program) {
      return false;
    }

    if (config.semester !== request.semester) {
      return false;
    }

    if (
      config.course &&
      request.course &&
      config.course.toLowerCase() !==
        request.course.toLowerCase()
    ) {
      return false;
    }

    if (config.department) {
      const configDepartment =
        normalizeDepartment(config.department);

      const requestDepartment =
        normalizeDepartment(request.department);

      if (configDepartment !== requestDepartment) {
        return false;
      }
    }

    const version = config.academicVersion;

    if (request.batch < version.fromBatch) {
      return false;
    }

    if (
      version.toBatch !== undefined &&
      request.batch > version.toBatch
    ) {
      return false;
    }

    return true;
  });
}

export function getAllResultConfigs(): CourseConfig[] {
  return configs;
}