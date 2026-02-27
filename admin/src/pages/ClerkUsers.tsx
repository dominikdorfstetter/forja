import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  Select,
  MenuItem,
  CircularProgress,
  TablePagination,
} from '@mui/material';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import type { ClerkUser } from '@/types/api';

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  master: 'error',
  admin: 'warning',
  write: 'info',
  read: 'default',
};

const VALID_ROLES = ['master', 'admin', 'write', 'read'];

function formatTimestamp(ts?: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ClerkUsersPage() {
  const { isMaster } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['clerk-users', page, rowsPerPage],
    queryFn: () => apiService.getClerkUsers({ limit: rowsPerPage, offset: page * rowsPerPage }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiService.updateClerkUserRole(userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clerk-users'] });
      enqueueSnackbar('Role updated successfully', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Failed to update role', { variant: 'error' });
    },
  });

  const handleRoleChange = (user: ClerkUser, newRole: string) => {
    updateRoleMutation.mutate({ userId: user.id, role: newRole });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Clerk Users
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage CMS roles for Clerk-authenticated users.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>CMS Role</TableCell>
                  <TableCell>Last Sign In</TableCell>
                  <TableCell>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.data.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={user.image_url || undefined}
                          alt={user.name}
                          sx={{ width: 32, height: 32 }}
                        />
                        <Typography variant="body2" fontWeight={500}>
                          {user.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.email || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isMaster ? (
                        <Select
                          size="small"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          disabled={updateRoleMutation.isPending}
                          sx={{ minWidth: 120 }}
                        >
                          {VALID_ROLES.map((role) => (
                            <MenuItem key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Chip
                          label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          color={ROLE_COLORS[user.role] || 'default'}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(user.last_sign_in_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(user.created_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No Clerk users found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.total_count ?? 0}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </Paper>
      )}
    </Box>
  );
}
