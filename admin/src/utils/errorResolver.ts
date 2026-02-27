import { ProblemDetails, FieldError } from '@/types/api';

export interface ResolvedError {
  title: string;
  detail: string;
  fieldErrors?: FieldError[];
}

export function isProblemDetails(error: unknown): error is ProblemDetails {
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
    let detail = error.detail || error.title;

    if (error.errors && error.errors.length > 0) {
      const fieldMessages = error.errors.map((e) => `${e.field}: ${e.message}`);
      detail = `${detail} (${fieldMessages.join(', ')})`;
    }

    return {
      title: error.title,
      detail,
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
