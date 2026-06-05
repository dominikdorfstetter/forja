import { useState, useCallback } from 'react';
import { Box, Chip, TextField, Autocomplete } from '@mui/material';
import type { SiteTagItem } from '@/types/api';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: SiteTagItem[];
  disabled?: boolean;
  placeholder?: string;
}

// Module-level constant so default props don't create a fresh array each render.
const EMPTY_SUGGESTIONS: SiteTagItem[] = [];

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export default function TagInput({
  tags,
  onChange,
  suggestions = EMPTY_SUGGESTIONS,
  disabled = false,
  placeholder = 'Type to add tag...',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = useCallback(
    (raw: string) => {
      const tag = normalizeTag(raw);
      if (!tag || tags.includes(tag)) return;
      onChange([...tags, tag]);
      setInputValue('');
    },
    [tags, onChange],
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      e.stopPropagation();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.endsWith(',')) {
      const tag = value.slice(0, -1);
      if (tag.trim()) addTag(tag);
      return;
    }
    setInputValue(value);
  };

  const suggestionOptions = (Array.isArray(suggestions) ? suggestions : [])
    .map((s) => s.tag)
    .filter((t) => !tags.includes(t));

  return (
    <Box data-testid="tag-input">
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: tags.length > 0 ? 1 : 0 }}>
        {tags.map((tag, index) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            onDelete={disabled ? undefined : () => removeTag(index)}
            deleteIcon={<span data-testid="tag-delete">&times;</span>}
            sx={{
              bgcolor: 'color-mix(in oklch, var(--info) 16%, transparent)',
              border: '1px solid color-mix(in oklch, var(--info) 40%, transparent)',
              color: 'var(--info)',
              height: 24,
              fontSize: 12,
              fontWeight: 600,
              fontVariationSettings: '"wght" 600, "opsz" 12',
              '& .MuiChip-label': { px: 1 },
              '& .MuiChip-deleteIcon': {
                color: 'var(--info)',
                opacity: 0.7,
                '&:hover': { opacity: 1, color: 'var(--info)' },
              },
            }}
          />
        ))}
      </Box>
      <Autocomplete
        freeSolo
        options={suggestionOptions}
        inputValue={inputValue}
        onInputChange={(_, value) => {
          setInputValue(value);
        }}
        onChange={(_, value) => {
          if (typeof value === 'string' && value.trim()) {
            addTag(value);
          }
        }}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder={placeholder}
            slotProps={{
              ...params.slotProps,

              htmlInput: {
                ...params.slotProps.htmlInput,
                maxLength: 50,
                onKeyDown: handleKeyDown,
                onChange: handleChange,
              }
            }}
          />
        )}
        size="small"
      />
    </Box>
  );
}
