import { Paper, Skeleton, Typography } from '@mui/material';

interface StatCardProps {
  label: string;
  value: number;
  loading?: boolean;
}

export default function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={80} height={36} />
      ) : (
        <Typography variant="h5" fontWeight="bold">
          {value.toLocaleString()}
        </Typography>
      )}
    </Paper>
  );
}
