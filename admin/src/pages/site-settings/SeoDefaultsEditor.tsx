import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Box, TextField } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { updateSiteSettings } from '@/services/sites';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import TemplateVariableInput from '@/components/shared/TemplateVariableInput';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useSiteContext } from '@/store/SiteContext';
import type { SiteSettingsResponse } from '@/types/api';
import {
  CardGroup,
  SettingsCard,
  Field,
  M3Button,
} from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { queryKeys } from '@/lib/queryKeys';

const DEFAULT_TITLE_TEMPLATE = '{{title}} | {{site_name}}';
const DESCRIPTION_MAX_LENGTH = 160;

function renderTitlePreview(template: string, siteName: string): string {
  return template
    .replace(/\{\{title\}\}/g, 'Example Blog Post')
    .replace(/\{\{site_name\}\}/g, siteName)
    .replace(/\{\{site_description\}\}/g, 'A great website')
    .replace(/\{\{author\}\}/g, 'John Doe')
    .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
    .replace(/\{\{category\}\}/g, 'Technology')
    .replace(/\{\{locale\}\}/g, 'en');
}

interface SeoDefaultsEditorProps {
  settings: SiteSettingsResponse | undefined;
  siteName: string;
}

// react-doctor-disable-next-line too-many-useState — states are independent concerns (form fields, dirty flag, media picker)
export default function SeoDefaultsEditor({ settings, siteName }: SeoDefaultsEditorProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [titleTemplate, setTitleTemplate] = useState(DEFAULT_TITLE_TEMPLATE);
  const [defaultDescription, setDefaultDescription] = useState('');
  const [defaultOgImageId, setDefaultOgImageId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const ogImageUrl = useMediaUrl(defaultOgImageId);

  const prevSettingsRef = useRef<typeof settings>(undefined);
  useEffect(() => {
    if (settings && settings !== prevSettingsRef.current) {
      prevSettingsRef.current = settings;
      setTitleTemplate(settings.seo_title_template ?? DEFAULT_TITLE_TEMPLATE);
      setDefaultDescription(settings.seo_default_description ?? '');
      setDefaultOgImageId(settings.seo_default_og_image_id ?? null);
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: {
      seo_title_template: string;
      seo_default_description: string;
      seo_default_og_image_id: string | null;
    }) => updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(selectedSiteId) });
      // Mark clean so the global save bar dismisses. We can't rely on the
      // ref-equality hydration block below because React Query's structural
      // sharing may return the same settings object after refetch.
      setIsDirty(false);
      enqueueSnackbar(t('settings.seoDefaults.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.seoDefaults.saveFailed'), { variant: 'error' });
    },
  });

  const handleSave = useCallback(() => {
    mutation.mutate({
      seo_title_template: titleTemplate,
      seo_default_description: defaultDescription,
      seo_default_og_image_id: defaultOgImageId,
    });
  }, [titleTemplate, defaultDescription, defaultOgImageId, mutation]);

  const titlePreview = useMemo(
    () => renderTitlePreview(titleTemplate, siteName),
    [titleTemplate, siteName],
  );

  // Discard should restore the last saved server state — not reset to
  // factory defaults. `resetDefaults` is a separate affordance inside
  // the card for when the user really does want to clear everything.
  const discardChanges = useCallback(() => {
    if (!settings) return;
    setTitleTemplate(settings.seo_title_template ?? DEFAULT_TITLE_TEMPLATE);
    setDefaultDescription(settings.seo_default_description ?? '');
    setDefaultOgImageId(settings.seo_default_og_image_id ?? null);
    setIsDirty(false);
  }, [settings]);

  useFormSaveBar({
    id: 'site-settings.seo.defaults',
    isDirty: isDirty,
    saving: mutation.isPending,
    onSave: handleSave,
    onDiscard: discardChanges,
    saveTestId: 'site-settings.seo.save-seo-defaults',
    discardTestId: 'site-settings.seo.reset-seo-defaults',
  });

  return (
    <>
      <CardGroup label={t('settings.seoDefaults.title')}>
        <SettingsCard>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
            {t('settings.seoDefaults.description')}
          </div>

          <Field
            fieldId="seo-title-template"
            label={t('settings.seoDefaults.titleTemplate')}
            hint={`${t('settings.seoDefaults.titleTemplateHelper')} (${titleTemplate.length} / 500)`}
          >
            <TemplateVariableInput
              label=""
              placeholder={DEFAULT_TITLE_TEMPLATE}
              value={titleTemplate}
              onChange={(val) => {
                setTitleTemplate(val);
                setIsDirty(true);
              }}
              maxLength={500}
              data-testid="site-settings.seo.title-template"
            />
            <Box
              sx={{
                mt: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                background: 'color-mix(in oklch, var(--primary-container) 60%, transparent)',
                color: 'var(--on-primary-container)',
                fontSize: 12.5,
                fontWeight: 500,
                maxWidth: '100%',
              }}
            >
              <span style={{ opacity: 0.75, flexShrink: 0 }}>
                {t('settings.seoDefaults.titlePreview')}:
              </span>
              <span
                data-testid="site-settings.seo.title-preview"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {titlePreview}
              </span>
            </Box>
          </Field>

          <Field
            fieldId="seo-default-description"
            label={t('settings.seoDefaults.defaultDescription')}
            hint={`${defaultDescription.length} / 500 (${t('settings.seoDefaults.charsRecommended')}: ${DESCRIPTION_MAX_LENGTH})`}
          >
            <TextField
              id="seo-default-description"
              placeholder={t('settings.seoDefaults.defaultDescriptionPlaceholder')}
              value={defaultDescription}
              onChange={(e) => {
                setDefaultDescription(e.target.value);
                setIsDirty(true);
              }}
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={4}
              data-testid="site-settings.seo.default-description"
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
          </Field>

          <Field
            label={t('settings.seoDefaults.defaultOgImage')}
            hint={t('settings.seoDefaults.ogImageHelper')}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {defaultOgImageId && ogImageUrl ? (
                <Box
                  component="img"
                  src={ogImageUrl}
                  alt="Default OG image"
                  sx={{
                    width: 120,
                    height: 63,
                    objectFit: 'cover',
                    borderRadius: 2,
                    border: '1px solid var(--outline-variant)',
                  }}
                  data-testid="site-settings.seo.og-image-preview"
                />
              ) : (
                <Box
                  sx={{
                    width: 120,
                    height: 63,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-container)',
                    borderRadius: 2,
                    border: '1px dashed var(--outline-variant)',
                  }}
                >
                  <ImageIcon sx={{ color: 'var(--on-surface-variant)' }} />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <M3Button
                  variant="outlined"
                  size="sm"
                  icon="image"
                  onClick={() => setMediaPickerOpen(true)}
                  data-testid="site-settings.seo.pick-og-image"
                >
                  {defaultOgImageId
                    ? t('settings.seoDefaults.changeImage')
                    : t('settings.seoDefaults.selectImage')}
                </M3Button>
                {defaultOgImageId && (
                  <M3Button
                    variant="outlined"
                    size="sm"
                    danger
                    onClick={() => {
                      setDefaultOgImageId(null);
                      setIsDirty(true);
                    }}
                    data-testid="site-settings.seo.clear-og-image"
                  >
                    {t('settings.seoDefaults.clearImage')}
                  </M3Button>
                )}
              </Box>
            </Box>
          </Field>
        </SettingsCard>
      </CardGroup>

      <MediaPickerDialog
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        siteId={selectedSiteId}
        currentValue={defaultOgImageId}
        onSelect={(mediaId) => {
          setDefaultOgImageId(mediaId);
          setIsDirty(true);
          setMediaPickerOpen(false);
        }}
      />
    </>
  );
}
