import { type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import apiService from '@/services/api';
import type {
  DocumentListItem,
  DocumentResponse,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import type { UIAction } from '@/pages/DocumentsReducer';

interface HandlerDeps {
  dispatch: React.Dispatch<UIAction>;
  showError: (error: unknown) => void;
  filteredDocuments: DocumentListItem[] | undefined;
  moveToFolderMutate: (vars: { id: string; folder_id: string | undefined }) => void;
  editingDocument: DocumentResponse | null;
  updateDocumentMutate: (vars: { id: string; data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[] }) => void;
  createDocumentMutate: (vars: { data: CreateDocumentRequest; localizations: CreateDocumentLocalizationRequest[] }) => void;
}

export function createDocumentHandlers(deps: HandlerDeps) {
  const { dispatch, showError, filteredDocuments, moveToFolderMutate, editingDocument, updateDocumentMutate, createDocumentMutate } = deps;

  const handleOpenCreate = () => {
    dispatch({ type: 'setEditingDocument', doc: null });
    dispatch({ type: 'openForm' });
  };

  const handleOpenEdit = async (doc: DocumentListItem) => {
    try {
      const detail = await apiService.getDocument(doc.id);
      dispatch({ type: 'setEditingDocument', doc: detail });
    } catch (error) {
      showError(error);
    }
  };

  const handleFormSubmit = (
    data: CreateDocumentRequest,
    localizations: CreateDocumentLocalizationRequest[],
  ) => {
    if (editingDocument) {
      updateDocumentMutate({ id: editingDocument.id, data, localizations });
    } else {
      createDocumentMutate({ data, localizations });
    }
  };

  const handleDownload = async (doc: DocumentListItem) => {
    try {
      const blob = await apiService.downloadDocument(doc.id);
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
