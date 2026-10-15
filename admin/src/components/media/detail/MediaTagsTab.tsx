import { Stack } from '@mui/material';
import type { SiteTagItem } from '@/types/api';
import AiVisionActions from '../AiVisionActions';
import TagInput from '../TagInput';

interface MediaTagsTabProps {
  /** Set when AI vision is available for this image (site id + hosted image URL). */
  ai: { siteId: string; imageUrl: string } | null;
  tags: string[];
  suggestions: SiteTagItem[];
  saving: boolean;
  onTagsChange: (tags: string[]) => void;
  onTagsGenerated: (tags: string[]) => void;
  onAddSuggestedTag: (tag: string) => void;
}

export default function MediaTagsTab({
  ai,
  tags,
  suggestions,
  saving,
  onTagsChange,
  onTagsGenerated,
  onAddSuggestedTag,
}: MediaTagsTabProps) {
  return (
    <Stack spacing={2}>
      {ai && (
        <AiVisionActions
          siteId={ai.siteId}
          imageUrl={ai.imageUrl}
          currentTags={tags}
          onAltTextGenerated={() => {}}
          onTagsGenerated={onTagsGenerated}
          onAddSuggestedTag={onAddSuggestedTag}
        />
      )}
      <TagInput
        tags={tags}
        onChange={onTagsChange}
        suggestions={suggestions}
        disabled={saving}
      />
    </Stack>
  );
}
