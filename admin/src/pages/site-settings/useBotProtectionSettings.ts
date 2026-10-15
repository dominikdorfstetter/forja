import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { deleteSiteBotProtection, getSiteBotProtection, upsertSiteBotProtection } from '@/services/botProtection';
import type { BotProtectionMode, SiteBotProtectionResponse } from '@/types/api';
import {
  ALTCHA,
  REMOTE,
  draftFromConfig,
  upsertRequest,
  validateDraft,
  type BotProtectionDraft,
} from './botProtectionModel';
import { queryKeys } from '@/lib/queryKeys';

/**
 * State + server sync for the per-site bot-protection card: loads the saved
 * config, keeps an editable draft, and exposes save / discard / regenerate /
 * remove plus the derived "form shown" and "can save" flags.
 */
export function useBotProtectionSettings(siteId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const queryKey = queryKeys.siteBotProtection(siteId);
  const { data: config, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getSiteBotProtection(siteId),
    enabled: !!siteId,
  });

  const [draft, setDraft] = useState<BotProtectionDraft>(() => draftFromConfig(undefined));
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Focus the first revealed remote field when the admin switches to vendor
  // mode (a11y: keep keyboard users oriented after the layout changes).
  const verifyUrlRef = useRef<HTMLInputElement>(null);

  // When the loaded config changes, reset the form. The ref guard keeps us
  // from clobbering edits on background refetches.
  const prevConfigRef = useRef<SiteBotProtectionResponse | null | undefined>(undefined);
  useEffect(() => {
    if (config !== prevConfigRef.current) {
      prevConfigRef.current = config;
      setDraft(draftFromConfig(config));
      setEditing(!config); // unconfigured sites land straight into edit mode
      setIsDirty(false);
    }
  }, [config]);

  const notify = (message: string, variant: 'success' | 'error') =>
    enqueueSnackbar(message, { variant });

  const upsertMutation = useMutation({
    mutationFn: () => upsertSiteBotProtection(siteId, upsertRequest(draft)),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setDraft((d) => ({ ...d, secret: '' }));
      setIsDirty(false);
      setEditing(false);
      notify(t('siteSettings.forms.botProtection.saved', 'Bot protection saved.'), 'success');
    },
    onError: () => {
      notify(t('siteSettings.forms.botProtection.saveFailed', 'Saving bot protection failed.'), 'error');
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => upsertSiteBotProtection(siteId, { mode: ALTCHA, regenerate_key: true }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      notify(t('siteSettings.forms.botProtection.altcha.keyRegenerated', 'ALTCHA key regenerated.'), 'success');
    },
    onError: () => {
      notify(t('siteSettings.forms.botProtection.altcha.keyRegenerateFailed', 'Regenerating the key failed.'), 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSiteBotProtection(siteId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      setDraft(draftFromConfig(null));
      setEditing(true);
      setIsDirty(false);
      notify(t('siteSettings.forms.botProtection.removed', 'Bot protection removed.'), 'success');
    },
    onError: () => {
      notify(t('siteSettings.forms.botProtection.removeFailed', 'Removing bot protection failed.'), 'error');
    },
  });

  const changeMode = (mode: BotProtectionMode) => {
    setDraft((d) => ({ ...d, mode }));
    setIsDirty(true);
    if (mode === REMOTE) {
      // Defer focus until the revealed fields have rendered.
      requestAnimationFrame(() => verifyUrlRef.current?.focus());
    }
  };

  const changeField = (key: 'providerLabel' | 'verifyUrl' | 'secret', value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setIsDirty(true);
  };

  const validationError = validateDraft(draft, { isDirty, editing });

  // The edit form is shown whenever there is no *saved* config (unconfigured,
  // or the load errored leaving `config` undefined) or the admin explicitly
  // hit "Reconfigure". Deriving this from the absence of a saved config —
  // rather than the `editing` flag alone — guarantees the save bar appears for
  // a brand-new site even if the GET never resolved to a clean 404.
  const showForm = !config || editing;

  // ALTCHA can always be saved while the form is shown (enabling it needs no
  // input); remote requires valid, dirty fields.
  const canSave = draft.mode === ALTCHA ? showForm : !validationError && isDirty;

  const save = useCallback(() => {
    if (!canSave) return;
    upsertMutation.mutate();
  }, [canSave, upsertMutation]);

  const discard = useCallback(() => {
    setDraft(draftFromConfig(config));
    setIsDirty(false);
    if (config) setEditing(false);
  }, [config]);

  return {
    config,
    isLoading,
    isError,
    draft,
    isDirty,
    showSecret,
    toggleShowSecret: () => setShowSecret((s) => !s),
    verifyUrlRef,
    validationError,
    showForm,
    canSave,
    saving: upsertMutation.isPending,
    changeMode,
    changeField,
    startEditing: () => setEditing(true),
    save,
    discard,
    regenerateKey: () => regenerateMutation.mutate(),
    regenerating: regenerateMutation.isPending,
    remove: () => deleteMutation.mutate(),
    removing: deleteMutation.isPending,
  };
}

export type BotProtectionSettings = ReturnType<typeof useBotProtectionSettings>;
