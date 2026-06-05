import { useState, useRef, useCallback } from 'react';
import {
  TextField,
  Paper,
  MenuList,
  MenuItem,
  ListItemText,
  Popper,
  Typography,
  ClickAwayListener,
} from '@mui/material';

interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: 'title', description: 'Page or post title', example: 'My Blog Post' },
  { name: 'site_name', description: 'Name of the site', example: 'My Website' },
  { name: 'site_description', description: 'Site default description', example: 'A great website' },
  { name: 'author', description: 'Content author name', example: 'John Doe' },
  { name: 'date', description: 'Publication date', example: '2026-04-01' },
  { name: 'category', description: 'Primary category', example: 'Technology' },
  { name: 'locale', description: 'Content locale code', example: 'en' },
];

interface TemplateVariableInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  'data-testid'?: string;
}

export default function TemplateVariableInput({
  value,
  onChange,
  label,
  placeholder,
  maxLength,
  helperText,
  fullWidth = true,
  size = 'small',
  'data-testid': testId,
}: TemplateVariableInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const pos = e.target.selectionStart ?? newValue.length;
      onChange(newValue);
      setCursorPos(pos);

      const textBefore = newValue.slice(0, pos);
      const match = textBefore.match(/\{\{(\w*)$/);
      if (match) {
        setFilter(match[1].toLowerCase());
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    },
    [onChange],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, []);

  const insertVariable = useCallback(
    (varName: string) => {
      const textBefore = value.slice(0, cursorPos);
      const textAfter = value.slice(cursorPos);
      const match = textBefore.match(/\{\{(\w*)$/);
      if (match) {
        const prefixEnd = textBefore.length - match[0].length;
        const newValue =
          textBefore.slice(0, prefixEnd) + `{{${varName}}}` + textAfter;
        onChange(newValue);
      }
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [value, cursorPos, onChange],
  );

  const filteredVars = TEMPLATE_VARIABLES.filter((v) =>
    v.name.toLowerCase().includes(filter),
  );

  return (
    <div ref={anchorRef}>
      <TextField
        inputRef={inputRef}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        fullWidth={fullWidth}
        size={size}
        helperText={helperText}
        data-testid={testId}
        slotProps={{
          htmlInput: { maxLength }
        }}
      />
      <Popper
        open={showSuggestions && filteredVars.length > 0}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        sx={(theme) => ({ zIndex: theme.zIndex.modal })}
        data-testid={testId ? `${testId}-suggestions` : undefined}
      >
        <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
          <Paper
            elevation={8}
            sx={{ maxHeight: 240, overflow: 'auto', mt: 0.5, minWidth: 300 }}
          >
            <MenuList dense>
              {filteredVars.map((v) => (
                <MenuItem
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  data-testid={testId ? `${testId}-var-${v.name}` : undefined}
                >
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}
                      >
                        {`{{${v.name}}}`}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {v.description} (e.g. &quot;{v.example}&quot;)
                      </Typography>
                    }
                  />
                </MenuItem>
              ))}
            </MenuList>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </div>
  );
}
