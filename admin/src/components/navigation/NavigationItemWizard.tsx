import { useMemo, useCallback, useEffect, useRef } from 'react';
import { Step, StepLabel, Stepper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import type {
  NavigationItem,
  CreateNavigationItemRequest,
  Locale,
} from '@/types/api';
import {
  LAST_WIZARD_STEP,
  buildNavigationItemRequest,
  buildParentOptions,
  canAdvanceWizardStep,
  getAvailableLinkTypes,
} from './navigationItemWizardModel';
import { useNavigationItemWizardForm } from './useNavigationItemWizardForm';
import { LinkTargetStep, OptionsStep, TranslationsStep } from './NavigationItemWizardSteps';

interface NavigationItemWizardProps {
  open: boolean;
  siteId: string;
  menuId: string;
  item?: NavigationItem | null;
  allItems?: NavigationItem[];
  maxDepth?: number;
  locales?: Locale[];
  onSubmit: (data: CreateNavigationItemRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const STEP_KEYS = [
  'navigation.wizard.steps.linkTarget',
  'navigation.wizard.steps.translations',
  'navigation.wizard.steps.options',
] as const;

const EMPTY_ITEMS: NavigationItem[] = [];
const EMPTY_LOCALES: Locale[] = [];

export default function NavigationItemWizard({
  open,
  siteId,
  menuId,
  item,
  allItems = EMPTY_ITEMS,
  maxDepth = 3,
  locales = EMPTY_LOCALES,
  onSubmit,
  onClose,
  loading,
}: NavigationItemWizardProps) {
  const { t } = useTranslation();
  const { modules } = useSiteContextData();
  const isEdit = !!item;

  const availableLinkTypes = useMemo(() => getAvailableLinkTypes(modules), [modules]);
  const {
    resetForm,
    activeStep,
    goNext,
    goBack,
    target,
    updateTarget,
    titles,
    updateTitle,
    activeLocaleTab,
    setActiveLocaleTab,
    options,
    updateOptions,
  } = useNavigationItemWizardForm({ open, item, defaultLinkType: availableLinkTypes[0] });

  // Reset form when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) resetForm();
    prevOpenRef.current = open;
  }, [open, resetForm]);

  const parentOptions = useMemo(
    () => buildParentOptions(allItems, item, maxDepth),
    [allItems, item, maxDepth],
  );

  const canAdvance = canAdvanceWizardStep(activeStep, target, locales.length, titles);

  const handleSubmit = useCallback(() => {
    onSubmit(buildNavigationItemRequest({
      target,
      options,
      titles,
      locales,
      siteId,
      menuId,
      displayOrder: item?.display_order ?? 0,
    }));
  }, [target, options, titles, locales, siteId, menuId, item, onSubmit]);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="menu_book"
      title={isEdit
        ? t('navigation.wizard.title.edit', 'Edit Navigation Item')
        : t('navigation.wizard.title.create', 'Add Navigation Item')}
      data-testid="navigation-wizard.dialog"
      actions={
        <WizardActions
          activeStep={activeStep}
          canAdvance={canAdvance}
          isEdit={isEdit}
          loading={loading}
          onCancel={onClose}
          onBack={goBack}
          onNext={goNext}
          onSubmit={handleSubmit}
        />
      }
    >
      <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
        {STEP_KEYS.map((key) => (
          <Step key={key}>
            <StepLabel>{t(key)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <LinkTargetStep
          target={target}
          availableLinkTypes={availableLinkTypes}
          siteId={siteId}
          onChange={updateTarget}
        />
      )}

      {activeStep === 1 && (
        <TranslationsStep
          locales={locales}
          titles={titles}
          activeTab={activeLocaleTab}
          onTabChange={setActiveLocaleTab}
          onTitleChange={updateTitle}
        />
      )}

      {activeStep === 2 && (
        <OptionsStep
          options={options}
          parentOptions={parentOptions}
          onChange={updateOptions}
        />
      )}
    </FormDialog>
  );
}

interface WizardActionsProps {
  activeStep: number;
  canAdvance: boolean;
  isEdit: boolean;
  loading?: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

function WizardActions({ activeStep, canAdvance, isEdit, loading, onCancel, onBack, onNext, onSubmit }: WizardActionsProps) {
  const { t } = useTranslation();
  const isLastStep = activeStep >= LAST_WIZARD_STEP;
  const disabled = !canAdvance || loading;
  const submitLabel = isEdit ? t('common.actions.save') : t('common.actions.create');

  return (
    <>
      <M3Button variant="ghost" size="sm" onClick={onCancel} disabled={loading} data-testid="navigation-wizard.btn.cancel">
        {t('common.actions.cancel')}
      </M3Button>
      {activeStep > 0 && (
        <M3Button variant="outlined" size="sm" onClick={onBack} disabled={loading} data-testid="navigation-wizard.btn.back">
          {t('common.actions.back')}
        </M3Button>
      )}
      {isLastStep ? (
        <M3Button
          variant="filled"
          size="sm"
          onClick={onSubmit}
          disabled={disabled}
          data-testid="navigation-wizard.btn.submit"
        >
          {loading ? t('common.actions.saving') : submitLabel}
        </M3Button>
      ) : (
        <M3Button
          variant="filled"
          size="sm"
          onClick={onNext}
          disabled={disabled}
          data-testid="navigation-wizard.btn.next"
        >
          {t('common.actions.next')}
        </M3Button>
      )}
    </>
  );
}
