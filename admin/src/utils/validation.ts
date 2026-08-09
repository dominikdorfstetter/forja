import { z } from 'zod';
import type { FieldValues, ResolverResult, Resolver } from 'react-hook-form';

/**
 * Zod 4–compatible form resolver for react-hook-form.
 *
 * In Zod 4, `z.coerce.number()` creates a ZodPipe whose *input* type is
 * `unknown`. The third-party `zodResolver` picks up this input type, which
 * breaks forms that declare `useForm<FormData>()` with the *output* type.
 *
 * This resolver calls `schema.safeParse` directly and maps Zod issues to
 * react-hook-form `FieldErrors` — no unsafe type casts, no library mismatch.
 */
export function formResolver<T extends z.ZodType<FieldValues>>(
  schema: T,
): Resolver<z.output<T>> {
  type Output = z.output<T>;
  return async (values): Promise<ResolverResult<Output>> => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as Output, errors: {} };
    }
    const fieldErrors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join('.');
      if (path && !fieldErrors[path]) {
        fieldErrors[path] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: fieldErrors } as ResolverResult<Output>;
  };
}

export const slugField = z
  .string()
  .min(1, 'Required')
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers, and hyphens only');

export const urlField = z.url('Must be a valid URL');

export const optionalUrl = z
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.url('Must be a valid URL').optional());

export const positiveInt = z.coerce.number().int().min(1, 'Must be at least 1');

export const nonNegativeInt = z.coerce.number().int().min(0, 'Must be 0 or greater');

export const optionalString = (max: number) =>
  z.string().max(max).optional().or(z.literal(''));

export const requiredString = (max: number) =>
  z.string().min(1, 'Required').max(max);

export const siteIdsField = z
  .array(z.uuid())
  .min(1, 'At least one site is required');
