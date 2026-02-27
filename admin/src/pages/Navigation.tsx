import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type {
  NavigationMenu,
  NavigationItem,
  CreateNavigationItemRequest,
  UpdateNavigationItemRequest,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
  ReorderTreeItem,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import NavigationFormDialog from '@/components/navigation/NavigationFormDialog';
import MenuFormDialog from '@/components/navigation/MenuFormDialog';
import SortableNavigationRow from '@/components/navigation/SortableNavigationRow';

/** Flatten a tree of items with depth for display */
function flattenItemsWithDepth(items: NavigationItem[]): { item: NavigationItem; depth: number }[] {
  const result: { item: NavigationItem; depth: number }[] = [];

  const addChildren = (parentId: string | undefined, depth: number) => {
    const children = items
      .filter(i => (i.parent_id || undefined) === parentId)
      .sort((a, b) => a.display_order - b.display_order);
    for (const child of children) {
      result.push({ item: child, depth });
      addChildren(child.id, depth + 1);
    }
  };

  addChildren(undefined, 0);
  return result;
}

export default function NavigationPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  // Menu state
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<NavigationMenu | null>(null);
  const [deletingMenu, setDeletingMenu] = useState<NavigationMenu | null>(null);

  // Item state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavigationItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<NavigationItem | null>(null);
  const [orderedItems, setOrderedItems] = useState<NavigationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const selectedMenu = menus?.[selectedMenuIndex] ?? null;

  // Fetch items for selected menu
  const { data: items, isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ['navigation-items', selectedMenu?.id],
    queryFn: () => apiService.getMenuItems(selectedMenu!.id),
    enabled: !!selectedMenu?.id,
  });

  // Sync ordered list from query data
  useEffect(() => {
    if (items) setOrderedItems(items);
  }, [items]);

  // Reset tab when menus change
  useEffect(() => {
    if (menus && selectedMenuIndex >= menus.length) {
      setSelectedMenuIndex(Math.max(0, menus.length - 1));
    }
  }, [menus, selectedMenuIndex]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Menu mutations
  const createMenuMutation = useMutation({
    mutationFn: (data: CreateNavigationMenuRequest) => apiService.createNavigationMenu(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      setMenuFormOpen(false);
      enqueueSnackbar(t('navigation.menus.messages.created', 'Menu created'), { variant: 'success' });
      // Select the new menu tab
      if (menus) setSelectedMenuIndex(menus.length);
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMenuMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNavigationMenuRequest }) => apiService.updateNavigationMenu(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      setEditingMenu(null);
      enqueueSnackbar(t('navigation.menus.messages.updated', 'Menu updated'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMenuMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteNavigationMenu(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      setDeletingMenu(null);
      setSelectedMenuIndex(0);
      enqueueSnackbar(t('navigation.menus.messages.deleted', 'Menu deleted'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
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
      setFormOpen(false);
      enqueueSnackbar(t('navigation.messages.created'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNavigationItemRequest }) => apiService.updateNavigationItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
      setEditingItem(null);
      enqueueSnackbar(t('navigation.messages.updated'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteNavigationItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
      queryClient.invalidateQueries({ queryKey: ['navigation-menus'] });
      setDeletingItem(null);
      enqueueSnackbar(t('navigation.messages.deleted'), { variant: 'success' });
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const reorderMutation = useMutation({
    mutationFn: (reorderItems: ReorderTreeItem[]) => {
      if (selectedMenu) {
        return apiService.reorderMenuItems(selectedMenu.id, reorderItems);
      }
      // Fallback to site-level reorder
      return apiService.reorderNavigationItems(selectedSiteId, reorderItems.map(i => ({ id: i.id, display_order: i.display_order })));
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  /** Check if `candidateChildId` is a descendant of `parentId` in the flat items list */
  const isDescendant = useCallback((items: NavigationItem[], parentId: string, candidateChildId: string): boolean => {
    let current = items.find(i => i.id === candidateChildId);
    while (current?.parent_id) {
      if (current.parent_id === parentId) return true;
      current = items.find(i => i.id === current!.parent_id);
    }
    return false;
  }, []);

  /** Send reorder request to backend with current parent/order state */
  const sendReorder = useCallback((items: NavigationItem[]) => {
    const reorderItems: ReorderTreeItem[] = items.map(item => ({
      id: item.id,
      parent_id: item.parent_id,
      display_order: item.display_order,
    }));
    reorderMutation.mutate(reorderItems);
  }, [reorderMutation]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over, delta } = event;
    if (!over || active.id === over.id) return;

    const maxDepth = selectedMenu?.max_depth || 3;
    const nestThreshold = 50; // px of rightward drag to trigger nesting
    const shouldNest = delta.x > nestThreshold;

    setOrderedItems((prev) => {
      const flat = flattenItemsWithDepth(prev);
      const activeEntry = flat.find(f => f.item.id === active.id);
      const overEntry = flat.find(f => f.item.id === over.id);
      if (!activeEntry || !overEntry) return prev;

      const activeItem = activeEntry.item;
      const overItem = overEntry.item;

      if (shouldNest) {
        // Nest: make active a child of over
        if (overEntry.depth + 1 >= maxDepth) return prev;
        // Prevent nesting under own descendants (circular)
        if (isDescendant(prev, active.id as string, over.id as string)) return prev;

        const overChildren = prev.filter(i => i.parent_id === overItem.id);
        const updated = prev.map(item =>
          item.id === activeItem.id
            ? { ...item, parent_id: overItem.id, display_order: overChildren.length }
            : item
        );
        sendReorder(updated);
        return updated;
      } else {
        // Reorder: move active to over's position, adopt over's parent
        const newParentId = overItem.parent_id;

        // Get siblings at the target level (excluding active)
        const siblings = prev
          .filter(i => (i.parent_id ?? undefined) === (newParentId ?? undefined) && i.id !== activeItem.id)
          .sort((a, b) => a.display_order - b.display_order);

        // Insert active at over's position among siblings
        const overSiblingIndex = siblings.findIndex(s => s.id === overItem.id);
        const insertIndex = overSiblingIndex >= 0 ? overSiblingIndex : siblings.length;

        // Build new display_order for the target parent group
        const updatedOrders = new Map<string, number>();
        let order = 0;
        for (let i = 0; i < siblings.length + 1; i++) {
          if (i === insertIndex) {
            updatedOrders.set(activeItem.id, order++);
          }
          if (i < siblings.length) {
            updatedOrders.set(siblings[i].id, order++);
          }
        }

        const updated = prev.map(item => {
          if (item.id === activeItem.id) {
            return { ...item, parent_id: newParentId, display_order: updatedOrders.get(item.id) ?? item.display_order };
          }
          const newOrder = updatedOrders.get(item.id);
          if (newOrder !== undefined) {
            return { ...item, display_order: newOrder };
          }
          return item;
        });

        sendReorder(updated);
        return updated;
      }
    });
  }, [reorderMutation, selectedMenu, isDescendant, sendReorder]);

  // Flatten items for display with depth
  const flattenedItems = useMemo(() => flattenItemsWithDepth(orderedItems), [orderedItems]);

  const activeItem = activeId ? orderedItems.find((i) => i.id === activeId) : null;
  const isLoading = menusLoading || itemsLoading;

  return (
    <Box>
      <PageHeader
        title={t('navigation.title')}
        subtitle={t('navigation.subtitle')}
        action={selectedSiteId && selectedMenu ? {
          label: t('navigation.addItem'),
          icon: <AddIcon />,
          onClick: () => setFormOpen(true),
          hidden: !canWrite,
        } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<MenuIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('navigation.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('navigation.loading')} />
      ) : (
        <>
          {/* Menu tabs */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Tabs
              value={menus && menus.length > 0 ? selectedMenuIndex : false}
              onChange={(_, newVal) => setSelectedMenuIndex(newVal)}
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
                <IconButton size="small" onClick={() => { setEditingMenu(null); setMenuFormOpen(true); }} sx={{ ml: 1 }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            )}
            {selectedMenu && canWrite && (
              <Tooltip title={t('navigation.menus.editMenu', 'Menu Settings')}>
                <IconButton size="small" onClick={() => { setEditingMenu(selectedMenu); setMenuFormOpen(true); }}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            )}
            {selectedMenu && isAdmin && (
              <Tooltip title={t('navigation.menus.deleteMenu', 'Delete Menu')}>
                <IconButton size="small" color="error" onClick={() => setDeletingMenu(selectedMenu)}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Items for selected menu */}
          {!selectedMenu ? (
            <EmptyState
              icon={<MenuIcon sx={{ fontSize: 64 }} />}
              title={t('navigation.menus.empty.title', 'No menus yet')}
              description={t('navigation.menus.empty.description', 'Create a navigation menu to get started')}
              action={canWrite ? { label: t('navigation.menus.addMenu', 'Add Menu'), onClick: () => setMenuFormOpen(true) } : undefined}
            />
          ) : itemsError ? (
            <Alert severity="error">{t('navigation.loadError')}</Alert>
          ) : !orderedItems || orderedItems.length === 0 ? (
            <EmptyState
              icon={<MenuIcon sx={{ fontSize: 64 }} />}
              title={t('navigation.empty.title')}
              description={t('navigation.empty.description')}
              action={canWrite ? { label: t('navigation.addItem'), onClick: () => setFormOpen(true) } : undefined}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                      <TableCell scope="col">{t('navigation.table.title', 'Title')}</TableCell>
                      <TableCell scope="col">{t('navigation.table.link')}</TableCell>
                      <TableCell scope="col">{t('navigation.table.type')}</TableCell>
                      <TableCell scope="col">{t('navigation.table.icon')}</TableCell>
                      <TableCell scope="col">{t('navigation.table.newTab')}</TableCell>
                      <TableCell scope="col" align="right">{t('navigation.table.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <SortableContext items={flattenedItems.map(({ item }) => item.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {flattenedItems.map(({ item, depth }) => (
                        <SortableNavigationRow
                          key={item.id}
                          item={item}
                          depth={depth}
                          canWrite={canWrite}
                          isAdmin={isAdmin}
                          onEdit={setEditingItem}
                          onDelete={setDeletingItem}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </TableContainer>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {activeItem ? (
                  <Paper
                    elevation={12}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      pointerEvents: 'none',
                    }}
                  >
                    <DragIndicatorIcon fontSize="small" color="primary" />
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {activeItem.title || activeItem.page_id || activeItem.external_url || '\u2014'}
                    </Typography>
                  </Paper>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {/* Menu form dialog */}
      <MenuFormDialog
        open={menuFormOpen}
        menu={editingMenu}
        onSubmitCreate={(data) => createMenuMutation.mutate(data)}
        onSubmitUpdate={(data) => editingMenu && updateMenuMutation.mutate({ id: editingMenu.id, data })}
        onClose={() => { setMenuFormOpen(false); setEditingMenu(null); }}
        loading={createMenuMutation.isPending || updateMenuMutation.isPending}
      />

      {/* Item form dialog */}
      <NavigationFormDialog
        open={formOpen}
        siteId={selectedSiteId}
        menuId={selectedMenu?.id || ''}
        allItems={orderedItems}
        maxDepth={selectedMenu?.max_depth || 3}
        locales={locales || []}
        onSubmit={(data) => createItemMutation.mutate(data)}
        onClose={() => setFormOpen(false)}
        loading={createItemMutation.isPending}
      />
      <NavigationFormDialog
        open={!!editingItem}
        siteId={selectedSiteId}
        menuId={selectedMenu?.id || ''}
        item={editingItem}
        allItems={orderedItems}
        maxDepth={selectedMenu?.max_depth || 3}
        locales={locales || []}
        onSubmit={(data) => editingItem && updateItemMutation.mutate({ id: editingItem.id, data })}
        onClose={() => setEditingItem(null)}
        loading={updateItemMutation.isPending}
      />

      {/* Delete item confirm */}
      <ConfirmDialog
        open={!!deletingItem}
        title={t('navigation.deleteDialog.title')}
        message={t('navigation.deleteDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingItem && deleteItemMutation.mutate(deletingItem.id)}
        onCancel={() => setDeletingItem(null)}
        loading={deleteItemMutation.isPending}
      />

      {/* Delete menu confirm */}
      <ConfirmDialog
        open={!!deletingMenu}
        title={t('navigation.menus.deleteDialog.title', 'Delete Menu')}
        message={t('navigation.menus.deleteDialog.message', 'This will permanently delete this menu and all its navigation items. This action cannot be undone.')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingMenu && deleteMenuMutation.mutate(deletingMenu.id)}
        onCancel={() => setDeletingMenu(null)}
        loading={deleteMenuMutation.isPending}
      />
    </Box>
  );
}
