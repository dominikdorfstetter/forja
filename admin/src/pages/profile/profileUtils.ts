import type { ProfileResponse } from '@/types/api';

type PermissionColor = 'error' | 'warning' | 'info' | 'success';

const PERMISSION_COLORS: Record<string, PermissionColor> = {
  Master: 'error',
  Admin: 'warning',
  Write: 'info',
  Read: 'success',
};

/** Palette colour for a permission level (unknown levels → undefined). */
export function permissionColor(permission: string | null | undefined): PermissionColor | undefined {
  return PERMISSION_COLORS[permission || 'Read'];
}

interface AuthIdentity {
  permission: string | null;
  userFullName: string | null;
  userImageUrl: string | null;
  userEmail: string | null;
}

export interface ProfileIdentity {
  /** Best known display name, or null when neither source has one. */
  displayName: string | null;
  imageUrl: string | undefined;
  email: string;
  role: string;
}

/** Merge the backend profile with the auth session, preferring the profile. */
export function resolveProfileIdentity(
  profile: ProfileResponse | undefined,
  auth: AuthIdentity,
): ProfileIdentity {
  return {
    displayName: profile?.name || auth.userFullName || null,
    imageUrl: profile?.image_url || auth.userImageUrl || undefined,
    email: profile?.email || auth.userEmail || '',
    role: profile?.role || auth.permission || 'read',
  };
}
