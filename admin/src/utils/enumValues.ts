import type { ContentStatus, PageType, ProjectLinkType } from '@/types/api';

// Slice 4 of issue #623: Zod schemas need runtime arrays for `z.enum(...)`,
// but the generated TS unions exist only at compile-time. We pin the arrays
// with `satisfies` so any backend enum change breaks `tsc --noEmit` here
// before drifting into the Zod schemas.
//
// Each array is typed as `readonly [T, ...T[]]` so `z.enum(...)` keeps its
// tuple-narrowing semantics. The `satisfies` check verifies element types
// exactly match the spec union — no missing values, no extras.

export const CONTENT_STATUSES = [
  'Draft',
  'InReview',
  'Scheduled',
  'Published',
  'Archived',
] as const satisfies readonly ContentStatus[];

export const PAGE_TYPES = [
  'Static',
  'Landing',
  'Contact',
  'BlogIndex',
  'Custom',
] as const satisfies readonly PageType[];

export const PROJECT_LINK_TYPES = [
  'Source',
  'Demo',
  'Documentation',
  'Website',
  'Other',
] as const satisfies readonly ProjectLinkType[];
