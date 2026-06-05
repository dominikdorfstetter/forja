import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLegalDocument } from '@/services/legal';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import FormDialog from '@/components/shared/FormDialog';

interface CreateLegalDocumentWizardProps {
  open: boolean;
  onClose: () => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function CreateLegalDocumentWizard({ open, onClose }: CreateLegalDocumentWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();

  const [name, setName] = useState('');

  const handleClose = useCallback(() => {
    setName('');
    onClose();
  }, [onClose]);

  const createMutation = useMutation({
    mutationFn: () =>
      createLegalDocument(selectedSiteId!, {
        cookie_name: slugify(name),
        document_type: 'PrivacyPolicy',
        status: 'Draft',
        site_ids: [selectedSiteId!],
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['legal'] });
      showSuccess(t('legal.messages.created'));
      handleClose();
      navigate(`/legal/${doc.id}`);
    },
    onError: (error) => showError(error),
  });

  const canSubmit = name.trim().length > 0 && slugify(name).length > 0;
  const slug = slugify(name);

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      onSubmit={() => createMutation.mutate()}
      icon="gavel"
      title={t('legal.wizard.title')}
      submitLabel={t('common.actions.create')}
      submitDisabled={!canSubmit}
      submitTestId="create-legal-wizard.btn-create"
      loading={createMutation.isPending}
      data-testid="create-legal-wizard.dialog"
    >
      <Typography variant="body2" color="text.secondary">
        {t('legal.wizard.description')}
      </Typography>
      <TextField
        autoFocus
        fullWidth
        size="small"
        label={t('legal.wizard.fields.name')}
        helperText={
          slug
            ? `${t('legal.wizard.fields.nameHelper')} — ${slug}`
            : t('legal.wizard.fields.nameHelper')
        }
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="create-legal-wizard.name-input"
      />
    </FormDialog>
  );
}
