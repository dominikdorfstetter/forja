import { useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import SocialLinksTable from '@/components/social/SocialLinksTable';
import { queryKeys } from '@/lib/queryKeys';

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

  const handleReorder = useCallback((activeId: string, overId: string) => {
    const reordered = reorder(activeId, overId);
    if (!reordered) return;
    reorderMutation.mutate(reordered.map((link, index) => ({ id: link.id, display_order: index })));
  }, [reorder, reorderMutation]);

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

      <SocialLinksContent
        hasSite={!!selectedSiteId}
        isLoading={isLoading}
        error={error}
        isEmpty={orderedLinks.length === 0}
        onCreate={openCreate}
      >
        <SocialLinksTable
          links={orderedLinks}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onDelete={openDelete}
          onReorder={handleReorder}
        />
      </SocialLinksContent>

      <SocialLinkFormDialog open={formOpen} siteId={selectedSiteId} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <SocialLinkFormDialog open={!!editing} siteId={selectedSiteId} link={editing} onSubmit={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('socialLinks.deleteDialog.title')} message={t('socialLinks.deleteDialog.message', { title: deleting?.title })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}

interface SocialLinksContentProps {
  hasSite: boolean;
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  onCreate: () => void;
  /** The links table, rendered once links have loaded. */
  children: ReactNode;
}

/** Page body: no-site / loading / error / empty states, else the table. */
function SocialLinksContent({ hasSite, isLoading, error, isEmpty, onCreate, children }: SocialLinksContentProps) {
  const { t } = useTranslation();

  if (!hasSite) {
    return <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('socialLinks.empty.noSite')} />;
  }
  if (isLoading) {
    return <LoadingState label={t('socialLinks.loading')} />;
  }
  if (error) {
    return <Alert severity="error">{t('socialLinks.loadError')}</Alert>;
  }
  if (isEmpty) {
    return <EmptyState icon={<ShareIcon sx={{ fontSize: 64 }} />} title={t('socialLinks.empty.title')} description={t('socialLinks.empty.description')} action={{ label: t('socialLinks.addLink'), onClick: onCreate }} />;
  }
  return children;
}
