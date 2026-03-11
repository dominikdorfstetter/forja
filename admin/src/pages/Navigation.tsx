import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  NavigationItem,
  CreateNavigationItemRequest,
  UpdateNavigationItemRequest,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import NavigationMenuTabs from '@/pages/NavigationMenuTabs';
import NavigationDialogs from '@/pages/NavigationDialogs';
import NavigationItemsTable from '@/pages/NavigationItemsTable';
import { uiReducer, initialUIState, flattenItemsWithDepth } from '@/pages/NavigationReducer';
import { useNavigationDragDrop } from '@/pages/useNavigationDragDrop';

export default function NavigationPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const [ui, dispatch] = useReducer(uiReducer, initialUIState);
  const [orderedItems, setOrderedItems] = useReducer(
    (_: NavigationItem[], next: NavigationItem[] | ((prev: NavigationItem[]) => NavigationItem[])) =>
      typeof next === 'function' ? next(_) : next,
    [] as NavigationItem[],
  );

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-nav-item') dispatch({ type: 'openItemForm' });
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  // Fetch menus
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: ['navigation-menus', selectedSiteId],
    queryFn: () => apiService.getNavigationMenus(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  // Fetch site-specific locales for title fields
  const { data: siteLocalesRaw } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const locales = (siteLocalesRaw || [])
    .filter((sl) => sl.is_active)
    .map((sl) => ({ id: sl.locale_id, code: sl.code, name: sl.name, native_name: sl.native_name, direction: sl.direction, is_active: sl.is_active, created_at: sl.created_at }));

  const selectedMenu = menus?.[ui.selectedMenuIndex] ?? null;

  // Fetch items for selected menu
  const { data: items, isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['navigation-items', selectedMenu?.id],
    queryFn: () => apiService.getMenuItems(selectedMenu!.id),
    enabled: !!selectedMenu?.id,
  });

  // Sync ordered list from query data
  const prevItemsRef = useRef<NavigationItem[] | undefined>(undefined);
  if (items && items !== prevItemsRef.current) {
    setOrderedItems(items);
  }
  prevItemsRef.current = items;

  // Reset tab when menus change
  useEffect(() => {
    if (menus && ui.selectedMenuIndex >= menus.length) {
      dispatch({ type: 'setSelectedMenuIndex', value: Math.max(0, menus.length - 1) });
    }
  }, [menus, ui.selectedMenuIndex]);

  const onDragStarted = useCallback((id: string) => {
    dispatch({ type: 'setActiveId', id });
  }, []);

  const onDragEnded = useCallback(() => {
    dispatch({ type: 'setActiveId', id: null });
  }, []);

  const { sensors, handleDragStart, handleDragEnd } = useNavigationDragDrop({
    selectedSiteId,
    selectedMenu,
    setOrderedItems,
    onDragStarted,
    onDragEnded,
  });

  // Menu mutations
  const createMenuMutation = useMutation({
    mutationFn: (data: CreateNavigationMenuRequest) => apiService.createNavigationMenu(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      dispatch({ type: 'closeMenuForm' });
      showSuccess(t('navigation.menus.messages.created', 'Menu created'));
      if (menus) dispatch({ type: 'setSelectedMenuIndex', value: menus.length });
    },
    onError: showError,
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNavigationMenuRequest }) => apiService.updateNavigationMenu(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      dispatch({ type: 'setEditingMenu', menu: null });
      dispatch({ type: 'closeMenuForm' });
      showSuccess(t('navigation.menus.messages.updated', 'Menu updated'));
    },
    onError: showError,
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteNavigationMenu(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      dispatch({ type: 'closeDeleteMenu' });
      dispatch({ type: 'setSelectedMenuIndex', value: 0 });
      showSuccess(t('navigation.menus.messages.deleted', 'Menu deleted'));
    },
    onError: showError,
  });

  // Item mutations
  const createItemMutation = useMutation({
    mutationFn: (data: CreateNavigationItemRequest) => {
      if (selectedMenu) {
        return apiService.createMenuItem(selectedMenu.id, data);
      }
      return apiService.createNavigationItem(selectedSiteId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      dispatch({ type: 'closeItemForm' });
      showSuccess(t('navigation.messages.created'));
    },
    onError: showError,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNavigationItemRequest }) => apiService.updateNavigationItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
      dispatch({ type: 'setEditingItem', item: null });
      showSuccess(t('navigation.messages.updated'));
    },
    onError: showError,
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteNavigationItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      dispatch({ type: 'closeDeleteItem' });
      showSuccess(t('navigation.messages.deleted'));
    },
    onError: showError,
  });

  // Flatten items for display with depth
  const flattenedItems = useMemo(() => flattenItemsWithDepth(orderedItems), [orderedItems]);

  const isLoading = menusLoading || itemsLoading;

  return (
    <Box data-testid="navigation.page">
      <PageHeader
        title={t('navigation.title')}
        subtitle={t('navigation.subtitle')}
        action={selectedSiteId && selectedMenu ? {
          label: t('navigation.addItem'),
          icon: <AddIcon />,
          onClick: () => dispatch({ type: 'openItemForm' }),
          hidden: !canWrite,
        } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<MenuIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('navigation.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('navigation.loading')} />
      ) : (
        <>
          <NavigationMenuTabs
            menus={menus}
            selectedMenuIndex={ui.selectedMenuIndex}
            selectedMenu={selectedMenu}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onSelectMenu={(index) => dispatch({ type: 'setSelectedMenuIndex', value: index })}
            onAddMenu={() => { dispatch({ type: 'setEditingMenu', menu: null }); dispatch({ type: 'openMenuForm' }); }}
            onEditMenu={() => { dispatch({ type: 'setEditingMenu', menu: selectedMenu }); dispatch({ type: 'openMenuForm' }); }}
            onDeleteMenu={() => selectedMenu && dispatch({ type: 'openDeleteMenu', menu: selectedMenu })}
          />

          {!selectedMenu ? (
            <EmptyState
              icon={<MenuIcon sx={{ fontSize: 64 }} />}
              title={t('navigation.menus.empty.title', 'No menus yet')}
              description={t('navigation.menus.empty.description', 'Create a navigation menu to get started')}
              action={canWrite ? { label: t('navigation.menus.addMenu', 'Add Menu'), onClick: () => dispatch({ type: 'openMenuForm' }) } : undefined}
            />
          ) : itemsError ? (
            <Alert severity="error">{t('navigation.loadError')}</Alert>
          ) : !orderedItems || orderedItems.length === 0 ? (
            <EmptyState
              icon={<MenuIcon sx={{ fontSize: 64 }} />}
              title={t('navigation.empty.title')}
              description={t('navigation.empty.description')}
              action={canWrite ? { label: t('navigation.addItem'), onClick: () => dispatch({ type: 'openItemForm' }) } : undefined}
            />
          ) : (
            <NavigationItemsTable
              flattenedItems={flattenedItems}
              orderedItems={orderedItems}
              activeId={ui.activeId}
              canWrite={canWrite}
              isAdmin={isAdmin}
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onEdit={(i) => dispatch({ type: 'setEditingItem', item: i })}
              onDelete={(i) => dispatch({ type: 'openDeleteItem', item: i })}
            />
          )}
        </>
      )}

      <NavigationDialogs
        menuFormOpen={ui.menuFormOpen}
        editingMenu={ui.editingMenu}
        onSubmitCreateMenu={(data) => createMenuMutation.mutate(data)}
        onSubmitUpdateMenu={(data) => ui.editingMenu && updateMenuMutation.mutate({ id: ui.editingMenu.id, data })}
        onCloseMenuForm={() => dispatch({ type: 'closeMenuForm' })}
        menuFormLoading={createMenuMutation.isPending || updateMenuMutation.isPending}
        itemFormOpen={ui.formOpen}
        editingItem={ui.editingItem}
        siteId={selectedSiteId}
        menuId={selectedMenu?.id || ''}
        orderedItems={orderedItems}
        maxDepth={selectedMenu?.max_depth || 3}
        locales={locales || []}
        onSubmitCreateItem={(data) => createItemMutation.mutate(data)}
        onSubmitUpdateItem={(data) => ui.editingItem && updateItemMutation.mutate({ id: ui.editingItem.id, data })}
        onCloseItemForm={() => dispatch({ type: 'closeItemForm' })}
        onCloseEditItem={() => dispatch({ type: 'setEditingItem', item: null })}
        createItemLoading={createItemMutation.isPending}
        updateItemLoading={updateItemMutation.isPending}
        deletingItem={ui.deletingItem}
        onConfirmDeleteItem={() => ui.deletingItem && deleteItemMutation.mutate(ui.deletingItem.id)}
        onCancelDeleteItem={() => dispatch({ type: 'closeDeleteItem' })}
        deleteItemLoading={deleteItemMutation.isPending}
        deletingMenu={ui.deletingMenu}
        onConfirmDeleteMenu={() => ui.deletingMenu && deleteMenuMutation.mutate(ui.deletingMenu.id)}
        onCancelDeleteMenu={() => dispatch({ type: 'closeDeleteMenu' })}
        deleteMenuLoading={deleteMenuMutation.isPending}
      />
    </Box>
  );
}
