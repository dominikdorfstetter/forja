import {
  Box,
  Tabs,
  Tab,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { NavigationMenu } from '@/types/api';

interface NavigationMenuTabsProps {
  menus: NavigationMenu[] | undefined;
  selectedMenuIndex: number;
  selectedMenu: NavigationMenu | null;
  canWrite: boolean;
  isAdmin: boolean;
  onSelectMenu: (index: number) => void;
  onAddMenu: () => void;
  onEditMenu: () => void;
  onDeleteMenu: () => void;
}

export default function NavigationMenuTabs({
  menus,
  selectedMenuIndex,
  selectedMenu,
  canWrite,
  isAdmin,
  onSelectMenu,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
}: NavigationMenuTabsProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        mb: 2,
        borderBottom: '1px solid var(--outline-variant)',
      }}
    >
      <Tabs
        value={menus && menus.length > 0 ? selectedMenuIndex : false}
        onChange={(_, newVal) => onSelectMenu(newVal)}
        sx={{
          flexGrow: 1,
          minHeight: 48,
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0',
            backgroundColor: 'var(--primary)',
          },
          '& .MuiTab-root': {
            textTransform: 'uppercase',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            color: 'var(--on-surface-variant)',
            minHeight: 48,
            px: 2.5,
            gap: 0.75,
            fontVariationSettings: '"wght" 600, "opsz" 12',
            '&.Mui-selected': { color: 'var(--primary)' },
          },
        }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {menus?.map((menu) => (
          <Tab
            key={menu.id}
            data-testid={`menu-tab-${menu.slug}`}
            label={
              <Tooltip title={menu.description || ''} placement="top">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span style={{ opacity: menu.is_active ? 1 : 0.5 }}>
                    {menu.slug}
                    {!menu.is_active && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5, fontStyle: 'italic' }}
                      >
                        {t('navigation.menu.inactive', '(inactive)')}
                      </Typography>
                    )}
                  </span>
                  <Typography variant="caption" color="text.secondary">
                    ({menu.item_count})
                  </Typography>
                </Box>
              </Tooltip>
            }
            sx={{
              opacity: menu.is_active ? 1 : 0.6,
              '&.Mui-selected': {
                opacity: 1,
              },
            }}
          />
        ))}
      </Tabs>
      {canWrite && (
        <Tooltip title={t('navigation.menus.addMenu', 'Add Menu')}>
          <IconButton size="small" onClick={onAddMenu} sx={{ ml: 1 }} data-testid="add-menu-btn">
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
      {selectedMenu && canWrite && (
        <Tooltip title={t('navigation.menus.editMenu', 'Menu Settings')}>
          <IconButton size="small" onClick={onEditMenu} data-testid="edit-menu-btn">
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      )}
      {selectedMenu && isAdmin && (
        <Tooltip title={t('navigation.menus.deleteMenu', 'Delete Menu')}>
          <IconButton size="small" color="error" onClick={onDeleteMenu} data-testid="delete-menu-btn">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
