//! Favicon generation service
//!
//! Resizes a source image into a full favicon package:
//! favicon.ico (multi-size), individual PNGs, Apple Touch, Android Chrome.

use std::io::Cursor;
use std::sync::Arc;

use image::imageops::FilterType;
use image::ImageReader;
use uuid::Uuid;

use crate::dto::favicon::FaviconVariant;
use crate::errors::ApiError;
use crate::services::storage::StorageBackend;

/// Favicon variant definitions: (filename, width, height)
const VARIANTS: &[(&str, u32, u32)] = &[
    ("favicon-16x16.png", 16, 16),
    ("favicon-32x32.png", 32, 32),
    ("apple-touch-icon.png", 180, 180),
    ("android-chrome-192x192.png", 192, 192),
    ("android-chrome-512x512.png", 512, 512),
];

/// ICO sizes embedded in favicon.ico
const ICO_SIZES: &[u32] = &[16, 32, 48];

/// Generate all favicon variants from a source image and store them.
///
/// Returns the list of generated variants with their public URLs.
/// Does NOT store anything in the `media_files` table — icons live
/// under `site_favicons/<site_id>/`.
pub async fn generate_favicon_package(
    source_bytes: &[u8],
    site_id: Uuid,
    storage: &Arc<dyn StorageBackend>,
) -> Result<Vec<FaviconVariant>, ApiError> {
    let img = ImageReader::new(Cursor::new(source_bytes))
        .with_guessed_format()
        .map_err(|e| ApiError::bad_request(format!("Cannot read image: {e}")))?
        .decode()
        .map_err(|e| ApiError::bad_request(format!("Cannot decode image: {e}")))?;

    let base_path = format!("site_favicons/{}", site_id);
    let mut variants = Vec::new();

    // Generate PNG variants
    for &(name, w, h) in VARIANTS {
        let resized = img.resize_to_fill(w, h, FilterType::Lanczos3);
        let mut buf = Vec::new();
        resized
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .map_err(|e| ApiError::internal(format!("Failed to encode {name}: {e}")))?;

        let path = format!("{}/{}", base_path, name);
        let url = storage.store(&path, &buf, "image/png").await?;
        variants.push(FaviconVariant {
            name: name.to_string(),
            url,
            width: w,
            height: h,
        });
    }

    // Generate favicon.ico (multi-resolution)
    let ico_bytes = build_ico(&img)?;
    let ico_path = format!("{}/favicon.ico", base_path);
    let ico_url = storage.store(&ico_path, &ico_bytes, "image/x-icon").await?;
    variants.push(FaviconVariant {
        name: "favicon.ico".to_string(),
        url: ico_url,
        width: 48,
        height: 48,
    });

    Ok(variants)
}

/// Build a multi-resolution ICO file with embedded PNG frames.
fn build_ico(img: &image::DynamicImage) -> Result<Vec<u8>, ApiError> {
    let mut frames: Vec<Vec<u8>> = Vec::new();

    for &size in ICO_SIZES {
        let resized = img.resize_to_fill(size, size, FilterType::Lanczos3);
        let mut buf = Vec::new();
        resized
            .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
            .map_err(|e| {
                ApiError::internal(format!("Failed to encode ICO frame {size}x{size}: {e}"))
            })?;
        frames.push(buf);
    }

    // ICO binary format with embedded PNGs
    let count = frames.len() as u16;
    let header_size = 6;
    let dir_entry_size = 16;
    let dir_total = dir_entry_size * count as usize;
    let mut data_offset = header_size + dir_total;

    let mut out = Vec::new();

    // Header: reserved(2) + type(2) + count(2)
    out.extend_from_slice(&[0, 0]); // reserved
    out.extend_from_slice(&1u16.to_le_bytes()); // type = ICO
    out.extend_from_slice(&count.to_le_bytes());

    // Directory entries
    for (i, frame) in frames.iter().enumerate() {
        let size = ICO_SIZES[i];
        let w = if size >= 256 { 0u8 } else { size as u8 };
        let h = w;
        out.push(w); // width
        out.push(h); // height
        out.push(0); // color count
        out.push(0); // reserved
        out.extend_from_slice(&1u16.to_le_bytes()); // color planes
        out.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
        out.extend_from_slice(&(frame.len() as u32).to_le_bytes()); // data size
        out.extend_from_slice(&(data_offset as u32).to_le_bytes()); // data offset
        data_offset += frame.len();
    }

    // Image data
    for frame in &frames {
        out.extend_from_slice(frame);
    }

    Ok(out)
}

/// Render a `site.webmanifest` JSON string.
pub fn render_webmanifest(
    site_name: &str,
    theme_color: &str,
    background_color: &str,
    variants: &[FaviconVariant],
) -> String {
    let icons: Vec<serde_json::Value> = variants
        .iter()
        .filter(|v| v.name.starts_with("android-chrome"))
        .map(|v| {
            serde_json::json!({
                "src": v.url,
                "sizes": format!("{}x{}", v.width, v.height),
                "type": "image/png"
            })
        })
        .collect();

    let manifest = serde_json::json!({
        "name": site_name,
        "short_name": site_name,
        "icons": icons,
        "theme_color": theme_color,
        "background_color": background_color,
        "display": "standalone"
    });

    serde_json::to_string_pretty(&manifest).unwrap_or_default()
}

/// Render a `browserconfig.xml` string for IE/Edge tile.
pub fn render_browserconfig(variants: &[FaviconVariant]) -> String {
    let tile_src = variants
        .iter()
        .find(|v| v.name == "android-chrome-192x192.png")
        .map(|v| v.url.as_str())
        .unwrap_or("");

    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="{}"/>
      <TileColor>#da532c</TileColor>
    </tile>
  </msapplication>
</browserconfig>"#,
        tile_src
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_variants() -> Vec<FaviconVariant> {
        vec![
            FaviconVariant {
                name: "android-chrome-192x192.png".to_string(),
                url: "https://cdn.example.com/favicons/android-chrome-192x192.png".to_string(),
                width: 192,
                height: 192,
            },
            FaviconVariant {
                name: "android-chrome-512x512.png".to_string(),
                url: "https://cdn.example.com/favicons/android-chrome-512x512.png".to_string(),
                width: 512,
                height: 512,
            },
            FaviconVariant {
                name: "favicon-32x32.png".to_string(),
                url: "https://cdn.example.com/favicons/favicon-32x32.png".to_string(),
                width: 32,
                height: 32,
            },
        ]
    }

    #[test]
    fn test_render_webmanifest() {
        let json = render_webmanifest("My Site", "#4a90d9", "#ffffff", &sample_variants());
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");
        assert_eq!(parsed["name"], "My Site");
        assert_eq!(parsed["theme_color"], "#4a90d9");
        assert_eq!(parsed["background_color"], "#ffffff");
        assert_eq!(parsed["display"], "standalone");
        // Only android-chrome icons included
        let icons = parsed["icons"].as_array().expect("icons array");
        assert_eq!(icons.len(), 2);
        assert!(icons[0]["sizes"].as_str().unwrap().contains("192x192"));
    }

    #[test]
    fn test_render_webmanifest_no_icons() {
        let json = render_webmanifest("Empty", "#000", "#fff", &[]);
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("valid JSON");
        assert_eq!(parsed["icons"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn test_render_browserconfig() {
        let xml = render_browserconfig(&sample_variants());
        assert!(xml.contains("<?xml version"));
        assert!(xml.contains("android-chrome-192x192.png"));
        assert!(xml.contains("<TileColor>#da532c</TileColor>"));
    }

    #[test]
    fn test_render_browserconfig_no_variants() {
        let xml = render_browserconfig(&[]);
        assert!(xml.contains("square150x150logo src=\"\""));
    }

    #[test]
    fn test_build_ico_from_small_image() {
        // Create a minimal 1x1 red PNG image
        let img = image::DynamicImage::new_rgba8(4, 4);
        let ico_bytes = build_ico(&img).expect("ICO generation should succeed");

        // Verify ICO header
        assert_eq!(&ico_bytes[0..2], &[0, 0]); // reserved
        assert_eq!(&ico_bytes[2..4], &[1, 0]); // type = ICO
        assert_eq!(&ico_bytes[4..6], &[3, 0]); // count = 3 (16, 32, 48)
    }
}
