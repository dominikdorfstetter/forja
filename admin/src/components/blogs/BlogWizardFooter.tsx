import { Box, Button } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import type { PrimaryActionId } from './blogWizardFlow';
import type { BlogWizardPrimaryAction } from './useCreateBlogWizard';

interface PrimaryButtonConfig {
  labelKey: string;
  busyLabelKey: string;
  busyWhen: 'creating' | 'generating';
  aiIcon?: boolean;
  testId?: string;
}

const PRIMARY_BUTTONS: Record<PrimaryActionId, PrimaryButtonConfig> = {
  scratch: { labelKey: 'blogs.wizard.create', busyLabelKey: 'blogs.wizard.creating', busyWhen: 'creating', testId: 'create-blog-wizard.btn.create' },
  template: { labelKey: 'templates.useTemplate', busyLabelKey: 'blogs.wizard.creating', busyWhen: 'creating' },
  import: { labelKey: 'markdownImport.import', busyLabelKey: 'blogs.wizard.creating', busyWhen: 'creating' },
  aiOutline: { labelKey: 'quickPost.ai.generateOutline', busyLabelKey: 'quickPost.ai.generating', busyWhen: 'generating', aiIcon: true },
  aiPost: { labelKey: 'quickPost.ai.generatePost', busyLabelKey: 'quickPost.ai.generating', busyWhen: 'generating', aiIcon: true },
  aiCreate: { labelKey: 'blogs.wizard.create', busyLabelKey: 'blogs.wizard.creating', busyWhen: 'creating' },
};

interface BusyProps {
  isCreating: boolean;
  isGenerating: boolean;
}

function PrimaryButton({ action, isCreating, isGenerating }: BusyProps & { action: BlogWizardPrimaryAction }) {
  const { t } = useTranslation();
  const config = PRIMARY_BUTTONS[action.id];
  const busy = config.busyWhen === 'generating' ? isGenerating : isCreating;
  return (
    <Button
      variant="contained"
      startIcon={config.aiIcon ? <AutoAwesomeIcon /> : undefined}
      onClick={action.onClick}
      disabled={action.disabled}
      data-testid={config.testId}
    >
      {busy ? t(config.busyLabelKey) : t(config.labelKey)}
    </Button>
  );
}

interface BlogWizardFooterProps extends BusyProps {
  showManageTemplates: boolean;
  showBack: boolean;
  primary: BlogWizardPrimaryAction | null;
  onManageTemplates: () => void;
  onCancel: () => void;
  onBack: () => void;
}

export default function BlogWizardFooter({
  showManageTemplates,
  showBack,
  primary,
  isCreating,
  isGenerating,
  onManageTemplates,
  onCancel,
  onBack,
}: BlogWizardFooterProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <Box sx={{ flex: 1 }}>
        {showManageTemplates && (
          <Button size="small" startIcon={<SettingsIcon />} onClick={onManageTemplates}>
            {t('templates.manageTemplates')}
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button onClick={onCancel} disabled={isCreating}>{t('common.actions.cancel')}</Button>
        {showBack && (
          <Button onClick={onBack} disabled={isCreating} data-testid="create-blog-wizard.btn.back">{t('common.actions.back')}</Button>
        )}
        {primary && <PrimaryButton action={primary} isCreating={isCreating} isGenerating={isGenerating} />}
      </Box>
    </Box>
  );
}
