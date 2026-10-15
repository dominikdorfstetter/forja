import { describe, it, expect, vi } from 'vitest';
import { availableWorkflowActions, type WorkflowActionState } from '../workflowActionSpecs';

const everything: Omit<WorkflowActionState, 'currentStatus'> = {
  canSubmitForReview: true,
  canApprove: true,
  canRequestChanges: true,
  canPublish: true,
  canUnpublish: true,
  canArchive: true,
  canRestore: true,
  onSubmitForReview: vi.fn(),
  onApprove: vi.fn(),
  onRequestChanges: vi.fn(),
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
  onArchive: vi.fn(),
  onRestore: vi.fn(),
};

const ids = (state: WorkflowActionState) => availableWorkflowActions(state).map((a) => a.spec.id);

describe('availableWorkflowActions', () => {
  it('orders outlined de-escalations before filled transitions', () => {
    expect(ids({ ...everything, currentStatus: 'InReview' })).toEqual([
      'requestChanges',
      'unpublish',
      'archive',
      'restore',
      'approve',
      'publish',
    ]);
  });

  it('gates submit-for-review to Draft and review actions to InReview', () => {
    expect(ids({ ...everything, currentStatus: 'Draft' })).toEqual([
      'unpublish',
      'archive',
      'restore',
      'submitForReview',
      'publish',
    ]);
  });

  it('requires both the capability and a handler', () => {
    expect(ids({ currentStatus: 'Draft', canPublish: true })).toEqual([]);
    expect(ids({ currentStatus: 'Draft', onPublish: vi.fn() })).toEqual([]);
    expect(ids({ currentStatus: 'Draft', canPublish: true, onPublish: vi.fn() })).toEqual(['publish']);
  });

  it('wires each spec to its own handler and marks archive as danger', () => {
    const onArchive = vi.fn();
    const [archive] = availableWorkflowActions({ currentStatus: 'Published', canArchive: true, onArchive });
    expect(archive.onClick).toBe(onArchive);
    expect(archive.spec).toMatchObject({ variant: 'outlined', icon: 'archive', danger: true });
  });

  it('keeps the publish-post test id on Publish only', () => {
    const actions = availableWorkflowActions({ ...everything, currentStatus: 'InReview' });
    expect(actions.filter((a) => a.spec.testId).map((a) => [a.spec.id, a.spec.testId])).toEqual([
      ['publish', 'publish-post'],
    ]);
  });
});
