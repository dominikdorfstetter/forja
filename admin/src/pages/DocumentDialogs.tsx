import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DocumentFormDialog, { type DocumentFormResult } from '@/components/documents/DocumentFormDialog';
import type { PasswordPolicy } from '@/components/documents/passwordUtils';
import type {
  DocumentResponse,
  DocumentListItem,
  DocumentFolder,
  Locale,
} from '@/types/api';

interface DocumentDialogsProps {
  formOpen: boolean;
  editingDocument: DocumentResponse | null;
  folders: DocumentFolder[];
  locales: Locale[];
  selectedFolderId?: string | null;
  passwordPolicy?: PasswordPolicy;
  onFormSubmit: (result: DocumentFormResult) => void;
  onFormClose: () => void;
  formLoading: boolean;
  deletingDocument: DocumentListItem | null;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  deleteLoading: boolean;
  deletingFolderId: string | null;
  onDeleteFolderConfirm: () => void;
  onDeleteFolderCancel: () => void;
}

export default function DocumentDialogs({
  formOpen,
  editingDocument,
  folders,
  locales,
  selectedFolderId,
  passwordPolicy,
  onFormSubmit,
  onFormClose,
  formLoading,
  deletingDocument,
  onDeleteConfirm,
  onDeleteCancel,
  deleteLoading,
  deletingFolderId,
  onDeleteFolderConfirm,
  onDeleteFolderCancel,
}: DocumentDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <DocumentFormDialog
        open={formOpen}
        document={editingDocument}
        folders={folders}
        locales={locales}
        selectedFolderId={selectedFolderId}
        passwordPolicy={passwordPolicy}
        onSubmit={onFormSubmit}
        onClose={onFormClose}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deletingDocument}
        title={t('documents.deleteDialog.title')}
        message={t('documents.deleteDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={onDeleteConfirm}
        onCancel={onDeleteCancel}
        loading={deleteLoading}
      />

      <ConfirmDialog
        open={!!deletingFolderId}
        title={t('documents.deleteFolderDialog.title')}
        message={t('documents.deleteFolderDialog.message')}
        confirmLabel={t('common.actions.delete')}
        onConfirm={onDeleteFolderConfirm}
        onCancel={onDeleteFolderCancel}
        confirmationText={t('common.actions.delete')}
      />
    </>
  );
}
