import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { SiteContextResponse } from '@/types/api';

const DEFAULT_MODULES = {
  blog: true,
  pages: true,
  cv: false,
  legal: false,
  documents: false,
  ai: false,
};

const DEFAULT_CONTEXT: SiteContextResponse = {
  member_count: 0,
  current_user_role: 'viewer',
  features: {
    editorial_workflow: false,
    scheduling: true,
    versioning: true,
    analytics: false,
  },
  suggestions: { show_team_workflow_prompt: false },
  modules: DEFAULT_MODULES,
};

export function useSiteContextData() {
  const { selectedSiteId } = useSiteContext();

  const query = useQuery({
    queryKey: ['siteContext', selectedSiteId],
    queryFn: () => apiService.getSiteContext(selectedSiteId),
    enabled: !!selectedSiteId,
    staleTime: 30_000,
  });

  return {
    ...query,
    context: query.data ?? DEFAULT_CONTEXT,
    modules: query.data?.modules ?? DEFAULT_MODULES,
  };
}
