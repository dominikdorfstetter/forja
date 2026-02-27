import { useState } from 'react';
import { Box, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { PageSectionResponse, SectionLocalizationResponse } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import SectionPreview from './SectionPreview';

interface PagePreviewProps {
  sections: PageSectionResponse[];
  localizations: SectionLocalizationResponse[];
}

export default function PagePreview({ sections, localizations }: PagePreviewProps) {
  const { selectedSiteId } = useSiteContext();

  const { data: siteLocalesRaw } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const activeLocales = (siteLocalesRaw || [])
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at }));
  const [selectedLocaleId, setSelectedLocaleId] = useState('');

  // Auto-select first locale if none selected
  const effectiveLocaleId = selectedLocaleId || activeLocales[0]?.id || '';

  const sortedSections = [...sections].sort((a, b) => a.display_order - b.display_order);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        bgcolor: 'background.default',
        border: '2px dashed',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Page Preview
        </Typography>
        {activeLocales.length > 0 && (
          <TextField
            select
            size="small"
            label="Preview Locale"
            value={effectiveLocaleId}
            onChange={(e) => setSelectedLocaleId(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            {activeLocales.map((locale) => (
              <MenuItem key={locale.id} value={locale.id}>
                {locale.code.toUpperCase()} — {locale.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      {sortedSections.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No sections to preview
        </Typography>
      ) : (
        <Stack spacing={2}>
          {sortedSections.map((section) => (
            <SectionPreview
              key={section.id}
              section={section}
              localizations={localizations}
              selectedLocaleId={effectiveLocaleId}
            />
          ))}
        </Stack>
      )}
    </Paper>
  );
}
