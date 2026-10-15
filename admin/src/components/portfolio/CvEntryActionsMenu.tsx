import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import type { CvEntryResponse } from '@/types/api';
import { RowKebabMenu, type RowKebabMenuEntry } from '@/components/shared/contentActionsMenu';

/** Row callbacks a CV entry list wires into each entry's menu. */
export interface CvEntryRowHandlers {
  onEdit: (entry: CvEntryResponse) => void;
  onDelete: (entry: CvEntryResponse) => void;
}

export interface CvEntryActionsMenuProps extends CvEntryRowHandlers {
  entry: CvEntryResponse;
  canWrite: boolean;
  isAdmin: boolean;
}

export default function CvEntryActionsMenu({ entry, canWrite, isAdmin, onEdit, onDelete }: CvEntryActionsMenuProps) {
  const { t } = useTranslation();
  const entries: RowKebabMenuEntry<CvEntryResponse>[] = canWrite
    ? [{ id: 'edit', icon: <EditIcon fontSize="small" />, label: t('common.actions.edit'), handler: onEdit }]
    : [];

  return <RowKebabMenu item={entry} isAdmin={isAdmin} testId="cv-entry-actions.btn.menu" entries={entries} onDelete={onDelete} />;
}
