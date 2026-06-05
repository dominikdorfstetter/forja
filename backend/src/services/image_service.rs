//! Image variant generation service
//!
//! Generates thumbnail, small, medium, large, and webp variants for uploaded images.
//! Supports focal-point-aware cropping for variants with a target aspect ratio.

use std::io::Cursor;
use std::sync::Arc;

use image::imageops::FilterType;
use image::{DynamicImage, ImageFormat, ImageReader};

use crate::errors::ApiError;
use crate::models::media::MediaVariantType;
use crate::services::storage::StorageBackend;

/// Specification for a single image variant
struct VariantSpec {
    variant_type: MediaVariantType,
    max_width: u32,
    /// If true, output as WebP regardless of source format
    force_webp: bool,
    /// Optional target aspect ratio (width, height). When set, the image is
    /// cropped to this ratio (centered on the focal point) before resizing.
    aspect_ratio: Option<(u32, u32)>,
}

const VARIANTS: &[VariantSpec] = &[
    VariantSpec {
        variant_type: MediaVariantType::Thumbnail,
        max_width: 200,
        force_webp: false,
        aspect_ratio: Some((1, 1)),
    },
    VariantSpec {
        variant_type: MediaVariantType::Small,
        max_width: 400,
        force_webp: false,
        aspect_ratio: None,
    },
    VariantSpec {
        variant_type: MediaVariantType::Medium,
        max_width: 800,
        force_webp: false,
        aspect_ratio: None,
    },
    VariantSpec {
        variant_type: MediaVariantType::Large,
        max_width: 1200,
        force_webp: false,
        aspect_ratio: None,
    },
    VariantSpec {
        variant_type: MediaVariantType::Webp,
        max_width: 1200,
        force_webp: true,
        aspect_ratio: None,
    },
];

/// Result of generating a single variant
pub struct GeneratedVariant {
    pub variant_type: MediaVariantType,
    pub width: u32,
    pub height: u32,
    pub file_size: usize,
    pub storage_path: String,
    pub public_url: String,
}

/// Focal point for image cropping (0.0–1.0 range, top-left origin)
#[derive(Debug, Clone, Copy)]
pub struct FocalPoint {
    pub x: f32,
    pub y: f32,
}

impl Default for FocalPoint {
    fn default() -> Self {
        Self { x: 0.5, y: 0.5 }
    }
}

/// Generate image variants for an uploaded image.
///
/// Returns `Ok(vec![])` if the bytes cannot be decoded as an image.
pub async fn generate_variants(
    original_bytes: &[u8],
    base_path: &str, // e.g. "site-id/2024/01/photo" (no extension)
    original_extension: &str,
    storage: &Arc<dyn StorageBackend>,
    focal_point: FocalPoint,
) -> Result<Vec<GeneratedVariant>, ApiError> {
    let img = match ImageReader::new(Cursor::new(original_bytes))
        .with_guessed_format()
        .map_err(|e| ApiError::internal(format!("Image format detection failed: {e}")))?
        .decode()
    {
        Ok(img) => img,
        Err(_) => return Ok(vec![]), // not a decodable image
    };

    let orig_w = img.width();
    let orig_h = img.height();
    let mut results = Vec::new();

    for spec in VARIANTS {
        // Skip if original is already smaller than target
        if orig_w <= spec.max_width {
            // Still generate webp variant even for small images
            if !spec.force_webp {
                continue;
            }
        }

        // Step 1: Crop to aspect ratio if specified
        let cropped = if let Some((ar_w, ar_h)) = spec.aspect_ratio {
            let rect = compute_crop_rect(orig_w, orig_h, ar_w, ar_h, focal_point);
            img.crop_imm(rect.x, rect.y, rect.width, rect.height)
        } else {
            img.clone()
        };

        // Step 2: Resize to target width
        let resized = if cropped.width() > spec.max_width {
            resize_image(&cropped, spec.max_width)
        } else if spec.aspect_ratio.is_some() {
            // For cropped variants, always resize to max_width for consistency
            resize_image(&cropped, spec.max_width.min(cropped.width()))
        } else {
            cropped
        };

        let (w, h) = (resized.width(), resized.height());

        let (encoded, ext, content_type) = if spec.force_webp {
            (encode_webp(&resized)?, "webp", "image/webp")
        } else {
            encode_original_format(&resized, original_extension)?
        };

        let variant_suffix = match spec.variant_type {
            MediaVariantType::Thumbnail => "thumb",
            MediaVariantType::Small => "sm",
            MediaVariantType::Medium => "md",
            MediaVariantType::Large => "lg",
            MediaVariantType::Webp => "webp",
            _ => "variant",
        };

        let storage_path = format!("{}_{}.{}", base_path, variant_suffix, ext);
        let file_size = encoded.len();

        let public_url = storage.store(&storage_path, &encoded, content_type).await?;

        results.push(GeneratedVariant {
            variant_type: spec.variant_type.clone(),
            width: w,
            height: h,
            file_size,
            storage_path,
            public_url,
        });
    }

    Ok(results)
}

/// Computed crop rectangle
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CropRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Compute the crop rectangle for a target aspect ratio centered on a focal point.
///
/// The rectangle is the largest possible crop at the target ratio that fits
/// within the image, positioned so the focal point is as close to the center
/// of the crop as possible (clamped to image bounds).
pub fn compute_crop_rect(
    img_w: u32,
    img_h: u32,
    ar_w: u32,
    ar_h: u32,
    focal: FocalPoint,
) -> CropRect {
    if img_w == 0 || img_h == 0 || ar_w == 0 || ar_h == 0 {
        return CropRect {
            x: 0,
            y: 0,
            width: img_w,
            height: img_h,
        };
    }

    let target_ratio = ar_w as f64 / ar_h as f64;
    let image_ratio = img_w as f64 / img_h as f64;

    // Determine crop dimensions — largest rectangle at target ratio that fits
    let (crop_w, crop_h) = if image_ratio > target_ratio {
        // Image is wider than target → constrained by height
        let h = img_h;
        let w = (h as f64 * target_ratio).round() as u32;
        (w.min(img_w), h)
    } else {
        // Image is taller than target → constrained by width
        let w = img_w;
        let h = (w as f64 / target_ratio).round() as u32;
        (w, h.min(img_h))
    };

    // Position crop centered on the focal point, clamped to image bounds
    let focal_px_x = (focal.x as f64 * img_w as f64).round() as i64;
    let focal_px_y = (focal.y as f64 * img_h as f64).round() as i64;

    let x = (focal_px_x - crop_w as i64 / 2).clamp(0, (img_w - crop_w) as i64) as u32;
    let y = (focal_px_y - crop_h as i64 / 2).clamp(0, (img_h - crop_h) as i64) as u32;

    CropRect {
        x,
        y,
        width: crop_w,
        height: crop_h,
    }
}

/// Resize an image to fit within max_width, preserving aspect ratio (only downscale)
fn resize_image(img: &DynamicImage, max_width: u32) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    let new_width = max_width;
    let new_height = (h as f64 * max_width as f64 / w as f64).round() as u32;
    img.resize(new_width, new_height, FilterType::Lanczos3)
}

/// Encode as WebP
fn encode_webp(img: &DynamicImage) -> Result<Vec<u8>, ApiError> {
    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), ImageFormat::WebP)
        .map_err(|e| ApiError::internal(format!("WebP encoding failed: {e}")))?;
    Ok(buf)
}

/// Encode in the same format as the original, falling back to PNG
fn encode_original_format(
    img: &DynamicImage,
    original_extension: &str,
) -> Result<(Vec<u8>, &'static str, &'static str), ApiError> {
    let (format, ext, ct) = match original_extension.to_lowercase().as_str() {
        "jpg" | "jpeg" => (ImageFormat::Jpeg, "jpg", "image/jpeg"),
        "png" => (ImageFormat::Png, "png", "image/png"),
        "gif" => (ImageFormat::Gif, "gif", "image/gif"),
        "webp" => (ImageFormat::WebP, "webp", "image/webp"),
        _ => (ImageFormat::Png, "png", "image/png"),
    };

    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), format)
        .map_err(|e| ApiError::internal(format!("Image encoding failed: {e}")))?;

    Ok((buf, ext, ct))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crop_rect_square_from_landscape_centered() {
        // 1000x500 image, default focal point → 500x500 square centered horizontally
        let rect = compute_crop_rect(1000, 500, 1, 1, FocalPoint { x: 0.5, y: 0.5 });
        assert_eq!(
            rect,
            CropRect {
                x: 250,
                y: 0,
                width: 500,
                height: 500
            }
        );
    }

    #[test]
    fn crop_rect_square_from_portrait_centered() {
        // 500x1000 image, default focal point → 500x500 square centered vertically
        let rect = compute_crop_rect(500, 1000, 1, 1, FocalPoint { x: 0.5, y: 0.5 });
        assert_eq!(
            rect,
            CropRect {
                x: 0,
                y: 250,
                width: 500,
                height: 500
            }
        );
    }

    #[test]
    fn crop_rect_focal_top_left() {
        // 1000x500, focal at top-left → crop clamped to (0, 0)
        let rect = compute_crop_rect(1000, 500, 1, 1, FocalPoint { x: 0.0, y: 0.0 });
        assert_eq!(
            rect,
            CropRect {
                x: 0,
                y: 0,
                width: 500,
                height: 500
            }
        );
    }

    #[test]
    fn crop_rect_focal_bottom_right() {
        // 1000x500, focal at bottom-right → crop clamped to right edge
        let rect = compute_crop_rect(1000, 500, 1, 1, FocalPoint { x: 1.0, y: 1.0 });
        assert_eq!(
            rect,
            CropRect {
                x: 500,
                y: 0,
                width: 500,
                height: 500
            }
        );
    }

    #[test]
    fn crop_rect_focal_off_center() {
        // 1000x500 image, focal at (0.3, 0.5) → crop should shift left
        let rect = compute_crop_rect(1000, 500, 1, 1, FocalPoint { x: 0.3, y: 0.5 });
        // focal_px_x = 300, crop_w = 500, ideal_x = 300 - 250 = 50
        assert_eq!(
            rect,
            CropRect {
                x: 50,
                y: 0,
                width: 500,
                height: 500
            }
        );
    }

    #[test]
    fn crop_rect_16_9_from_square() {
        // 1000x1000 image, 16:9 crop centered
        let rect = compute_crop_rect(1000, 1000, 16, 9, FocalPoint { x: 0.5, y: 0.5 });
        // Constrained by width: w=1000, h=round(1000*9/16)=563
        assert_eq!(rect.width, 1000);
        assert_eq!(rect.height, 563);
        // Centered vertically: y = (500 - 281) = 219
        assert_eq!(rect.y, 219);
    }

    #[test]
    fn crop_rect_already_matching_ratio() {
        // Image already matches target ratio → full image
        let rect = compute_crop_rect(1600, 900, 16, 9, FocalPoint { x: 0.5, y: 0.5 });
        assert_eq!(
            rect,
            CropRect {
                x: 0,
                y: 0,
                width: 1600,
                height: 900
            }
        );
    }

    #[test]
    fn crop_rect_zero_dimensions() {
        let rect = compute_crop_rect(0, 0, 1, 1, FocalPoint::default());
        assert_eq!(
            rect,
            CropRect {
                x: 0,
                y: 0,
                width: 0,
                height: 0
            }
        );
    }
}
