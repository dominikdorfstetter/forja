import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
import { useQuery, useMutation } from '@tanstack/react-query';
import { createSocialLink, deleteSocialLink, getSocialLinks, reorderSocialLinks, updateSocialLink } from '@/services/social';
import type { SocialLink, CreateSocialLinkRequest, UpdateSocialLinkRequest, ReorderItem } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useReorderableList } from '@/hooks/useReorderableList';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SocialLinkFormDialog from '@/components/social/SocialLinkFormDialog';
import SortableSocialRow from '@/components/social/SortableSocialRow';
import { useTableDensity } from '@/components/shared/listPageV2';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export default function SocialLinksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError } = useErrorSnackbar();
  const { size, rowHeight } = useTableDensity();

  const {
    formOpen, editing, deleting,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
  } = useListPageState<SocialLink>();

  const [activeId, setActiveId] = useState<string | null>(null);

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-social-link') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data: links, isLoading, error } = useQuery({
    queryKey: queryKeys.socialLinks(selectedSiteId),
    queryFn: () => getSocialLinks(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { orderedItems: orderedLinks, reorder, resetOrder } = useReorderableList(links);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateSocialLinkRequest, UpdateSocialLinkRequest
  >({
    queryKey: 'social-links',
    create: {
      mutationFn: (data) => createSocialLink(selectedSiteId, data),
      successMessage: t('socialLinks.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => updateSocialLink(id, data),
      successMessage: t('socialLinks.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => deleteSocialLink(id),
      successMessage: t('socialLinks.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => reorderSocialLinks(selectedSiteId, items),
    onError: (err) => {
      showError(err);
      resetOrder();
      queryClient.invalidateQueries({ queryKey: queryKeys.socialLinks(selectedSiteId) });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const reordered = reorder(active.id as string, over.id as string);
    if (!reordered) return;
    const items: ReorderItem[] = reordered.map((link, index) => ({
      id: link.id,
      display_order: index,
    }));
    reorderMutation.mutate(items);
  }, [reorder, reorderMutation]);

  const activeLink = activeId ? orderedLinks.find((l) => l.id === activeId) : null;

  return (
    <Box data-testid="social-links.page">
      <PageHeader
        icon="share"
        title={t('socialLinks.title')}
        subtitle={t('socialLinks.subtitle')}
        breadcrumbs={[
          { label: t('layout.sidebar.structure') },
          { label: t('layout.sidebar.socialLinks') },
        ]}
        action={selectedSiteId ? { label: t('socialLinks.addLink'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite, testId: 'add-social-link' } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('socialLinks.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('socialLinks.loading')} />
      ) : error ? (
        <Alert severity="error">{t('socialLinks.loadError')}</Alert>
      ) : orderedLinks.length === 0 ? (
        <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('socialLinks.empty.title')} description={t('socialLinks.empty.description')} action={{ label: t('socialLinks.addLink'), onClick: openCreate }} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <TableContainer
            data-density={size === 'small' ? 'compact' : 'comfortable'}
            sx={{
              bgcolor: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '20px',
              overflow: 'hidden',
            }}
          >
            <Table
              size={size}
              sx={{
                '& td': {
                  borderBottom: '1px solid var(--outline-variant)',
                  color: 'var(--on-surface)',
                  height: rowHeight,
                },
                '& tbody tr': {
                  transition: 'background 160ms cubic-bezier(0.2, 0, 0, 1)',
                  '&:hover': { bgcolor: 'var(--surface-container)' },
                },
                '& tbody tr:last-of-type td': { borderBottom: 'none' },
                '& th': {
                  color: 'var(--on-surface-variant)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--outline-variant)',
                  fontVariationSettings: '"wght" 600, "opsz" 11',
                  height: 44,
                  py: 0,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                  <TableCell scope="col">{t('socialLinks.table.title')}</TableCell>
                  <TableCell scope="col">{t('socialLinks.table.url')}</TableCell>
                  <TableCell scope="col">{t('socialLinks.table.icon')}</TableCell>
                  <TableCell scope="col" align="right">{t('socialLinks.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={orderedLinks.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {orderedLinks.map((link) => (
                    <SortableSocialRow key={link.id} link={link} canWrite={canWrite} isAdmin={isAdmin} onEdit={openEdit} onDelete={openDelete} />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </TableContainer>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeLink ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: '14px',
                  bgcolor: 'var(--surface-container-highest)',
                  border: '1px solid var(--primary)',
                  boxShadow: '0 12px 24px -6px rgb(0 0 0 / 0.45)',
                  pointerEvents: 'none',
                  color: 'var(--on-surface)',
                }}
              >
                <DragIndicatorIcon fontSize="small" sx={{ color: 'var(--primary)' }} />
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: 600, fontVariationSettings: '"wght" 600, "opsz" 14' }}
                >
                  {activeLink.title}
                </Typography>
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <SocialLinkFormDialog open={formOpen} siteId={selectedSiteId} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <SocialLinkFormDialog open={!!editing} siteId={selectedSiteId} link={editing} onSubmit={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('socialLinks.deleteDialog.title')} message={t('socialLinks.deleteDialog.message', { title: deleting?.title })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
