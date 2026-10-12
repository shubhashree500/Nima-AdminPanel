import type { EngineRequest } from './calculation/types';

import { getResultConfig } from './configs';

import { calculateUGStudent } from './calculation/ugCalculator';
import { calculatePGStudent } from './calculation/pgCalculator';

export function calculateResults(
  request: EngineRequest,
) {
  const batch = Number(request.batch);

  if (!Number.isFinite(batch)) {
    throw new Error(
      `Invalid batch: ${request.batch}`,
    );
  }

  const config =
    getResultConfig({
      program: request.program,
      batch,
      semester: request.semester,
      course: request.course,
      department:
        request.department,
    });

  if (!config) {
    throw new Error(
      `No result configuration found for ` +
        `${request.program} ` +
        `${request.course || ''} ` +
        `${request.department || ''} ` +
        `Semester ${request.semester}, ` +
        `Batch ${batch}`,
    );
  }

  return request.students.map(
    (student) => {
      if (
        request.program === 'UG'
      ) {
        return calculateUGStudent(
          student,
          config,
        );
      }

      if (
        request.program === 'PG'
      ) {
        return calculatePGStudent(
          student,
          config,
        );
      }

      throw new Error(
        `Unsupported program: ${request.program}`,
      );
    },
  );
}