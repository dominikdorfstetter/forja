import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { updateSiteSettings } from '@/services/sites';
import type { SiteSettingsResponse } from '@/types/api';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_COLOR = '#ffffff';

/**
 * Theme/background colour drafts for the favicon manifest, wired into the
 * global save bar. Drafts follow the saved settings only while clean.
 */
export function useFaviconColors(siteId: string, settings: SiteSettingsResponse | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [themeColor, setThemeColor] = useState(DEFAULT_COLOR);
  const [bgColor, setBgColor] = useState(DEFAULT_COLOR);
  const [colorsDirty, setColorsDirty] = useState(false);

  const savedThemeColor = settings?.theme_color ?? DEFAULT_COLOR;
  const savedBgColor = settings?.background_color ?? DEFAULT_COLOR;

  // Sync colors from settings only while clean — otherwise the user's
  // pending edits would be clobbered by an incidental refetch.
  if (settings && !colorsDirty) {
    if (themeColor !== savedThemeColor) setThemeColor(savedThemeColor);
    if (bgColor !== savedBgColor) setBgColor(savedBgColor);
  }

  const { mutate: saveColors, isPending: saving } = useMutation({
    mutationFn: (data: { theme_color: string; background_color: string }) =>
      updateSiteSettings(siteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.favicon(siteId) });
      setColorsDirty(false);
      enqueueSnackbar(t('settings.favicon.colorsSaved'), { variant: 'success' });
    },
  });

  const handleSaveColors = useCallback(() => {
    saveColors({ theme_color: themeColor, background_color: bgColor });
  }, [saveColors, themeColor, bgColor]);

  const discardColorChanges = useCallback(() => {
    setThemeColor(savedThemeColor);
    setBgColor(savedBgColor);
    setColorsDirty(false);
  }, [savedThemeColor, savedBgColor]);

  useFormSaveBar({
    id: 'site-settings.favicon.colors',
    isDirty: colorsDirty,
    saving,
    onSave: handleSaveColors,
    onDiscard: discardColorChanges,
    saveTestId: 'site-settings.favicon.save-colors',
    discardTestId: 'site-settings.favicon.discard-colors',
  });

  const changeThemeColor = useCallback((value: string) => {
    setThemeColor(value);
    setColorsDirty(true);
  }, []);

  const changeBgColor = useCallback((value: string) => {
    setBgColor(value);
    setColorsDirty(true);
  }, []);

  return { themeColor, bgColor, changeThemeColor, changeBgColor };
}
