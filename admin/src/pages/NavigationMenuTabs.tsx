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
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <Tabs
        value={menus && menus.length > 0 ? selectedMenuIndex : false}
        onChange={(_, newVal) => onSelectMenu(newVal)}
        sx={{ flexGrow: 1 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {menus?.map((menu) => (
          <Tab
            key={menu.id}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{menu.slug}</span>
                <Typography variant="caption" color="text.secondary">({menu.item_count})</Typography>
              </Box>
            }
          />
        ))}
      </Tabs>
      {canWrite && (
        <Tooltip title={t('navigation.menus.addMenu', 'Add Menu')}>
          <IconButton size="small" onClick={onAddMenu} sx={{ ml: 1 }}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
      {selectedMenu && canWrite && (
        <Tooltip title={t('navigation.menus.editMenu', 'Menu Settings')}>
          <IconButton size="small" onClick={onEditMenu}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      )}
      {selectedMenu && isAdmin && (
        <Tooltip title={t('navigation.menus.deleteMenu', 'Delete Menu')}>
          <IconButton size="small" color="error" onClick={onDeleteMenu}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
