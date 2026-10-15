import { describe, it, expect } from 'vitest';
import { daysUntilPurge, selectionToTargets, toTrashTarget, TRASH_RETENTION_DAYS } from '../trashItem';

describe('daysUntilPurge', () => {
  const now = new Date('2026-04-01T12:00:00Z');

  it('falls back to the full retention window when the deletion time is unknown', () => {
    expect(daysUntilPurge(null, now)).toBe(TRASH_RETENTION_DAYS);
    expect(daysUntilPurge(undefined, now)).toBe(TRASH_RETENTION_DAYS);
  });

  it('counts the remaining whole days, rounding partial days up', () => {
    expect(daysUntilPurge('2026-04-01T12:00:00Z', now)).toBe(30);
    expect(daysUntilPurge('2026-03-20T10:00:00Z', now)).toBe(18);
  });

  it('never goes negative once the purge date has passed', () => {
    expect(daysUntilPurge('2026-01-01T00:00:00Z', now)).toBe(0);
  });
});

describe('trash targets', () => {
  const items = [
    { id: 'a', entity_type: 'blog' },
    { id: 'b', entity_type: 'media' },
  ];

  it('maps an item to its restore/delete target', () => {
    expect(toTrashTarget(items[1])).toEqual({ id: 'b', entityType: 'media' });
  });

  it('resolves selected ids to targets, defaulting unknown ids to content', () => {
    expect(selectionToTargets(new Set(['b', 'zzz']), items)).toEqual([
      { id: 'b', entityType: 'media' },
      { id: 'zzz', entityType: 'content' },
    ]);
  });
});
