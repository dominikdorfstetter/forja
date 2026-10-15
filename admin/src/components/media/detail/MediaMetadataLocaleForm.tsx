import { Box, CircularProgress, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useTranslation } from 'react-i18next';
import { M3Button, M3IconButton } from '@/components/design-system';
import type { Locale } from '@/types/api';
import { EMPTY_META_VALUES, GENERATE_ACTIONS, type MetaField } from './mediaDetailModel';
import type { MediaMetadataEditor } from './useMediaMetadataEditor';
import type { MediaMetadataAi } from './useMediaMetadataAi';

const FIELD_ROWS: ReadonlyArray<{ field: MetaField; labelKey: string; aiTooltipKey: string; aiTooltipDefault: string }> = [
  { field: 'alt_text', labelKey: 'forms.mediaDetail.fields.altText', aiTooltipKey: 'media.ai.generateAltText', aiTooltipDefault: 'Generate Alt Text' },
  { field: 'caption', labelKey: 'forms.mediaDetail.fields.caption', aiTooltipKey: 'media.ai.generateCaption', aiTooltipDefault: 'Generate Caption' },
  { field: 'title', labelKey: 'forms.mediaDetail.fields.title', aiTooltipKey: 'media.ai.generateTitle', aiTooltipDefault: 'Generate Title' },
];

interface TranslateButtonProps {
  source: Locale;
  isTranslating: boolean;
  onTranslate: () => void;
}

function TranslateButton({ source, isTranslating, onTranslate }: TranslateButtonProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ alignSelf: 'flex-start' }}>
      <M3Button
        variant="outlined"
        size="sm"
        icon={isTranslating ? undefined : 'translate'}
        onClick={onTranslate}
        disabled={isTranslating}
      >
        {isTranslating ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
        {t('media.ai.translateFrom', { locale: source.code.toUpperCase() })}
      </M3Button>
    </Box>
  );
}

interface MediaMetadataLocaleFormProps {
  locale: Locale;
  /** Id of the saved metadata row for this locale, when one exists. */
  existingId: string | undefined;
  editor: MediaMetadataEditor;
  /** AI helpers, or null when AI isn't available for this file. */
  ai: MediaMetadataAi | null;
  /** Locale to offer "translate from", or null to hide the button. */
  translateFrom: Locale | null;
}

/** Alt text / caption / title inputs for one locale, with optional AI assists. */
export default function MediaMetadataLocaleForm({ locale, existingId, editor, ai, translateFrom }: MediaMetadataLocaleFormProps) {
  const { t } = useTranslation();
  const values = editor.editingMeta[locale.id] || EMPTY_META_VALUES;

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {ai && translateFrom && (
        <TranslateButton
          source={translateFrom}
          isTranslating={ai.isTranslating}
          onTranslate={() => ai.translateMetadata(locale.id, locale.code)}
        />
      )}
      {FIELD_ROWS.map((row) => (
        <Box key={row.field} sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
          <TextField
            label={t(row.labelKey)}
            size="small"
            fullWidth
            value={values[row.field]}
            onChange={(e) => editor.setMetaField(locale.id, row.field, e.target.value)}
          />
          {ai && (
            <Tooltip title={t(row.aiTooltipKey, row.aiTooltipDefault)}>
              <IconButton
                size="small"
                color="primary"
                onClick={() => ai.generateField(row.field, locale.id, locale.code)}
                disabled={ai.isGenerating}
                sx={{ mt: 0.5 }}
              >
                {ai.generatingAction === GENERATE_ACTIONS[row.field]
                  ? <CircularProgress size={18} />
                  : <AutoFixHighIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <M3Button
          variant="filled"
          size="sm"
          icon="save"
          onClick={() => editor.saveLocale(locale.id)}
          disabled={editor.saving}
        >
          {t('common.actions.save')}
        </M3Button>
        {existingId && (
          <M3IconButton
            name="delete"
            size={36}
            tooltip={t('common.actions.delete')}
            disabled={editor.deleting}
            onClick={() => editor.deleteMetadata(existingId)}
          />
        )}
      </Box>
    </Stack>
  );
}
