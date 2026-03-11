import { useTranslation } from 'react-i18next';
import type {
  NavigationMenu,
  NavigationItem,
  CreateNavigationItemRequest,
  UpdateNavigationItemRequest,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
  Locale,
} from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import NavigationFormDialog from '@/components/navigation/NavigationFormDialog';
import MenuFormDialog from '@/components/navigation/MenuFormDialog';

interface NavigationDialogsProps {
  menuFormOpen: boolean;
  editingMenu: NavigationMenu | null;
  onSubmitCreateMenu: (data: CreateNavigationMenuRequest) => void;
  onSubmitUpdateMenu: (data: UpdateNavigationMenuRequest) => void;
  onCloseMenuForm: () => void;
  menuFormLoading: boolean;

  itemFormOpen: boolean;
  editingItem: NavigationItem | null;
  siteId: string;
  menuId: string;
  orderedItems: NavigationItem[];
  maxDepth: number;
  locales: Locale[];
  onSubmitCreateItem: (data: CreateNavigationItemRequest) => void;
  onSubmitUpdateItem: (data: UpdateNavigationItemRequest) => void;
  onCloseItemForm: () => void;
  onCloseEditItem: () => void;
  createItemLoading: boolean;
  updateItemLoading: boolean;

  deletingItem: NavigationItem | null;
  onConfirmDeleteItem: () => void;
  onCancelDeleteItem: () => void;
  deleteItemLoading: boolean;

  deletingMenu: NavigationMenu | null;
  onConfirmDeleteMenu: () => void;
  onCancelDeleteMenu: () => void;
  deleteMenuLoading: boolean;
}

export default function NavigationDialogs({
  menuFormOpen,
  editingMenu,
  onSubmitCreateMenu,
  onSubmitUpdateMenu,
  onCloseMenuForm,
  menuFormLoading,
  itemFormOpen,
  editingItem,
  siteId,
  menuId,
  orderedItems,
  maxDepth,
  locales,
  onSubmitCreateItem,
  onSubmitUpdateItem,
  onCloseItemForm,
  onCloseEditItem,
  createItemLoading,
  updateItemLoading,
  deletingItem,
  onConfirmDeleteItem,
  onCancelDeleteItem,
  deleteItemLoading,
  deletingMenu,
  onConfirmDeleteMenu,
  onCancelDeleteMenu,
  deleteMenuLoading,
}: NavigationDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <MenuFormDialog
        open={menuFormOpen}
        menu={editingMenu}
        onSubmitCreate={onSubmitCreateMenu}
        onSubmitUpdate={onSubmitUpdateMenu}
        onClose={onCloseMenuForm}
        loading={menuFormLoading}
      />

      <NavigationFormDialog
        open={itemFormOpen}
        siteId={siteId}
        menuId={menuId}
        allItems={orderedItems}
        maxDepth={maxDepth}
        locales={locales}
        onSubmit={onSubmitCreateItem}
        onClose={onCloseItemForm}
        loading={createItemLoading}
      />
      <NavigationFormDialog
        open={!!editingItem}
        siteId={siteId}
        menuId={menuId}
        item={editingItem}
        allItems={orderedItems}
        maxDepth={maxDepth}
        locales={locales}
        onSubmit={onSubmitUpdateItem}
        onClose={onCloseEditItem}
        loading={updateItemLoading}
      />

      <ConfirmDialog
        open={!!deletingItem}
        title={t('navigation.deleteDialog.title')}
        message={t('navigation.deleteDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={onConfirmDeleteItem}
        onCancel={onCancelDeleteItem}
        loading={deleteItemLoading}
        confirmationText={t('common.actions.delete')}
      />

      <ConfirmDialog
        open={!!deletingMenu}
        title={t('navigation.menus.deleteDialog.title', 'Delete Menu')}
        message={t('navigation.menus.deleteDialog.message', 'This will permanently delete this menu and all its navigation items. This action cannot be undone.')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={onConfirmDeleteMenu}
        onCancel={onCancelDeleteMenu}
        loading={deleteMenuLoading}
        confirmationText={t('common.actions.delete')}
      />
    </>
  );
}
