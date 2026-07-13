import { Alert, Button, Stack } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import { useTranslation } from 'react-i18next';
import SectionItemsEditor from './SectionItemsEditor';
import type { SectionType } from '@/types/api';

interface SectionItemsLocalePanelProps {
  sectionType: SectionType;
  /** The single-source default items stored in `settings.items`. */
  defaultItems: Record<string, unknown>[];
  /** The active locale's items override — `null` = fall back to the default. */
  overrideItems: Record<string, unknown>[] | null;
  isDefaultLocale: boolean;
  localeCode: string;
  onDefaultItemsChange: (items: Record<string, unknown>[]) => void;
  onOverrideChange: (items: Record<string, unknown>[] | null) => void;
}

/**
 * Locale dimension around {@link SectionItemsEditor}. The default locale
 * edits `settings.items` directly (unchanged behavior); a non-default locale
 * either previews the default items with an explicit "localize" action that
 * copies them into a per-locale override, or edits its override with a
 * "remove localization" action that restores the fallback.
 */
export default function SectionItemsLocalePanel({
  sectionType,
  defaultItems,
  overrideItems,
  isDefaultLocale,
  localeCode,
  onDefaultItemsChange,
  onOverrideChange,
}: SectionItemsLocalePanelProps) {
  const { t } = useTranslation();

  if (isDefaultLocale) {
    return (
      <SectionItemsEditor
        sectionType={sectionType}
        items={defaultItems}
        onChange={onDefaultItemsChange}
      />
    );
  }

  const locale = localeCode.toUpperCase();

  if (overrideItems === null) {
    return (
      <Stack spacing={1.5}>
        <Alert severity="info" data-testid="section-editor.items.fallback-notice">
          {t('sectionEditor.items.fallbackNotice', { locale })}
        </Alert>
        <SectionItemsEditor
          sectionType={sectionType}
          items={defaultItems}
          onChange={onDefaultItemsChange}
          readOnly
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<TranslateIcon />}
          onClick={() => onOverrideChange(structuredClone(defaultItems))}
          data-testid="section-editor.items.btn.localize"
        >
          {t('sectionEditor.items.localizeAction')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" data-testid="section-editor.items.override-notice">
        {t('sectionEditor.items.overrideNotice', { locale })}
      </Alert>
      <SectionItemsEditor
        sectionType={sectionType}
        items={overrideItems}
        onChange={onOverrideChange}
      />
      <Button
        color="error"
        size="small"
        startIcon={<LayersClearIcon />}
        onClick={() => onOverrideChange(null)}
        data-testid="section-editor.items.btn.remove-localization"
      >
        {t('sectionEditor.items.removeLocalization')}
      </Button>
    </Stack>
  );
}
