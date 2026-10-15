import type { ReactNode } from 'react';
import { Card, CardActionArea } from '@mui/material';

/** Outlined, clickable picker result whose border thickens in the primary colour when selected. */
export function PickerCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        transition: 'border-color 0.15s',
      }}
    >
      <CardActionArea onClick={onClick}>{children}</CardActionArea>
    </Card>
  );
}
