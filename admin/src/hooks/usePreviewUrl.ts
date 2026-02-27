import { useQueryClient } from '@tanstack/react-query';
import { useSiteContext } from '@/store/SiteContext';
import type { SiteSettingsResponse, PreviewTemplate } from '@/types/api';

export function usePreviewUrl() {
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();

  const settings = queryClient.getQueryData<SiteSettingsResponse>(['site-settings', selectedSiteId]);
  const templates: PreviewTemplate[] = settings?.preview_templates ?? [];
  const hasPreview = templates.length > 0;

  const openPreview = (path?: string, templateUrl?: string) => {
    const url = templateUrl ?? (templates.length === 1 ? templates[0].url : undefined);
    if (!url) return;

    const cleanBase = url.replace(/\/+$/, '');
    const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';
    window.open(cleanBase + cleanPath, '_blank');
  };

  return { templates, hasPreview, openPreview };
}
