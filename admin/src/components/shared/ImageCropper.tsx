import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Box, Button, Slider, Typography, Paper } from '@mui/material';
import CropIcon from '@mui/icons-material/Crop';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

interface ImageCropperProps {
  imageSrc: string;
  aspectRatio?: number;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

export default function ImageCropper({
  imageSrc,
  aspectRatio = 1,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;
    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
    onCropComplete(croppedBlob);
  }, [imageSrc, croppedAreaPixels, onCropComplete]);

  return (
    <Paper sx={{ p: 2 }} data-testid="image-cropper">
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        {t('imageCropper.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('imageCropper.description')}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 350,
          bgcolor: 'grey.900',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </Box>
      <Box sx={{ px: 2, mt: 2 }}>
        <Typography variant="caption" color="text.secondary">{t('imageCropper.zoom')}</Typography>
        <Slider
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          onChange={(_, value) => setZoom(value as number)}
          size="small"
          data-testid="image-cropper.zoom-slider"
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
        <Button
          startIcon={<CloseIcon />}
          onClick={onCancel}
          color="secondary"
          data-testid="image-cropper.cancel-btn"
        >
          {t('imageCropper.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<CropIcon />}
          onClick={handleConfirm}
          data-testid="image-cropper.apply-btn"
        >
          {t('imageCropper.apply')}
        </Button>
      </Box>
    </Paper>
  );
}
