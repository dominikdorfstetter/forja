import { z } from 'zod';
import { requiredString, slugField, siteIdsField, nonNegativeInt } from '@/utils/validation';
import { PAGE_TYPES } from '@/utils/enumValues';

// Issue #623 Slice 4: shape sourced from generated types; Zod for refinements.

const step1Schema = z.object({
  page_type: z.enum(PAGE_TYPES),
});

const step2Schema = z.object({
  route: requiredString(255),
  slug: slugField,
});

const step3Schema = z.object({
  site_ids: siteIdsField,
  is_in_navigation: z.boolean(),
  navigation_order: z.union([nonNegativeInt, z.literal('')]),
});

export const wizardSchema = step1Schema.merge(step2Schema).merge(step3Schema);

export type WizardFormData = z.infer<typeof wizardSchema>;
