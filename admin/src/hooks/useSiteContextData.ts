import { useQuery } from '@tanstack/react-query';
import { getSiteContext } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import type { SiteContextResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_MODULES = {
  blog: true,
  pages: true,
  portfolio: false,
  legal: false,
  documents: false,
  ai: false,
  forms: false,
  collections: false,
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
  integration: {
    code_injection_head: '',
    code_injection_footer: '',
    seo_title_template: '{{title}} | {{site_name}}',
    seo_default_description: '',
    theme_color: '#ffffff',
    background_color: '#ffffff',
  },
};

export function useSiteContextData() {
  const { selectedSiteId } = useSiteContext();

  const query = useQuery({
    queryKey: queryKeys.siteContext(selectedSiteId),
    queryFn: () => getSiteContext(selectedSiteId),
    enabled: !!selectedSiteId,
    staleTime: 30_000,
  });

  return {
    ...query,
    context: query.data ?? DEFAULT_CONTEXT,
    modules: query.data?.modules ?? DEFAULT_MODULES,
  };
}
