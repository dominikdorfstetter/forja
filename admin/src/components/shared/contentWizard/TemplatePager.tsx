import { Box, IconButton, Typography } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';

interface TemplatePagerProps {
  /** Page as stored by the wizard (may exceed the last page after filtering). */
  requestedPage: number;
  /** Requested page clamped to the available range. */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Prev/next pager for the template pickers; renders nothing for a single page. */
export default function TemplatePager({ requestedPage, currentPage, totalPages, onPageChange }: TemplatePagerProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 2 }}>
      <IconButton size="small" disabled={currentPage === 0} onClick={() => onPageChange(requestedPage - 1)}>
        <NavigateBeforeIcon />
      </IconButton>
      <Typography variant="body2" color="text.secondary">
        {t('templates.page', { current: currentPage + 1, total: totalPages })}
      </Typography>
      <IconButton size="small" disabled={currentPage >= totalPages - 1} onClick={() => onPageChange(requestedPage + 1)}>
        <NavigateNextIcon />
      </IconButton>
    </Box>
  );
}
