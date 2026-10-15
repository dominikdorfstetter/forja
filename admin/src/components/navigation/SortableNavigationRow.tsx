import { TableRow, TableCell, Box, Typography } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { NavigationItem } from '@/types/api';
import type { FlatItem } from '@/pages/NavigationReducer';
import { useTranslation } from 'react-i18next';
import {
  getNavigationItemDisplayTitle,
  getNavigationItemLinkTarget,
  getNavigationLinkKind,
} from './navigationRowModel';
import {
  NavigationLinkTypeChip,
  NavigationRowActions,
  NavigationTreeConnector,
  NavigationTreeToggle,
} from './NavigationRowCells';
import { DragHandleCell, useSortableRow } from '@/components/shared/listPageV2';

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
  const { attributes, listeners, setNodeRef, style } = useSortableRow(item.id);

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid="nav-row">
      {canWrite && <DragHandleCell listeners={listeners} />}
      {/* Title cell with tree lines and expand/collapse */}
      <TableCell sx={{ pl: 0, py: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: `${depth * 28}px` }}>
          {depth > 0 && <NavigationTreeConnector isLastChild={isLastChild} />}
          <NavigationTreeToggle
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            childCount={childCount}
            onToggle={() => onToggleExpand(item.id)}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {getNavigationItemDisplayTitle(item, pageRouteMap, legalRouteMap)}
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
            {getNavigationItemLinkTarget(item, pageRouteMap, legalRouteMap)}
          </Typography>
        </Box>
      </TableCell>
      {/* Type chip */}
      <TableCell>
        <NavigationLinkTypeChip kind={getNavigationLinkKind(item)} />
      </TableCell>
      {/* Locale coverage */}
      {totalLocales > 0 && (
        <TableCell data-testid="locale-count">
          <Typography variant="caption" color="text.secondary">
            {t('navigation.row.locales', { count: item.locale_count ?? 0, total: totalLocales })}
          </Typography>
        </TableCell>
      )}
      <NavigationRowActions item={item} canWrite={canWrite} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
    </TableRow>
  );
}
