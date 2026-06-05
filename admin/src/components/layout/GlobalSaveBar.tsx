import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover } from '@mui/material';
import { useSaveBar } from '@/store/SaveBarContext';
import { M3Button, M3IconButton, Icon } from '@/components/design-system';

/**
 * App-level save bar that docks at the bottom of the main content area.
 * Renders only when a page has registered a dirty form via
 * `useRegisterSaveBar` / `useFormSaveBar`.
 *
 * Visual language is M3 Expressive: a floating pill on
 * surface-container-highest with a soft elevation shadow, slides up
 * from the bottom on appear, and pairs a tonal "circle" indicator dot
 * with the status text on the left. When the host reports a change
 * count, the status reads "N unsaved changes"; when it also reports the
 * changed fields, the indicator becomes a button opening a popover that
 * lists each field with a per-field revert. Buttons sit on the right:
 * tonal Discard + filled Save with shape-morph press.
 */
export default function GlobalSaveBar() {
  const { activeEntry } = useSaveBar();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Trigger the slide-in animation when an entry appears.
  useEffect(() => {
    if (activeEntry) {
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    }
    setMounted(false);
  }, [activeEntry]);

  // Close the popover whenever the active form changes.
  useEffect(() => {
    setAnchorEl(null);
  }, [activeEntry?.id]);

  if (!activeEntry) return null;

  const {
    status,
    saving,
    changeCount,
    changedFields,
    onRevertField,
    onSave,
    onDiscard,
    saveLabel,
    savingLabel,
    discardLabel,
    saveTestId,
    discardTestId,
  } = activeEntry;

  const hasCount = typeof changeCount === 'number' && changeCount > 0;
  const statusText = hasCount
    ? t('unsavedChanges.count', { count: changeCount })
    : (status ?? t('unsavedChanges.title'));
  const canExpand = !!changedFields && changedFields.length > 0;

  const indicator = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--primary-container)',
          color: 'var(--on-primary-container)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={saving ? 'progress_activity' : 'edit'} size={16} />
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--on-surface)',
          letterSpacing: 0.1,
        }}
      >
        {statusText}
      </span>
    </>
  );

  return (
    <div
      data-testid="global-save-bar"
      role="region"
      aria-label={t('unsavedChanges.title')}
      style={{
        position: 'sticky',
        bottom: 24,
        zIndex: 10,
        marginTop: 32,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 12px 8px 20px',
          minHeight: 56,
          borderRadius: 28,
          background: 'var(--surface-container-highest)',
          border: '1px solid var(--outline-variant)',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.18), 0 16px 40px -12px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          opacity: mounted ? 1 : 0,
          transition:
            'transform 280ms var(--motion-shape-morph, cubic-bezier(0.16, 1, 0.3, 1)), opacity 200ms ease',
        }}
      >
        {canExpand ? (
          <button
            type="button"
            data-testid="save-bar-changes-toggle"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-haspopup="dialog"
            aria-expanded={Boolean(anchorEl)}
            aria-label={t('unsavedChanges.viewChanges')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 20,
              font: 'inherit',
            }}
          >
            {indicator}
            <Icon name="expand_more" size={18} />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{indicator}</div>
        )}

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {onDiscard && (
            <M3Button
              variant="tonal"
              size="sm"
              onClick={onDiscard}
              disabled={saving}
              data-testid={discardTestId}
            >
              {discardLabel ?? t('unsavedChanges.discard')}
            </M3Button>
          )}
          <M3Button
            variant="filled"
            size="sm"
            icon="check"
            onClick={onSave}
            disabled={saving}
            data-testid={saveTestId}
          >
            {saving
              ? (savingLabel ?? t('common.actions.saving'))
              : (saveLabel ?? t('common.actions.save'))}
          </M3Button>
        </div>
      </div>

      {canExpand && (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{
            paper: {
              style: {
                pointerEvents: 'auto',
                marginTop: -8,
                borderRadius: 20,
                background: 'var(--surface-container-high)',
                border: '1px solid var(--outline-variant)',
                minWidth: 240,
                maxWidth: 360,
              },
            },
          }}
        >
          <div style={{ padding: '12px 8px 8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px 8px',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  color: 'var(--on-surface-variant)',
                }}
              >
                {t('unsavedChanges.changedFields')}
              </span>
              {onDiscard && (
                <M3Button variant="text" size="sm" onClick={onDiscard}>
                  {t('unsavedChanges.revertAll')}
                </M3Button>
              )}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {changedFields!.map((field) => (
                <li
                  key={field.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '2px 4px 2px 8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--on-surface)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {field.label}
                  </span>
                  {onRevertField && (
                    <M3IconButton
                      name="undo"
                      size={32}
                      onClick={() => onRevertField(field.name)}
                      data-testid={`save-bar-revert-${field.name}`}
                      tooltip={t('unsavedChanges.revertField', { field: field.label })}
                      ariaLabel={t('unsavedChanges.revertField', { field: field.label })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Popover>
      )}
    </div>
  );
}
