import { useEffect, useReducer, useRef } from 'react';
import { Step, StepLabel, Stepper } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { useTranslation } from 'react-i18next';
import type { CreateContentTemplateRequest } from '@/types/api';
import TemplateWizardMethodStep from './TemplateWizardMethodStep';
import TemplateWizardDetailsStep from './TemplateWizardDetailsStep';
import { templateWizardReducer, initialTemplateWizardState } from './templateWizardState';
import { buildTemplateSubmission, hasTemplateSubmitAction, isTemplateSubmittable } from './templateWizardFlow';

const STEP_KEYS = ['contentTemplates.wizard.steps.method', 'contentTemplates.wizard.steps.details'] as const;

interface CreateTemplateWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateContentTemplateRequest, 'site_id'>) => void;
  loading?: boolean;
}

export default function CreateTemplateWizard({ open, onClose, onSubmit, loading }: CreateTemplateWizardProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(templateWizardReducer, initialTemplateWizardState);

  // Reset all state when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      dispatch({ type: 'RESET' });
    }
    prevOpenRef.current = open;
  });

  const handleSubmit = () => {
    const submission = buildTemplateSubmission(state, t);
    if (submission) onSubmit(submission);
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="dynamic_form"
      title={t('contentTemplates.wizard.title')}
      maxWidth={state.method === 'template' ? 'md' : 'sm'}
      data-testid="create-template-wizard"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {t('common.actions.cancel')}
          </M3Button>
          {state.activeStep === 1 && (
            <M3Button variant="outlined" size="sm" onClick={() => dispatch({ type: 'GO_BACK' })} disabled={loading}>
              {t('common.actions.back')}
            </M3Button>
          )}
          {hasTemplateSubmitAction(state) && (
            <M3Button variant="filled" size="sm" onClick={handleSubmit} disabled={!isTemplateSubmittable(state) || loading}>
              {loading ? t('common.actions.saving') : t('common.actions.create')}
            </M3Button>
          )}
        </>
      }
    >
      <Stepper activeStep={state.activeStep} sx={{ mb: 1 }}>
          {STEP_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(key)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {state.activeStep === 0 ? (
          <TemplateWizardMethodStep
            method={state.method}
            onSelect={(m) => dispatch({ type: 'SELECT_METHOD', method: m })}
          />
        ) : (
          <TemplateWizardDetailsStep state={state} dispatch={dispatch} />
        )}
    </FormDialog>
  );
}
