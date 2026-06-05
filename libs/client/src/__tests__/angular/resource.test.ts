import { describe, expect, it, vi } from 'vitest';
import { forjaResource } from '../../angular/resource.js';

describe('forjaResource', () => {
  it('starts in loading state', () => {
    const resource = forjaResource(() => new Promise(() => {}));

    expect(resource.isLoading()).toBe(true);
    expect(resource.value()).toBeUndefined();
    expect(resource.error()).toBeNull();
  });

  it('resolves value and clears loading', async () => {
    const resource = forjaResource(() => Promise.resolve({ id: '1', name: 'Test' }));

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });

    expect(resource.value()).toEqual({ id: '1', name: 'Test' });
    expect(resource.error()).toBeNull();
  });

  it('captures error and clears loading', async () => {
    const resource = forjaResource(() => Promise.reject(new Error('Network failure')));

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });

    expect(resource.value()).toBeUndefined();
    expect(resource.error()).toBeInstanceOf(Error);
    expect(resource.error()?.message).toBe('Network failure');
  });

  it('wraps non-Error rejections in Error', async () => {
    const resource = forjaResource(() => Promise.reject('string error'));

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });

    expect(resource.error()).toBeInstanceOf(Error);
    expect(resource.error()?.message).toBe('string error');
  });

  it('reload re-executes the loader', async () => {
    let callCount = 0;
    const resource = forjaResource(() => {
      callCount++;
      return Promise.resolve(callCount);
    });

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });
    expect(resource.value()).toBe(1);

    resource.reload();
    expect(resource.isLoading()).toBe(true);

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });
    expect(resource.value()).toBe(2);
    expect(callCount).toBe(2);
  });

  it('reload clears previous error', async () => {
    let shouldFail = true;
    const resource = forjaResource(() => {
      if (shouldFail) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });
    expect(resource.error()).toBeTruthy();

    shouldFail = false;
    resource.reload();

    await vi.waitFor(() => {
      expect(resource.isLoading()).toBe(false);
    });
    expect(resource.error()).toBeNull();
    expect(resource.value()).toBe('ok');
  });

  it('signals are readonly', () => {
    const resource = forjaResource(() => Promise.resolve(42));

    // Readonly signals don't have .set() — they're Signal<T>, not WritableSignal<T>
    expect(typeof resource.value).toBe('function');
    expect(typeof resource.isLoading).toBe('function');
    expect(typeof resource.error).toBe('function');
    expect('set' in resource.value).toBe(false);
    expect('set' in resource.isLoading).toBe(false);
    expect('set' in resource.error).toBe(false);
  });
});
