import {
  Avatar,
  Box,
  Card,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';
import CommentIcon from '@mui/icons-material/Comment';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HubIcon from '@mui/icons-material/Hub';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import apiService from '@/services/api';
import type { FederationActivity, FederationNote } from '@/types/api';

interface FederationTimelineProps {
  siteId: string;
  handle?: string;
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

function NoteItem({ note, handle }: { note: FederationNote; handle?: string }) {
  const timeAgo = formatDistanceToNow(new Date(note.published_at), { addSuffix: true });

  return (
    <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.5 }}>
      <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
        <HubIcon sx={{ fontSize: 18 }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {handle && (
          <Typography variant="caption" fontWeight={600} fontFamily="monospace" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
            @{handle}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {note.body}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>{timeAgo}</Typography>
      </Box>
    </Box>
  );
}

export default function FederationTimeline({ siteId, handle }: FederationTimelineProps) {
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

  // Merge activities and notes into a single timeline, sorted by date
  const timeline: TimelineItem[] = [];

  for (const note of (notesData?.data ?? [])) {
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

  if (items.length === 0) {
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
      {items.map((item, i) => (
        <Box key={item.id}>
          {i > 0 && <Divider />}
          {item.type === 'note' && item.note && (
            <NoteItem note={item.note} handle={handle} />
          )}
          {item.type === 'activity' && item.activity && (
            <ActivityItem activity={item.activity} />
          )}
        </Box>
      ))}
    </Card>
  );
}
