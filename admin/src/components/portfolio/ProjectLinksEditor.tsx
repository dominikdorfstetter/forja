import { useTranslation } from 'react-i18next';
import { Stack, TextField, MenuItem, IconButton, Button, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { CreateProjectLinkRequest, ProjectLinkType } from '@/types/api';

interface ProjectLinksEditorProps {
  links: CreateProjectLinkRequest[];
  onChange: (links: CreateProjectLinkRequest[]) => void;
}

const LINK_TYPES: ProjectLinkType[] = ['Source', 'Demo', 'Documentation', 'Website', 'Other'];

const createEmptyLink = (): CreateProjectLinkRequest => ({
  label: '',
  url: '',
  link_type: 'Other',
});

const updateLinkAtIndex = (
  links: CreateProjectLinkRequest[],
  index: number,
  field: keyof CreateProjectLinkRequest,
  value: string,
): CreateProjectLinkRequest[] =>
  links.map((link, i) => (i === index ? { ...link, [field]: value } : link));

export default function ProjectLinksEditor({ links, onChange }: ProjectLinksEditorProps) {
  const { t } = useTranslation();

  const handleAdd = () => onChange([...links, createEmptyLink()]);

  const handleRemove = (index: number) =>
    onChange(links.filter((_, i) => i !== index));

  const handleFieldChange = (
    index: number,
    field: keyof CreateProjectLinkRequest,
    value: string,
  ) => onChange(updateLinkAtIndex(links, index, field, value));

  return (
    <Box data-testid="project-links-editor">
      <Stack spacing={2}>
        {links.map((link, index) => (
          // Links are controlled inputs typed by the user; no stable ID exists
          // without a DTO schema change. Reorder uses index-in-place edits.
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
          <Stack key={index} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              label={t('wizard.project.fields.linkLabel')}
              value={link.label}
              onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              data-testid={`project-links-editor.label.${index}`}
            />
            <TextField
              label={t('wizard.project.fields.linkUrl')}
              value={link.url}
              onChange={(e) => handleFieldChange(index, 'url', e.target.value)}
              size="small"
              sx={{ flex: 2 }}
              data-testid={`project-links-editor.url.${index}`}
            />
            <TextField
              select
              label={t('wizard.project.fields.linkType')}
              value={link.link_type ?? 'Other'}
              onChange={(e) => handleFieldChange(index, 'link_type', e.target.value)}
              size="small"
              sx={{ minWidth: 140 }}
              data-testid={`project-links-editor.type.${index}`}
            >
              {LINK_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('wizard.project.fields.linkIcon')}
              value={link.icon ?? ''}
              onChange={(e) => handleFieldChange(index, 'icon', e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              data-testid={`project-links-editor.icon.${index}`}
            />
            <IconButton
              onClick={() => handleRemove(index)}
              color="error"
              aria-label={t('common.actions.delete')}
              data-testid={`project-links-editor.delete.${index}`}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button
        startIcon={<AddIcon />}
        onClick={handleAdd}
        sx={{ mt: 1 }}
        data-testid="project-links-editor.add"
      >
        {t('wizard.project.addLink')}
      </Button>
    </Box>
  );
}
