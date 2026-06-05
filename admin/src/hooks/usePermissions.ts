import { useMemo, useCallback } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';

/**
 * Check if a permission string matches any entry in a permission set.
 *
 * When checking an unscoped permission like "blog:update", also matches
 * scoped variants ("blog:update:own", "blog:update:any", "blog:update:published").
 */
function matchesPermission(permissions: Set<string>, permission: string): boolean {
  if (permissions.has(permission)) return true;

  // For unscoped permissions (no second colon after resource:action),
  // check if any scoped variant exists
  const parts = permission.split(':');
  if (parts.length === 2) {
    const base = permission;
    return (
      permissions.has(`${base}:own`) ||
      permissions.has(`${base}:any`) ||
      permissions.has(`${base}:published`)
    );
  }

  return false;
}

/**
 * Permission-based access control hook.
 *
 * Resolves the current user's permissions for the selected site from the
 * API-provided permission set (returned in /auth/me memberships). Replaces
 * role-rank comparisons with granular permission checks.
 */
export function usePermissions() {
  const { memberships, isSystemAdmin } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const permissions = useMemo(() => {
    if (!selectedSiteId || !memberships) return new Set<string>();

    const membership = memberships.find((m) => m.site_id === selectedSiteId);
    if (!membership) return new Set<string>();

    return new Set(membership.permissions ?? []);
  }, [selectedSiteId, memberships]);

  /** Check if user has a specific permission (with scoped variant matching) */
  const can = useCallback(
    (permission: string): boolean => {
      if (isSystemAdmin) return true;
      return matchesPermission(permissions, permission);
    },
    [permissions, isSystemAdmin],
  );

  /** Check if user has ANY of the listed permissions */
  const canAny = useCallback(
    (...perms: string[]): boolean => {
      if (isSystemAdmin) return true;
      return perms.some((p) => matchesPermission(permissions, p));
    },
    [permissions, isSystemAdmin],
  );

  /** Check if user has ALL of the listed permissions */
  const canAll = useCallback(
    (...perms: string[]): boolean => {
      if (isSystemAdmin) return true;
      return perms.every((p) => matchesPermission(permissions, p));
    },
    [permissions, isSystemAdmin],
  );

  // Convenience booleans (backward-compatible with existing AuthContext)
  const canWrite = can('blog:create');
  const isAdmin = canAny('settings:update', 'settings:read');
  const canManageMembers = can('member:invite');
  const canEditAll = can('blog:update:any');
  const canPublish = can('blog:publish');
  const canReview = can('blog:review');

  return {
    permissions,
    can,
    canAny,
    canAll,
    canWrite,
    isAdmin,
    canManageMembers,
    canEditAll,
    canPublish,
    canReview,
  };
}
