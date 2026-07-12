import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Alert } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getSiteSettings, updateSiteSettings } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import HighlightedCodeEditor from '@/components/shared/HighlightedCodeEditor';
import { useSiteContext } from '@/store/SiteContext';
import {
  SectionHead,
  SettingsCard,
  Field,
} from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { queryKeys } from '@/lib/queryKeys';

const MAX_CHARS = 10_000;

export default function CodeInjectionPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [headCode, setHeadCode] = useState('');
  const [footerCode, setFooterCode] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.siteSettings(selectedSiteId),
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const prevSettingsRef = useRef<typeof settings>(undefined);
  useEffect(() => {
    if (settings && settings !== prevSettingsRef.current) {
      prevSettingsRef.current = settings;
      setHeadCode(settings.code_injection_head ?? '');
      setFooterCode(settings.code_injection_footer ?? '');
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: { code_injection_head: string; code_injection_footer: string }) =>
      updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(selectedSiteId) });
      setIsDirty(false);
      enqueueSnackbar(t('settings.codeInjection.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.codeInjection.saveFailed'), { variant: 'error' });
    },
  });

  const handleSave = useCallback(() => {
    mutation.mutate({
      code_injection_head: headCode,
      code_injection_footer: footerCode,
    });
  }, [headCode, footerCode, mutation]);

  const discardChanges = useCallback(() => {
    setHeadCode(settings?.code_injection_head ?? '');
    setFooterCode(settings?.code_injection_footer ?? '');
    setIsDirty(false);
  }, [settings]);

  const headOverLimit = headCode.length > MAX_CHARS;
  const footerOverLimit = footerCode.length > MAX_CHARS;
  const charsLabel = t('settings.codeInjection.chars');

  useFormSaveBar({
    id: 'site-settings.code-injection',
    isDirty: isDirty,
    saving: mutation.isPending || headOverLimit || footerOverLimit,
    onSave: handleSave,
    onDiscard: discardChanges,
    saveTestId: 'site-settings.code-injection.save',
    discardTestId: 'site-settings.code-injection.discard',
  });

  if (isLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  return (
    <Box data-testid="site-settings.code-injection.page">
      <SectionHead
        icon="code"
        title={t('siteSettings.codeInjection.title', 'Code injection')}
        subtitle={t(
          'siteSettings.codeInjection.subtitle',
          'Inject custom HTML into the page. Only scripts from trusted sources, please.',
        )}
      />

      <Alert
        severity="warning"
        icon={<WarningAmberIcon />}
        data-testid="site-settings.code-injection.warning"
        sx={{ mb: 3, borderRadius: 3 }}
      >
        {t('settings.codeInjection.warning')}
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsCard>
          <Field
            fieldId="headCode"
            label={t('settings.codeInjection.headTitle')}
            hint={t('settings.codeInjection.headDescription')}
          >
            <HighlightedCodeEditor
              value={headCode}
              onChange={(val) => {
                setHeadCode(val);
                setIsDirty(true);
              }}
              placeholder={t('settings.codeInjection.headPlaceholder')}
              maxLength={MAX_CHARS}
              error={headOverLimit}
              helperText={`${headCode.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()} ${charsLabel}`}
              language="xml"
              data-testid="site-settings.code-injection.head-input"
            />
          </Field>
        </SettingsCard>

        <SettingsCard>
          <Field
            fieldId="footerCode"
            label={t('settings.codeInjection.footerTitle')}
            hint={t('settings.codeInjection.footerDescription')}
          >
            <HighlightedCodeEditor
              value={footerCode}
              onChange={(val) => {
                setFooterCode(val);
                setIsDirty(true);
              }}
              placeholder={t('settings.codeInjection.footerPlaceholder')}
              maxLength={MAX_CHARS}
              error={footerOverLimit}
              helperText={`${footerCode.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()} ${charsLabel}`}
              language="xml"
              data-testid="site-settings.code-injection.footer-input"
            />
          </Field>
        </SettingsCard>

      </Box>
    </Box>
  );
}
