import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClerkUsers } from '@/services/clerkUsers';

/**
 * Resolves a raw Clerk user id (e.g. `user_2abc…`, as stored in
 * `changed_by` / `author_id`) to a human-friendly display name.
 *
 * Shares the `['clerk-users']` query cache with other callers so the
 * directory is fetched once per session. `/clerk/users` is admin-gated;
 * for users who can't list it the query 403s and the resolver falls back
 * to the raw id — no worse than showing the id we already have.
 */
export function useClerkUserNames() {
  const { data } = useQuery({
    queryKey: ['clerk-users'],
    queryFn: () => getClerkUsers({ limit: 200 }),
    retry: false,
  });

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of data?.data ?? []) {
      map.set(u.id, u.name || u.email || u.id);
    }
    return map;
  }, [data]);

  return (clerkId: string | null | undefined): string | undefined =>
    clerkId ? (byId.get(clerkId) ?? clerkId) : undefined;
}
