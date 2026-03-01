import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useErrorSnackbar } from './useErrorSnackbar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface MutationConfig<TInput, TResult = any> {
  mutationFn: (input: TInput) => Promise<TResult>;
  successMessage: string;
  onSuccess?: (result: TResult) => void;
}

interface CrudMutationOptions<TCreate, TUpdate> {
  queryKey: string | string[];
  additionalInvalidations?: string[][];
  create?: MutationConfig<TCreate>;
  update?: MutationConfig<{ id: string; data: TUpdate }>;
  delete?: MutationConfig<string>;
}

export function useCrudMutations<TCreate, TUpdate>(
  options: CrudMutationOptions<TCreate, TUpdate>,
) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const invalidate = () => {
    const key = Array.isArray(options.queryKey) ? options.queryKey : [options.queryKey];
    queryClient.invalidateQueries({ queryKey: key });
    options.additionalInvalidations?.forEach((k) =>
      queryClient.invalidateQueries({ queryKey: k }),
    );
  };

  const createMutation = useMutation({
    mutationFn: options.create?.mutationFn ?? ((() => Promise.resolve()) as never),
    onSuccess: (result) => {
      invalidate();
      if (options.create) {
        showSuccess(options.create.successMessage);
        options.create.onSuccess?.(result);
      }
    },
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: options.update?.mutationFn ?? ((() => Promise.resolve()) as never),
    onSuccess: (result) => {
      invalidate();
      if (options.update) {
        showSuccess(options.update.successMessage);
        options.update.onSuccess?.(result);
      }
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: options.delete?.mutationFn ?? ((() => Promise.resolve()) as never),
    onSuccess: (result) => {
      invalidate();
      if (options.delete) {
        showSuccess(options.delete.successMessage);
        options.delete.onSuccess?.(result);
      }
    },
    onError: showError,
  });

  return { createMutation, updateMutation, deleteMutation };
}
