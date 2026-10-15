import { Drawer } from '@mui/material';
import type { PageSectionResponse } from '@/types/api';
import SectionEditorDialog from '@/components/pages/SectionEditorDialog';
import { otherSectionTypes } from './pageSectionsHelpers';

/** Side panel hosting the embedded section editor. */
export default function SectionEditorDrawer({
  section,
  sections,
  pageRoute,
  onClose,
}: {
  section: PageSectionResponse | null;
  sections: PageSectionResponse[] | undefined;
  pageRoute: string | undefined;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="right"
      open={!!section}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: '100%', sm: '50%', lg: '33%' }, minWidth: { sm: 400 } } }
      }}
    >
      {section && (
        <SectionEditorDialog
          open={true}
          section={section}
          onClose={onClose}
          embedded
          pageContext={{
            route: pageRoute,
            existingSectionTypes: otherSectionTypes(sections, section.id),
          }}
        />
      )}
    </Drawer>
  );
}
