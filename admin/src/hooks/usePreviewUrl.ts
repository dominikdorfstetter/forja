import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSiteContext } from '@/store/SiteContext';
import { getPreviewToken } from '@/services/sites';
import type { SiteSettingsResponse, PreviewTemplate } from '@/types/api';

export function usePreviewUrl() {
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();

  const settings = queryClient.getQueryData<SiteSettingsResponse>(['site-settings', selectedSiteId]);
  const templates: PreviewTemplate[] = useMemo(
    () => settings?.preview_templates ?? [],
    [settings?.preview_templates],
  );
  const hasPreview = templates.length > 0;

  const openPreview = useCallback(async (path?: string, templateUrl?: string) => {
    const url = templateUrl ?? (templates.length === 1 ? templates[0].url : undefined);
    if (!url || !selectedSiteId) return;

    const cleanBase = url.replace(/\/+$/, '');
    const cleanPath = path ? '/preview' + (path.startsWith('/') ? path : '/' + path) : '';

    try {
      const { token } = await getPreviewToken(selectedSiteId);
      const separator = cleanPath.includes('?') ? '&' : '?';
      window.open(`${cleanBase}${cleanPath}${separator}token=${encodeURIComponent(token)}`, '_blank');
    } catch {
      // Fall back to direct URL without token if token generation fails
      window.open(cleanBase + (path ? '/' + path.replace(/^\/+/, '') : ''), '_blank');
    }
  }, [templates, selectedSiteId]);

  return { templates, hasPreview, openPreview };
}
