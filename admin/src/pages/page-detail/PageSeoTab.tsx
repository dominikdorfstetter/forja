import { useState, useCallback, useMemo } from 'react';
import { Box, Button, CircularProgress, Tab, Tabs, Tooltip } from '@mui/material';
import { AutoAwesome as AiIcon } from '@mui/icons-material';
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { createPageLocalization, getPageLocalizations, updatePageLocalization } from '@/services/pages';
import type { PageDetailFormData } from './pageDetailSchema';
import type { SectionLocalizationResponse } from '@/types/api';
import SerpPreview from '@/pages/blog-detail/SerpPreview';
import SocialPreview from '@/pages/blog-detail/SocialPreview';
import SeoFieldsEditor from '@/components/locale-aware/SeoFieldsEditor';
import { useAiAssist } from '@/hooks/useAiAssist';
import { useSiteContext } from '@/store/SiteContext';
import { queryKeys } from '@/lib/queryKeys';

interface ActiveLocale {
  id: string;
  code: string;
}

interface PageSeoTabProps {
  control: Control<PageDetailFormData>;
  watch: UseFormWatch<PageDetailFormData>;
  setValue?: UseFormSetValue<PageDetailFormData>;
  onSnapshot: () => void;
  route: string;
  pageId: string;
  activeLocales: ActiveLocale[];
  /** Flat list of section localizations for all sections + locales on this page.
   *  Used as source content for AI Generate SEO / Excerpt actions. */
  sectionLocalizations?: SectionLocalizationResponse[];
}

const MIN_CONTENT_CHARS = 50;

/** Concatenate `title + text` of localizations for the active locale.
 *  Order is whatever the API returns — section ordering on the page itself is
 *  preserved at fetch time. Empty fields are skipped to keep the prompt tight. */
function buildSeoSourceContent(
  localizations: SectionLocalizationResponse[] | undefined,
  localeId: string | undefined,
): string {
  if (!localizations || !localeId) return '';
  return localizations
    .filter((l) => l.locale_id === localeId)
    .flatMap((l) => [l.title, l.text].filter((v): v is string => !!v))
    .join('\n\n');
}

export default function PageSeoTab({ control, watch, setValue, onSnapshot, route, pageId, activeLocales, sectionLocalizations }: PageSeoTabProps) {
  const { t } = useTranslation();
  const { selectedSite } = useSiteContext();
  const [activeTab, setActiveTab] = useState(0);
  const pageRoute = watch('route');
  const ai = useAiAssist();
  const defaultLocale = activeLocales[0];
  const seoSourceContent = useMemo(
    () => buildSeoSourceContent(sectionLocalizations, defaultLocale?.id),
    [sectionLocalizations, defaultLocale?.id],
  );
  const hasSeoSource = seoSourceContent.length >= MIN_CONTENT_CHARS;

  const handleGenerateSeo = useCallback(async () => {
    if (!hasSeoSource || !setValue) return;
    const result = await ai.generate('seo', seoSourceContent);
    if (result.meta_title) setValue('meta_title', result.meta_title, { shouldDirty: true });
    if (result.meta_description) setValue('meta_description', result.meta_description, { shouldDirty: true });
    onSnapshot();
  }, [ai, hasSeoSource, seoSourceContent, setValue, onSnapshot]);

  const handleGenerateExcerpt = useCallback(async () => {
    if (!hasSeoSource || !setValue) return;
    const result = await ai.generate('excerpt', seoSourceContent);
    if (result.excerpt) setValue('excerpt', result.excerpt, { shouldDirty: true });
    onSnapshot();
  }, [ai, hasSeoSource, seoSourceContent, setValue, onSnapshot]);

  // Fetch all page localizations
  const { data: localizations } = useQuery({
    queryKey: queryKeys.pageLocalizations(pageId),
    queryFn: () => getPageLocalizations(pageId),
    enabled: !!pageId,
  });

  const currentLocale = activeLocales[activeTab];
  const currentLoc = localizations?.find((l) => l.locale_id === currentLocale?.id);
  const isDefaultLocale = activeTab === 0;

  // Read-only mirror of the active non-default locale's edits, for live previews.
  // The save path itself is owned by <SeoFieldsEditor>/<LocaleAwareFields>.
  const [localePreview, setLocalePreview] = useState<Record<string, string>>({});

  const aiButton = (onClick: () => void, testId: string, label: string) =>
    ai.isConfigured ? (
      <Tooltip title={hasSeoSource ? '' : t('blogDetail.ai.writeContentFirst')}>
        <span>
          <Button
            size="small"
            startIcon={ai.isGenerating ? <CircularProgress size={14} /> : <AiIcon />}
            onClick={onClick}
            disabled={!hasSeoSource || ai.isGenerating}
            data-testid={testId}
          >
            {label}
          </Button>
        </span>
      </Tooltip>
    ) : null;

  // Preview values: form (default locale) or the localized mirror (non-default),
  // falling back to the persisted localization then the default-locale fields.
  const previewTitle = isDefaultLocale
    ? watch('meta_title') || pageRoute || route
    : localePreview.meta_title || currentLoc?.meta_title || watch('meta_title') || pageRoute || route;
  const previewDescription = isDefaultLocale
    ? watch('meta_description') || watch('excerpt')
    : localePreview.meta_description || currentLoc?.meta_description || watch('meta_description') || watch('excerpt');

  return (
    <Box>
      {/* Locale tabs — only show if multiple locales */}
      {activeLocales.length > 1 && (
        <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); setLocalePreview({}); }} sx={{ mb: 2 }}>
          {activeLocales.map((locale) => (
            <Tab key={locale.id} label={locale.code.toUpperCase()} />
          ))}
        </Tabs>
      )}
      {currentLocale && (
        <SeoFieldsEditor
          key={currentLocale.id}
          control={control}
          isDefault={isDefaultLocale}
          onDefaultBlur={onSnapshot}
          testIdPrefix="page-seo"
          labels={{
            metaTitle: t('pageDetail.fields.metaTitle'),
            metaDescription: t('pageDetail.fields.metaDescription'),
            excerpt: t('pageDetail.fields.excerpt'),
          }}
          footerSlots={{
            meta_description: aiButton(handleGenerateSeo, 'page-seo.btn.generate-seo', t('blogDetail.ai.generateSeo')),
            excerpt: aiButton(handleGenerateExcerpt, 'page-seo.btn.generate-excerpt', t('blogDetail.ai.generateExcerpt')),
          }}
          locale={currentLocale}
          localization={currentLoc}
          createLocalization={(localeId, values) =>
            createPageLocalization(pageId, { locale_id: localeId, title: '-', ...values })
          }
          updateLocalization={(locId, values) => updatePageLocalization(locId, values)}
          invalidateKey={queryKeys.pageLocalizations(pageId)}
          placeholders={{
            meta_title: watch('meta_title') || '',
            meta_description: watch('meta_description') || '',
            excerpt: watch('excerpt') || '',
          }}
          localeHint={
            isDefaultLocale
              ? undefined
              : t('pageDetail.seo.localeHint', {
                  locale: currentLocale.code.toUpperCase(),
                  fallback: 'SEO fields for this locale. Leave empty to fall back to the default locale.',
                })
          }
          onLocaleValuesChange={setLocalePreview}
        />
      )}
      <SerpPreview title={previewTitle} description={previewDescription} urlPath={route} />
      <SocialPreview
        title={previewTitle || ''}
        description={previewDescription || ''}
        coverImageId={null}
        baseUrl={selectedSite?.base_url}
      />
    </Box>
  );
}
