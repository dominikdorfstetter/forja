import { describe, it, expect } from 'vitest';
import { quickPostView, regeneratedActions, showsPublishActions } from '../quickPostState';

describe('quickPostState', () => {
  it('maps manual mode to the manual view regardless of AI step', () => {
    expect(quickPostView({ mode: 'manual', aiStep: 'post' })).toBe('manual');
    expect(quickPostView({ mode: 'ai', aiStep: 'outline' })).toBe('outline');
  });

  it('shows publish actions only for the manual editor and the final AI step', () => {
    expect(showsPublishActions('manual')).toBe(true);
    expect(showsPublishActions('post')).toBe(true);
    expect(showsPublishActions('idea')).toBe(false);
    expect(showsPublishActions('outline')).toBe(false);
  });

  it('applies only the non-empty regenerated values for the requested field', () => {
    const result = { body: 'New body', excerpt: '', meta_title: 'MT', meta_description: null };
    expect(regeneratedActions('all', result)).toEqual([
      { type: 'SET_BODY', value: 'New body' },
      { type: 'SET_META_TITLE', value: 'MT' },
    ]);
    expect(regeneratedActions('seo', result)).toEqual([{ type: 'SET_META_TITLE', value: 'MT' }]);
    expect(regeneratedActions('excerpt', result)).toEqual([]);
  });
});
