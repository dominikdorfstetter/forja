import type { ReactNode } from 'react';
import { alpha, Box, CardActionArea, Typography, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

export interface TemplateCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  bodyPreview: string;
}

interface TemplateSelectCardProps {
  template: TemplateCardData;
  selected: boolean;
  /** Optional chip rendered next to the icon (e.g. built-in vs custom). */
  badge?: ReactNode;
  onSelect: (id: string) => void;
}

/** Selectable template tile shared by the blog and content-template wizards. */
export default function TemplateSelectCard({ template, selected, badge, onSelect }: TemplateSelectCardProps) {
  const theme = useTheme();
  const Icon = iconMap[template.icon] || ArticleIcon;

  const iconTile = (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.action.active, 0.08),
      }}
    >
      <Icon sx={{ fontSize: 22, color: selected ? 'primary.main' : 'action.active' }} />
    </Box>
  );

  return (
    <CardActionArea
      onClick={() => onSelect(template.id)}
      sx={{
        borderRadius: 2,
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
        transition: 'all 0.15s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        height: '100%',
        '&:hover': { borderColor: selected ? 'primary.main' : 'action.hover' },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          {badge ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {iconTile}
              {badge}
            </Box>
          ) : (
            iconTile
          )}
          {selected && <CheckCircleIcon color="primary" sx={{ fontSize: 22 }} />}
        </Box>
        <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 600 }}>{template.name}</Typography>
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
}
