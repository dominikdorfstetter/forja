import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { resolveError } from '@/utils/errorResolver';

export function useErrorSnackbar() {
  const { enqueueSnackbar } = useSnackbar();

  const showError = useCallback(
    (error: unknown) => {
      const { detail, title, action } = resolveError(error);
      const base = detail || title;
      const message = action ? `${base} ${action}` : base;
      enqueueSnackbar(message, { variant: 'error' });
    },
    [enqueueSnackbar],
  );

  const showSuccess = useCallback(
    (message: string) => {
      enqueueSnackbar(message, { variant: 'success' });
    },
    [enqueueSnackbar],
  );

  return { showError, showSuccess, enqueueSnackbar };
}
