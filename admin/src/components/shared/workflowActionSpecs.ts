import type { M3ButtonVariant } from '@/components/design-system';

type WorkflowCapability =
  | 'canSubmitForReview'
  | 'canApprove'
  | 'canRequestChanges'
  | 'canPublish'
  | 'canUnpublish'
  | 'canArchive'
  | 'canRestore';

type WorkflowHandler =
  | 'onSubmitForReview'
  | 'onApprove'
  | 'onRequestChanges'
  | 'onPublish'
  | 'onUnpublish'
  | 'onArchive'
  | 'onRestore';

/** Capability flags + handlers an editor toolbar forwards to `WorkflowActions`. */
export type WorkflowActionControls = Partial<Record<WorkflowCapability, boolean>> &
  Partial<Record<WorkflowHandler, () => void>>;

export type WorkflowActionState = { currentStatus: string } & WorkflowActionControls;

export interface WorkflowActionSpec {
  id: string;
  capability: WorkflowCapability;
  handler: WorkflowHandler;
  /** Only offered while the content is in this status. */
  requiredStatus?: string;
  variant: M3ButtonVariant;
  icon: string;
  labelKey: string;
  danger?: boolean;
  testId?: string;
}

/** Render order: de-escalating (outlined) actions first, progressive (filled) transitions last. */
const WORKFLOW_ACTION_SPECS: readonly WorkflowActionSpec[] = [
  { id: 'requestChanges', capability: 'canRequestChanges', handler: 'onRequestChanges', requiredStatus: 'InReview', variant: 'outlined', icon: 'undo', labelKey: 'workflow.requestChanges' },
  { id: 'unpublish', capability: 'canUnpublish', handler: 'onUnpublish', variant: 'outlined', icon: 'unpublished', labelKey: 'workflow.unpublish' },
  { id: 'archive', capability: 'canArchive', handler: 'onArchive', variant: 'outlined', icon: 'archive', labelKey: 'workflow.archive', danger: true },
  { id: 'restore', capability: 'canRestore', handler: 'onRestore', variant: 'outlined', icon: 'unarchive', labelKey: 'workflow.restore' },
  { id: 'submitForReview', capability: 'canSubmitForReview', handler: 'onSubmitForReview', requiredStatus: 'Draft', variant: 'filled', icon: 'send', labelKey: 'workflow.submitForReview' },
  { id: 'approve', capability: 'canApprove', handler: 'onApprove', requiredStatus: 'InReview', variant: 'filled', icon: 'check_circle', labelKey: 'workflow.approve' },
  { id: 'publish', capability: 'canPublish', handler: 'onPublish', variant: 'filled', icon: 'publish', labelKey: 'workflow.publish', testId: 'publish-post' },
];

/**
 * Workflow actions to render, in display order: permitted by capability,
 * valid for the current status, and wired to a handler.
 */
export function availableWorkflowActions(
  state: WorkflowActionState,
): { spec: WorkflowActionSpec; onClick: () => void }[] {
  return WORKFLOW_ACTION_SPECS.flatMap((spec) => {
    const onClick = state[spec.handler];
    const statusMatches = spec.requiredStatus === undefined || spec.requiredStatus === state.currentStatus;
    return state[spec.capability] && statusMatches && onClick ? [{ spec, onClick }] : [];
  });
}

const WORKFLOW_CONTROL_KEYS = WORKFLOW_ACTION_SPECS.flatMap((spec) => [spec.capability, spec.handler]);

/** Just the workflow capability flags + handlers, out of a toolbar's wider props. */
export function pickWorkflowControls(props: WorkflowActionControls): WorkflowActionControls {
  return Object.fromEntries(WORKFLOW_CONTROL_KEYS.map((key) => [key, props[key]]));
}
