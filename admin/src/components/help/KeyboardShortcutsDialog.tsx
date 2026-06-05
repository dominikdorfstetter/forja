import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { Kbd, M3Button } from '@/components/design-system';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '\u2318' : 'Ctrl';

const SHORTCUTS = [
  { action: 'help.shortcuts.commandPalette', keys: [mod, 'K'] },
  { action: 'help.shortcuts.save', keys: [mod, 'S'] },
  { action: 'help.shortcuts.undo', keys: [mod, 'Z'] },
  { action: 'help.shortcuts.redo', keys: [mod, 'Shift', 'Z'] },
  { action: 'help.shortcuts.bold', keys: [mod, 'B'] },
  { action: 'help.shortcuts.italic', keys: [mod, 'I'] },
  { action: 'help.shortcuts.underline', keys: [mod, 'U'] },
] as const;

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="keyboard"
      title={t('help.shortcuts.title')}
      maxWidth="xs"
      actions={
        <M3Button variant="filled" size="sm" onClick={onClose}>
          {t('common.actions.close')}
        </M3Button>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {SHORTCUTS.map((shortcut) => (
          <Box
            key={shortcut.action}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              borderBottom: '1px solid var(--outline-variant)',
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <Box sx={{ fontSize: 14, color: 'var(--on-surface)' }}>
              {t(shortcut.action)}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </FormDialog>
  );
}
