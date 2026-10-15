import { Step, StepLabel, Stepper } from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { ContentTemplate, SiteLocaleResponse } from '@/types/api';
import BlogWizardMethodStep from './BlogWizardMethodStep';
import BlogWizardDetailsStep from './BlogWizardDetailsStep';
import BlogWizardFooter from './BlogWizardFooter';
import { useCreateBlogWizard } from './useCreateBlogWizard';

const STEP_KEYS = ['blogs.wizard.steps.method', 'blogs.wizard.steps.details'] as const;
const EMPTY_TEMPLATES: ContentTemplate[] = [];

interface CreateBlogWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (blogId: string) => void;
  siteLocales: SiteLocaleResponse[] | undefined;
  siteTemplates: ContentTemplate[] | undefined;
  siteTemplatesLoading: boolean;
}

export default function CreateBlogWizard({
  open, onClose, onCreated, siteLocales,
  siteTemplates = EMPTY_TEMPLATES, siteTemplatesLoading,
}: CreateBlogWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const wizard = useCreateBlogWizard({ open, onClose, onCreated, siteLocales, siteTemplates });
  const { state, dispatch, ai } = wizard;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="article"
      title={t('blogs.wizard.title')}
      maxWidth={wizard.dialogWidth}
      data-testid="create-blog-wizard"
      actions={
        <BlogWizardFooter
          showManageTemplates={wizard.showManageTemplates}
          showBack={state.activeStep === 1}
          primary={wizard.primary}
          isCreating={wizard.isCreating}
          isGenerating={ai.isGenerating}
          onManageTemplates={() => { onClose(); navigate('/blogs/templates'); }}
          onCancel={onClose}
          onBack={wizard.back}
        />
      }
    >
        <Stepper activeStep={state.activeStep} sx={{ mb: 1 }}>
          {STEP_KEYS.map((key) => (<Step key={key}><StepLabel>{t(key)}</StepLabel></Step>))}
        </Stepper>

        {state.activeStep === 0 ? (
          <BlogWizardMethodStep method={state.method} onSelect={(m) => dispatch({ type: 'SELECT_METHOD', method: m })} aiAvailable={ai.aiAvailable} />
        ) : (
          <BlogWizardDetailsStep wizard={wizard} siteTemplates={siteTemplates} siteTemplatesLoading={siteTemplatesLoading} />
        )}
    </FormDialog>
  );
}
