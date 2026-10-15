import { describe, it, expect, vi } from 'vitest';
import { pickWorkflowControls } from '../workflowActionSpecs';

describe('pickWorkflowControls', () => {
  it('keeps the workflow flags and handlers and drops unrelated toolbar props', () => {
    const onPublish = vi.fn();
    const props = { canPublish: true, onPublish, canSchedule: true, isSaving: false, version: 3 };

    const controls = pickWorkflowControls(props);

    expect(controls.canPublish).toBe(true);
    expect(controls.onPublish).toBe(onPublish);
    expect(controls).not.toHaveProperty('canSchedule');
    expect(controls).not.toHaveProperty('isSaving');
    expect(controls).not.toHaveProperty('version');
  });

  it('covers every workflow capability and handler', () => {
    expect(Object.keys(pickWorkflowControls({})).sort()).toEqual([
      'canApprove',
      'canArchive',
      'canPublish',
      'canRequestChanges',
      'canRestore',
      'canSubmitForReview',
      'canUnpublish',
      'onApprove',
      'onArchive',
      'onPublish',
      'onRequestChanges',
      'onRestore',
      'onSubmitForReview',
      'onUnpublish',
    ]);
  });
});
