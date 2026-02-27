//! Image variant generation service
//!
//! Generates thumbnail, small, medium, large, and webp variants for uploaded images.

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
}

const VARIANTS: &[VariantSpec] = &[
    VariantSpec {
        variant_type: MediaVariantType::Thumbnail,
        max_width: 200,
        force_webp: false,
    },
    VariantSpec {
        variant_type: MediaVariantType::Small,
        max_width: 400,
        force_webp: false,
    },
    VariantSpec {
        variant_type: MediaVariantType::Medium,
        max_width: 800,
        force_webp: false,
    },
    VariantSpec {
        variant_type: MediaVariantType::Large,
        max_width: 1200,
        force_webp: false,
    },
    VariantSpec {
        variant_type: MediaVariantType::Webp,
        max_width: 1200,
        force_webp: true,
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

/// Generate image variants for an uploaded image.
///
/// Returns `Ok(vec![])` if the bytes cannot be decoded as an image.
pub async fn generate_variants(
    original_bytes: &[u8],
    base_path: &str, // e.g. "site-id/2024/01/photo" (no extension)
    original_extension: &str,
    storage: &Arc<dyn StorageBackend>,
) -> Result<Vec<GeneratedVariant>, ApiError> {
    let img = match ImageReader::new(Cursor::new(original_bytes))
        .with_guessed_format()
        .map_err(|e| ApiError::Internal(format!("Image format detection failed: {e}")))?
        .decode()
    {
        Ok(img) => img,
        Err(_) => return Ok(vec![]), // not a decodable image
    };

    let orig_w = img.width();
    let mut results = Vec::new();

    for spec in VARIANTS {
        // Skip if original is already smaller than target
        if orig_w <= spec.max_width {
            // Still generate webp variant even for small images
            if !spec.force_webp {
                continue;
            }
        }

        let resized = if orig_w > spec.max_width {
            resize_image(&img, spec.max_width)
        } else {
            img.clone()
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
        .map_err(|e| ApiError::Internal(format!("WebP encoding failed: {e}")))?;
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
        .map_err(|e| ApiError::Internal(format!("Image encoding failed: {e}")))?;

    Ok((buf, ext, ct))
}
