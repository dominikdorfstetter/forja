import { useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { slugField, requiredString, formResolver } from '@/utils/validation';
import { slugify } from '@/utils/slugify';

const scratchSchema = z.object({
  title: z.string().min(1, 'Required').max(500),
  slug: slugField,
  author: requiredString(200),
});
export type ScratchFormData = z.infer<typeof scratchSchema>;

/** "From scratch" form: title/slug/author with the slug following the title until edited by hand. */
export function useBlogScratchForm(userFullName: string | null) {
  const slugManuallyEdited = useRef(false);
  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm<ScratchFormData>({
    resolver: formResolver(scratchSchema),
    defaultValues: { title: '', slug: '', author: userFullName || '' },
    mode: 'onChange',
  });

  // Auto-sync slug from title when slug hasn't been manually edited
  const watchedTitle = watch('title');
  const prevTitle = useRef('');
  useEffect(() => {
    if (watchedTitle !== prevTitle.current) {
      prevTitle.current = watchedTitle;
      if (!slugManuallyEdited.current && watchedTitle) {
        setValue('slug', slugify(watchedTitle), { shouldValidate: true });
      }
    }
  });

  const resetScratch = useCallback(
    () => reset({ title: '', slug: '', author: userFullName || '' }),
    [reset, userFullName],
  );
  const markSlugEdited = useCallback(() => { slugManuallyEdited.current = true; }, []);

  return { register, handleSubmit, errors, resetScratch, markSlugEdited };
}
