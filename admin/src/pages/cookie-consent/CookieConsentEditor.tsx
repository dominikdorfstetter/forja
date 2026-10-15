import { Box } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { LegalDocumentResponse } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { M3Button } from '@/components/design-system';
import CookieDocInfoCard, { type PendingAction } from './CookieDocInfoCard';
import CookieGroupFormDialog from './CookieGroupFormDialog';
import CookieGroupList from './CookieGroupList';
import { useCookieGroups } from './useCookieGroups';

interface CookieConsentEditorProps {
  cookieDoc: LegalDocumentResponse;
  embedded: boolean;
  publish: PendingAction;
  unpublish: PendingAction;
}

/** Cookie-consent management once the document exists: doc card + groups. */
export default function CookieConsentEditor({ cookieDoc, embedded, publish, unpublish }: CookieConsentEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canWrite, isAdmin } = useAuth();
  const {
    groups,
    groupsLoading,
    groupsError,
    dialogState,
    dialogDispatch,
    createGroupMutation,
    updateGroupMutation,
    deleteGroupMutation,
    moveGroup,
  } = useCookieGroups(cookieDoc.id);

  const openDocument = () => navigate(`/legal/${cookieDoc.id}`);
  const openGroupForm = () => dialogDispatch({ type: 'OPEN_GROUP_FORM' });
  const nextOrder = groups?.length ?? 0;
  const { editingGroup, deletingGroup } = dialogState;

  return (
    <Box data-testid="cookie-consent.page">
      {!embedded && (
        <PageHeader
          icon="cookie"
          title={t('cookieConsent.title')}
          subtitle={t('cookieConsent.subtitle')}
          breadcrumbs={[
            { label: t('layout.sidebar.content') },
            { label: t('layout.sidebar.legal'), path: '/legal' },
            { label: t('cookieConsent.title') },
          ]}
          action={{
            label: t('cookieConsent.manageDocument'),
            icon: <OpenInNewIcon />,
            onClick: openDocument,
          }}
        />
      )}

      <CookieDocInfoCard
        cookieDoc={cookieDoc}
        canWrite={canWrite}
        publish={publish}
        unpublish={unpublish}
        onEditContent={openDocument}
      />

      {/* Groups section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box
          component="h2"
          sx={{
            m: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 700, "opsz" 20',
            letterSpacing: -0.2,
          }}
        >
          {t('legalDetail.groups.title')}
        </Box>
        {canWrite && (
          <M3Button
            variant="filled"
            icon="add"
            onClick={openGroupForm}
            data-testid="cookie-consent.add-group-btn"
          >
            {t('legalDetail.groups.add')}
          </M3Button>
        )}
      </Box>

      <CookieGroupList
        groups={groups}
        loading={groupsLoading}
        error={groupsError}
        canWrite={canWrite}
        isAdmin={isAdmin}
        onAdd={openGroupForm}
        onMove={moveGroup}
        onEdit={(group) => dialogDispatch({ type: 'SET_EDITING_GROUP', payload: group })}
        onDelete={(group) => dialogDispatch({ type: 'SET_DELETING_GROUP', payload: group })}
      />

      {/* Group form dialogs */}
      <CookieGroupFormDialog
        open={dialogState.groupFormOpen}
        nextOrder={nextOrder}
        onSubmit={(data) => createGroupMutation.mutate(data)}
        onClose={() => dialogDispatch({ type: 'CLOSE_GROUP_FORM' })}
        loading={createGroupMutation.isPending}
      />
      <CookieGroupFormDialog
        open={!!editingGroup}
        group={editingGroup}
        nextOrder={nextOrder}
        onSubmit={(data) => editingGroup && updateGroupMutation.mutate({ groupId: editingGroup.id, data })}
        onClose={() => dialogDispatch({ type: 'SET_EDITING_GROUP', payload: null })}
        loading={updateGroupMutation.isPending}
      />
      <ConfirmDialog
        open={!!deletingGroup}
        title={t('legalDetail.groups.deleteGroup')}
        message={t('legalDetail.groups.deleteMessage', { name: deletingGroup?.cookie_name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingGroup && deleteGroupMutation.mutate(deletingGroup.id)}
        onCancel={() => dialogDispatch({ type: 'SET_DELETING_GROUP', payload: null })}
        loading={deleteGroupMutation.isPending}
      />
    </Box>
  );
}
