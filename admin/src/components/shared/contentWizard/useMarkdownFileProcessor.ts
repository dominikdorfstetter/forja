import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { validateMarkdownFile, parseMarkdown, type MarkdownParseResult } from '@/utils/markdownImport';

export interface MarkdownFileCallbacks {
  onImportError: (error: string | null) => void;
  onFileName: (name: string) => void;
  onFileSize: (size: number) => void;
  onParsed: (result: MarkdownParseResult) => void;
}

/** Validates, reads, and parses a dropped/selected markdown file, reporting each stage via callbacks. */
export function useMarkdownFileProcessor({ onImportError, onFileName, onFileSize, onParsed }: MarkdownFileCallbacks) {
  const { t } = useTranslation();

  return useCallback(async (file: File) => {
    onImportError(null);
    const validationError = validateMarkdownFile(file);
    if (validationError) {
      onImportError(t(validationError));
      return;
    }
    onFileName(file.name);
    onFileSize(file.size);
    let content: string;
    try {
      content = await file.text();
    } catch {
      onImportError(t('markdownImport.errors.readFailed'));
      return;
    }
    const { result, error: parseError } = parseMarkdown(content);
    if (parseError) {
      onImportError(t(parseError, { max: parseError.includes('title') ? 500 : 200000 }));
      return;
    }
    if (result) {
      onParsed(result);
    }
  }, [t, onImportError, onFileName, onFileSize, onParsed]);
}
