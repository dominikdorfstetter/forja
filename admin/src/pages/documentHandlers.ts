import { type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { downloadDocument, getDocument } from '@/services/documents';
import type {
  DocumentListItem,
  DocumentResponse,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import type { DocumentFormResult } from '@/components/documents/DocumentFormDialog';
import type { UIAction } from '@/pages/DocumentsReducer';

interface HandlerDeps {
  dispatch: React.Dispatch<UIAction>;
  showError: (error: unknown) => void;
  filteredDocuments: DocumentListItem[] | undefined;
  moveToFolderMutate: (vars: { id: string; folder_id: string | undefined }) => void;
  editingDocument: DocumentResponse | null;
  updateDocumentMutate: (vars: { id: string; data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[] }) => void;
  createDocumentMutate: (vars: { data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[]; privacy?: { password: string } }) => void;
  onPrivateDownload: (doc: DocumentListItem) => void;
}

export function createDocumentHandlers(deps: HandlerDeps) {
  const { dispatch, showError, filteredDocuments, moveToFolderMutate, editingDocument, updateDocumentMutate, createDocumentMutate, onPrivateDownload } = deps;

  const handleOpenCreate = () => {
    dispatch({ type: 'setEditingDocument', doc: null });
    dispatch({ type: 'openForm' });
  };

  const handleOpenEdit = async (doc: DocumentListItem) => {
    try {
      const detail = await getDocument(doc.id);
      dispatch({ type: 'setEditingDocument', doc: detail });
    } catch (error) {
      showError(error);
    }
  };

  const handleFormSubmit = (result: DocumentFormResult) => {
    if (editingDocument) {
      updateDocumentMutate({ id: editingDocument.id, data: result.request, localizations: result.localizations });
    } else {
      createDocumentMutate({ data: result.request, localizations: result.localizations, privacy: result.privacy });
    }
  };

  const handleDownload = async (doc: DocumentListItem) => {
    if (doc.is_private) {
      onPrivateDownload(doc);
      return;
    }

    try {
      const blob = await downloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    dispatch({ type: 'setActiveId', id: event.active.id as string });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    dispatch({ type: 'setActiveId', id: null });
    const { active, over } = event;
    if (!over) return;
    const folderId = over.data.current?.folderId as string | null;
    const docId = active.id as string;
    const doc = filteredDocuments?.find((d) => d.id === docId);
    if (!doc) return;
    if (folderId === (doc.folder_id ?? null)) return;
    moveToFolderMutate({ id: docId, folder_id: folderId ?? undefined });
  };

  return { handleOpenCreate, handleOpenEdit, handleFormSubmit, handleDownload, handleDragStart, handleDragEnd };
}
