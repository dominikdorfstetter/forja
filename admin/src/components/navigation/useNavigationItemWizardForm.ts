import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNavigationItemLocalizations } from '@/services/navigation';
import type { NavigationItem } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  LAST_WIZARD_STEP,
  getInitialItemOptions,
  getInitialLinkTarget,
  titlesFromLocalizations,
  type ItemOptionFields,
  type LinkTargetFields,
  type LinkType,
} from './navigationItemWizardModel';

interface UseNavigationItemWizardFormArgs {
  open: boolean;
  item?: NavigationItem | null;
  defaultLinkType: LinkType;
}

/**
 * Wizard form state: step position, link target, per-locale titles and
 * options. The owning dialog calls `resetForm` when it opens; in edit mode
 * titles are loaded from the item's stored localizations while `open`.
 */
export function useNavigationItemWizardForm({ open, item, defaultLinkType }: UseNavigationItemWizardFormArgs) {
  const [activeStep, setActiveStep] = useState(0);
  const [target, setTarget] = useState<LinkTargetFields>(() => getInitialLinkTarget(null, defaultLinkType));
  const [activeLocaleTab, setActiveLocaleTab] = useState(0);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<ItemOptionFields>(() => getInitialItemOptions(null));

  const { data: existingLocalizations } = useQuery({
    queryKey: queryKeys.navigationLocalizations(item?.id),
    queryFn: () => getNavigationItemLocalizations(item!.id),
    enabled: !!item?.id && open,
  });

  /** Re-seed every field from `item` (or blank for create); call when the dialog opens. */
  const resetForm = useCallback(() => {
    setTarget(getInitialLinkTarget(item, defaultLinkType));
    setOptions(getInitialItemOptions(item));
    // Edit mode keeps titles: they are loaded from existingLocalizations below
    if (!item) setTitles({});
    setActiveStep(0);
    setActiveLocaleTab(0);
  }, [item, defaultLinkType]);

  // Populate titles from fetched localizations (edit mode)
  const prevLocRef = useRef<string | undefined>(undefined);
  const locKey = existingLocalizations?.map((l) => `${l.locale_id}:${l.title}`).join(',');
  useEffect(() => {
    if (locKey && locKey !== prevLocRef.current && existingLocalizations) {
      setTitles(titlesFromLocalizations(existingLocalizations));
    }
    prevLocRef.current = locKey;
  }, [locKey, existingLocalizations]);

  const updateTarget = useCallback((patch: Partial<LinkTargetFields>) => {
    setTarget((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateOptions = useCallback((patch: Partial<ItemOptionFields>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateTitle = useCallback((localeId: string, value: string) => {
    setTitles((prev) => ({ ...prev, [localeId]: value }));
  }, []);

  const goNext = useCallback(() => {
    setActiveStep((s) => Math.min(s + 1, LAST_WIZARD_STEP));
  }, []);

  const goBack = useCallback(() => {
    setActiveStep((s) => Math.max(s - 1, 0));
  }, []);

  return {
    resetForm,
    activeStep,
    goNext,
    goBack,
    target,
    updateTarget,
    titles,
    updateTitle,
    activeLocaleTab,
    setActiveLocaleTab,
    options,
    updateOptions,
  };
}
