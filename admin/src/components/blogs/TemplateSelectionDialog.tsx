import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  alpha,
  Box,
  Button,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArticleIcon from '@mui/icons-material/Article';
import SchoolIcon from '@mui/icons-material/School';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CampaignIcon from '@mui/icons-material/Campaign';
import CodeIcon from '@mui/icons-material/Code';
import BuildIcon from '@mui/icons-material/Build';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import StarIcon from '@mui/icons-material/Star';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router';
import { blogTemplates, type BlogTemplate } from '@/data/blogTemplates';
import type { ContentTemplate } from '@/types/api';
import { useAuth } from '@/store/AuthContext';

const iconMap: Record<string, typeof ArticleIcon> = {
  Article: ArticleIcon,
  School: SchoolIcon,
  NewReleases: NewReleasesIcon,
  RateReview: RateReviewIcon,
  Campaign: CampaignIcon,
  Code: CodeIcon,
  Build: BuildIcon,
  Lightbulb: LightbulbIcon,
  Star: StarIcon,
  Announcement: AnnouncementIcon,
};

interface MergedTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: 'builtin' | 'custom';
  bodyPreview: string;
  builtin?: BlogTemplate;
  custom?: ContentTemplate;
}

const ITEMS_PER_PAGE = 4;

interface TemplateSelectionDialogProps {
  open: boolean;
  onSelect: (template: BlogTemplate | ContentTemplate, source: 'builtin' | 'custom') => void;
  onClose: () => void;
  loading?: boolean;
  siteTemplates?: ContentTemplate[];
  siteTemplatesLoading?: boolean;
}

export default function TemplateSelectionDialog({
  open,
  onSelect,
  onClose,
  loading,
  siteTemplates = [],
  siteTemplatesLoading,
}: TemplateSelectionDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const mergedTemplates = useMemo<MergedTemplate[]>(() => {
    const builtins: MergedTemplate[] = blogTemplates.map((tpl) => ({
      id: `builtin-${tpl.id}`,
      name: t(tpl.nameKey),
      description: t(tpl.descriptionKey),
      icon: tpl.icon,
      source: 'builtin' as const,
      bodyPreview: tpl.content.body.trimStart().slice(0, 100),
      builtin: tpl,
    }));

    const customs: MergedTemplate[] = siteTemplates
      .filter((tpl) => tpl.is_active)
      .map((tpl) => ({
        id: `custom-${tpl.id}`,
        name: tpl.name,
        description: tpl.description || '',
        icon: tpl.icon,
        source: 'custom' as const,
        bodyPreview: tpl.body.trimStart().slice(0, 100),
        custom: tpl,
      }));

    return [...builtins, ...customs];
  }, [t, siteTemplates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return mergedTemplates;
    const q = search.toLowerCase();
    return mergedTemplates.filter(
      (tpl) => tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q),
    );
  }, [mergedTemplates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const pageItems = filtered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const handleClose = () => {
    setSelected(null);
    setSearch('');
    setPageIndex(0);
    onClose();
  };

  const handleConfirm = () => {
    const tpl = mergedTemplates.find((t) => t.id === selected);
    if (!tpl) return;
    if (tpl.source === 'builtin' && tpl.builtin) {
      onSelect(tpl.builtin, 'builtin');
    } else if (tpl.source === 'custom' && tpl.custom) {
      onSelect(tpl.custom, 'custom');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPageIndex(0);
    setSelected(null);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('templates.dialogTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('templates.dialogSubtitle')}
        </Typography>

        <TextField
          fullWidth
          size="small"
          placeholder={t('templates.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {siteTemplatesLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {t('common.actions.loading')}
          </Typography>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {t('templates.noResults')}
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                minHeight: 280,
              }}
            >
              {pageItems.map((template) => {
                const Icon = iconMap[template.icon] || ArticleIcon;
                const isSelected = selected === template.id;
                return (
                  <CardActionArea
                    key={template.id}
                    onClick={() => setSelected(template.id)}
                    sx={{
                      borderRadius: 2,
                      border: 2,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                      transition: 'all 0.15s ease-in-out',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      height: '100%',
                      '&:hover': {
                        borderColor: isSelected ? 'primary.main' : 'action.hover',
                      },
                    }}
                  >
                    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: isSelected
                                ? alpha(theme.palette.primary.main, 0.12)
                                : alpha(theme.palette.action.active, 0.08),
                            }}
                          >
                            <Icon
                              sx={{
                                fontSize: 22,
                                color: isSelected ? 'primary.main' : 'action.active',
                              }}
                            />
                          </Box>
                          <Chip
                            label={template.source === 'builtin' ? t('templates.builtIn') : t('templates.custom')}
                            size="small"
                            variant="outlined"
                            color={template.source === 'builtin' ? 'default' : 'secondary'}
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        </Box>
                        {isSelected && (
                          <CheckCircleIcon color="primary" sx={{ fontSize: 22 }} />
                        )}
                      </Box>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                        {template.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1.5,
                          minHeight: 40,
                        }}
                      >
                        {template.description}
                      </Typography>
                      <Box
                        sx={{
                          mt: 'auto',
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.action.active, 0.04),
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            m: 0,
                          }}
                        >
                          {template.bodyPreview}
                        </Typography>
                      </Box>
                    </Box>
                  </CardActionArea>
                );
              })}
            </Box>

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 2 }}>
                <IconButton
                  size="small"
                  disabled={currentPage === 0}
                  onClick={() => setPageIndex(currentPage - 1)}
                >
                  <NavigateBeforeIcon />
                </IconButton>
                <Typography variant="body2" color="text.secondary">
                  {t('templates.page', { current: currentPage + 1, total: totalPages })}
                </Typography>
                <IconButton
                  size="small"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPageIndex(currentPage + 1)}
                >
                  <NavigateNextIcon />
                </IconButton>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {isAdmin && (
            <Button
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => { handleClose(); navigate('/content-templates'); }}
            >
              {t('templates.manageTemplates')}
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleClose}>{t('common.actions.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={!selected || loading}
          >
            {loading ? t('common.actions.loading') : t('templates.useTemplate')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
