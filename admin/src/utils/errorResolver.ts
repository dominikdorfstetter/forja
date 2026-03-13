import { ProblemDetails, FieldError } from '@/types/api';
import { resolveErrorCode } from './errorCodes';

export interface ResolvedError {
  title: string;
  detail: string;
  code?: string;
  action?: string;
  fieldErrors?: FieldError[];
}

function isProblemDetails(error: unknown): error is ProblemDetails {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.status === 'number' &&
    typeof obj.code === 'string'
  );
}

export function resolveError(error: unknown): ResolvedError {
  if (isProblemDetails(error)) {
    const codeInfo = resolveErrorCode(error.code);
    const title = codeInfo?.message ?? error.title;
    let detail = error.detail || title;

    if (error.errors && error.errors.length > 0) {
      const fieldMessages = error.errors.map((e) => `${e.field}: ${e.message}`);
      detail = `${detail} (${fieldMessages.join(', ')})`;
    }

    return {
      title,
      detail,
      code: error.code,
      action: codeInfo?.action,
      fieldErrors: error.errors,
    };
  }

  if (error instanceof Error) {
    if (error.message === 'Network Error') {
      return { title: 'Network Error', detail: 'Unable to reach the server. Check your connection.' };
    }
    if (error.message.includes('timeout')) {
      return { title: 'Timeout', detail: 'The request timed out. Please try again.' };
    }
    return { title: 'Error', detail: error.message };
  }

  return { title: 'Unknown Error', detail: 'An unexpected error occurred.' };
}
