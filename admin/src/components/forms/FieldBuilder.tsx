import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { M3Button } from '@/components/design-system';
import { useReadOnly } from '@/hooks/useReadOnly';
import FieldEditor from './FieldEditor';
import type { FormFieldInput, FormFieldType } from '@/types/api';

interface FieldBuilderProps {
  fields: FormFieldInput[];
  onChange: (next: FormFieldInput[]) => void;
}

const FIELD_TYPES: FormFieldType[] = [
  'text',
  'textarea',
  'email',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'custom',
];

function makeField(field_type: FormFieldType, order: number): FormFieldInput {
  return {
    label: '',
    field_type,
    is_required: false,
    display_order: order,
    validation: {},
    placeholder: null,
    help_text: null,
    options:
      field_type === 'select' || field_type === 'radio' || field_type === 'checkbox' ? [] : null,
  };
}

function reseatOrder(fields: FormFieldInput[]): FormFieldInput[] {
  return fields.map((f, i) => ({ ...f, display_order: i }));
}

/**
 * Field builder for the FormDetail "Fields" tab (#587). Renders the
 * ordered field list with per-field editors, an "Add field" menu (one
 * entry per field type), drag-to-reorder via @dnd-kit, and
 * keyboard-accessible up/down arrows so reorder works without a mouse
 * (and gives tests a stable surface — programmatic dnd is awkward to
 * simulate end-to-end).
 *
 * Stateless from the parent's POV: `fields` is canonical, every edit
 * fires `onChange(next)`. The parent (FormDetailPage) holds the
 * dirty-tracking + save bar registration.
 */
export default function FieldBuilder({ fields, onChange }: FieldBuilderProps) {
  const { t } = useTranslation();
  const { readOnly } = useReadOnly();
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Each row needs a stable id for @dnd-kit. New fields lack a server id,
  // so we synthesise one from the index for unsaved rows. This is fine
  // because the array index IS stable across re-renders here (we never
  // splice mid-render).
  const ids = fields.map((_, i) => String(i));

  function addField(field_type: FormFieldType) {
    onChange(reseatOrder([...fields, makeField(field_type, fields.length)]));
    setAddAnchor(null);
  }

  function deleteField(index: number) {
    onChange(reseatOrder(fields.filter((_, i) => i !== index)));
  }

  function updateField(index: number, patch: Partial<FormFieldInput>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    onChange(reseatOrder(arrayMove(fields, index, target)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    onChange(reseatOrder(arrayMove(fields, from, to)));
  }

  return (
    <Box data-testid="forms.fields.builder">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t('formsModule.builder.heading', 'Fields')}
        </Typography>
        <M3Button
          size="md"
          icon="add"
          onClick={(e) => setAddAnchor(e.currentTarget as HTMLElement)}
          disabled={readOnly}
          data-testid="forms.fields.btn.add"
        >
          {t('formsModule.builder.addField', 'Add field')}
        </M3Button>
        <Menu
          anchorEl={addAnchor}
          open={!!addAnchor}
          onClose={() => setAddAnchor(null)}
          data-testid="forms.fields.type-menu"
        >
          {FIELD_TYPES.map((type) => (
            <MenuItem
              key={type}
              onClick={() => addField(type)}
              data-testid={`forms.fields.type.${type}`}
            >
              {t(`formsModule.fieldType.${type}`, type)}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {fields.length === 0 && (
        <Box
          sx={{
            border: '1px dashed var(--outline-variant)',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          {t(
            'formsModule.builder.empty',
            'No fields yet. Click "Add field" to choose a type.',
          )}
        </Box>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Box sx={{ display: 'grid', gap: 2 }}>
            {fields.map((field, index) => (
              <SortableFieldRow
                key={index}
                id={String(index)}
                index={index}
                field={field}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                readOnly={readOnly}
                onChange={(patch) => updateField(index, patch)}
                onDelete={() => deleteField(index)}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
              />
            ))}
          </Box>
        </SortableContext>
      </DndContext>
    </Box>
  );
}

interface SortableFieldRowProps {
  id: string;
  index: number;
  field: FormFieldInput;
  isFirst: boolean;
  isLast: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<FormFieldInput>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableFieldRow({
  id,
  field,
  isFirst,
  isLast,
  readOnly,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SortableFieldRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        border: '1px solid var(--outline-variant)',
        borderRadius: 3,
        background: 'var(--surface-container-low)',
      }}
      data-testid="forms.fields.row"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: '1px solid var(--outline-variant)' }}>
        <Tooltip title={t('formsModule.builder.drag', 'Drag to reorder')}>
          <span>
            <IconButton
              size="small"
              {...(readOnly ? {} : attributes)}
              {...(readOnly ? {} : listeners)}
              disabled={readOnly}
              data-testid="forms.fields.btn.drag"
              sx={{ cursor: readOnly ? 'not-allowed' : 'grab' }}
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1, fontSize: 13, color: 'text.secondary' }}>
          {t(`formsModule.fieldType.${field.field_type}`, field.field_type)} ·{' '}
          {t('formsModule.builder.fieldIndex', 'Field {{n}}', { n: (field.display_order ?? 0) + 1 })}
        </Box>
        <Tooltip title={t('formsModule.builder.moveUp', 'Move up')}>
          <span>
            <IconButton
              size="small"
              onClick={onMoveUp}
              disabled={isFirst || readOnly}
              data-testid="forms.fields.btn.moveUp"
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('formsModule.builder.moveDown', 'Move down')}>
          <span>
            <IconButton
              size="small"
              onClick={onMoveDown}
              disabled={isLast || readOnly}
              data-testid="forms.fields.btn.moveDown"
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('formsModule.builder.delete', 'Delete field')}>
          <span>
            <IconButton
              size="small"
              onClick={onDelete}
              disabled={readOnly}
              data-testid="forms.fields.btn.delete"
              sx={{ color: 'var(--err)' }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Box sx={{ p: 2 }}>
        <FieldEditor field={field} onChange={onChange} />
      </Box>
    </Box>
  );
}
