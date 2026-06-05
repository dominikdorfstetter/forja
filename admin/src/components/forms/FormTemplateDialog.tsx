import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import FieldBuilder from '@/components/forms/FieldBuilder';
import { M3Button } from '@/components/design-system';
import { createFormTemplate, updateFormTemplate } from '@/services/forms';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type {
  CreateFormTemplateRequest,
  FormFieldInput,
  FormTemplateResponse,
  UpdateFormTemplateRequest,
} from '@/types/api';

interface FormTemplateDialogProps {
  open: boolean;
  /** When present, the dialog edits this template; otherwise it creates a new one. */
  template: FormTemplateResponse | null;
  onClose: () => void;
  onSaved?: (template: FormTemplateResponse) => void;
}

/**
 * Create/edit form template (#588). Reuses FieldBuilder from #587 for
 * the field-list section — templates store the exact same FormFieldInput
 * shape that forms do, so there's no parallel editor to maintain.
 */
export default function FormTemplateDialog({
  open,
  template,
  onClose,
  onSaved,
}: FormTemplateDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormFieldInput[]>([]);

  // Seed on open / when template changes.
  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setDescription(template.description ?? '');
      setIcon(template.icon ?? '');
      setIsActive(template.is_active);
      setFields(Array.isArray(template.fields) ? template.fields : []);
    } else {
      setName('');
      setDescription('');
      setIcon('');
      setIsActive(true);
      setFields([]);
    }
  }, [open, template]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateFormTemplateRequest) =>
      createFormTemplate(selectedSiteId, payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] });
      showSuccess(t('formsModule.templates.messages.created', 'Template created.'));
      onSaved?.(saved);
      onClose();
    },
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFormTemplateRequest }) =>
      updateFormTemplate(id, payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] });
      showSuccess(t('formsModule.templates.messages.updated', 'Template updated.'));
      onSaved?.(saved);
      onClose();
    },
    onError: showError,
  });

  const canSave = name.trim().length > 0;
  const isPending = createMutation.isPending || updateMutation.isPending;

  function submit() {
    if (!canSave) return;
    const payload = {
      name,
      description: description.trim() === '' ? null : description,
      icon: icon.trim() === '' ? null : icon,
      is_active: isActive,
      fields,
    };
    if (template) {
      updateMutation.mutate({ id: template.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={
        template
          ? t('formsModule.templates.dialog.editTitle', 'Edit template')
          : t('formsModule.templates.dialog.createTitle', 'Create template')
      }
      icon="view_quilt"
      maxWidth="md"
      data-testid="forms.template.dialog"
      actions={
        <Box sx={{ display: 'flex', gap: 1, width: '100%', alignItems: 'center' }}>
          <Box sx={{ flex: 1 }} />
          <M3Button variant="text" size="md" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </M3Button>
          <M3Button
            size="md"
            onClick={submit}
            disabled={!canSave || isPending}
            data-testid="forms.template.dialog.save"
          >
            {t('common.save', 'Save')}
          </M3Button>
        </Box>
      }
    >
      <Box sx={{ display: 'grid', gap: 2 }}>
        <TextField
          label={t('formsModule.templates.fields.name', 'Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { 'data-testid': 'forms.template.field.name' } }}
        />
        <TextField
          label={t('formsModule.templates.fields.description', 'Description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />
        <TextField
          label={t('formsModule.templates.fields.icon', 'Icon (Material Symbol name)')}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          helperText={t(
            'formsModule.templates.fields.iconHelp',
            'Optional Material Symbols ligature, e.g. "contact_mail".',
          )}
          fullWidth
        />
        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={(_, v) => setIsActive(v)}
              data-testid="forms.template.field.active"
            />
          }
          label={t('formsModule.templates.fields.active', 'Active (offered in CreateFormWizard)')}
        />
        <FieldBuilder fields={fields} onChange={setFields} />
      </Box>
    </FormDialog>
  );
}
