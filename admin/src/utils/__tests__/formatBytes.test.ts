import { describe, it, expect } from 'vitest';
import { formatBytes } from '../formatBytes';

describe('formatBytes', () => {
  it('shows whole bytes below 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('scales to the largest fitting unit with one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 ** 2)).toBe('50.0 MB');
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB');
  });

  it('caps at terabytes', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3.0 TB');
    expect(formatBytes(2048 * 1024 ** 4)).toBe('2048.0 TB');
  });
});
