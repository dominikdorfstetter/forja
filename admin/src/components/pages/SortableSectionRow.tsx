import { type CSSProperties, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTranslation } from 'react-i18next';
import type { PageSectionResponse } from '@/types/api';

interface SortableSectionRowProps {
  section: PageSectionResponse;
  localeChips: string[];
  primaryTitle: string | null;
  subtitle: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (section: PageSectionResponse) => void;
  onDelete: (section: PageSectionResponse) => void;
  onDuplicate: (section: PageSectionResponse) => void;
  onMoveUp: (section: PageSectionResponse) => void;
  onMoveDown: (section: PageSectionResponse) => void;
}

export default function SortableSectionRow({
  section,
  localeChips,
  primaryTitle,
  subtitle,
  canWrite,
  isAdmin,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: SortableSectionRowProps) {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Build settings summary
  const settingsSummary: string[] = [];
  if (section.settings) {
    const s = section.settings as Record<string, unknown>;
    if (typeof s.columns === 'number') settingsSummary.push(t('sectionEditor.nColumns', { n: s.columns }));
    if (typeof s.style === 'string') settingsSummary.push(s.style);
    if (typeof s.layout === 'string') settingsSummary.push(s.layout);
    if (s.fullWidth) settingsSummary.push(t('sectionEditor.fullWidth'));
  }

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      {...attributes}
      variant="outlined"
      sx={{
        p: 1.5,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
      }}
      onClick={() => onEdit(section)}
      data-testid={`section-card-${section.id}`}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        {/* Drag handle */}
        {canWrite && (
          <IconButton
            size="small"
            sx={{ cursor: 'grab', mt: 0.25 }}
            {...listeners}
            aria-label={t('sectionEditor.dragToReorder')}
            onClick={(e) => e.stopPropagation()}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        )}

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 0.5, alignItems: "center" }}>
            <Chip label={t(`sectionEditor.typeNames.${section.section_type}`)} size="small" variant="outlined" color="primary" />
            {settingsSummary.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {settingsSummary.join(' · ')}
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {primaryTitle || <Typography component="span" variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>{t('pageDetail.sections.untitled')}</Typography>}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {subtitle}
            </Typography>
          )}
          {localeChips.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              {localeChips.map((code) => (
                <Chip key={code} label={code} size="small" color="info" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
              ))}
            </Stack>
          )}
        </Box>

        {/* Overflow menu */}
        {canWrite && (
          <Box onClick={(e) => e.stopPropagation()}>
            <Tooltip title={t('common.actions.more', 'More')}>
              <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label={t('common.actions.more', 'More')}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
              <MenuItem onClick={() => { setMenuAnchor(null); onEdit(section); }}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('common.actions.edit')}</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setMenuAnchor(null); onDuplicate(section); }}>
                <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('common.actions.duplicate', 'Duplicate')}</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setMenuAnchor(null); onMoveUp(section); }} disabled={isFirst}>
                <ListItemIcon><KeyboardArrowUpIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('common.actions.moveUp', 'Move up')}</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setMenuAnchor(null); onMoveDown(section); }} disabled={isLast}>
                <ListItemIcon><KeyboardArrowDownIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('common.actions.moveDown', 'Move down')}</ListItemText>
              </MenuItem>
              {isAdmin && (
                <MenuItem onClick={() => { setMenuAnchor(null); onDelete(section); }} sx={{ color: 'error.main' }}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>{t('common.actions.delete')}</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
