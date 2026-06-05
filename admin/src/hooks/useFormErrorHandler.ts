import { useCallback } from 'react';
import { type FieldValues, type UseFormSetError, type Path } from 'react-hook-form';
import { resolveError, type ResolvedError } from '@/utils/errorResolver';

/**
 * Maps server-side field errors from ProblemDetails to React Hook Form's
 * setError, enabling inline field validation from backend responses.
 *
 * Usage:
 *   const { setError } = useForm<MyForm>();
 *   const handleFormError = useFormErrorHandler(setError);
 *
 *   const mutation = useMutation({
 *     mutationFn: ...,
 *     onError: (err) => {
 *       const resolved = handleFormError(err);
 *       showError(err); // still show snackbar
 *     },
 *   });
 */
export function useFormErrorHandler<T extends FieldValues>(
  setError: UseFormSetError<T>,
) {
  return useCallback(
    (error: unknown): ResolvedError => {
      const resolved = resolveError(error);

      if (resolved.fieldErrors) {
        for (const { field, message } of resolved.fieldErrors) {
          setError(field as Path<T>, { type: 'server', message });
        }
      }

      return resolved;
    },
    [setError],
  );
}
