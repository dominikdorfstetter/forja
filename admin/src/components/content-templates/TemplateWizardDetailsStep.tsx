import type { Dispatch } from 'react';
import { markdownUploadBindings, templateBrowserBindings } from '@/components/shared/contentWizard/wizardSourceState';
import TemplateWizardScratchStep from './TemplateWizardScratchStep';
import TemplateWizardTemplateStep from './TemplateWizardTemplateStep';
import TemplateWizardImportStep from './TemplateWizardImportStep';
import type { TemplateWizardAction, TemplateWizardState } from './templateWizardState';

interface TemplateWizardDetailsStepProps {
  state: TemplateWizardState;
  dispatch: Dispatch<TemplateWizardAction>;
}

/** Second wizard step: the detail form for the chosen creation method. */
export default function TemplateWizardDetailsStep({ state, dispatch }: TemplateWizardDetailsStepProps) {
  switch (state.method) {
    case 'scratch':
      return (
        <TemplateWizardScratchStep
          name={state.name}
          slugPrefix={state.slugPrefix}
          body={state.body}
          onNameChange={(v) => dispatch({ type: 'SET_NAME', value: v })}
          onSlugPrefixChange={(v) => dispatch({ type: 'SET_SLUG_PREFIX', value: v })}
          onBodyChange={(v) => dispatch({ type: 'SET_BODY', value: v })}
        />
      );
    case 'template':
      return (
        <TemplateWizardTemplateStep {...templateBrowserBindings(state, dispatch)} />
      );
    case 'import':
      return (
        <TemplateWizardImportStep
          upload={markdownUploadBindings(state, dispatch, (result) => dispatch({ type: 'SET_PARSED', result }))}
          parsed={state.parsed}
          editName={state.editName}
          editSlugPrefix={state.editSlugPrefix}
          editBody={state.editBody}
          onEditNameChange={(v) => dispatch({ type: 'SET_EDIT_NAME', value: v })}
          onEditSlugPrefixChange={(v) => dispatch({ type: 'SET_EDIT_SLUG_PREFIX', value: v })}
        />
      );
    default:
      return null;
  }
}
