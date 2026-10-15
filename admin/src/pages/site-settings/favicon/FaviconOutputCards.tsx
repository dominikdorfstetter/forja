import { Box, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from 'react-i18next';
import { CardGroup, SettingsCard, M3Button } from '@/components/design-system';
import type { FaviconVariant } from '@/types/api';

interface FaviconVariantsCardProps {
  variants: FaviconVariant[];
  onDownload: () => void;
}

/** Grid of the generated favicon sizes, with a zip download. */
export function FaviconVariantsCard({ variants, onDownload }: FaviconVariantsCardProps) {
  const { t } = useTranslation();

  return (
    <CardGroup
      label={t('settings.favicon.variants')}
      actions={
        <M3Button
          variant="ghost"
          size="sm"
          icon="download"
          onClick={onDownload}
          data-testid="site-settings.favicon.download"
        >
          {t('settings.favicon.download')}
        </M3Button>
      }
    >
      <SettingsCard>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 1.5,
          }}
        >
          {variants.map((v) => (
            <Box
              key={v.name}
              sx={{
                p: 1.5,
                textAlign: 'center',
                borderRadius: 2,
                border: '1px solid var(--outline-variant)',
                background: 'var(--surface-container-high)',
              }}
              data-testid="site-settings.favicon.variant"
            >
              <Box
                component="img"
                src={v.url}
                alt={v.name}
                sx={{
                  width: Math.min(v.width, 64),
                  height: Math.min(v.height, 64),
                  objectFit: 'contain',
                  mb: 1,
                  imageRendering: v.width <= 32 ? 'pixelated' : 'auto',
                }}
              />
              <Box sx={{ fontSize: 12, color: 'var(--on-surface)', fontWeight: 500 }}>
                {v.name}
              </Box>
              <Box sx={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                {v.width}×{v.height}
              </Box>
            </Box>
          ))}
        </Box>
      </SettingsCard>
    </CardGroup>
  );
}

interface FaviconSnippetCardProps {
  snippet: string;
  onCopy: () => void;
}

/** The `<head>` markup to paste into a site, with a copy button. */
export function FaviconSnippetCard({ snippet, onCopy }: FaviconSnippetCardProps) {
  const { t } = useTranslation();

  return (
    <CardGroup
      label={t('settings.favicon.snippet')}
      actions={
        <Tooltip title={t('settings.favicon.copySnippet')}>
          <IconButton
            onClick={onCopy}
            size="small"
            data-testid="site-settings.favicon.copy-snippet"
            sx={{ color: 'var(--on-surface-variant)' }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      <SettingsCard>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-container-high)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 200,
            overflow: 'auto',
          }}
          data-testid="site-settings.favicon.snippet-preview"
        >
          {snippet}
        </Box>
      </SettingsCard>
    </CardGroup>
  );
}
