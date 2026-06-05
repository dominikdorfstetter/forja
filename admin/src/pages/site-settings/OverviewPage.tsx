import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Box, TextField, Button, IconButton, Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getSite, getSiteSettings, getStorageUsage, updateSite, updateSiteSettings } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { appConfig } from '@/appConfig';
import AllowedOriginsSection from './AllowedOriginsSection';
import StorageSection from './StorageSection';
import CacheSection from '@/components/cache/CacheSection';
import { formResolver } from '@/utils/validation';
import {
  SectionHead,
  SettingsCard,
  CardGroup,
  Field,
  ToggleField,
} from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';

const DEMO_BANNER_KEY = 'demoBannerDismissed';

const schema = z.object({
  base_url: z
    .url('Must be a valid URL (e.g. https://example.com)')
    .optional()
    .or(z.literal('')),
  contact_email: z.string().max(500).optional().or(z.literal('')),
  maintenance_mode: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { isMaster, isAdmin, isGuest } = useAuth();

  // Demo banners live on this page so they flow with content instead of
  // nudging the entire site-settings shell. Dismissal is session-scoped.
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(
    () => sessionStorage.getItem(DEMO_BANNER_KEY) === '1',
  );
  const showGuestDemoBanner = isGuest && !demoBannerDismissed;
  const dismissDemoBanner = () => {
    setDemoBannerDismissed(true);
    sessionStorage.setItem(DEMO_BANNER_KEY, '1');
  };

  const { data: site, isLoading: isSiteLoading } = useQuery({
    queryKey: ['site', selectedSiteId],
    queryFn: () => getSite(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: storageUsage } = useQuery({
    queryKey: ['storage-usage', selectedSiteId],
    queryFn: () => getStorageUsage(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { control, handleSubmit, reset, formState: { isDirty, errors, dirtyFields } } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: { base_url: '', contact_email: '', maintenance_mode: false },
  });

  const prevSettingsRef = useRef<typeof settings>(undefined);
  const prevSiteRef = useRef<typeof site>(undefined);
  if (
    settings && site &&
    (settings !== prevSettingsRef.current || site !== prevSiteRef.current)
  ) {
    prevSettingsRef.current = settings;
    prevSiteRef.current = site;
    reset({
      base_url: site.base_url ?? '',
      contact_email: settings.contact_email,
      maintenance_mode: settings.maintenance_mode,
    });
  }

  const settingsMutation = useMutation({
    mutationFn: (data: { contact_email?: string; maintenance_mode?: boolean }) =>
      updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings', selectedSiteId] });
    },
  });

  const siteMutation = useMutation({
    mutationFn: (data: { base_url?: string }) =>
      updateSite(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await Promise.all([
        settingsMutation.mutateAsync({
          contact_email: values.contact_email || '',
          maintenance_mode: values.maintenance_mode,
        }),
        siteMutation.mutateAsync({
          base_url: values.base_url || undefined,
        }),
      ]);
      // Reset the form to the just-saved values so RHF clears isDirty —
      // the global save bar watches isDirty to know when to dismiss.
      reset(values, { keepValues: true });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    }
  };

  const isSaving = settingsMutation.isPending || siteMutation.isPending;

  useFormSaveBar({
    id: 'site-settings.overview',
    isDirty,
    saving: isSaving,
    onSave: handleSubmit(onSubmit),
    onDiscard: () => reset(),
    saveTestId: 'site-settings.save',
    discardTestId: 'site-settings.discard',
    dirtyFields,
  });

  if (isSiteLoading || isSettingsLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SectionHead
        icon="tune"
        title={t('siteSettings.overview.title', 'Overview')}
        subtitle={t(
          'siteSettings.overview.subtitle',
          'Identity and access basics for this site.',
        )}
      />
      {appConfig.demoMode && !isGuest && (
        <Alert
          severity="warning"
          data-testid="layout.demo-instance-banner"
          sx={{ mb: 2, borderRadius: 3 }}
        >
          {t('layout.demoInstance')}
        </Alert>
      )}
      {showGuestDemoBanner && (
        <Alert
          severity="info"
          data-testid="layout.demo-banner"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                dismissDemoBanner();
                navigate('/sign-up');
              }}
            >
              {t('layout.demoBanner.signUp')}
            </Button>
          }
          onClose={dismissDemoBanner}
          sx={{ mb: 2, borderRadius: 3 }}
        >
          {t('layout.demoBanner.message')}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {site && (
          <CardGroup label={t('siteSettings.overview.groups.identity', 'Identity')}>
            <SettingsCard>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  flexWrap: 'wrap',
                  fontSize: 13,
                  color: 'var(--on-surface-variant)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>{t('siteSettings.overview.slug', 'Slug')}:</span>
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{site.slug}</span>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>ID:</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      userSelect: 'all',
                      color: 'var(--on-surface)',
                    }}
                    data-testid="site-settings.site-id"
                  >
                    {selectedSiteId}
                  </span>
                  <Tooltip title={t('common.actions.copy', 'Copy')}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedSiteId);
                        enqueueSnackbar(t('common.actions.copied', 'Copied to clipboard'), { variant: 'info', autoHideDuration: 1500 });
                      }}
                      aria-label={t('common.actions.copy', 'Copy')}
                      data-testid="site-settings.copy-site-id"
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>{t('common.table.created', 'Created')}:</span>
                  <span style={{ color: 'var(--on-surface)' }}>
                    {new Date(site.created_at).toLocaleDateString()}
                  </span>
                </Box>
              </Box>

              <Controller
                name="base_url"
                control={control}
                render={({ field }) => (
                  <Field
                    fieldId="base_url"
                    label={t('settings.general.siteUrl')}
                    hint={errors.base_url?.message ?? `${t('settings.general.siteUrlHelper')} (${field.value?.length ?? 0} / 500)`}
                  >
                    <TextField
                      {...field}
                      id="base_url"
                      placeholder={t('settings.general.siteUrlPlaceholder')}
                      fullWidth
                      size="small"
                      error={!!errors.base_url}
                      data-testid="site-settings.base-url"
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                  </Field>
                )}
              />

              <Controller
                name="contact_email"
                control={control}
                render={({ field }) => (
                  <Field
                    fieldId="contact_email"
                    label={t('settings.general.contactEmail')}
                    hint={errors.contact_email?.message ?? `${field.value?.length ?? 0} / 500`}
                  >
                    <TextField
                      {...field}
                      id="contact_email"
                      type="email"
                      fullWidth
                      size="small"
                      error={!!errors.contact_email}
                      data-testid="site-settings.contact-email"
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                  </Field>
                )}
              />
            </SettingsCard>
          </CardGroup>
        )}

        {storageUsage && (
          <StorageSection siteId={selectedSiteId} storageUsage={storageUsage} isMaster={isMaster} />
        )}

        <CardGroup label={t('siteSettings.overview.groups.status', 'Status')}>
          <SettingsCard>
            <Controller
              name="maintenance_mode"
              control={control}
              render={({ field }) => (
                <ToggleField
                  label={t('settings.featureToggles.maintenanceMode')}
                  sublabel={t('settings.featureToggles.maintenanceModeDescription')}
                  checked={field.value}
                  onChange={field.onChange}
                  data-testid="site-settings.maintenance-mode"
                />
              )}
            />
          </SettingsCard>
        </CardGroup>

        {isAdmin && settings && (
          <AllowedOriginsSection siteId={selectedSiteId} settings={settings} />
        )}

        {isAdmin && <CacheSection siteId={selectedSiteId} />}

      </Box>
    </form>
  );
}
