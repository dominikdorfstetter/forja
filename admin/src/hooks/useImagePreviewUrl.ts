import { useEffect, useState } from 'react';

/**
 * Object URL for an image-file preview.
 *
 * Created in an effect (never during render, where StrictMode double-invoke
 * would leak the extra URL) and revoked automatically when the file changes
 * or the component unmounts. Returns null for non-image or absent files.
 */
export function useImagePreviewUrl(file: File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.type.startsWith('image/')) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}
