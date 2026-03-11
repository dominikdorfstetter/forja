import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('help.shortcuts.title')}
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableBody>
            {SHORTCUTS.map((shortcut) => (
              <TableRow key={shortcut.action}>
                <TableCell sx={{ border: 0, py: 1 }}>
                  {t(shortcut.action)}
                </TableCell>
                <TableCell align="right" sx={{ border: 0, py: 1 }}>
                  {shortcut.keys.map((key) => (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 0.5, fontFamily: 'monospace', minWidth: 28 }}
                    />
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
