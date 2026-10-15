import type { Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createMenuItem,
  createNavigationItem,
  createNavigationMenu,
  deleteNavigationItem,
  deleteNavigationMenu,
  updateNavigationItem,
  updateNavigationMenu,
} from '@/services/navigation';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  NavigationMenu,
  CreateNavigationItemRequest,
  UpdateNavigationItemRequest,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
} from '@/types/api';
import type { uiReducer } from '@/pages/NavigationReducer';
import { queryKeys } from '@/lib/queryKeys';

type UIDispatch = Dispatch<Parameters<typeof uiReducer>[1]>;

interface UseNavigationMutationsArgs {
  selectedSiteId: string;
  menus: NavigationMenu[] | undefined;
  selectedMenu: NavigationMenu | null;
  dispatch: UIDispatch;
}

/** Menu + item CRUD for the Navigation page; each success closes its dialog. */
export function useNavigationMutations({ selectedSiteId, menus, selectedMenu, dispatch }: UseNavigationMutationsArgs) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const invalidateMenus = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.navigationMenus(selectedSiteId) });
  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.navigationItems() });

  const createMenuMutation = useMutation({
    mutationFn: (data: CreateNavigationMenuRequest) => createNavigationMenu(selectedSiteId, data),
    onSuccess: () => {
      invalidateMenus();
      dispatch({ type: 'closeMenuForm' });
      showSuccess(t('navigation.menus.messages.created', 'Menu created'));
      if (menus) dispatch({ type: 'setSelectedMenuIndex', value: menus.length });
    },
    onError: showError,
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNavigationMenuRequest }) => updateNavigationMenu(id, data),
    onSuccess: () => {
      invalidateMenus();
      dispatch({ type: 'setEditingMenu', menu: null });
      dispatch({ type: 'closeMenuForm' });
      showSuccess(t('navigation.menus.messages.updated', 'Menu updated'));
    },
    onError: showError,
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => deleteNavigationMenu(id),
    onSuccess: () => {
      invalidateMenus();
      dispatch({ type: 'closeDeleteMenu' });
      dispatch({ type: 'setSelectedMenuIndex', value: 0 });
      showSuccess(t('navigation.menus.messages.deleted', 'Menu deleted'));
    },
    onError: showError,
  });

  const createItemMutation = useMutation({
    mutationFn: (data: CreateNavigationItemRequest) => {
      if (selectedMenu) {
        return createMenuItem(selectedMenu.id, data);
      }
      return createNavigationItem(selectedSiteId, data);
    },
    onSuccess: () => {
      invalidateItems();
      invalidateMenus();
      dispatch({ type: 'closeItemForm' });
      showSuccess(t('navigation.messages.created'));
    },
    onError: showError,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNavigationItemRequest }) => updateNavigationItem(id, data),
    onSuccess: () => {
      invalidateItems();
      dispatch({ type: 'setEditingItem', item: null });
      showSuccess(t('navigation.messages.updated'));
    },
    onError: showError,
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteNavigationItem(id),
    onSuccess: () => {
      invalidateItems();
      invalidateMenus();
      dispatch({ type: 'closeDeleteItem' });
      showSuccess(t('navigation.messages.deleted'));
    },
    onError: showError,
  });

  return {
    createMenuMutation,
    updateMenuMutation,
    deleteMenuMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
  };
}
