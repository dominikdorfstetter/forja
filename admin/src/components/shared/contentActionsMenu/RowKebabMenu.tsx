import { useState, type ReactNode } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';

export interface RowKebabMenuEntry<T> {
  id: string;
  icon: ReactNode;
  label: string;
  handler: (item: T) => void;
}

export interface RowKebabMenuProps<T> {
  item: T;
  isAdmin: boolean;
  /** data-testid of the kebab trigger, e.g. `project-actions.btn.menu`. */
  testId: string;
  entries: RowKebabMenuEntry<T>[];
  /** Admin-only, rendered below a divider in the error colour. */
  onDelete: (item: T) => void;
}

/** Kebab (⋮) row menu: the given entries, then an admin-only delete below a divider. */
export function RowKebabMenu<T>({ item, isAdmin, testId, entries, onDelete }: RowKebabMenuProps<T>) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClose = () => setAnchorEl(null);
  const select = (handler: (item: T) => void) => {
    handleClose();
    handler(item);
  };

  return (
    <>
      <IconButton size="small" aria-label={t('common.table.actions')} aria-haspopup="menu" aria-expanded={!!anchorEl} data-testid={testId} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        {entries.map(({ id, icon, label, handler }) => (
          <MenuItem key={id} onClick={() => select(handler)}>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}

        {isAdmin && <Divider />}

        {isAdmin && (
          <MenuItem onClick={() => select(onDelete)}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>{t('common.actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
