import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { Site } from '@/types/api';
import { useTranslation } from 'react-i18next';

interface SiteCardProps {
  site: Site;
  onEdit?: (site: Site) => void;
  onDelete?: (site: Site) => void;
  onView: (site: Site) => void;
}

export default function SiteCard({ site, onEdit, onDelete, onView }: SiteCardProps) {
  const { t } = useTranslation();
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" noWrap>
            {site.name}
          </Typography>
          <Chip
            label={site.is_active ? t('common.status.active') : t('common.status.inactive')}
            size="small"
            color={site.is_active ? 'success' : 'default'}
            variant="outlined"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" fontFamily="monospace" sx={{ mb: 1 }}>
          {site.slug}
        </Typography>
        {site.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {site.description}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled">
          Timezone: {site.timezone}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end' }}>
        <Tooltip title={t('sites.card.view')}>
          <IconButton size="small" onClick={() => onView(site)}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {onEdit && <Tooltip title={t('sites.card.edit')}>
          <IconButton size="small" onClick={() => onEdit(site)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>}
        {onDelete && <Tooltip title={t('sites.card.delete')}>
          <IconButton size="small" color="error" onClick={() => onDelete(site)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>}
      </CardActions>
    </Card>
  );
}
