import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Stack,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  MenuItem,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getNavigationItemLocalizations } from '@/services/navigation';
import PagePicker from '@/components/shared/PagePicker';
import BlogPicker from '@/components/shared/BlogPicker';
import LegalPicker from '@/components/shared/LegalPicker';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import type {
  NavigationItem,
  CreateNavigationItemRequest,
  NavigationItemLocalizationInput,
  Locale,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

type LinkType = 'page' | 'blog' | 'cv' | 'legal' | 'external';


interface NavigationItemWizardProps {
  open: boolean;
  siteId: string;
  menuId: string;
  item?: NavigationItem | null;
  allItems?: NavigationItem[];
  maxDepth?: number;
  locales?: Locale[];
  onSubmit: (data: CreateNavigationItemRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const STEP_KEYS = [
  'navigation.wizard.steps.linkTarget',
  'navigation.wizard.steps.translations',
  'navigation.wizard.steps.options',
] as const;

const EMPTY_ITEMS: NavigationItem[] = [];
const EMPTY_LOCALES: Locale[] = [];

export default function NavigationItemWizard({
  open,
  siteId,
  menuId,
  item,
  allItems = EMPTY_ITEMS,
  maxDepth = 3,
  locales = EMPTY_LOCALES,
  onSubmit,
  onClose,
  loading,
}: NavigationItemWizardProps) {
  const { t } = useTranslation();
  const { modules } = useSiteContextData();
  const isEdit = !!item;

  // Available link types based on active modules
  const availableLinkTypes = useMemo(() => {
    const types: LinkType[] = [];
    if (modules.pages) types.push('page');
    if (modules.blog) types.push('blog');
    if (modules.portfolio) types.push('cv');
    if (modules.legal) types.push('legal');
    types.push('external'); // always available
    return types;
  }, [modules]);

  const defaultLinkType = availableLinkTypes[0];

  // --- Wizard step state ---
  const [activeStep, setActiveStep] = useState(0);

  // --- Step 1: Link target ---
  const [linkType, setLinkType] = useState<LinkType>(defaultLinkType);
  const [pageId, setPageId] = useState('');
  const [blogSlug, setBlogSlug] = useState('');
  const [legalSlug, setLegalSlug] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  // --- Step 2: Translations ---
  const [activeLocaleTab, setActiveLocaleTab] = useState(0);
  const [titles, setTitles] = useState<Record<string, string>>({});

  // --- Step 3: Options ---
  const [parentId, setParentId] = useState('');
  const [icon, setIcon] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(false);

  // --- Fetch existing localizations when editing ---
  const { data: existingLocalizations } = useQuery({
    queryKey: queryKeys.navigationLocalizations(item?.id),
    queryFn: () => getNavigationItemLocalizations(item!.id),
    enabled: !!item?.id && open,
  });

  // --- Reset form when dialog opens ---
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (item) {
        const isBlogLink = item.external_url?.startsWith('/blog/') ?? false;
        const isCvLink = item.external_url === '/cv';
        const isLegalLink = item.external_url?.startsWith('/legal/') ?? false;
        const detectedType: LinkType = isCvLink ? 'cv' : isBlogLink ? 'blog' : isLegalLink ? 'legal' : item.external_url ? 'external' : 'page';
        setLinkType(detectedType);
        setPageId(item.page_id || '');
        setBlogSlug(isBlogLink ? item.external_url!.replace('/blog/', '') : '');
        setLegalSlug(isLegalLink ? item.external_url!.replace('/legal/', '') : '');
        setExternalUrl((isBlogLink || isCvLink || isLegalLink) ? '' : (item.external_url || ''));
        setParentId(item.parent_id || '');
        setIcon(item.icon || '');
        setOpenInNewTab(item.open_in_new_tab);
        setActiveStep(0);
        setActiveLocaleTab(0);
        // Titles will be loaded from existingLocalizations below
      } else {
        setLinkType(defaultLinkType);
        setPageId('');
        setBlogSlug('');
        setLegalSlug('');
        setExternalUrl('');
        setParentId('');
        setIcon('');
        setOpenInNewTab(false);
        setTitles({});
        setActiveStep(0);
        setActiveLocaleTab(0);
      }
    }
    prevOpenRef.current = open;
  }, [open, item, defaultLinkType]);

  // Populate titles from fetched localizations (edit mode)
  const prevLocRef = useRef<string | undefined>(undefined);
  const locKey = existingLocalizations?.map((l) => `${l.locale_id}:${l.title}`).join(',');
  useEffect(() => {
    if (locKey && locKey !== prevLocRef.current) {
      const newTitles: Record<string, string> = {};
      existingLocalizations?.forEach((l) => {
        newTitles[l.locale_id] = l.title;
      });
      setTitles(newTitles);
    }
    prevLocRef.current = locKey;
  }, [locKey, existingLocalizations]);

  // --- Parent picker options ---
  const parentOptions = useMemo(() => {
    if (!allItems.length) return [];

    const excludeIds = new Set<string>();
    if (item) {
      excludeIds.add(item.id);
      const findDescendants = (pid: string) => {
        allItems.filter((i) => i.parent_id === pid).forEach((child) => {
          excludeIds.add(child.id);
          findDescendants(child.id);
        });
      };
      findDescendants(item.id);
    }

    const depthMap = new Map<string, number>();
    const calculateDepth = (itemId: string): number => {
      if (depthMap.has(itemId)) return depthMap.get(itemId)!;
      const i = allItems.find((x) => x.id === itemId);
      if (!i || !i.parent_id) { depthMap.set(itemId, 0); return 0; }
      const depth = calculateDepth(i.parent_id) + 1;
      depthMap.set(itemId, depth);
      return depth;
    };

    return allItems.flatMap<{ value: string; label: string; depth: number }>((i) => {
      if (excludeIds.has(i.id)) return [];
      const depth = calculateDepth(i.id);
      if (depth >= maxDepth - 1) return [];
      const indent = '\u00A0\u00A0'.repeat(depth);
      const label = `${indent}${i.title || i.page_id || i.external_url || i.id}`;
      return [{ value: i.id, label, depth }];
    });
  }, [allItems, item, maxDepth]);

  // --- Step validation ---
  const isStep1Valid = linkType === 'page' ? !!pageId
    : linkType === 'blog' ? !!blogSlug
    : linkType === 'legal' ? !!legalSlug
    : linkType === 'cv' ? true
    : !!externalUrl && isValidUrl(externalUrl);
  const isStep2Valid = locales.length === 0 || Object.values(titles).some((t) => t.trim());

  const canAdvance = activeStep === 0 ? isStep1Valid
    : activeStep === 1 ? isStep2Valid
    : true;

  // --- Navigation ---
  const handleNext = useCallback(() => {
    setActiveStep((s) => Math.min(s + 1, 2));
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(s - 1, 0));
  }, []);

  // --- Submit ---
  const handleSubmit = useCallback(() => {
    const localizationInputs: NavigationItemLocalizationInput[] = locales
      .filter((locale) => titles[locale.id]?.trim())
      .map((locale) => ({ locale_id: locale.id, title: titles[locale.id].trim() }));

    const resolvedExternalUrl = linkType === 'cv'
      ? '/cv'
      : linkType === 'legal'
        ? `/legal/${legalSlug}`
        : linkType === 'blog' && blogSlug
          ? `/blog/${blogSlug}`
          : linkType === 'external' && externalUrl ? externalUrl : undefined;

    onSubmit({
      page_id: linkType === 'page' && pageId ? pageId : undefined,
      external_url: resolvedExternalUrl,
      icon: icon || undefined,
      display_order: item?.display_order ?? 0,
      open_in_new_tab: openInNewTab,
      parent_id: parentId || undefined,
      site_id: siteId,
      menu_id: menuId,
      localizations: localizationInputs.length > 0 ? localizationInputs : undefined,
    });
  }, [linkType, pageId, blogSlug, legalSlug, externalUrl, icon, openInNewTab, parentId, siteId, menuId, locales, titles, item, onSubmit]);

  const handleTitleChange = useCallback((localeId: string, value: string) => {
    setTitles((prev) => ({ ...prev, [localeId]: value }));
  }, []);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="menu_book"
      title={isEdit
        ? t('navigation.wizard.title.edit', 'Edit Navigation Item')
        : t('navigation.wizard.title.create', 'Add Navigation Item')}
      data-testid="navigation-wizard.dialog"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={onClose} disabled={loading} data-testid="navigation-wizard.btn.cancel">
            {t('common.actions.cancel')}
          </M3Button>
          {activeStep > 0 && (
            <M3Button variant="outlined" size="sm" onClick={handleBack} disabled={loading} data-testid="navigation-wizard.btn.back">
              {t('common.actions.back')}
            </M3Button>
          )}
          {activeStep < 2 ? (
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleNext}
              disabled={!canAdvance || loading}
              data-testid="navigation-wizard.btn.next"
            >
              {t('common.actions.next')}
            </M3Button>
          ) : (
            <M3Button
              variant="filled"
              size="sm"
              onClick={handleSubmit}
              disabled={!canAdvance || loading}
              data-testid="navigation-wizard.btn.submit"
            >
              {loading
                ? t('common.actions.saving')
                : isEdit
                  ? t('common.actions.save')
                  : t('common.actions.create')}
            </M3Button>
          )}
        </>
      }
    >
      <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
        {STEP_KEYS.map((key) => (
          <Step key={key}>
            <StepLabel>{t(key)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <LinkTargetStep
          linkType={linkType}
          availableLinkTypes={availableLinkTypes}
          pageId={pageId}
          blogSlug={blogSlug}
          legalSlug={legalSlug}
          externalUrl={externalUrl}
          siteId={siteId}
          onLinkTypeChange={setLinkType}
          onPageIdChange={setPageId}
          onBlogSlugChange={setBlogSlug}
          onLegalSlugChange={setLegalSlug}
          onExternalUrlChange={setExternalUrl}
        />
      )}

      {activeStep === 1 && (
        <TranslationsStep
          locales={locales}
          titles={titles}
          activeTab={activeLocaleTab}
          onTabChange={setActiveLocaleTab}
          onTitleChange={handleTitleChange}
        />
      )}

      {activeStep === 2 && (
        <OptionsStep
          parentId={parentId}
          icon={icon}
          openInNewTab={openInNewTab}
          parentOptions={parentOptions}
          onParentIdChange={setParentId}
          onIconChange={setIcon}
          onOpenInNewTabChange={setOpenInNewTab}
        />
      )}
    </FormDialog>
  );
}

// --- Step sub-components ---

function LinkTargetStep({
  linkType,
  availableLinkTypes,
  pageId,
  blogSlug,
  legalSlug,
  externalUrl,
  siteId,
  onLinkTypeChange,
  onPageIdChange,
  onBlogSlugChange,
  onLegalSlugChange,
  onExternalUrlChange,
}: {
  linkType: LinkType;
  availableLinkTypes: LinkType[];
  pageId: string;
  blogSlug: string;
  legalSlug: string;
  externalUrl: string;
  siteId: string;
  onLinkTypeChange: (type: LinkType) => void;
  onPageIdChange: (id: string) => void;
  onBlogSlugChange: (slug: string) => void;
  onLegalSlugChange: (slug: string) => void;
  onExternalUrlChange: (url: string) => void;
}) {
  const { t } = useTranslation();
  const isInternal = linkType !== 'external';
  const internalTypes = availableLinkTypes.filter((lt) => lt !== 'external');

  const handleScopeChange = (_: unknown, value: string | null) => {
    if (!value) return;
    if (value === 'internal') {
      onLinkTypeChange(internalTypes[0] ?? 'page');
    } else {
      onLinkTypeChange('external');
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('forms.navigation.fields.type', 'Type')}
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={isInternal ? 'internal' : 'external'}
          onChange={handleScopeChange}
          size="small"
          fullWidth
        >
          <ToggleButton value="internal">
            {internalTypes.length === 1
              ? t(`common.labels.${internalTypes[0]}`)
              : t('common.labels.internal', 'Internal')}
          </ToggleButton>
          <ToggleButton value="external">{t('common.labels.external', 'External')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isInternal && internalTypes.length > 1 && (
        <TextField
          select
          label={t('navigation.wizard.contentType', 'Content type')}
          value={linkType}
          onChange={(e) => onLinkTypeChange(e.target.value as LinkType)}
          fullWidth
          size="small"
        >
          {internalTypes.map((type) => (
            <MenuItem key={type} value={type}>
              {t(`common.labels.${type}`)}
            </MenuItem>
          ))}
        </TextField>
      )}

      {linkType === 'page' && (
        <PagePicker
          value={pageId}
          onChange={onPageIdChange}
          siteId={siteId}
          label={t('forms.navigation.fields.page', 'Page')}
        />
      )}

      {linkType === 'blog' && (
        <BlogPicker
          value={blogSlug}
          onChange={onBlogSlugChange}
          siteId={siteId}
          label={t('forms.navigation.fields.blog', 'Blog Post')}
          helperText={t('navigation.wizard.blogHelp', 'Link will point to /blog/{slug}')}
        />
      )}

      {linkType === 'cv' && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          {t('navigation.wizard.cvInfo', 'This will link to your CV page at /cv')}
        </Typography>
      )}

      {linkType === 'legal' && (
        <LegalPicker
          value={legalSlug}
          onChange={onLegalSlugChange}
          siteId={siteId}
          label={t('navigation.wizard.legalDocType', 'Legal document')}
          helperText={t('navigation.wizard.legalHelp', 'Link will point to /legal/{slug}')}
        />
      )}

      {linkType === 'external' && (
        <TextField
          label={t('forms.navigation.fields.externalUrl', 'External URL')}
          fullWidth
          required
          value={externalUrl}
          onChange={(e) => onExternalUrlChange(e.target.value)}
          error={!!externalUrl && !isValidUrl(externalUrl)}
          helperText={externalUrl && !isValidUrl(externalUrl)
            ? t('navigation.wizard.validation.urlInvalid', 'Please enter a valid URL')
            : t('navigation.wizard.externalHelp', 'Any URL — documents, files, external sites')}
        />
      )}
    </Stack>
  );
}

function TranslationsStep({
  locales,
  titles,
  activeTab,
  onTabChange,
  onTitleChange,
}: {
  locales: Locale[];
  titles: Record<string, string>;
  activeTab: number;
  onTabChange: (tab: number) => void;
  onTitleChange: (localeId: string, value: string) => void;
}) {
  const { t } = useTranslation();

  if (locales.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('navigation.wizard.noLocales', 'No locales configured for this site.')}
      </Typography>
    );
  }

  const currentLocale = locales[activeTab] ?? locales[0];

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('navigation.wizard.translationsHelp', 'Enter a title for each language. At least one title is required.')}
      </Typography>

      {locales.length > 1 && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => onTabChange(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {locales.map((locale) => (
            <Tab
              key={locale.id}
              label={locale.code.toUpperCase()}
              aria-label={locale.code}
            />
          ))}
        </Tabs>
      )}

      <TextField
        label={`${t('navigation.fields.title', 'Title')} (${currentLocale.code})`}
        fullWidth
        value={titles[currentLocale.id] || ''}
        onChange={(e) => onTitleChange(currentLocale.id, e.target.value)}
        autoFocus
        data-testid="navigation-wizard.title-input"
      />
    </Stack>
  );
}

function OptionsStep({
  parentId,
  icon,
  openInNewTab,
  parentOptions,
  onParentIdChange,
  onIconChange,
  onOpenInNewTabChange,
}: {
  parentId: string;
  icon: string;
  openInNewTab: boolean;
  parentOptions: { value: string; label: string }[];
  onParentIdChange: (id: string) => void;
  onIconChange: (icon: string) => void;
  onOpenInNewTabChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <TextField
        select
        label={t('navigation.fields.parent', 'Parent')}
        fullWidth
        value={parentId}
        onChange={(e) => onParentIdChange(e.target.value)}
        helperText={t('navigation.fields.parentHelp', 'Select a parent item or leave as root')}
      >
        <MenuItem value="">
          <em>{t('navigation.fields.noParent', 'None (root level)')}</em>
        </MenuItem>
        {parentOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label={t('forms.navigation.fields.icon', 'Icon')}
        fullWidth
        value={icon}
        onChange={(e) => onIconChange(e.target.value)}
        helperText={t('navigation.wizard.iconHelp', 'Optional icon name')}
      />

      <FormControlLabel
        control={
          <Switch
            checked={openInNewTab}
            onChange={(e) => onOpenInNewTabChange(e.target.checked)}
          />
        }
        label={t('forms.navigation.fields.openInNewTab', 'Open in new tab')}
      />
    </Stack>
  );
}

// --- Utils ---

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
