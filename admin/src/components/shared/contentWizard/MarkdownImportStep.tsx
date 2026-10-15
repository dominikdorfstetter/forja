import type { ReactNode } from 'react';
import { Alert, Box, TextField } from '@mui/material';
import MarkdownUploadDropzone from './MarkdownUploadDropzone';
import type { MarkdownUploadBindings } from './wizardSourceState';

/** `slotProps` giving a TextField a monospace input (slugs, raw markdown). */
export const MONOSPACE_INPUT_SLOT_PROPS = { input: { sx: { fontFamily: 'monospace' } } } as const;

/** Read-only, scroll-capped monospace preview of an imported markdown body. */
export function ImportBodyPreview({ label, value }: { label: string; value: string }) {
  return (
    <TextField
      label={label}
      value={value}
      fullWidth
      multiline
      slotProps={{
        input: { readOnly: true, sx: { fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' } }
      }}
    />
  );
}

interface MarkdownImportStepProps {
  /** Show the wizard's editable preview fields instead of the dropzone. */
  showPreview: boolean;
  upload: MarkdownUploadBindings;
  /** The wizard-specific preview fields. */
  children: ReactNode;
}

/** Markdown import step shared by the content wizards: dropzone → editable preview, plus the import error. */
export default function MarkdownImportStep({ showPreview, upload, children }: MarkdownImportStepProps) {
  return (
    <>
      {showPreview ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
      ) : (
        <MarkdownUploadDropzone {...upload} />
      )}
      {upload.importError && <Alert severity="error" sx={{ mt: 2 }}>{upload.importError}</Alert>}
    </>
  );
}
