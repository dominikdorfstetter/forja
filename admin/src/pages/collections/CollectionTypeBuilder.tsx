/**
 * Schema-driven builder for a custom type ("Collection", #797).
 *
 * Works for both create and edit. In edit mode it prefills from the existing
 * {@link CustomTypeResponse}, locks the immutable `key`, and carries each
 * field's `id` through so the backend can detect renames vs. new fields
 * (#800 evolve_field). On save it emits a {@link CreateCustomTypeRequest}-
 * shaped payload; the edit page maps it to an update by dropping `key`.
 *
 * Fields are drag-and-drop reorderable (@dnd-kit); display_order is derived
 * from row position on submit. Presentational + self-contained row state. The
 * page obeys the Layout chrome rule (no own maxWidth/padding). Every
 * interactive control carries a data-testid for e2e, and labels/help text are
 * i18n-driven (11 locales).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { M3Button, SectionHead, SettingsCard } from '@/components/design-system';
import type {
  CreateCustomTypeRequest,
  CustomContentKind,
  CustomFieldInput,
  CustomFieldType,
  CustomTypeResponse,
} from '@/types/customTypes';

const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'richtext',
  'number',
  'boolean',
  'date',
  'enum',
  'media',
];

let rowSeq = 0;
interface Row extends CustomFieldInput {
  _uid: number;
}

function blankRow(isTitle = false): Row {
  return {
    _uid: rowSeq++,
    key: '',
    label: '',
    field_type: 'text',
    required: false,
    localized: false,
    is_title: isTitle,
    is_pii: false,
    legal_basis: '',
    enum_options: [],
  };
}

/** Prefill rows from an existing type's (non-deprecated) fields, carrying ids. */
function rowsFromType(type: CustomTypeResponse): Row[] {
  const rows = type.fields
    .filter((f) => !f.deprecated_at)
    .sort((a, b) => a.display_order - b.display_order)
    .map<Row>((f) => ({
      _uid: rowSeq++,
      id: f.id,
      key: f.key,
      label: f.label,
      field_type: f.field_type,
      required: f.required,
      localized: f.localized,
      is_title: f.is_title,
      is_pii: f.is_pii,
      legal_basis: f.legal_basis ?? '',
      processing_purpose: f.processing_purpose ?? '',
      enum_options: f.enum_options ?? [],
    }));
  return rows.length ? rows : [blankRow(true)];
}

interface FieldRowProps {
  row: Row;
  removeDisabled: boolean;
  onPatch: (uid: number, p: Partial<Row>) => void;
  onSetTitle: (uid: number) => void;
  onRemove: (uid: number) => void;
}

/** A single draggable field-definition row. The drag handle is the only
 *  element wired to dnd listeners, so the inputs stay fully interactive. */
function SortableFieldRow({ row, removeDisabled, onPatch, onSetTitle, onRemove }: FieldRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row._uid });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      data-testid="field-row"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        bgcolor: 'var(--surface-container-low)',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
        <IconButton
          ref={setActivatorNodeRef}
          aria-label={t('collections.dragToReorder')}
          data-testid="field-drag"
          size="small"
          sx={{ cursor: 'grab', touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <DragIndicatorIcon />
        </IconButton>
        <TextField
          label={t('collections.fieldKey')}
          value={row.key}
          onChange={(e) => onPatch(row._uid, { key: e.target.value })}
          slotProps={{ htmlInput: { 'data-testid': 'field-key' } }}
          required
        />
        <TextField
          label={t('collections.fieldLabel')}
          value={row.label}
          onChange={(e) => onPatch(row._uid, { label: e.target.value })}
          slotProps={{ htmlInput: { 'data-testid': 'field-label' } }}
          required
        />
        <TextField
          select
          label={t('collections.fieldType')}
          value={row.field_type}
          onChange={(e) => onPatch(row._uid, { field_type: e.target.value as CustomFieldType })}
          slotProps={{ htmlInput: { 'data-testid': 'field-type' } }}
          sx={{ minWidth: 140 }}
        >
          {FIELD_TYPES.map((ft) => (
            <MenuItem key={ft} value={ft}>
              {ft}
            </MenuItem>
          ))}
        </TextField>
        <IconButton
          aria-label={t('collections.removeField')}
          data-testid="remove-field"
          onClick={() => onRemove(row._uid)}
          disabled={removeDisabled}
        >
          <DeleteOutlineIcon />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={<Switch checked={!!row.required} onChange={(e) => onPatch(row._uid, { required: e.target.checked })} />}
          label={t('collections.required')}
        />
        <FormControlLabel
          control={<Switch checked={!!row.localized} onChange={(e) => onPatch(row._uid, { localized: e.target.checked })} />}
          label={t('collections.localized')}
        />
        <FormControlLabel
          control={<Switch checked={!!row.is_title} onChange={() => onSetTitle(row._uid)} data-testid="field-title" />}
          label={t('collections.titleField')}
        />
        <FormControlLabel
          control={<Switch checked={!!row.is_pii} onChange={(e) => onPatch(row._uid, { is_pii: e.target.checked })} data-testid="field-pii" />}
          label={t('collections.isPii')}
        />
        {row.is_pii && <Chip size="small" color="warning" label={t('collections.piiBadge')} />}
      </Stack>

      {row.is_pii && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('collections.legalBasis')}
            value={row.legal_basis ?? ''}
            onChange={(e) => onPatch(row._uid, { legal_basis: e.target.value })}
            slotProps={{ htmlInput: { 'data-testid': 'field-legal-basis' } }}
            helperText={t('collections.piiHelp')}
            required
            fullWidth
          />
          <TextField
            label={t('collections.purpose')}
            value={row.processing_purpose ?? ''}
            onChange={(e) => onPatch(row._uid, { processing_purpose: e.target.value })}
            fullWidth
          />
        </Stack>
      )}

      {row.field_type === 'enum' && (
        <TextField
          label={t('collections.enumOptions')}
          value={(row.enum_options ?? []).join(', ')}
          onChange={(e) =>
            onPatch(row._uid, {
              enum_options: e.target.value
                .split(',')
                .flatMap((s) => {
                  const trimmed = s.trim();
                  return trimmed ? [trimmed] : [];
                }),
            })
          }
          slotProps={{ htmlInput: { 'data-testid': 'field-enum-options' } }}
          sx={{ mt: 1 }}
          fullWidth
        />
      )}
    </Box>
  );
}

export interface CollectionTypeBuilderProps {
  onSubmit: (req: CreateCustomTypeRequest) => void;
  submitting?: boolean;
  /** When provided, the builder opens in edit mode prefilled from this type. */
  initial?: CustomTypeResponse;
  mode?: 'create' | 'edit';
}

export function CollectionTypeBuilder({
  onSubmit,
  submitting,
  initial,
  mode = 'create',
}: CollectionTypeBuilderProps) {
  const { t } = useTranslation();
  const isEdit = mode === 'edit';
  const [name, setName] = useState(initial?.name ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [retentionDays, setRetentionDays] = useState(
    initial?.retention_days != null ? String(initial.retention_days) : '',
  );
  const [isPublic, setIsPublic] = useState(initial?.is_publicly_readable ?? false);
  const [contentKind, setContentKind] = useState<CustomContentKind>(
    initial?.content_kind ?? 'data',
  );
  const [rows, setRows] = useState<Row[]>(initial ? rowsFromType(initial) : [blankRow(true)]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const patch = (uid: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r._uid === uid ? { ...r, ...p } : r)));

  const setTitle = (uid: number) =>
    setRows((rs) => rs.map((r) => ({ ...r, is_title: r._uid === uid })));

  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (uid: number) => setRows((rs) => rs.filter((r) => r._uid !== uid));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setRows((rs) => {
        const oldIndex = rs.findIndex((r) => r._uid === active.id);
        const newIndex = rs.findIndex((r) => r._uid === over.id);
        return oldIndex < 0 || newIndex < 0 ? rs : arrayMove(rs, oldIndex, newIndex);
      });
    }
  };

  const buildRequest = (): CreateCustomTypeRequest => {
    const fields: CustomFieldInput[] = rows.map(({ _uid, enum_options, legal_basis, ...rest }, i) => ({
      ...rest,
      display_order: i,
      enum_options: rest.field_type === 'enum' ? (enum_options ?? []) : null,
      legal_basis: rest.is_pii ? legal_basis || null : null,
    }));
    return {
      key: key.trim(),
      name: name.trim(),
      retention_days: retentionDays ? Number(retentionDays) : null,
      is_publicly_readable: isPublic,
      content_kind: contentKind,
      fields,
    };
  };
  const submit = () => onSubmit(buildRequest());

  // Drive the global save bar (#48) instead of an in-form submit button. Dirty
  // is a fingerprint of the canonical payload vs. the baseline captured at mount
  // (the initial/blank state). Create mode force-shows the bar — a fresh type
  // has nothing "dirty" yet — while the nav guard still keys off real edits.
  const [baseline] = useState(() => JSON.stringify(buildRequest()));
  const isDirty = JSON.stringify(buildRequest()) !== baseline;

  useFormSaveBar({
    id: 'collection-type-builder',
    isDirty,
    saving: submitting,
    forceVisible: !isEdit,
    saveLabel: isEdit ? t('collections.saveChanges') : t('collections.save'),
    saveTestId: 'save-type',
    discardTestId: 'discard-type',
    onSave: submit,
    onDiscard: () => {
      setName(initial?.name ?? '');
      setKey(initial?.key ?? '');
      setRetentionDays(initial?.retention_days != null ? String(initial.retention_days) : '');
      setIsPublic(initial?.is_publicly_readable ?? false);
      setContentKind(initial?.content_kind ?? 'data');
      setRows(initial ? rowsFromType(initial) : [blankRow(true)]);
    },
  });

  return (
    <Box component="form" data-testid="collection-type-builder" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Stack spacing={4}>
        <Box>
          <SectionHead
            icon="tune"
            title={t('collections.sectionDetails')}
            subtitle={t('collections.sectionDetailsDesc')}
          />
          <SettingsCard>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('collections.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                slotProps={{ htmlInput: { 'data-testid': 'type-name' } }}
                required
                fullWidth
              />
              <TextField
                label={t('collections.key')}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                slotProps={{ htmlInput: { 'data-testid': 'type-key' } }}
                helperText={isEdit ? t('collections.keyLocked') : t('collections.keyHelp')}
                disabled={isEdit}
                required
                fullWidth
              />
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: 'flex-start' }}
            >
              <TextField
                select
                label={t('collections.contentKind')}
                value={contentKind}
                onChange={(e) => setContentKind(e.target.value as CustomContentKind)}
                slotProps={{ htmlInput: { 'data-testid': 'type-content-kind' } }}
                helperText={
                  contentKind === 'page'
                    ? t('collections.kindPageDesc')
                    : t('collections.kindDataDesc')
                }
                sx={{ flex: 1 }}
              >
                <MenuItem value="data">{t('collections.kindData')}</MenuItem>
                <MenuItem value="page">{t('collections.kindPage')}</MenuItem>
              </TextField>
              <TextField
                type="number"
                label={t('collections.retentionDays')}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                slotProps={{ htmlInput: { 'data-testid': 'type-retention', min: 0 } }}
                helperText={t('collections.retentionHelp')}
                sx={{ width: { xs: '100%', sm: 200 } }}
              />
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  data-testid="type-public"
                />
              }
              label={t('collections.publiclyReadable')}
            />
          </SettingsCard>
        </Box>

        <Box>
          <SectionHead
            icon="view_list"
            title={t('collections.sectionFields')}
            subtitle={t('collections.sectionFieldsDesc')}
          />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r._uid)} strategy={verticalListSortingStrategy}>
              <Stack spacing={2}>
                {rows.map((row) => (
                  <SortableFieldRow
                    key={row._uid}
                    row={row}
                    removeDisabled={rows.length === 1}
                    onPatch={patch}
                    onSetTitle={setTitle}
                    onRemove={removeRow}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>

          <Box sx={{ mt: 2 }}>
            <M3Button variant="outlined" size="md" icon="add" onClick={addRow} data-testid="add-field">
              {t('collections.addField')}
            </M3Button>
          </Box>
        </Box>

        {isEdit && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t('collections.editHelp')}
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
