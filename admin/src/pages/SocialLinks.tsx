import { useState, useEffect, useCallback } from 'react';
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
  arrayMove,
} from '@dnd-kit/sortable';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { SocialLink, CreateSocialLinkRequest, UpdateSocialLinkRequest, ReorderItem } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SocialLinkFormDialog from '@/components/social/SocialLinkFormDialog';
import SortableSocialRow from '@/components/social/SortableSocialRow';
import { useQueryClient } from '@tanstack/react-query';

export default function SocialLinksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError } = useErrorSnackbar();

  const {
    formOpen, editing, deleting,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
  } = useListPageState<SocialLink>();

  const [orderedLinks, setOrderedLinks] = useState<SocialLink[]>([]);
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
    queryKey: ['social-links', selectedSiteId],
    queryFn: () => apiService.getSocialLinks(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  useEffect(() => {
    if (links) setOrderedLinks(links);
  }, [links]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateSocialLinkRequest, UpdateSocialLinkRequest
  >({
    queryKey: 'social-links',
    create: {
      mutationFn: (data) => apiService.createSocialLink(selectedSiteId, data),
      successMessage: t('socialLinks.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateSocialLink(id, data),
      successMessage: t('socialLinks.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => apiService.deleteSocialLink(id),
      successMessage: t('socialLinks.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => apiService.reorderSocialLinks(selectedSiteId, items),
    onError: (err) => {
      showError(err);
      queryClient.invalidateQueries({ queryKey: ['social-links'] });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedLinks((prev) => {
      const oldIndex = prev.findIndex((l) => l.id === active.id);
      const newIndex = prev.findIndex((l) => l.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      const items: ReorderItem[] = reordered.map((link, index) => ({
        id: link.id,
        display_order: index,
      }));
      reorderMutation.mutate(items);
      return reordered;
    });
  }, [reorderMutation]);

  const activeLink = activeId ? orderedLinks.find((l) => l.id === activeId) : null;

  return (
    <Box data-testid="social-links.page">
      <PageHeader
        title={t('socialLinks.title')}
        subtitle={t('socialLinks.subtitle')}
        action={selectedSiteId ? { label: t('socialLinks.addLink'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('socialLinks.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('socialLinks.loading')} />
      ) : error ? (
        <Alert severity="error">{t('socialLinks.loadError')}</Alert>
      ) : !orderedLinks || orderedLinks.length === 0 ? (
        <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('socialLinks.empty.title')} description={t('socialLinks.empty.description')} action={{ label: t('socialLinks.addLink'), onClick: openCreate }} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <TableContainer component={Paper}>
            <Table>
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
              <Paper elevation={12} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', pointerEvents: 'none' }}>
                <DragIndicatorIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500} noWrap>{activeLink.title}</Typography>
              </Paper>
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
