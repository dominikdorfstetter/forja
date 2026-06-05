import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RateReviewIcon from '@mui/icons-material/RateReview';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import ArchiveIcon from '@mui/icons-material/Archive';
import type { SvgIconComponent } from '@mui/icons-material';
import { useReadOnly } from '@/hooks/useReadOnly';
import { nextStatuses } from '@/utils/submissionStatus';
import type { FormSubmissionStatus, SubmissionListItem } from '@/types/api';

/** Icon per transition *target* — 'new' is never a target so it is omitted. */
const TARGET_ICON: Record<
  Exclude<FormSubmissionStatus, 'new'>,
  SvgIconComponent
> = {
  in_review: RateReviewIcon,
  resolved: CheckCircleIcon,
  rejected: BlockIcon,
  archived: ArchiveIcon,
};

interface SubmissionActionsMenuProps {
  submission: SubmissionListItem;
  onChangeStatus: (status: FormSubmissionStatus) => void;
  /** True while a status mutation is in flight (disables the trigger). */
  pending?: boolean;
}

/**
 * Per-row status action menu for the submissions inbox. Offers only the
 * state-machine's legal next transitions for that row's current status, so a
 * reviewer can move a submission along without opening the detail drawer.
 *
 * `stopPropagation` everywhere is deliberate: rows are click-to-open-drawer,
 * and neither the trigger nor the menu items should bubble into that.
 */
export default function SubmissionActionsMenu({
  submission,
  onChangeStatus,
  pending,
}: SubmissionActionsMenuProps) {
  const { t } = useTranslation();
  const { readOnly } = useReadOnly();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const close = () => setAnchorEl(null);
  const targets = nextStatuses(submission.status);
  const label = t('formsModule.submissions.actions.menu', 'Change status');

  return (
    <>
      <Tooltip title={label}>
        <span>
          <IconButton
            size="small"
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={!!anchorEl}
            data-testid={`forms.submission.actions.${submission.id}`}
            disabled={readOnly || pending}
            onClick={(e) => {
              e.stopPropagation();
              setAnchorEl(e.currentTarget);
            }}
          >
            <MoreVertIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        onClick={(e) => e.stopPropagation()}
      >
        {targets.length === 0 && (
          <MenuItem disabled data-testid="forms.submission.actions.none">
            {t(
              'formsModule.submissions.actions.none',
              'No further transitions',
            )}
          </MenuItem>
        )}
        {targets.map((target) => {
          const Icon = TARGET_ICON[target as Exclude<FormSubmissionStatus, 'new'>];
          return (
            <MenuItem
              key={target}
              data-testid={`forms.submission.actions.${submission.id}.${target}`}
              onClick={(e) => {
                e.stopPropagation();
                close();
                onChangeStatus(target);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {t(`formsModule.submissions.transition.${target}`, target)}
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
