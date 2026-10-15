import { TableCell, IconButton, Tooltip, Box, Badge } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import type { NavigationItem } from '@/types/api';
import type { NavigationLinkKind } from './navigationRowModel';

/** L-shaped connector linking a child row to its parent's tree line. */
export function NavigationTreeConnector({ isLastChild }: { isLastChild: boolean }) {
  return (
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
  );
}

interface NavigationTreeToggleProps {
  hasChildren: boolean;
  isExpanded: boolean;
  childCount: number;
  onToggle: () => void;
}

/** Expand/collapse toggle for parent rows; a same-width spacer for leaves. */
export function NavigationTreeToggle({ hasChildren, isExpanded, childCount, onToggle }: NavigationTreeToggleProps) {
  const { t } = useTranslation();

  if (!hasChildren) return <Box sx={{ width: 28 }} />;

  const label = isExpanded
    ? t('navigation.tree.collapse', 'Collapse')
    : t('navigation.tree.expand', 'Expand');

  return (
    <Tooltip title={label}>
      <Badge
        badgeContent={isExpanded ? 0 : childCount}
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
          onClick={onToggle}
          aria-label={label}
          data-testid="tree-toggle"
          sx={{ mr: 0.5 }}
        >
          {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Badge>
    </Tooltip>
  );
}

interface LinkKindStyle {
  bg: string;
  fg: string;
  border?: string;
  labelKey: string;
  labelDefault?: string;
}

const LINK_KIND_STYLES: Record<NavigationLinkKind, LinkKindStyle> = {
  broken: {
    bg: 'color-mix(in oklch, var(--err) 18%, transparent)',
    fg: 'var(--err)',
    labelKey: 'navigation.brokenLink',
    labelDefault: 'Broken link',
  },
  internal: {
    bg: 'var(--primary-container)',
    fg: 'var(--on-primary-container)',
    labelKey: 'common.labels.internal',
  },
  legal: {
    bg: 'var(--warn-container)',
    fg: 'var(--on-warn-container)',
    labelKey: 'common.labels.legal',
    labelDefault: 'Legal',
  },
  cv: {
    bg: 'var(--tertiary-container)',
    fg: 'var(--on-tertiary-container)',
    labelKey: 'common.labels.cv',
    labelDefault: 'CV',
  },
  blog: {
    bg: 'color-mix(in oklch, var(--info) 18%, transparent)',
    fg: 'var(--info)',
    labelKey: 'common.labels.blog',
    labelDefault: 'Blog',
  },
  external: {
    bg: 'transparent',
    fg: 'var(--on-surface-variant)',
    border: '1px solid var(--outline-variant)',
    labelKey: 'common.labels.external',
  },
};

/** Pill naming the link kind; broken links get a repair hint tooltip. */
export function NavigationLinkTypeChip({ kind }: { kind: NavigationLinkKind }) {
  const { t } = useTranslation();
  const style = LINK_KIND_STYLES[kind];
  const isBroken = kind === 'broken';

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
        bgcolor: style.bg,
        color: style.fg,
        border: style.border ?? 'none',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 11',
      }}
    >
      {t(style.labelKey, { defaultValue: style.labelDefault })}
    </Box>
  );

  if (!isBroken) return chip;

  return (
    <Tooltip title={t('navigation.brokenLinkHint', 'This item lost its link target. Edit it to pick a new one.')}>
      {chip}
    </Tooltip>
  );
}

interface NavigationRowActionsProps {
  item: NavigationItem;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (item: NavigationItem) => void;
  onDelete: (item: NavigationItem) => void;
}

export function NavigationRowActions({ item, canWrite, isAdmin, onEdit, onDelete }: NavigationRowActionsProps) {
  const { t } = useTranslation();

  return (
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
  );
}
