import { describe, it, expect } from 'vitest';
import { checklistDismissedKey, focusCardFilter, hasEntries, hasNoSites } from '../dashboardHomeUtils';

describe('hasNoSites', () => {
  it('waits for the site list before deciding', () => {
    expect(hasNoSites(true, undefined)).toBe(false);
    expect(hasNoSites(true, [])).toBe(false);
  });

  it('is true once loaded with no sites', () => {
    expect(hasNoSites(false, undefined)).toBe(true);
    expect(hasNoSites(false, [])).toBe(true);
  });

  it('is false when the user has a site', () => {
    expect(hasNoSites(false, [{ id: 'site-1' }])).toBe(false);
  });
});

describe('focusCardFilter', () => {
  it('highlights no tile for the default attention feed', () => {
    expect(focusCardFilter('attention')).toBeNull();
  });

  it.each(['review', 'drafts', 'scheduled'] as const)('passes %s through', (filter) => {
    expect(focusCardFilter(filter)).toBe(filter);
  });
});

describe('hasEntries', () => {
  it('treats missing and empty lists as empty', () => {
    expect(hasEntries(undefined)).toBe(false);
    expect(hasEntries([])).toBe(false);
    expect(hasEntries([1])).toBe(true);
  });
});

describe('checklistDismissedKey', () => {
  it('scopes the dismissal flag per site', () => {
    expect(checklistDismissedKey('site-1')).toBe('forja_checklist_dismissed_site-1');
  });
});
