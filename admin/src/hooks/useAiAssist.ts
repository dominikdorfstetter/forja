import { useMutation, useQuery } from '@tanstack/react-query';
import { generateAiContent, getAiConfig } from '@/services/ai';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import type {
  AiAction,
  AiGenerateResponse,
  BlogTagContext,
  SectionContext,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

export interface GenerateOptions {
  targetLocale?: string;
  sectionContext?: SectionContext;
  blogTagContext?: BlogTagContext;
}

export function useAiAssist() {
  const { selectedSiteId } = useSiteContext();
  const { modules } = useSiteContextData();
  const moduleEnabled = modules.ai;

  const configQuery = useQuery({
    queryKey: queryKeys.aiConfig(selectedSiteId),
    queryFn: () => getAiConfig(selectedSiteId),
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
      sectionContext,
      blogTagContext,
    }: {
      action: AiAction;
      content: string;
      targetLocale?: string;
      sectionContext?: SectionContext;
      blogTagContext?: BlogTagContext;
    }) =>
      generateAiContent(selectedSiteId, {
        action,
        content,
        target_locale: targetLocale,
        section_context: sectionContext,
        blog_tag_context: blogTagContext,
      }),
  });

  const generate = async (
    action: AiAction,
    content: string,
    optionsOrLocale?: string | GenerateOptions,
  ): Promise<AiGenerateResponse> => {
    const opts: GenerateOptions =
      typeof optionsOrLocale === 'string'
        ? { targetLocale: optionsOrLocale }
        : optionsOrLocale ?? {};
    return generateMutation.mutateAsync({
      action,
      content,
      targetLocale: opts.targetLocale,
      sectionContext: opts.sectionContext,
      blogTagContext: opts.blogTagContext,
    });
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
