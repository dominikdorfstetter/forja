import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import type { NavigationItem } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import NavigationMenuTabs from '@/pages/NavigationMenuTabs';
import NavigationMenuBody from '@/pages/NavigationMenuBody';
import NavigationDialogs from '@/pages/NavigationDialogs';
import NavigationItemsTable from '@/pages/NavigationItemsTable';
import { uiReducer, initialUIState, flattenItemsWithDepth, getParentIds } from '@/pages/NavigationReducer';
import { useNavigationDragDrop } from '@/pages/useNavigationDragDrop';
import { useNavigationQueries } from '@/pages/useNavigationQueries';
import { useNavigationMutations } from '@/pages/useNavigationMutations';

export default function NavigationPage() {
  const { t } = useTranslation();
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

  const {
    menus,
    selectedMenu,
    items,
    itemsError,
    isLoading,
    locales,
    pageRouteMap,
    legalRouteMap,
  } = useNavigationQueries(selectedSiteId, ui.selectedMenuIndex);

  // Sync ordered list from query data and auto-expand parents
  const prevItemsRef = useRef<NavigationItem[] | undefined>(undefined);
  useEffect(() => {
    if (items && items !== prevItemsRef.current) {
      setOrderedItems(items);
      // Auto-expand all parent items on first load
      const parentIds = getParentIds(items);
      if (parentIds.length > 0) {
        dispatch({ type: 'expandAll', ids: parentIds });
      }
    }
    prevItemsRef.current = items;
  });

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

  const {
    createMenuMutation,
    updateMenuMutation,
    deleteMenuMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
  } = useNavigationMutations({ selectedSiteId, menus, selectedMenu, dispatch });

  // Flatten items for display with depth and tree metadata
  const flattenedItems = useMemo(
    () => flattenItemsWithDepth(orderedItems, ui.expandedIds),
    [orderedItems, ui.expandedIds],
  );

  const openItemForm = () => dispatch({ type: 'openItemForm' });

  return (
    <Box data-testid="navigation.page">
      <PageHeader
        icon="menu_book"
        title={t('navigation.title')}
        subtitle={t('navigation.subtitle')}
        breadcrumbs={[
          { label: t('layout.sidebar.structure') },
          { label: t('layout.sidebar.navigation') },
        ]}
        action={selectedSiteId && selectedMenu ? {
          label: t('navigation.addItem'),
          icon: <AddIcon />,
          onClick: openItemForm,
          hidden: !canWrite,
          testId: 'add-nav-item',
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

          <NavigationMenuBody
            selectedMenu={selectedMenu}
            itemsError={itemsError}
            itemCount={orderedItems.length}
            canWrite={canWrite}
            onAddMenu={() => dispatch({ type: 'openMenuForm' })}
            onAddItem={openItemForm}
          >
            <NavigationItemsTable
              flattenedItems={flattenedItems}
              orderedItems={orderedItems}
              activeId={ui.activeId}
              expandedIds={ui.expandedIds}
              totalLocales={locales.length}
              pageRouteMap={pageRouteMap}
              legalRouteMap={legalRouteMap}
              canWrite={canWrite}
              isAdmin={isAdmin}
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onEdit={(i) => dispatch({ type: 'setEditingItem', item: i })}
              onDelete={(i) => dispatch({ type: 'openDeleteItem', item: i })}
              onToggleExpand={(id) => dispatch({ type: 'toggleExpanded', id })}
            />
          </NavigationMenuBody>
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
        locales={locales}
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
