import { Box } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useTranslation } from 'react-i18next';
import { CardGroup, SettingsCard, M3Button } from '@/components/design-system';

interface FaviconUploadCardProps {
  uploading: boolean;
  onFileSelected: (file: File) => void;
  onChooseFromMedia: () => void;
}

/** Drop zone + file picker + "choose from media" for the favicon source image. */
export default function FaviconUploadCard({ uploading, onFileSelected, onChooseFromMedia }: FaviconUploadCardProps) {
  const { t } = useTranslation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  return (
    <CardGroup label={t('settings.favicon.title')}>
      <SettingsCard>
        <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
          {t('settings.favicon.description')}
        </div>

        <Box
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            borderRadius: 3,
            border: '2px dashed var(--outline-variant)',
            p: 4,
            textAlign: 'center',
            transition: 'background 150ms, border-color 150ms',
            '&:hover': {
              borderColor: 'var(--primary)',
              background: 'color-mix(in oklch, var(--primary) 6%, transparent)',
            },
          }}
          data-testid="site-settings.favicon.dropzone"
        >
          <CloudUploadIcon sx={{ fontSize: 42, color: 'var(--on-surface-variant)', mb: 1 }} />
          <Box sx={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)', mb: 0.5 }}>
            {t('settings.favicon.dropHere')}
          </Box>
          <Box sx={{ fontSize: 12.5, color: 'var(--on-surface-variant)', mb: 2 }}>
            {t('settings.favicon.recommended')}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Box
              component="label"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                height: 40,
                px: 2.5,
                borderRadius: 999,
                cursor: uploading ? 'not-allowed' : 'pointer',
                background: 'var(--primary)',
                color: 'var(--primary-c)',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 0.2,
                opacity: uploading ? 0.5 : 1,
                transition: 'transform 120ms',
                '&:active': { transform: 'scale(0.97)' },
              }}
              data-testid="site-settings.favicon.upload-btn"
            >
              <CloudUploadIcon sx={{ fontSize: 18 }} />
              {uploading
                ? t('settings.favicon.generating')
                : t('settings.favicon.selectFile')}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/gif,image/webp"
                aria-label={t('settings.favicon.selectFile')}
                onChange={handleFileChange}
              />
            </Box>
            <M3Button
              variant="outlined"
              size="md"
              icon="collections"
              disabled={uploading}
              onClick={onChooseFromMedia}
              data-testid="site-settings.favicon.choose-from-media"
            >
              {t('settings.favicon.chooseFromMedia')}
            </M3Button>
          </Box>
        </Box>
      </SettingsCard>
    </CardGroup>
  );
}
