import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  Typography,
  Box,
  TextField,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useTranslation } from 'react-i18next';

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mediaId: string | null) => void;
  siteId: string;
  currentValue?: string | null;
}

export default function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  siteId,
  currentValue,
}: MediaPickerDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: mediaData, isLoading } = useQuery({
    queryKey: ['media-picker', siteId],
    queryFn: () => apiService.getMedia(siteId, { mime_category: 'image', page_size: 50 }),
    enabled: open && !!siteId,
  });

  const filteredMedia = useMemo(() => {
    const list = mediaData?.data ?? [];
    if (!search.trim()) return list;
    const lower = search.toLowerCase();
    return list.filter((m) => m.original_filename.toLowerCase().includes(lower));
  }, [mediaData?.data, search]);

  const handleSelect = () => {
    onSelect(selected);
    handleClose();
  };

  const handleClear = () => {
    onSelect(null);
    handleClose();
  };

  const handleClose = () => {
    setSelected(null);
    setSearch('');
    onClose();
  };

  // Initialize selection from current value when dialog opens
  const effectiveSelected = selected ?? (currentValue || null);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth aria-labelledby="media-picker-dialog-title" data-testid="media-picker.dialog">
      <DialogTitle id="media-picker-dialog-title">{t('media.picker.title')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          placeholder={t('media.picker.search')}
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!isLoading && filteredMedia.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('media.picker.noResults')}
          </Typography>
        )}

        {!isLoading && filteredMedia.length > 0 && (
          <Grid container spacing={1.5}>
            {filteredMedia.map((media) => {
              const isSelected = effectiveSelected === media.id;
              return (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={media.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <CardActionArea onClick={() => setSelected(media.id)}>
                      {media.public_url ? (
                        <CardMedia
                          component="img"
                          height={100}
                          image={media.public_url}
                          alt={media.original_filename}
                          sx={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 100,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'action.hover',
                          }}
                        >
                          <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                        </Box>
                      )}
                      <Box sx={{ px: 1, py: 0.5 }}>
                        <Typography variant="caption" noWrap display="block">
                          {media.original_filename}
                        </Typography>
                        {media.width && media.height && (
                          <Typography variant="caption" color="text.secondary">
                            {media.width} x {media.height}
                          </Typography>
                        )}
                      </Box>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        {currentValue && (
          <Button onClick={handleClear} color="error">
            {t('media.picker.clear')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose} data-testid="media-picker.btn.cancel">{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={!effectiveSelected}
          data-testid="media-picker.btn.submit"
        >
          {t('media.picker.select')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
