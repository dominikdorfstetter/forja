import { describe, it, expect } from 'vitest';
import { v5 as uuidv5 } from 'uuid';
import type { ClerkUser } from '@/types/api';
import { buildUserNameMap, hasActiveFilters, timeframeFrom } from '../activityLogConfig';

const NOW = new Date('2026-03-10T12:00:00.000Z');
const CLERK_NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('timeframeFrom', () => {
  it('omits the lower bound for "all"', () => {
    expect(timeframeFrom('all', NOW)).toBeUndefined();
  });

  it.each([
    ['24h', '2026-03-09T12:00:00.000Z'],
    ['7d', '2026-03-03T12:00:00.000Z'],
    ['30d', '2026-02-08T12:00:00.000Z'],
  ] as const)('maps %s to an ISO from_date', (tf, expected) => {
    expect(timeframeFrom(tf, NOW)).toBe(expected);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the unfiltered default', () => {
    expect(hasActiveFilters({ action: '', entity: '', timeframe: 'all' })).toBe(false);
  });

  it.each([
    { action: 'create', entity: '', timeframe: 'all' as const },
    { action: '', entity: 'blog', timeframe: 'all' as const },
    { action: '', entity: '', timeframe: '7d' as const },
  ])('is true when any filter narrows the log (%o)', (filters) => {
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe('buildUserNameMap', () => {
  const user = (over: Partial<ClerkUser>) => ({ id: 'user_1', name: null, email: null, ...over }) as ClerkUser;

  it('returns an empty map when users are not loaded', () => {
    expect(buildUserNameMap(undefined).size).toBe(0);
  });

  it('keys users by the backend-derived v5 UUID and prefers name, then email, then id', () => {
    const map = buildUserNameMap([
      user({ id: 'user_a', name: 'Ada', email: 'ada@example.com' }),
      user({ id: 'user_b', email: 'bob@example.com' }),
      user({ id: 'user_c' }),
    ]);
    expect(map.get(uuidv5('user_a', CLERK_NS))).toBe('Ada');
    expect(map.get(uuidv5('user_b', CLERK_NS))).toBe('bob@example.com');
    expect(map.get(uuidv5('user_c', CLERK_NS))).toBe('user_c');
  });
});
