import { describe, it, expect } from 'vitest';
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_MEDIA_TYPES,
  MAX_MEDIA_FILE_SIZE,
  checkMediaFile,
} from '../mediaFileValidation';

function fileOf(type: string, size = 10): File {
  const file = new File(['x'], 'f', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('checkMediaFile', () => {
  it('accepts an allowed type within the size limit', () => {
    expect(checkMediaFile(fileOf('image/png'), ACCEPTED_IMAGE_TYPES)).toBeNull();
  });

  it('rejects files over the size limit before checking the type', () => {
    expect(checkMediaFile(fileOf('application/x-msdownload', MAX_MEDIA_FILE_SIZE + 1), ACCEPTED_IMAGE_TYPES)).toBe('tooLarge');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(checkMediaFile(fileOf('image/png', MAX_MEDIA_FILE_SIZE), ACCEPTED_IMAGE_TYPES)).toBeNull();
  });

  it('rejects a type outside the accepted list', () => {
    expect(checkMediaFile(fileOf('application/pdf'), ACCEPTED_IMAGE_TYPES)).toBe('invalidType');
  });

  it('lets files without a MIME type through for server-side detection', () => {
    expect(checkMediaFile(fileOf(''), ACCEPTED_IMAGE_TYPES)).toBeNull();
  });

  it('media types are a superset of image types', () => {
    expect(ACCEPTED_MEDIA_TYPES).toEqual(expect.arrayContaining(ACCEPTED_IMAGE_TYPES));
    expect(checkMediaFile(fileOf('application/pdf'), ACCEPTED_MEDIA_TYPES)).toBeNull();
  });
});
