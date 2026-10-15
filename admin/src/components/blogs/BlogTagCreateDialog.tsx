import { useState } from 'react';
import { FormControlLabel, Switch, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { createTag } from '@/services/taxonomy';
import type { CreateTagRequest, Tag } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface BlogTagCreateDialogProps {
  open: boolean;
  siteId: string;
  onClose: () => void;
  /** Called with the freshly created tag so the caller can assign it. */
  onCreated: (tag: Tag) => void;
}

/** Create-a-tag dialog (slug + global toggle). Resets its fields on success. */
export default function BlogTagCreateDialog({ open, siteId, onClose, onCreated }: BlogTagCreateDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [slug, setSlug] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: CreateTagRequest) => createTag(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags(siteId) });
      onCreated(created);
      setSlug('');
      setIsGlobal(false);
    },
    onError: () =>
      enqueueSnackbar(t('blogDetail.tags.createFailed'), { variant: 'error' }),
  });

  const handleSubmit = () => {
    const trimmed = slug.trim();
    if (!trimmed) return;
    createMutation.mutate({
      slug: trimmed,
      is_global: isGlobal,
      site_id: isGlobal ? undefined : siteId,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      icon="sell"
      title={t('forms.tag.createTitle')}
      submitLabel={t('common.actions.create')}
      submitDisabled={!slug.trim()}
      submitTestId="blog-tag-create.btn.submit"
      cancelTestId="blog-tag-create.btn.cancel"
      loading={createMutation.isPending}
      maxWidth="xs"
      data-testid="blog-tag-create.dialog"
    >
      <TextField
        label={t('forms.tag.fields.slug')}
        fullWidth
        size="small"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        helperText={t('forms.tag.fields.slugHelper')}
      />
      <FormControlLabel
        control={
          <Switch
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
          />
        }
        label={t('forms.tag.fields.global')}
      />
    </FormDialog>
  );
}
