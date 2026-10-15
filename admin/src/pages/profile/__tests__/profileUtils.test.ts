import { describe, it, expect } from 'vitest';
import type { ProfileResponse } from '@/types/api';
import { permissionColor, resolveProfileIdentity } from '../profileUtils';

const noSession = { permission: null, userFullName: null, userImageUrl: null, userEmail: null };

describe('permissionColor', () => {
  it.each([
    ['Master', 'error'],
    ['Admin', 'warning'],
    ['Write', 'info'],
    ['Read', 'success'],
  ])('maps %s to %s', (permission, color) => {
    expect(permissionColor(permission)).toBe(color);
  });

  it('treats a missing permission as Read', () => {
    expect(permissionColor(null)).toBe('success');
  });

  it('returns undefined for unknown levels so callers pick their fallback', () => {
    expect(permissionColor('Custom')).toBeUndefined();
  });
});

describe('resolveProfileIdentity', () => {
  it('prefers the backend profile over the auth session', () => {
    const profile = {
      name: 'Profile Name',
      image_url: 'https://img/profile.png',
      email: 'profile@example.com',
      role: 'admin',
    } as ProfileResponse;
    const identity = resolveProfileIdentity(profile, {
      permission: 'Write',
      userFullName: 'Session Name',
      userImageUrl: 'https://img/session.png',
      userEmail: 'session@example.com',
    });
    expect(identity).toEqual({
      displayName: 'Profile Name',
      imageUrl: 'https://img/profile.png',
      email: 'profile@example.com',
      role: 'admin',
    });
  });

  it('falls back to the auth session, then to neutral defaults', () => {
    expect(
      resolveProfileIdentity(undefined, {
        permission: 'Write',
        userFullName: 'Session Name',
        userImageUrl: null,
        userEmail: 'session@example.com',
      }),
    ).toEqual({ displayName: 'Session Name', imageUrl: undefined, email: 'session@example.com', role: 'Write' });

    expect(resolveProfileIdentity(undefined, noSession)).toEqual({
      displayName: null,
      imageUrl: undefined,
      email: '',
      role: 'read',
    });
  });
});
