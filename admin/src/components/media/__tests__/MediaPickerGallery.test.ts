import { describe, it, expect } from 'vitest';
import { filterMediaByFilename } from '../MediaPickerGallery';

const items = [
  { id: '1', original_filename: 'Logo-Dark.png' },
  { id: '2', original_filename: 'hero.jpg' },
];

describe('filterMediaByFilename', () => {
  it('keeps everything for a blank query', () => {
    expect(filterMediaByFilename(items, '   ')).toBe(items);
  });

  it('matches filenames case-insensitively', () => {
    expect(filterMediaByFilename(items, 'logo').map((m) => m.id)).toEqual(['1']);
    expect(filterMediaByFilename(items, 'JPG').map((m) => m.id)).toEqual(['2']);
  });
});
