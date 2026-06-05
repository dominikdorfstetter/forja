import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { M3IconButton } from '@/components/design-system';
import { useFieldDirty } from '@/store/FormChangeContext';

/**
 * Wraps a single form field and marks it when it has unsaved changes:
 * an M3 tonal left-accent + a change dot, plus a "revert this field"
 * control. Reads dirty state from the nearest {@link FormChangeProvider};
 * renders its child untouched when clean (or when there's no provider).
 *
 * Visual language is M3 Expressive: the accent uses `--primary` and the
 * revert affordance is a ghost icon button so it stays quiet until needed.
 */
export default function DirtyFieldMarker({
  name,
  label,
  children,
}: {
  name: string;
  label?: string;
  children: ReactNode;
}) {
  const { isDirty, revert } = useFieldDirty(name);
  const { t } = useTranslation();

  if (!isDirty) return <>{children}</>;

  return (
    <div
      data-testid={`field-marker-${name}`}
      style={{
        position: 'relative',
        paddingLeft: 12,
        boxShadow: 'inset 2px 0 0 var(--primary)',
        borderRadius: 4,
        background:
          'color-mix(in srgb, var(--primary) 5%, transparent)',
        transition: 'background 160ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -5,
          top: 14,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--primary)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        <M3IconButton
          name="undo"
          size={32}
          onClick={revert}
          data-testid={`field-revert-${name}`}
          tooltip={t('unsavedChanges.revertField', {
            defaultValue: 'Revert {{field}}',
            field: label ?? name,
          })}
          ariaLabel={t('unsavedChanges.revertField', {
            defaultValue: 'Revert {{field}}',
            field: label ?? name,
          })}
        />
      </div>
    </div>
  );
}
