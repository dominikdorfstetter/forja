//! Validation utilities for input sanitization and validation

use regex::Regex;
use validator::ValidationError;

lazy_static::lazy_static! {
    /// Valid slug pattern: lowercase letters, numbers, and hyphens
    static ref SLUG_REGEX: Regex = Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").unwrap();

    /// Valid route pattern: starts with /, contains valid path characters
    static ref ROUTE_REGEX: Regex = Regex::new(r"^/[a-z0-9\-_/]*$").unwrap();

    /// Valid locale code pattern: language[-region]
    static ref LOCALE_REGEX: Regex = Regex::new(r"^[a-z]{2}(-[A-Z]{2})?$").unwrap();

    /// Valid timezone pattern (simplified)
    static ref TIMEZONE_REGEX: Regex = Regex::new(r"^[A-Za-z_]+/[A-Za-z_]+$|^UTC$").unwrap();

    /// Valid hex color pattern
    static ref HEX_COLOR_REGEX: Regex = Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap();

    /// Valid icon name pattern (alphanumeric and hyphens)
    static ref ICON_REGEX: Regex = Regex::new(r"^[a-z0-9\-]+$").unwrap();

    /// XSS prevention - dangerous HTML characters
    static ref DANGEROUS_HTML_REGEX: Regex = Regex::new(r"<script|javascript:|on\w+=").unwrap();

    /// Basic email format validation
    static ref EMAIL_REGEX: Regex = Regex::new(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$").unwrap();
}

/// Validate a slug format
pub fn validate_slug(slug: &str) -> Result<(), ValidationError> {
    if slug.is_empty() {
        let mut err = ValidationError::new("invalid_slug");
        err.message = Some("Slug cannot be empty".into());
        return Err(err);
    }

    if slug.len() > 100 {
        let mut err = ValidationError::new("invalid_slug");
        err.message = Some("Slug cannot exceed 100 characters".into());
        return Err(err);
    }

    if !SLUG_REGEX.is_match(slug) {
        let mut err = ValidationError::new("invalid_slug");
        err.message = Some("Slug must contain only lowercase letters, numbers, and hyphens".into());
        return Err(err);
    }

    Ok(())
}

/// Validate a route format
pub fn validate_route(route: &str) -> Result<(), ValidationError> {
    if route.is_empty() || !route.starts_with('/') {
        let mut err = ValidationError::new("invalid_route");
        err.message = Some("Route must start with /".into());
        return Err(err);
    }

    if route.len() > 500 {
        let mut err = ValidationError::new("invalid_route");
        err.message = Some("Route cannot exceed 500 characters".into());
        return Err(err);
    }

    if !ROUTE_REGEX.is_match(route) {
        let mut err = ValidationError::new("invalid_route");
        err.message = Some("Route contains invalid characters".into());
        return Err(err);
    }

    // Prevent path traversal
    if route.contains("..") {
        let mut err = ValidationError::new("invalid_route");
        err.message = Some("Route cannot contain path traversal".into());
        return Err(err);
    }

    Ok(())
}

/// Validate a URL format
pub fn validate_url(url: &str) -> Result<(), ValidationError> {
    if url.is_empty() {
        return Ok(()); // Empty URLs are often optional
    }

    if url.len() > 2000 {
        let mut err = ValidationError::new("invalid_url");
        err.message = Some("URL cannot exceed 2000 characters".into());
        return Err(err);
    }

    if !url.starts_with("http://") && !url.starts_with("https://") {
        let mut err = ValidationError::new("invalid_url");
        err.message = Some("URL must start with http:// or https://".into());
        return Err(err);
    }

    // Check for potential XSS in URL
    if DANGEROUS_HTML_REGEX.is_match(url) {
        let mut err = ValidationError::new("invalid_url");
        err.message = Some("URL contains potentially dangerous content".into());
        return Err(err);
    }

    Ok(())
}

/// Validate a locale code
pub fn validate_locale_code(code: &str) -> Result<(), ValidationError> {
    if !LOCALE_REGEX.is_match(code) {
        let mut err = ValidationError::new("invalid_locale");
        err.message = Some("Locale must be in format 'en' or 'en-US'".into());
        return Err(err);
    }
    Ok(())
}

/// Validate a timezone
pub fn validate_timezone(tz: &str) -> Result<(), ValidationError> {
    if !TIMEZONE_REGEX.is_match(tz) {
        let mut err = ValidationError::new("invalid_timezone");
        err.message = Some("Timezone must be in format 'Region/City' or 'UTC'".into());
        return Err(err);
    }
    Ok(())
}

/// Validate a hex color
pub fn validate_hex_color(color: &str) -> Result<(), ValidationError> {
    if !HEX_COLOR_REGEX.is_match(color) {
        let mut err = ValidationError::new("invalid_color");
        err.message = Some("Color must be in hex format #RRGGBB".into());
        return Err(err);
    }
    Ok(())
}

/// Validate an email address format
pub fn validate_email(email: &str) -> Result<(), ValidationError> {
    if email.is_empty() {
        return Ok(()); // Empty is valid (optional field)
    }

    if email.len() > 500 {
        let mut err = ValidationError::new("invalid_email");
        err.message = Some("Email cannot exceed 500 characters".into());
        return Err(err);
    }

    if !EMAIL_REGEX.is_match(email) {
        let mut err = ValidationError::new("invalid_email");
        err.message = Some("Must be a valid email address".into());
        return Err(err);
    }

    Ok(())
}

/// Validate an icon name
pub fn validate_icon(icon: &str) -> Result<(), ValidationError> {
    if icon.is_empty() || icon.len() > 50 {
        let mut err = ValidationError::new("invalid_icon");
        err.message = Some("Icon name must be 1-50 characters".into());
        return Err(err);
    }

    if !ICON_REGEX.is_match(icon) {
        let mut err = ValidationError::new("invalid_icon");
        err.message =
            Some("Icon name must contain only lowercase letters, numbers, and hyphens".into());
        return Err(err);
    }

    Ok(())
}

/// Validate display order (positive integer within reasonable range)
pub fn validate_display_order(order: i16) -> Result<(), ValidationError> {
    if !(0..=9999).contains(&order) {
        let mut err = ValidationError::new("invalid_order");
        err.message = Some("Display order must be between 0 and 9999".into());
        return Err(err);
    }
    Ok(())
}

/// Validate reading time in minutes
pub fn validate_reading_time(minutes: i16) -> Result<(), ValidationError> {
    if !(0..=999).contains(&minutes) {
        let mut err = ValidationError::new("invalid_reading_time");
        err.message = Some("Reading time must be between 0 and 999 minutes".into());
        return Err(err);
    }
    Ok(())
}

/// Sanitize a string by trimming whitespace and normalizing spaces
pub fn sanitize_string(input: &str) -> String {
    input.trim().to_string()
}

/// Sanitize and validate a string for safe storage
pub fn sanitize_text(input: &str, max_length: usize) -> Result<String, ValidationError> {
    let sanitized = sanitize_string(input);

    if sanitized.len() > max_length {
        let mut err = ValidationError::new("text_too_long");
        err.message = Some(format!("Text cannot exceed {} characters", max_length).into());
        return Err(err);
    }

    // Check for potential XSS
    if DANGEROUS_HTML_REGEX.is_match(&sanitized) {
        let mut err = ValidationError::new("dangerous_content");
        err.message = Some("Text contains potentially dangerous content".into());
        return Err(err);
    }

    Ok(sanitized)
}

/// Check if content contains potentially dangerous HTML/JS
pub fn contains_dangerous_content(content: &str) -> bool {
    DANGEROUS_HTML_REGEX.is_match(content)
}

/// Validate JSON content is not excessively nested (prevent DoS)
pub fn validate_json_depth(
    value: &serde_json::Value,
    max_depth: usize,
) -> Result<(), ValidationError> {
    fn check_depth(value: &serde_json::Value, current: usize, max: usize) -> bool {
        if current > max {
            return false;
        }
        match value {
            serde_json::Value::Array(arr) => arr.iter().all(|v| check_depth(v, current + 1, max)),
            serde_json::Value::Object(obj) => {
                obj.values().all(|v| check_depth(v, current + 1, max))
            }
            _ => true,
        }
    }

    if !check_depth(value, 0, max_depth) {
        let mut err = ValidationError::new("json_too_deep");
        err.message = Some(format!("JSON nesting cannot exceed {} levels", max_depth).into());
        return Err(err);
    }
    Ok(())
}

/// Validate MIME type is in allowed list
pub fn validate_mime_type(mime: &str, allowed: &[&str]) -> Result<(), ValidationError> {
    if !allowed.contains(&mime) {
        let mut err = ValidationError::new("invalid_mime_type");
        err.message = Some(format!("MIME type '{}' is not allowed", mime).into());
        return Err(err);
    }
    Ok(())
}

/// Allowed image MIME types
pub const ALLOWED_IMAGE_MIMES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/svg+xml",
];

/// Allowed document MIME types
pub const ALLOWED_DOCUMENT_MIMES: &[&str] = &[
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_slug_valid() {
        assert!(validate_slug("my-slug").is_ok());
        assert!(validate_slug("my-slug-123").is_ok());
        assert!(validate_slug("test").is_ok());
        assert!(validate_slug("a1b2c3").is_ok());
    }

    #[test]
    fn test_validate_slug_invalid() {
        assert!(validate_slug("").is_err());
        assert!(validate_slug("My-Slug").is_err()); // uppercase
        assert!(validate_slug("my_slug").is_err()); // underscore
        assert!(validate_slug("my slug").is_err()); // space
        assert!(validate_slug("-my-slug").is_err()); // starts with hyphen
        assert!(validate_slug(&"a".repeat(101)).is_err()); // too long
    }

    #[test]
    fn test_validate_route_valid() {
        assert!(validate_route("/").is_ok());
        assert!(validate_route("/about").is_ok());
        assert!(validate_route("/blog/my-post").is_ok());
        assert!(validate_route("/api/v1/users").is_ok());
    }

    #[test]
    fn test_validate_route_invalid() {
        assert!(validate_route("").is_err());
        assert!(validate_route("about").is_err()); // no leading /
        assert!(validate_route("/path/../secret").is_err()); // path traversal
        assert!(validate_route(&format!("/{}", "a".repeat(500))).is_err()); // too long
    }

    #[test]
    fn test_validate_url_valid() {
        assert!(validate_url("https://example.com").is_ok());
        assert!(validate_url("http://localhost:8080/path").is_ok());
        assert!(validate_url("").is_ok()); // empty is valid (optional)
    }

    #[test]
    fn test_validate_url_invalid() {
        assert!(validate_url("ftp://example.com").is_err());
        assert!(validate_url("javascript:alert(1)").is_err());
        assert!(validate_url("not-a-url").is_err());
    }

    #[test]
    fn test_validate_locale_code() {
        assert!(validate_locale_code("en").is_ok());
        assert!(validate_locale_code("en-US").is_ok());
        assert!(validate_locale_code("de-AT").is_ok());
        assert!(validate_locale_code("english").is_err());
        assert!(validate_locale_code("en_US").is_err());
    }

    #[test]
    fn test_validate_timezone() {
        assert!(validate_timezone("UTC").is_ok());
        assert!(validate_timezone("Europe/Vienna").is_ok());
        assert!(validate_timezone("America/New_York").is_ok());
        assert!(validate_timezone("Invalid").is_err());
    }

    #[test]
    fn test_validate_hex_color() {
        assert!(validate_hex_color("#FF0000").is_ok());
        assert!(validate_hex_color("#ffffff").is_ok());
        assert!(validate_hex_color("#123abc").is_ok());
        assert!(validate_hex_color("FF0000").is_err()); // missing #
        assert!(validate_hex_color("#FFF").is_err()); // too short
    }

    #[test]
    fn test_sanitize_string() {
        assert_eq!(sanitize_string("  hello  "), "hello");
        assert_eq!(sanitize_string("\n\ttest\n"), "test");
    }

    #[test]
    fn test_sanitize_text_with_xss() {
        assert!(sanitize_text("<script>alert(1)</script>", 1000).is_err());
        assert!(sanitize_text("onclick=alert(1)", 1000).is_err());
        assert!(sanitize_text("javascript:void(0)", 1000).is_err());
    }

    #[test]
    fn test_validate_json_depth() {
        let shallow: serde_json::Value = serde_json::json!({"a": {"b": "c"}});
        assert!(validate_json_depth(&shallow, 10).is_ok());

        // Create deeply nested JSON
        let mut deep = serde_json::json!("value");
        for _ in 0..15 {
            deep = serde_json::json!({"nested": deep});
        }
        assert!(validate_json_depth(&deep, 10).is_err());
    }

    #[test]
    fn test_validate_display_order() {
        assert!(validate_display_order(0).is_ok());
        assert!(validate_display_order(100).is_ok());
        assert!(validate_display_order(9999).is_ok());
        assert!(validate_display_order(-1).is_err());
        assert!(validate_display_order(10000).is_err());
    }

    #[test]
    fn test_validate_reading_time() {
        assert!(validate_reading_time(0).is_ok());
        assert!(validate_reading_time(5).is_ok());
        assert!(validate_reading_time(999).is_ok());
        assert!(validate_reading_time(-1).is_err());
        assert!(validate_reading_time(1000).is_err());
    }

    #[test]
    fn test_validate_mime_type() {
        assert!(validate_mime_type("image/jpeg", ALLOWED_IMAGE_MIMES).is_ok());
        assert!(validate_mime_type("image/png", ALLOWED_IMAGE_MIMES).is_ok());
        assert!(validate_mime_type("application/exe", ALLOWED_IMAGE_MIMES).is_err());
    }

    #[test]
    fn test_validate_email_valid() {
        assert!(validate_email("user@example.com").is_ok());
        assert!(validate_email("test.user+tag@domain.org").is_ok());
        assert!(validate_email("a@b.co").is_ok());
        assert!(validate_email("").is_ok()); // empty is valid (optional)
    }

    #[test]
    fn test_validate_email_invalid() {
        assert!(validate_email("not-an-email").is_err());
        assert!(validate_email("@domain.com").is_err());
        assert!(validate_email("user@").is_err());
        assert!(validate_email("user@domain").is_err());
        assert!(validate_email("user @domain.com").is_err());
    }

    #[test]
    fn test_validate_icon_valid() {
        assert!(validate_icon("home").is_ok());
        assert!(validate_icon("arrow-right").is_ok());
        assert!(validate_icon("icon-123").is_ok());
    }

    #[test]
    fn test_validate_icon_invalid() {
        assert!(validate_icon("").is_err());
        assert!(validate_icon("Icon Name").is_err());
        assert!(validate_icon("icon!").is_err());
        assert!(validate_icon(&"a".repeat(51)).is_err());
    }

    #[test]
    fn test_contains_dangerous_content() {
        assert!(contains_dangerous_content("<script>alert(1)</script>"));
        assert!(contains_dangerous_content("javascript:void(0)"));
        assert!(contains_dangerous_content("<div onclick=alert(1)>"));
        assert!(!contains_dangerous_content("<h1>Safe HTML</h1>"));
        assert!(!contains_dangerous_content("Normal text"));
    }
}
