import { useRef } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  ClickAwayListener,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';

interface QuickPostActionsProps {
  isSaving: boolean;
  canSubmit: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onPublish: (status: ContentStatus) => void;
  onCancel: () => void;
}

/** Footer for the quick-post dialog: "more options" (draft + open editor),
 * cancel, and a publish split button with a publish/draft menu. */
export default function QuickPostActions({
  isSaving,
  canSubmit,
  menuOpen,
  onMenuOpenChange,
  onPublish,
  onCancel,
}: QuickPostActionsProps) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <Button startIcon={<OpenInNewIcon />} onClick={() => onPublish('Draft')} disabled={isSaving || !canSubmit} size="small">{t('quickPost.moreOptions')}</Button>
      <Box sx={{ flex: 1 }} />
      <Button onClick={onCancel} disabled={isSaving}>{t('common.actions.cancel')}</Button>
      <ButtonGroup variant="contained" ref={anchorRef} disabled={isSaving || !canSubmit}>
        <Button onClick={() => onPublish('Published')} startIcon={<SendIcon />}>{isSaving ? t('common.actions.saving') : t('quickPost.publish')}</Button>
        <Button size="small" onClick={() => onMenuOpenChange(!menuOpen)}><ArrowDropDownIcon /></Button>
      </ButtonGroup>
      <Popper open={menuOpen} anchorEl={anchorRef.current} transition disablePortal placement="top-end">
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper elevation={8}>
              <ClickAwayListener onClickAway={() => onMenuOpenChange(false)}>
                <MenuList>
                  <MenuItem onClick={() => onPublish('Published')}>{t('quickPost.publishNow')}</MenuItem>
                  <MenuItem onClick={() => onPublish('Draft')}>{t('quickPost.saveAsDraft')}</MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </Box>
  );
}
