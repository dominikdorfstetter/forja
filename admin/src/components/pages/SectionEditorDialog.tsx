import type { PageSectionResponse } from '@/types/api';
import { useSectionEditor, type SectionPageContext } from './useSectionEditor';
import { SectionEditorModal, SectionEditorPanel } from './SectionEditorViews';

export type { SectionPageContext } from './useSectionEditor';

interface SectionEditorDialogProps {
  open: boolean;
  section: PageSectionResponse | null;
  onClose: () => void;
  /** When true, renders content without the Dialog wrapper (for use inside a Drawer) */
  embedded?: boolean;
  /** Page metadata used to ground AI section-content generation. Hidden when absent. */
  pageContext?: SectionPageContext;
}

export default function SectionEditorDialog({ open, section, onClose, embedded, pageContext }: SectionEditorDialogProps) {
  const editor = useSectionEditor({ open, section, onClose, pageContext });
  if (!section) return null;

  return embedded
    ? <SectionEditorPanel section={section} editor={editor} />
    : <SectionEditorModal open={open} section={section} editor={editor} />;
}
