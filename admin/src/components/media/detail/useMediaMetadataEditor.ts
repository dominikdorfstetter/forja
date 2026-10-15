import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { createMediaMetadata, deleteMediaMetadata, updateMediaMetadata } from '@/services/media';
import type { MediaMetadataResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  EMPTY_META_VALUES,
  toMetaValuesByLocale,
  type MetaField,
  type MetaValues,
  type MetaValuesByLocale,
} from './mediaDetailModel';

/**
 * Per-locale alt text / caption / title drafts for a media file, seeded from
 * the saved metadata, plus save (create or update) and delete per locale.
 */
export function useMediaMetadataEditor(mediaId: string | undefined, metadata: MediaMetadataResponse[]) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [editingMeta, setEditingMeta] = useState<MetaValuesByLocale>({});

  useEffect(() => {
    setEditingMeta(toMetaValuesByLocale(metadata));
  }, [metadata]);

  const onSaved = (message: string) => () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mediaMetadata(mediaId) });
    enqueueSnackbar(message, { variant: 'success' });
  };

  const { mutate: createMeta, isPending: creating } = useMutation({
    mutationFn: (data: { localeId: string } & MetaValues) =>
      createMediaMetadata(mediaId!, {
        locale_id: data.localeId,
        alt_text: data.alt_text || undefined,
        caption: data.caption || undefined,
        title: data.title || undefined,
      }),
    onSuccess: onSaved('Metadata saved'),
  });

  const { mutate: updateMeta, isPending: updating } = useMutation({
    mutationFn: (data: { id: string } & MetaValues) =>
      updateMediaMetadata(data.id, {
        alt_text: data.alt_text || undefined,
        caption: data.caption || undefined,
        title: data.title || undefined,
      }),
    onSuccess: onSaved('Metadata updated'),
  });

  const { mutate: deleteMetadata, isPending: deleting } = useMutation({
    mutationFn: (id: string) => deleteMediaMetadata(id),
    onSuccess: onSaved('Metadata removed'),
  });

  const setMetaField = useCallback((localeId: string, field: MetaField, value: string) => {
    setEditingMeta((prev) => ({
      ...prev,
      [localeId]: { ...(prev[localeId] || EMPTY_META_VALUES), [field]: value },
    }));
  }, []);

  const setLocaleValues = useCallback((localeId: string, values: MetaValues) => {
    setEditingMeta((prev) => ({ ...prev, [localeId]: values }));
  }, []);

  const saveLocale = (localeId: string) => {
    const values = editingMeta[localeId];
    if (!values) return;

    const existing = metadata.find((m) => m.locale_id === localeId);
    if (existing) {
      updateMeta({ id: existing.id, ...values });
    } else {
      createMeta({ localeId, ...values });
    }
  };

  return {
    editingMeta,
    setMetaField,
    setLocaleValues,
    saveLocale,
    saving: creating || updating,
    deleteMetadata,
    deleting,
  };
}

export type MediaMetadataEditor = ReturnType<typeof useMediaMetadataEditor>;
