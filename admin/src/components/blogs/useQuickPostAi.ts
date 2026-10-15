import type { Dispatch, RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSiteLocales } from '@/services/siteLocales';
import { useSiteContext } from '@/store/SiteContext';
import { queryKeys } from '@/lib/queryKeys';
import { defaultLocaleInfo } from './aiDraftRequests';
import { regeneratedActions, type QuickPostAction, type QuickPostState } from './quickPostState';
import { useAiDraftFlow, type AiDraftAdapter } from './useAiDraftFlow';

const QUICK_POST_AI: AiDraftAdapter<QuickPostState, QuickPostAction> = {
  idea: (state) => state.idea,
  draft: (state) => state,
  setOutline: (value) => ({ type: 'SET_OUTLINE', value }),
  regenerated: regeneratedActions,
};

/** AI drafting flow for the quick-post dialog; generation runs in the site's default locale. */
export function useQuickPostAi(
  stateRef: RefObject<QuickPostState>,
  dispatch: Dispatch<QuickPostAction>,
) {
  const { selectedSiteId } = useSiteContext();
  const { data: siteLocales } = useQuery({
    queryKey: queryKeys.siteLocales(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const defaultLocale = defaultLocaleInfo(siteLocales);
  const flow = useAiDraftFlow(stateRef, dispatch, defaultLocale.code, QUICK_POST_AI);

  return { ...flow, defaultLocaleName: defaultLocale.name };
}

export type QuickPostAi = ReturnType<typeof useQuickPostAi>;
