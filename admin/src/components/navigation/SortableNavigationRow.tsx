import { type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Badge,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { NavigationItem } from '@/types/api';
import type { FlatItem } from '@/pages/NavigationReducer';
import { useTranslation } from 'react-i18next';

interface SortableNavigationRowProps {
  flatItem: FlatItem;
  isExpanded: boolean;
  totalLocales: number;
  pageRouteMap: Map<string, string>;
  legalRouteMap: Map<string, string>;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
  onToggleExpand: (id: string) => void;
}

export default function SortableNavigationRow({
  flatItem,
  isExpanded,
  totalLocales,
  pageRouteMap,
  legalRouteMap,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
  onToggleExpand,
}: SortableNavigationRowProps) {
  const { item, depth, isLastChild, hasChildren, childCount } = flatItem;
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const legalRoute = item.legal_document_id && legalRouteMap.get(item.legal_document_id);
  const displayTitle = item.title || (item.page_id && pageRouteMap.get(item.page_id)) || item.external_url || legalRoute || '\u2014';
  const linkTarget = (item.page_id && (pageRouteMap.get(item.page_id) || item.page_id))
    || (item.legal_document_id && (legalRoute || item.legal_document_id))
    || item.external_url
    || '\u2014';
  const isInternal = !!item.page_id;
  const isLegalLink = !!item.legal_document_id;
  const isBlogLink = !isInternal && item.external_url?.startsWith('/blog/');
  const isCvLink = !isInternal && item.external_url === '/cv';
  const isBroken = !item.page_id && !item.external_url && !item.legal_document_id;

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="nav-row">
      {canWrite && (
        <TableCell sx={{ width: 48, px: 1 }}>
          <Tooltip title={t('navigation.dragToReorder', 'Drag to reorder')}>
            <IconButton
              size="small"
              sx={{
                cursor: 'grab',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              {...listeners}
              aria-label={t('navigation.dragToReorder', 'Drag to reorder')}
              data-testid="drag-handle"
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      )}
      {/* Title cell with tree lines and expand/collapse */}
      <TableCell sx={{ pl: 0, py: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: `${depth * 28}px` }}>
          {/* Tree connector */}
          {depth > 0 && (
            <Box
              sx={{
                width: 20,
                height: '100%',
                position: 'relative',
                mr: 0.5,
                flexShrink: 0,
                color: 'divider',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: isLastChild ? '50%' : 0,
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  width: 12,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                },
              }}
              data-testid="tree-connector"
            />
          )}

          {/* Expand/collapse toggle for parent items */}
          {hasChildren ? (
            <Tooltip
              title={isExpanded
                ? t('navigation.tree.collapse', 'Collapse')
                : t('navigation.tree.expand', 'Expand')}
            >
              <Badge
                badgeContent={!isExpanded ? childCount : 0}
                color="default"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.65rem',
                    height: 16,
                    minWidth: 16,
                  },
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => onToggleExpand(item.id)}
                  aria-label={isExpanded
                    ? t('navigation.tree.collapse', 'Collapse')
                    : t('navigation.tree.expand', 'Expand')}
                  data-testid="tree-toggle"
                  sx={{ mr: 0.5 }}
                >
                  {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              </Badge>
            </Tooltip>
          ) : (
            (<Box sx={{ width: 28 }} />) // spacer to align with expand toggle
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {displayTitle}
            </Typography>
            {item.open_in_new_tab && (
              <OpenInNewIcon sx={{ fontSize: 12, ml: 0.5, flexShrink: 0, color: 'text.secondary' }} />
            )}
          </Box>
        </Box>
      </TableCell>
      {/* Link target */}
      <TableCell data-testid="link-target">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LinkIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }} noWrap>
            {linkTarget}
          </Typography>
        </Box>
      </TableCell>
      {/* Type chip */}
      <TableCell>
        {(() => {
          const paint = isBroken
            ? {
                bg: 'color-mix(in oklch, var(--err) 18%, transparent)',
                fg: 'var(--err)',
                label: t('navigation.brokenLink', 'Broken link'),
              }
            : isInternal
              ? { bg: 'var(--primary-container)', fg: 'var(--on-primary-container)', label: t('common.labels.internal') }
              : isLegalLink
                ? {
                    bg: 'var(--warn-container)',
                    fg: 'var(--on-warn-container)',
                    label: t('common.labels.legal', 'Legal'),
                  }
                : isCvLink
                  ? {
                      bg: 'var(--tertiary-container)',
                      fg: 'var(--on-tertiary-container)',
                      label: t('common.labels.cv', 'CV'),
                    }
                  : isBlogLink
                    ? {
                        bg: 'color-mix(in oklch, var(--info) 18%, transparent)',
                        fg: 'var(--info)',
                        label: t('common.labels.blog', 'Blog'),
                      }
                    : {
                        bg: 'transparent',
                        fg: 'var(--on-surface-variant)',
                        border: '1px solid var(--outline-variant)',
                        label: t('common.labels.external'),
                      };
          const chip = (
            <Box
              component="span"
              data-testid={isBroken ? 'broken-link-chip' : 'type-chip'}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1.25,
                height: 22,
                borderRadius: '999px',
                bgcolor: paint.bg,
                color: paint.fg,
                border: paint.border ?? 'none',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.3,
                fontVariationSettings: '"wght" 600, "opsz" 11',
              }}
            >
              {paint.label}
            </Box>
          );
          return isBroken ? (
            <Tooltip title={t('navigation.brokenLinkHint', 'This item lost its link target. Edit it to pick a new one.')}>
              {chip}
            </Tooltip>
          ) : chip;
        })()}
      </TableCell>
      {/* Locale coverage */}
      {totalLocales > 0 && (
        <TableCell data-testid="locale-count">
          <Typography variant="caption" color="text.secondary">
            {t('navigation.row.locales', { count: item.locale_count ?? 0, total: totalLocales })}
          </Typography>
        </TableCell>
      )}
      {/* Actions */}
      <TableCell align="right">
        {canWrite && (
          <Tooltip title={t('common.actions.edit')}>
            <IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEdit(item)} data-testid="edit-nav-item">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && (
          <Tooltip title={t('common.actions.delete')}>
            <IconButton
              size="small"
              aria-label={t('common.actions.delete')}
              color="error"
              onClick={() => onDelete(item)}
              data-testid="delete-nav-item"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
