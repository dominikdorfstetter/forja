import { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  IconButton,
  CircularProgress,
  type TypographyProps,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';

interface InlineEditFieldProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  variant?: TypographyProps['variant'];
  disabled?: boolean;
  fontFamily?: string;
}

export default function InlineEditField({
  value,
  onSave,
  variant = 'body1',
  disabled = false,
  fontFamily,
}: InlineEditFieldProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // keep editing on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TextField
          inputRef={inputRef}
          size="small"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          sx={{ flex: 1, '& input': { fontFamily } }}
        />
        {saving && <CircularProgress size={18} />}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: disabled ? 'default' : 'pointer',
        '&:hover .edit-icon': disabled ? {} : { opacity: 1 },
      }}
      onClick={disabled ? undefined : () => setEditing(true)}
    >
      <Typography variant={variant} sx={{ fontFamily }}>
        {value || '—'}
      </Typography>
      {!disabled && (
        <IconButton
          size="small"
          className="edit-icon"
          sx={{ opacity: 0, transition: 'opacity 0.2s' }}
          aria-label={t('inlineEdit.clickToEdit')}
        >
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  );
}
