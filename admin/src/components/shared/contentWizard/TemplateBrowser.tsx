import type { ReactNode } from 'react';
import { Box, InputAdornment, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import TemplateSelectCard, { type TemplateCardData } from './TemplateSelectCard';
import TemplatePager from './TemplatePager';
import { filterTemplates, paginateTemplates } from './templatePagination';

const ITEMS_PER_PAGE = 4;

interface TemplateBrowserProps<T extends TemplateCardData> {
  templates: T[];
  loading?: boolean;
  selectedTemplate: string | null;
  onSelectTemplate: (id: string) => void;
  /** Called when a new search invalidates the current selection. */
  onClearSelection: () => void;
  templateSearch: string;
  onSearchChange: (value: string) => void;
  templatePage: number;
  onPageChange: (page: number) => void;
  renderBadge?: (template: T) => ReactNode;
}

function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
      {children}
    </Typography>
  );
}

/** Searchable, paginated template grid shared by the blog and content-template wizards. */
export default function TemplateBrowser<T extends TemplateCardData>({
  templates,
  loading = false,
  selectedTemplate,
  onSelectTemplate,
  onClearSelection,
  templateSearch,
  onSearchChange,
  templatePage,
  onPageChange,
  renderBadge,
}: TemplateBrowserProps<T>) {
  const { t } = useTranslation();
  const filtered = filterTemplates(templates, templateSearch);
  const { pageItems, totalPages, currentPage } = paginateTemplates(filtered, templatePage, ITEMS_PER_PAGE);

  const results = filtered.length === 0 ? (
    <StatusMessage>{t('templates.noResults')}</StatusMessage>
  ) : (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, minHeight: 280 }}>
        {pageItems.map((template) => (
          <TemplateSelectCard
            key={template.id}
            template={template}
            selected={selectedTemplate === template.id}
            badge={renderBadge?.(template)}
            onSelect={onSelectTemplate}
          />
        ))}
      </Box>
      <TemplatePager requestedPage={templatePage} currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );

  return (
    <>
      <TextField
        autoFocus
        fullWidth
        size="small"
        placeholder={t('templates.searchPlaceholder')}
        value={templateSearch}
        onChange={(e) => { onSearchChange(e.target.value); onPageChange(0); onClearSelection(); }}
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {loading ? <StatusMessage>{t('common.actions.loading')}</StatusMessage> : results}
    </>
  );
}
