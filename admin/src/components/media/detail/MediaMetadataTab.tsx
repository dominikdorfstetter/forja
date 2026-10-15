import { Box, Tab, Tabs } from '@mui/material';
import type { Locale, MediaMetadataResponse } from '@/types/api';
import { translationSourceFor } from './mediaDetailModel';
import MediaMetadataLocaleForm from './MediaMetadataLocaleForm';
import type { MediaMetadataEditor } from './useMediaMetadataEditor';
import type { MediaMetadataAi } from './useMediaMetadataAi';

interface MediaMetadataTabProps {
  locales: Locale[];
  defaultLocale: Locale | undefined;
  localeTabIndex: number;
  onLocaleTabChange: (index: number) => void;
  metadata: MediaMetadataResponse[];
  editor: MediaMetadataEditor;
  ai: MediaMetadataAi | null;
}

/** Per-locale metadata editor: a locale tab strip over the active locale's form. */
export default function MediaMetadataTab({
  locales,
  defaultLocale,
  localeTabIndex,
  onLocaleTabChange,
  metadata,
  editor,
  ai,
}: MediaMetadataTabProps) {
  const locale = locales[localeTabIndex];

  return (
    <Box>
      <Tabs
        value={localeTabIndex}
        onChange={(_, v) => onLocaleTabChange(v)}
        variant="scrollable"
        sx={{
          minHeight: 36,
          '& .MuiTabs-indicator': {
            height: 2,
            backgroundColor: 'var(--primary)',
          },
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 600,
            minHeight: 36,
            letterSpacing: 0.5,
            color: 'var(--on-surface-variant)',
            '&.Mui-selected': { color: 'var(--primary)' },
          },
        }}
      >
        {locales.map((l, i) => (
          <Tab key={l.id} label={l.code.toUpperCase()} value={i} />
        ))}
      </Tabs>
      {locale && (
        <MediaMetadataLocaleForm
          key={locale.id}
          locale={locale}
          existingId={metadata.find((m) => m.locale_id === locale.id)?.id}
          editor={editor}
          ai={ai}
          translateFrom={translationSourceFor(locale.id, defaultLocale, editor.editingMeta)}
        />
      )}
    </Box>
  );
}
