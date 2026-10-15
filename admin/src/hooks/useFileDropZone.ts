import { useCallback, useRef } from 'react';

interface FileDropZoneOptions {
  /** Called with the first dropped or picked file. */
  onFile: (file: File) => void;
  /** Drag-hover state lives with the caller (state, reducer, or lifted prop). */
  onDragOverChange: (dragOver: boolean) => void;
  /** Suppresses opening the file picker on click (e.g. while uploading). */
  disabled?: boolean;
}

/**
 * Drag-and-drop + click-to-pick wiring for a file drop zone backed by a
 * hidden `<input type="file">`. The input is cleared after every pick so
 * re-selecting the same file fires `onChange` again.
 */
export function useFileDropZone({ onFile, onDragOverChange, disabled = false }: FileDropZoneOptions) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange(true);
  }, [onDragOverChange]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange(false);
  }, [onDragOverChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverChange(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile, onDragOverChange]);

  const onClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }, [onFile]);

  return {
    dropZoneProps: { onDragOver, onDragLeave, onDrop, onClick },
    inputProps: { ref: inputRef, onChange },
  };
}
