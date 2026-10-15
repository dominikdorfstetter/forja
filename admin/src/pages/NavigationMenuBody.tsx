import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import type { NavigationMenu } from '@/types/api';
import EmptyState from '@/components/shared/EmptyState';

interface NavigationMenuBodyProps {
  selectedMenu: NavigationMenu | null;
  itemsError: unknown;
  itemCount: number;
  canWrite: boolean;
  onAddMenu: () => void;
  onAddItem: () => void;
  /** The items table, rendered once the menu has items. */
  children: ReactNode;
}

/** Content under the menu tabs: empty / error states, else the items table. */
export default function NavigationMenuBody({
  selectedMenu,
  itemsError,
  itemCount,
  canWrite,
  onAddMenu,
  onAddItem,
  children,
}: NavigationMenuBodyProps) {
  const { t } = useTranslation();

  if (!selectedMenu) {
    return (
      <EmptyState
        icon={<MenuIcon sx={{ fontSize: 64 }} />}
        title={t('navigation.menus.empty.title', 'No menus yet')}
        description={t('navigation.menus.empty.description', 'Create a navigation menu to get started')}
        action={canWrite ? { label: t('navigation.menus.addMenu', 'Add Menu'), onClick: onAddMenu } : undefined}
      />
    );
  }

  if (itemsError) {
    return <Alert severity="error">{t('navigation.loadError')}</Alert>;
  }

  if (itemCount === 0) {
    return (
      <EmptyState
        icon={<MenuIcon sx={{ fontSize: 64 }} />}
        title={t('navigation.empty.title')}
        description={t('navigation.empty.description')}
        action={canWrite ? { label: t('navigation.addItem'), onClick: onAddItem } : undefined}
      />
    );
  }

  return children;
}
