import {
  alpha,
  Box,
  CardActionArea,
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
import { useTranslation } from 'react-i18next';
import { blogTemplates, type BlogTemplate } from '@/data/blogTemplates';

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
  bodyPreview: string;
  builtin: BlogTemplate;
}

const ITEMS_PER_PAGE = 4;

interface TemplateWizardTemplateStepProps {
  selectedTemplate: string | null;
  onSelectTemplate: (id: string) => void;
  templateSearch: string;
  onSearchChange: (value: string) => void;
  templatePage: number;
  onPageChange: (page: number) => void;
}

export default function TemplateWizardTemplateStep({
  selectedTemplate,
  onSelectTemplate,
  templateSearch,
  onSearchChange,
  templatePage,
  onPageChange,
}: TemplateWizardTemplateStepProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const mergedTemplates: MergedTemplate[] = blogTemplates.map((tpl) => ({
    id: tpl.id,
    name: t(tpl.nameKey),
    description: t(tpl.descriptionKey),
    icon: tpl.icon,
    bodyPreview: tpl.content.body.trimStart().slice(0, 100),
    builtin: tpl,
  }));

  const filteredTemplates = (() => {
    if (!templateSearch.trim()) return mergedTemplates;
    const q = templateSearch.toLowerCase();
    return mergedTemplates.filter(
      (tpl) => tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q),
    );
  })();

  const totalTemplatePages = Math.max(1, Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE));
  const currentTemplatePage = Math.min(templatePage, totalTemplatePages - 1);
  const pageTemplateItems = filteredTemplates.slice(currentTemplatePage * ITEMS_PER_PAGE, (currentTemplatePage + 1) * ITEMS_PER_PAGE);

  return (
    <>
      <TextField
        autoFocus
        fullWidth
        size="small"
        placeholder={t('templates.searchPlaceholder')}
        value={templateSearch}
        onChange={(e) => { onSearchChange(e.target.value); onPageChange(0); onSelectTemplate(''); }}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
      />
      {filteredTemplates.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {t('templates.noResults')}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, minHeight: 280 }}>
            {pageTemplateItems.map((template) => {
              const Icon = iconMap[template.icon] || ArticleIcon;
              const isSelected = selectedTemplate === template.id;
              return (
                <CardActionArea
                  key={template.id}
                  onClick={() => onSelectTemplate(template.id)}
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
                    '&:hover': { borderColor: isSelected ? 'primary.main' : 'action.hover' },
                  }}
                >
                  <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40, height: 40, borderRadius: 1.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.action.active, 0.08),
                        }}
                      >
                        <Icon sx={{ fontSize: 22, color: isSelected ? 'primary.main' : 'action.active' }} />
                      </Box>
                      {isSelected && <CheckCircleIcon color="primary" sx={{ fontSize: 22 }} />}
                    </Box>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>{template.description}</Typography>
                    <Box sx={{ mt: 'auto', p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.action.active, 0.04) }}>
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        component="pre"
                        sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', m: 0 }}
                      >
                        {template.bodyPreview}
                      </Typography>
                    </Box>
                  </Box>
                </CardActionArea>
              );
            })}
          </Box>
          {totalTemplatePages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 2 }}>
              <IconButton size="small" disabled={currentTemplatePage === 0} onClick={() => onPageChange(templatePage - 1)}>
                <NavigateBeforeIcon />
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                {t('templates.page', { current: currentTemplatePage + 1, total: totalTemplatePages })}
              </Typography>
              <IconButton size="small" disabled={currentTemplatePage >= totalTemplatePages - 1} onClick={() => onPageChange(templatePage + 1)}>
                <NavigateNextIcon />
              </IconButton>
            </Box>
          )}
        </>
      )}
    </>
  );
}
