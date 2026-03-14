import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';
import CommentIcon from '@mui/icons-material/Comment';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HubIcon from '@mui/icons-material/Hub';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import apiService from '@/services/api';
import type { FederationActivity, FederationNote } from '@/types/api';

interface FederationTimelineProps {
  siteId: string;
  handle?: string;
  avatarUrl?: string;
  onDeleteNote?: (noteId: string) => void;
  onEditNote?: (noteId: string, body: string) => void;
}

interface TimelineItem {
  id: string;
  type: 'note' | 'activity';
  timestamp: string;
  note?: FederationNote;
  activity?: FederationActivity;
}

function extractUsername(actorUri: string): string {
  try {
    const url = new URL(actorUri);
    const parts = url.pathname.split('/');
    const name = parts[parts.length - 1];
    return `@${name}@${url.hostname}`;
  } catch {
    return actorUri;
  }
}

function activityIcon(type: string, direction: string) {
  if (direction === 'out') {
    if (type === 'Create') return <SendIcon sx={{ fontSize: 18 }} />;
    if (type === 'Update') return <EditIcon sx={{ fontSize: 18 }} />;
    if (type === 'Delete') return <DeleteIcon sx={{ fontSize: 18 }} />;
    return <SendIcon sx={{ fontSize: 18 }} />;
  }
  switch (type) {
    case 'Follow': return <PersonAddIcon sx={{ fontSize: 18 }} />;
    case 'Like': return <FavoriteIcon sx={{ fontSize: 18, color: 'error.main' }} />;
    case 'Announce': return <RepeatIcon sx={{ fontSize: 18, color: 'success.main' }} />;
    case 'Create': return <CommentIcon sx={{ fontSize: 18, color: 'info.main' }} />;
    default: return <HubIcon sx={{ fontSize: 18 }} />;
  }
}

function activityColor(type: string, direction: string): string {
  if (direction === 'out') return 'primary.main';
  switch (type) {
    case 'Follow': return 'primary.main';
    case 'Like': return 'error.main';
    case 'Announce': return 'success.main';
    case 'Create': return 'info.main';
    default: return 'text.secondary';
  }
}

function ActivityItem({ activity }: { activity: FederationActivity }) {
  const { t } = useTranslation();
  const username = extractUsername(activity.actor_uri);
  const isOutbound = activity.direction === 'out';
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  const getMessage = () => {
    if (isOutbound) {
      switch (activity.activity_type) {
        case 'Create': return t('federation.timeline.outCreate');
        case 'Update': return t('federation.timeline.outUpdate');
        case 'Delete': return t('federation.timeline.outDelete');
        default: return t('federation.timeline.outDefault', { type: activity.activity_type });
      }
    }
    switch (activity.activity_type) {
      case 'Follow': return t('federation.timeline.inFollow');
      case 'Like': return t('federation.timeline.inLike');
      case 'Announce': return t('federation.timeline.inBoost');
      case 'Create': return t('federation.timeline.inComment');
      default: return t('federation.timeline.inDefault', { type: activity.activity_type });
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.5 }}>
      <Avatar sx={{ bgcolor: activityColor(activity.activity_type, activity.direction), width: 36, height: 36 }}>
        {activityIcon(activity.activity_type, activity.direction)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {!isOutbound && (
            <Typography component="span" variant="body2" fontWeight={600} fontFamily="monospace" sx={{ fontSize: '0.8rem' }}>
              {username}{' '}
            </Typography>
          )}
          {getMessage()}
        </Typography>
        <Typography variant="caption" color="text.disabled">{timeAgo}</Typography>
      </Box>
    </Box>
  );
}

interface NoteItemProps {
  note: FederationNote;
  handle?: string;
  avatarUrl?: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, body: string) => void;
}

function NoteItem({ note, handle, avatarUrl, onDelete, onEdit }: NoteItemProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(note.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(note.published_at), { addSuffix: true });

  const handleSave = () => {
    if (editBody.trim() && editBody !== note.body) {
      onEdit?.(note.id, editBody.trim());
    }
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditBody(note.body);
    setEditing(false);
  };

  const handleDelete = () => {
    onDelete?.(note.id);
    setConfirmDelete(false);
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.5 }}>
      <Avatar src={avatarUrl || undefined} sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
        <HubIcon sx={{ fontSize: 18 }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {handle && (
          <Typography variant="caption" fontWeight={600} fontFamily="monospace" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
            @{handle}
          </Typography>
        )}

        {editing ? (
          <Box sx={{ mt: 0.5 }}>
            <TextField
              fullWidth
              multiline
              size="small"
              minRows={2}
              maxRows={6}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              inputProps={{ maxLength: 500 }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" variant="contained" onClick={handleSave} disabled={!editBody.trim()}>
                {t('federation.quickPost.editSave')}
              </Button>
              <Button size="small" onClick={handleCancelEdit}>
                {t('federation.quickPost.editCancel')}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {note.body}
          </Typography>
        )}

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.disabled">
            {timeAgo}
          </Typography>

          {!editing && !confirmDelete && (
            <>
              {onEdit && (
                <Tooltip title={t('federation.quickPost.editPost')}>
                  <IconButton
                    size="small"
                    onClick={() => { setEditBody(note.body); setEditing(true); }}
                    sx={{ p: 0.25 }}
                  >
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title={t('federation.quickPost.deletePost')}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setConfirmDelete(true)}
                    sx={{ p: 0.25 }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}

          {confirmDelete && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" color="error">
                {t('federation.quickPost.deletePostConfirm')}
              </Typography>
              <Button size="small" color="error" variant="outlined" onClick={handleDelete} sx={{ minWidth: 0, px: 1, py: 0, fontSize: '0.7rem' }}>
                {t('federation.quickPost.deleteConfirm')}
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)} sx={{ minWidth: 0, px: 1, py: 0, fontSize: '0.7rem' }}>
                {t('federation.quickPost.editCancel')}
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export default function FederationTimeline({ siteId, handle, avatarUrl, onDeleteNote, onEditNote }: FederationTimelineProps) {
  const { t } = useTranslation();

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['federation-activities', siteId],
    queryFn: () => apiService.getFederationActivities(siteId, { page: 1, page_size: 20 }),
    enabled: !!siteId,
    refetchInterval: 30_000,
  });

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['federation-notes', siteId],
    queryFn: () => apiService.getFederationNotes(siteId, { page: 1, page_size: 20 }),
    enabled: !!siteId,
    refetchInterval: 30_000,
  });

  const isLoading = activitiesLoading || notesLoading;

  const allNotes = notesData?.data ?? [];
  const publishedNotes = allNotes.filter((n) => n.status !== 'scheduled');
  const scheduledCount = allNotes.filter((n) => n.status === 'scheduled').length;

  // Merge activities and published notes into a single timeline, sorted by date
  const timeline: TimelineItem[] = [];

  for (const note of publishedNotes) {
    timeline.push({ id: `note-${note.id}`, type: 'note', timestamp: note.published_at, note });
  }

  for (const activity of (activitiesData?.data ?? [])) {
    // Skip outbound Create/Update/Delete if we already show the note
    // (avoid duplicating note posts in the timeline)
    if (activity.direction === 'out' && ['Undo', 'Accept', 'Reject'].includes(activity.activity_type)) {
      continue; // Skip internal protocol events
    }
    timeline.push({ id: `activity-${activity.id}`, type: 'activity', timestamp: activity.created_at, activity });
  }

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Limit to most recent 30 items
  const items = timeline.slice(0, 30);

  if (isLoading) {
    return (
      <Card>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      </Card>
    );
  }

  if (items.length === 0 && scheduledCount === 0) {
    return (
      <Card>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <HubIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('federation.timeline.empty')}
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      {scheduledCount > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
            <ScheduleIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Chip
              label={t('federation.quickPost.scheduledCountBanner', { count: scheduledCount })}
              size="small"
              variant="outlined"
              color="warning"
              sx={{ height: 22, fontSize: '0.75rem' }}
            />
          </Box>
          {items.length > 0 && <Divider />}
        </>
      )}
      {items.map((item, i) => (
        <Box key={item.id}>
          {i > 0 && <Divider />}
          {item.type === 'note' && item.note && (
            <NoteItem
              note={item.note}
              handle={handle}
              avatarUrl={avatarUrl}
              onDelete={onDeleteNote}
              onEdit={onEditNote}
            />
          )}
          {item.type === 'activity' && item.activity && (
            <ActivityItem activity={item.activity} />
          )}
        </Box>
      ))}
    </Card>
  );
}
