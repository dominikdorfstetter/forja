import { z } from 'zod';

export const slugField = z
  .string()
  .min(1, 'Required')
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers, and hyphens only');

export const urlField = z.string().url('Must be a valid URL');

export const optionalUrl = z
  .string()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().url('Must be a valid URL').optional());

export const emailField = z.string().min(1, 'Required').email('Must be a valid email');

export const positiveInt = z.coerce.number().int().min(1, 'Must be at least 1');

export const nonNegativeInt = z.coerce.number().int().min(0, 'Must be 0 or greater');

export const optionalString = (max: number) =>
  z.string().max(max).optional().or(z.literal(''));

export const requiredString = (max: number) =>
  z.string().min(1, 'Required').max(max);

export const siteIdsField = z
  .array(z.string().uuid())
  .min(1, 'At least one site is required');
