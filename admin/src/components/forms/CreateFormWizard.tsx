import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { createForm, getFormTemplates } from '@/services/forms';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { slugify } from '@/utils/slugify';
import { M3Button, Icon } from '@/components/design-system';
import type { FormTemplateResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface CreateFormWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new form's id after successful creation. */
  onCreated: (id: string) => void;
}

type CreationMethod = 'scratch' | 'template';

/**
 * Two-step create-form flow (#587). Step 1 picks the creation method —
 * scratch or template; step 2 collects name + slug. Slug auto-fills
 * from the name until the user edits it directly. Forms intentionally
 * have a much simpler creation surface than blogs/pages, so this
 * lives as a small useState-driven wizard rather than the reducer
 * pattern used by CreateBlogWizard — porting that would be premature
 * abstraction for two steps.
 */
export default function CreateFormWizard({ open, onClose, onCreated }: CreateFormWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { showError, showSuccess } = useErrorSnackbar();

  const [activeStep, setActiveStep] = useState(0);
  const [method, setMethod] = useState<CreationMethod | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setMethod(null);
      setTemplateId(null);
      setName('');
      setSlug('');
      setSlugTouched(false);
    }
  }, [open]);


  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: queryKeys.formTemplates(selectedSiteId),
    queryFn: () => getFormTemplates(selectedSiteId, { page_size: 100 }),
    enabled: open && !!selectedSiteId,
  });
  // Filter to active templates only — inactive templates are kept on the
  // backend for restoration but shouldn't be offered as new-form sources.
  const templates: FormTemplateResponse[] =
    templatesData?.data?.filter((tpl) => tpl.is_active) ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createForm(selectedSiteId, {
        name,
        slug,
        template_id: method === 'template' && templateId ? templateId : undefined,
      }),
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms(selectedSiteId) });
      showSuccess(t('formsModule.list.messages.created', 'Form created.'));
      onCreated(form.id);
      onClose();
    },
    onError: showError,
  });

  const canCreate = name.trim().length > 0 && slug.trim().length > 0;

  const stepLabels = useMemo(
    () => [
      t('formsModule.wizard.steps.method', 'Method'),
      t('formsModule.wizard.steps.details', 'Details'),
    ],
    [t],
  );

  function selectMethod(m: CreationMethod) {
    setMethod(m);
    if (m === 'scratch') {
      setActiveStep(1);
    }
    // For template: stay on step 1 until a template is picked.
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    setActiveStep(1);
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('formsModule.wizard.title', 'Create form')}
      icon="dynamic_form"
      data-testid="forms.wizard"
      maxWidth="md"
      actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
          {activeStep > 0 && (
            <M3Button
              variant="text"
              size="md"
              onClick={() => setActiveStep((s) => s - 1)}
              data-testid="forms.wizard.btn.back"
            >
              {t('common.back', 'Back')}
            </M3Button>
          )}
          <Box sx={{ flex: 1 }} />
          <M3Button
            variant="text"
            size="md"
            onClick={onClose}
            data-testid="forms.wizard.btn.cancel"
          >
            {t('common.cancel', 'Cancel')}
          </M3Button>
          {activeStep === 1 && (
            <M3Button
              size="md"
              onClick={() => createMutation.mutate()}
              disabled={!canCreate || createMutation.isPending}
              data-testid="forms.wizard.btn.create"
            >
              {t('formsModule.wizard.btnCreate', 'Create form')}
            </M3Button>
          )}
        </Box>
      }
    >
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box
            role="button"
            tabIndex={0}
            onClick={() => selectMethod('scratch')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectMethod('scratch');
              }
            }}
            data-testid="forms.wizard.method.scratch"
            sx={{
              border: '1px solid var(--outline-variant)',
              borderRadius: 3,
              p: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              '&:hover': { background: 'var(--surface-container)' },
            }}
          >
            <Icon name="add" size={28} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('formsModule.wizard.method.scratchTitle', 'Start from scratch')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'formsModule.wizard.method.scratchDesc',
                  'Create an empty form and add fields one by one.',
                )}
              </Typography>
            </Box>
          </Box>

          <Typography variant="overline" sx={{ mt: 1, color: 'text.secondary' }}>
            {t('formsModule.wizard.method.templatesHeading', 'Or pick a template')}
          </Typography>

          {templatesLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('common.loading', 'Loading…')}
            </Typography>
          ) : templates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" data-testid="forms.wizard.templates.empty">
              {t(
                'formsModule.wizard.method.templatesEmpty',
                'No templates yet. Save fields as a template from any form to reuse them.',
              )}
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 1.5,
              }}
            >
              {templates.map((tmpl) => (
                <Box
                  key={tmpl.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => pickTemplate(tmpl.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pickTemplate(tmpl.id);
                    }
                  }}
                  data-testid={`forms.wizard.template.${tmpl.id}`}
                  sx={{
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 3,
                    p: 2,
                    cursor: 'pointer',
                    '&:hover': { background: 'var(--surface-container)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Icon name={tmpl.icon || 'description'} size={20} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {tmpl.name}
                    </Typography>
                  </Box>
                  {tmpl.description && (
                    <Typography variant="body2" color="text.secondary">
                      {tmpl.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {activeStep === 1 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label={t('formsModule.wizard.fields.name', 'Form name')}
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              // Keep slug synced to name until the user edits the slug directly.
              if (!slugTouched) setSlug(slugify(v));
            }}
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { 'data-testid': 'forms.wizard.field.name' } }}
          />
          <TextField
            label={t('formsModule.wizard.fields.slug', 'Slug')}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            helperText={t(
              'formsModule.wizard.fields.slugHelp',
              'URL-safe identifier. Used in the public form path: /forms/<slug>',
            )}
            fullWidth
            slotProps={{ htmlInput: { 'data-testid': 'forms.wizard.field.slug' } }}
          />
        </Box>
      )}
    </FormDialog>
  );
}
