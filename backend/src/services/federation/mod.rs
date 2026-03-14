//! Federation services — key management, HTTP signatures, sanitization, and SSRF-safe HTTP client.

pub mod http_client;
pub mod key_management;
pub mod sanitizer;
pub mod signing;
