import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCommands } from '../SlashCommandMenu';

describe('SlashCommandMenu zen command', () => {
  const fakeEditor = {
    chain: () => ({
      focus: () => ({
        deleteRange: () => ({ run: vi.fn() }),
      }),
    }),
  } as never;
  const fakeRange = { from: 0, to: 0 };

  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('invokes the configured onToggleZen callback', () => {
    const onToggleZen = vi.fn();
    const commands = buildCommands({ onToggleZen });
    const zen = commands.find((c) => c.key === 'zen');

    expect(zen).toBeDefined();
    zen!.command({ editor: fakeEditor, range: fakeRange });

    expect(onToggleZen).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch a window event for zen toggle', () => {
    const onToggleZen = vi.fn();
    const zen = buildCommands({ onToggleZen }).find((c) => c.key === 'zen')!;

    zen.command({ editor: fakeEditor, range: fakeRange });

    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
