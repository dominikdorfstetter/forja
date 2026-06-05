import type { FormSubmissionStatus } from '@/types/api';

/** Display + iteration order for submission statuses (filters, pills). */
export const SUBMISSION_STATUSES: readonly FormSubmissionStatus[] = [
  'new',
  'in_review',
  'resolved',
  'rejected',
  'archived',
];

/**
 * Allowed status transitions. This MUST mirror the backend state machine in
 * `backend/src/repos/form_submission_repo.rs::is_valid_transition` — the
 * server is the source of truth and rejects anything not listed here with
 * HTTP 400. The UI only offers these so a transition never "bounces back".
 *
 *   new      → in_review, rejected
 *   in_review → resolved, rejected
 *   resolved → archived
 *   rejected → archived
 *   archived → (terminal)
 */
export const STATUS_TRANSITIONS: Record<
  FormSubmissionStatus,
  readonly FormSubmissionStatus[]
> = {
  new: ['in_review', 'rejected'],
  in_review: ['resolved', 'rejected'],
  resolved: ['archived'],
  rejected: ['archived'],
  archived: [],
};

/** Valid next statuses for a submission currently in `current`. */
export function nextStatuses(
  current: FormSubmissionStatus,
): readonly FormSubmissionStatus[] {
  return STATUS_TRANSITIONS[current];
}

/** Color tones for the status pill (CSS custom properties with fallbacks). */
export const STATUS_TONES: Record<
  FormSubmissionStatus,
  { bg: string; fg: string }
> = {
  new: { bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
  in_review: { bg: 'var(--warn-container, #fff3cd)', fg: 'var(--on-warn-container, #664d03)' },
  resolved: { bg: 'var(--success-container, #d6f5dd)', fg: 'var(--on-success-container, #0f5132)' },
  rejected: { bg: 'var(--err-container, #f9dedc)', fg: 'var(--on-err-container, #410e0b)' },
  archived: { bg: 'var(--surface-container-high)', fg: 'var(--on-surface-variant)' },
};
