import { Box, Chip, Paper, Typography, Button, Stack } from '@mui/material';
import type { PageSectionResponse, SectionLocalizationResponse, SectionType } from '@/types/api';

const SECTION_TYPE_COLORS: Record<SectionType, string> = {
  Hero: '#1976d2',
  Features: '#2e7d32',
  Cta: '#ed6c02',
  Gallery: '#9c27b0',
  Testimonials: '#0288d1',
  Pricing: '#d32f2f',
  Faq: '#757575',
  Contact: '#00796b',
  Custom: '#5d4037',
};

interface SectionPreviewProps {
  section: PageSectionResponse;
  localizations: SectionLocalizationResponse[];
  selectedLocaleId?: string;
}

export default function SectionPreview({ section, localizations, selectedLocaleId }: SectionPreviewProps) {
  const loc = localizations.find(
    (l) => l.page_section_id === section.id && l.locale_id === selectedLocaleId
  );

  const borderColor = SECTION_TYPE_COLORS[section.section_type] || '#757575';

  // Build settings summary chips
  const settingsChips: string[] = [];
  if (section.settings) {
    const s = section.settings;
    if (s.fullWidth) settingsChips.push('Full Width');
    if (typeof s.columns === 'number') settingsChips.push(`${s.columns} columns`);
    if (typeof s.gradient === 'string' && s.gradient) settingsChips.push('Gradient');
    if (typeof s.style === 'string') settingsChips.push(s.style as string);
    if (typeof s.layout === 'string') settingsChips.push(s.layout as string);
    if (s.showCaptions) settingsChips.push('Captions');
    if (s.showAvatar) settingsChips.push('Avatar');
    if (s.showToggle) settingsChips.push('Pricing Toggle');
    if (s.accordion) settingsChips.push('Accordion');
    if (s.showMap) settingsChips.push('Map');
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: `4px solid ${borderColor}`,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={section.section_type} size="small" sx={{ bgcolor: borderColor, color: 'white' }} />
          <Typography variant="caption" color="text.secondary">
            #{section.display_order}
          </Typography>
        </Box>
        {settingsChips.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {settingsChips.map((chip) => (
              <Chip key={chip} label={chip} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            ))}
          </Stack>
        )}
      </Box>

      {loc ? (
        <Box>
          {loc.title && (
            <Typography variant="h6" gutterBottom>
              {loc.title}
            </Typography>
          )}
          {loc.text && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                mb: 1,
              }}
            >
              {loc.text}
            </Typography>
          )}
          {loc.button_text && (
            <Button variant="outlined" size="small" disabled>
              {loc.button_text}
            </Button>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          No content for selected locale
        </Typography>
      )}

      {section.call_to_action_route && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          CTA: {section.call_to_action_route}
        </Typography>
      )}
    </Paper>
  );
}
