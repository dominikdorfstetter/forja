import { describe, it, expect } from 'vitest';
import {
  SUBMISSION_STATUSES,
  STATUS_TONES,
  nextStatuses,
} from '@/utils/submissionStatus';

describe('submissionStatus state machine', () => {
  it('offers the legal next states the backend accepts', () => {
    // Mirrors backend is_valid_transition — if this drifts, the UI will
    // offer transitions the server rejects with HTTP 400.
    expect(nextStatuses('new')).toEqual(['in_review', 'rejected']);
    expect(nextStatuses('in_review')).toEqual(['resolved', 'rejected']);
    expect(nextStatuses('resolved')).toEqual(['archived']);
    expect(nextStatuses('rejected')).toEqual(['archived']);
  });

  it('treats archived as terminal (no further transitions)', () => {
    expect(nextStatuses('archived')).toEqual([]);
  });

  it('never offers a transition back into "new"', () => {
    for (const s of SUBMISSION_STATUSES) {
      expect(nextStatuses(s)).not.toContain('new');
    }
  });

  it('has a tone for every status', () => {
    for (const s of SUBMISSION_STATUSES) {
      expect(STATUS_TONES[s]).toBeDefined();
    }
  });
});
