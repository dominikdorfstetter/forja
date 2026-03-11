import {
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface TocItem {
  id: number;
  text: string;
  level: number;
}

interface BlogTocPanelProps {
  items: TocItem[];
}

export default function BlogTocPanel({ items }: BlogTocPanelProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <Paper sx={{ p: 2, position: 'sticky', top: 140 }}>
      <Typography variant="subtitle2" gutterBottom>
        {t('blogDetail.toc')}
      </Typography>
      <List dense>
        {items.map((item) => (
          <ListItem key={item.id} sx={{ pl: (item.level - 1) * 2 }}>
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: item.level === 1 ? 600 : 400,
              }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
