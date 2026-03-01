import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { resolveError } from '@/utils/errorResolver';

export function useErrorSnackbar() {
  const { enqueueSnackbar } = useSnackbar();

  const showError = useCallback(
    (error: unknown) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
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
