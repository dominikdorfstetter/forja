import type { ContentStatus } from '@/types/api';

export type ContentEntityKind = 'blog' | 'page' | 'legal';

export interface TransitionRules {
  canPublishFrom: readonly ContentStatus[];
  canUnpublishFrom: readonly ContentStatus[];
  canArchiveFrom: readonly ContentStatus[];
  canRestoreFrom: readonly ContentStatus[];
  supportsClone: boolean;
}

const blogPageRules: TransitionRules = {
  canPublishFrom: ['Draft', 'Scheduled'],
  canUnpublishFrom: ['Published', 'Scheduled'],
  canArchiveFrom: ['Published', 'Scheduled'],
  canRestoreFrom: ['Archived'],
  supportsClone: true,
};

const legalRules: TransitionRules = {
  canPublishFrom: ['Draft', 'InReview'],
  canUnpublishFrom: ['Published'],
  canArchiveFrom: ['Draft', 'InReview', 'Scheduled', 'Published'],
  canRestoreFrom: ['Archived'],
  supportsClone: false,
};

export const transitionsByKind: Record<ContentEntityKind, TransitionRules> = {
  blog: blogPageRules,
  page: blogPageRules,
  legal: legalRules,
};
