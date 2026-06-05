/**
 * Shared Menu / Popover paper treatment for top-bar surfaces
 * (notification bell panel, help menu, account menu). Every drop-down
 * anchored on the AppBar reads from the same sx so they share the
 * same radius, elevation, stroke, and menu-item pill styling — no
 * surprise greys or MUI-default paper chrome.
 */
export const m3MenuPaperSx = {
  bgcolor: 'var(--surface-container-high)',
  color: 'var(--on-surface)',
  border: '1px solid var(--outline-variant)',
  borderRadius: '14px',
  mt: 0.5,
  backgroundImage: 'none',
  boxShadow: '0 6px 24px -8px rgba(0,0,0,0.24), 0 2px 8px -2px rgba(0,0,0,0.12)',
  '& .MuiMenuItem-root': {
    mx: 0.5,
    my: 0.25,
    px: 1.25,
    py: 0.75,
    borderRadius: '10px',
    fontSize: 14,
    minHeight: 36,
    color: 'var(--on-surface)',
    '& .MuiListItemIcon-root': {
      minWidth: 32,
      color: 'var(--on-surface-variant)',
    },
    '&:hover': {
      bgcolor: 'var(--surface-container-highest)',
    },
    '&.Mui-selected, &.Mui-selected:hover': {
      bgcolor: 'var(--primary-container)',
      color: 'var(--on-primary-container)',
      '& .MuiListItemIcon-root': {
        color: 'var(--on-primary-container)',
      },
    },
  },
  '& .MuiDivider-root': {
    borderColor: 'var(--outline-variant)',
    my: 0.5,
  },
} as const;
