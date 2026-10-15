import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Popover } from '@mui/material';
import type { ChangedField, SaveBarRegistration } from '@/store/SaveBarContext';
import { M3Button, M3IconButton, Icon } from '@/components/design-system';

/** "N unsaved changes" when the host reports a count, else its status text or the generic title. */
function resolveStatusText(t: TFunction, entry: SaveBarRegistration) {
  const { changeCount, status } = entry;
  if (typeof changeCount === 'number' && changeCount > 0) {
    return t('unsavedChanges.count', { count: changeCount });
  }
  return status ?? t('unsavedChanges.title');
}

function SaveBarIndicator({ entry }: { entry: SaveBarRegistration }) {
  const { t } = useTranslation();
  return (
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
        <Icon name={entry.saving ? 'progress_activity' : 'edit'} size={16} />
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--on-surface)',
          letterSpacing: 0.1,
        }}
      >
        {resolveStatusText(t, entry)}
      </span>
    </>
  );
}

interface SaveBarStatusProps {
  entry: SaveBarRegistration;
  /** True when the host reported changed fields, so the status opens the popover. */
  canExpand: boolean;
  expanded: boolean;
  onExpand: (anchor: HTMLButtonElement) => void;
}

/** Left side of the bar: the indicator, as a popover toggle when there are changed fields. */
export function SaveBarStatus({ entry, canExpand, expanded, onExpand }: SaveBarStatusProps) {
  const { t } = useTranslation();
  if (!canExpand) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SaveBarIndicator entry={entry} />
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid="save-bar-changes-toggle"
      onClick={(e) => onExpand(e.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={expanded}
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
      <SaveBarIndicator entry={entry} />
      <Icon name="expand_more" size={18} />
    </button>
  );
}

/** Right side of the bar: tonal Discard (when the host allows it) + filled Save. */
export function SaveBarActions({ entry }: { entry: SaveBarRegistration }) {
  const { t } = useTranslation();
  const { saving, onSave, onDiscard, saveLabel, savingLabel, discardLabel, saveTestId, discardTestId } = entry;
  const label = saving
    ? (savingLabel ?? t('common.actions.saving'))
    : (saveLabel ?? t('common.actions.save'));
  return (
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
        {label}
      </M3Button>
    </div>
  );
}

interface SaveBarChangesPopoverProps {
  anchorEl: HTMLButtonElement | null;
  onClose: () => void;
  changedFields: ChangedField[];
  onDiscard?: () => void;
  onRevertField?: (name: string) => void;
}

/** Popover listing each changed field with a per-field revert, plus "revert all". */
export function SaveBarChangesPopover({
  anchorEl,
  onClose,
  changedFields,
  onDiscard,
  onRevertField,
}: SaveBarChangesPopoverProps) {
  const { t } = useTranslation();
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
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
          {changedFields.map((field) => (
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
  );
}
