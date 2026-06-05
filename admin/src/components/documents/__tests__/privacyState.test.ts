import { describe, expect, it } from 'vitest';
import {
  classifyPrivacyState,
  ttlPresetToIso,
  TTL_PRESETS,
} from '../privacyState';

const FROZEN_NOW = new Date('2026-05-15T12:00:00Z');

describe('classifyPrivacyState', () => {
  it('returns "public" when is_private is false', () => {
    expect(classifyPrivacyState({ is_private: false }, FROZEN_NOW)).toBe('public');
  });

  it('returns "active" for a private doc with no expiry', () => {
    expect(classifyPrivacyState({ is_private: true }, FROZEN_NOW)).toBe('active');
  });

  it('returns "expired" when expiry is in the past', () => {
    expect(
      classifyPrivacyState(
        {
          is_private: true,
          private_access_expires_at: '2026-05-15T11:00:00Z',
        },
        FROZEN_NOW,
      ),
    ).toBe('expired');
  });

  it('returns "expiring" within the warning window', () => {
    expect(
      classifyPrivacyState(
        {
          is_private: true,
          private_access_expires_at: '2026-05-15T12:30:00Z',
        },
        FROZEN_NOW,
      ),
    ).toBe('expiring');
  });

  it('returns "active" when expiry is far in the future', () => {
    expect(
      classifyPrivacyState(
        {
          is_private: true,
          private_access_expires_at: '2026-06-15T12:00:00Z',
        },
        FROZEN_NOW,
      ),
    ).toBe('active');
  });

  it('returns "locked" when private_locked_until is set, even past expiry', () => {
    expect(
      classifyPrivacyState(
        {
          is_private: true,
          private_locked_until: '9999-12-31T23:59:59Z',
          private_access_expires_at: '2026-05-15T11:00:00Z',
        },
        FROZEN_NOW,
      ),
    ).toBe('locked');
  });
});

describe('ttlPresetToIso', () => {
  it('returns null for the "never" preset', () => {
    expect(ttlPresetToIso('never', FROZEN_NOW)).toBeNull();
  });

  it.each([
    ['1h', '2026-05-15T13:00:00.000Z'],
    ['24h', '2026-05-16T12:00:00.000Z'],
    ['7d', '2026-05-22T12:00:00.000Z'],
  ])('computes %s correctly', (key, expected) => {
    expect(ttlPresetToIso(key, FROZEN_NOW)).toBe(expected);
  });

  it('returns null for an unknown preset key', () => {
    expect(ttlPresetToIso('forever', FROZEN_NOW)).toBeNull();
  });

  it('exposes all six preset keys', () => {
    expect(TTL_PRESETS.map((p) => p.key)).toEqual([
      'never',
      '1h',
      '6h',
      '24h',
      '7d',
      '30d',
    ]);
  });
});
