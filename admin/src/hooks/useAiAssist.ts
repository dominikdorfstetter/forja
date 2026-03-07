import { useMutation, useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type { AiAction, AiGenerateResponse } from '@/types/api';

export function useAiAssist() {
  const { selectedSiteId } = useSiteContext();
  const { modules } = useSiteContextData();
  const moduleEnabled = modules.ai;

  const configQuery = useQuery({
    queryKey: ['ai-config', selectedSiteId],
    queryFn: () => apiService.getAiConfig(selectedSiteId),
    // Only query if the AI module is enabled for this site
    enabled: !!selectedSiteId && moduleEnabled,
    retry: false,
    staleTime: 60_000,
  });

  const isConfigured = moduleEnabled && configQuery.isSuccess && !!configQuery.data;

  const generateMutation = useMutation({
    mutationFn: ({
      action,
      content,
      targetLocale,
    }: {
      action: AiAction;
      content: string;
      targetLocale?: string;
    }) =>
      apiService.generateAiContent(selectedSiteId, {
        action,
        content,
        target_locale: targetLocale,
      }),
  });

  const generate = async (
    action: AiAction,
    content: string,
    targetLocale?: string,
  ): Promise<AiGenerateResponse> => {
    return generateMutation.mutateAsync({ action, content, targetLocale });
  };

  return {
    isConfigured,
    isLoading: configQuery.isLoading,
    generate,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
    reset: generateMutation.reset,
  };
}
