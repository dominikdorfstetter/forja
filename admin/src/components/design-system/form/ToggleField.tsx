import { type ReactNode } from 'react';
import { Switch } from '@mui/material';

export interface ToggleFieldProps {
  label: ReactNode;
  sublabel?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Row-style toggle with label + sublabel on the left and a Switch on the
 * right. Thin wrapper over MUI Switch so the visual stays consistent with
 * the M3 Expressive row pattern used across Settings cards.
 */
export function ToggleField({
  label,
  sublabel,
  checked,
  onChange,
  disabled,
  ...rest
}: ToggleFieldProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 20,
        alignItems: 'center',
        padding: '6px 0',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--on-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--on-surface-variant)',
              marginTop: 4,
              lineHeight: 1.5,
              maxWidth: 560,
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        data-testid={rest['data-testid']}
      />
    </div>
  );
}
