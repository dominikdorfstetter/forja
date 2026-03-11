import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DocumentFormDialog from '@/components/documents/DocumentFormDialog';
import type {
  DocumentResponse,
  DocumentListItem,
  DocumentFolder,
  Locale,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';

interface DocumentDialogsProps {
  formOpen: boolean;
  editingDocument: DocumentResponse | null;
  folders: DocumentFolder[];
  locales: Locale[];
  onFormSubmit: (data: CreateDocumentRequest, localizations: CreateDocumentLocalizationRequest[]) => void;
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
        onSubmit={onFormSubmit}
        onClose={onFormClose}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deletingDocument}
        title={t('documents.deleteDialog.title')}
        message={t('documents.deleteDialog.message', { title: '' })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={onDeleteConfirm}
        onCancel={onDeleteCancel}
        loading={deleteLoading}
        confirmationText={t('common.actions.delete')}
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
