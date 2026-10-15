import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSaveBar } from '@/store/SaveBarContext';
import { SaveBarActions, SaveBarChangesPopover, SaveBarStatus } from './GlobalSaveBarParts';

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

  const { changedFields } = activeEntry;
  const canExpand = !!changedFields && changedFields.length > 0;

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
        <SaveBarStatus
          entry={activeEntry}
          canExpand={canExpand}
          expanded={Boolean(anchorEl)}
          onExpand={setAnchorEl}
        />
        <SaveBarActions entry={activeEntry} />
      </div>

      {canExpand && (
        <SaveBarChangesPopover
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          changedFields={changedFields}
          onDiscard={activeEntry.onDiscard}
          onRevertField={activeEntry.onRevertField}
        />
      )}
    </div>
  );
}
