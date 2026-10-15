import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';
import { availableWorkflowActions, type WorkflowActionState } from './workflowActionSpecs';

type WorkflowActionsProps = WorkflowActionState & { isSaving: boolean };

/**
 * Workflow action cluster rendered alongside every content editor
 * (Blogs / Pages / Legal). Each action maps to an M3Button — outlined
 * for reversible / de-escalating operations (request changes,
 * unpublish, archive, restore), filled for progressive workflow
 * transitions (submit, approve, publish). Archive uses the danger
 * palette so it reads as a warning action.
 */
export default function WorkflowActions({ isSaving, ...state }: WorkflowActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      {availableWorkflowActions(state).map(({ spec, onClick }) => (
        <M3Button
          key={spec.id}
          size="sm"
          variant={spec.variant}
          icon={spec.icon}
          danger={spec.danger}
          onClick={onClick}
          disabled={isSaving}
          data-testid={spec.testId}
        >
          {t(spec.labelKey)}
        </M3Button>
      ))}
    </>
  );
}
