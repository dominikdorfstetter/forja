import {
  Box,
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
import PagePicker from '@/components/shared/PagePicker';
import BlogPicker from '@/components/shared/BlogPicker';
import LegalPicker from '@/components/shared/LegalPicker';
import type { Locale } from '@/types/api';
import {
  isValidUrl,
  type ItemOptionFields,
  type LinkTargetFields,
  type LinkType,
  type ParentOption,
} from './navigationItemWizardModel';

interface LinkTargetStepProps {
  target: LinkTargetFields;
  availableLinkTypes: LinkType[];
  siteId: string;
  onChange: (patch: Partial<LinkTargetFields>) => void;
}

export function LinkTargetStep({ target, availableLinkTypes, siteId, onChange }: LinkTargetStepProps) {
  const { t } = useTranslation();
  const { linkType } = target;
  const isInternal = linkType !== 'external';
  const internalTypes = availableLinkTypes.filter((lt) => lt !== 'external');

  const handleScopeChange = (_: unknown, value: string | null) => {
    if (!value) return;
    onChange({ linkType: value === 'internal' ? (internalTypes[0] ?? 'page') : 'external' });
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
          onChange={(e) => onChange({ linkType: e.target.value as LinkType })}
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

      <LinkTargetField target={target} siteId={siteId} onChange={onChange} />
    </Stack>
  );
}

/** The single input matching the selected link type. */
function LinkTargetField({ target, siteId, onChange }: Omit<LinkTargetStepProps, 'availableLinkTypes'>) {
  const { t } = useTranslation();
  const { externalUrl } = target;
  const urlInvalid = !!externalUrl && !isValidUrl(externalUrl);

  switch (target.linkType) {
    case 'page':
      return (
        <PagePicker
          value={target.pageId}
          onChange={(pageId) => onChange({ pageId })}
          siteId={siteId}
          label={t('forms.navigation.fields.page', 'Page')}
        />
      );
    case 'blog':
      return (
        <BlogPicker
          value={target.blogSlug}
          onChange={(blogSlug) => onChange({ blogSlug })}
          siteId={siteId}
          label={t('forms.navigation.fields.blog', 'Blog Post')}
          helperText={t('navigation.wizard.blogHelp', 'Link will point to /blog/{slug}')}
        />
      );
    case 'cv':
      return (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          {t('navigation.wizard.cvInfo', 'This will link to your CV page at /cv')}
        </Typography>
      );
    case 'legal':
      return (
        <LegalPicker
          value={target.legalDocumentId}
          onChange={(legalDocumentId) => onChange({ legalDocumentId })}
          siteId={siteId}
          label={t('navigation.wizard.legalDocType', 'Legal document')}
          helperText={t('navigation.wizard.legalHelp', 'Link will point to /legal/{slug}')}
        />
      );
    default:
      return (
        <TextField
          label={t('forms.navigation.fields.externalUrl', 'External URL')}
          fullWidth
          required
          value={externalUrl}
          onChange={(e) => onChange({ externalUrl: e.target.value })}
          error={urlInvalid}
          helperText={urlInvalid
            ? t('navigation.wizard.validation.urlInvalid', 'Please enter a valid URL')
            : t('navigation.wizard.externalHelp', 'Any URL — documents, files, external sites')}
        />
      );
  }
}

interface TranslationsStepProps {
  locales: Locale[];
  titles: Record<string, string>;
  activeTab: number;
  onTabChange: (tab: number) => void;
  onTitleChange: (localeId: string, value: string) => void;
}

export function TranslationsStep({ locales, titles, activeTab, onTabChange, onTitleChange }: TranslationsStepProps) {
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

interface OptionsStepProps {
  options: ItemOptionFields;
  parentOptions: ParentOption[];
  onChange: (patch: Partial<ItemOptionFields>) => void;
}

export function OptionsStep({ options, parentOptions, onChange }: OptionsStepProps) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <TextField
        select
        label={t('navigation.fields.parent', 'Parent')}
        fullWidth
        value={options.parentId}
        onChange={(e) => onChange({ parentId: e.target.value })}
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
        value={options.icon}
        onChange={(e) => onChange({ icon: e.target.value })}
        helperText={t('navigation.wizard.iconHelp', 'Optional icon name')}
      />

      <FormControlLabel
        control={
          <Switch
            checked={options.openInNewTab}
            onChange={(e) => onChange({ openInNewTab: e.target.checked })}
          />
        }
        label={t('forms.navigation.fields.openInNewTab', 'Open in new tab')}
      />
    </Stack>
  );
}
