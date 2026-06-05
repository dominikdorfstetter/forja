//! Storage configuration

use serde::Deserialize;

/// Storage backend configuration
#[derive(Debug, Clone, Deserialize)]
pub struct StorageConfig {
    /// Storage provider: "local" or "s3"
    #[serde(default = "default_provider")]
    pub provider: String,

    /// Local upload directory (default: "./uploads")
    #[serde(default = "default_upload_dir")]
    pub local_upload_dir: String,

    /// Base URL for locally served files (default: "/uploads")
    #[serde(default = "default_base_url")]
    pub local_base_url: String,

    /// S3 bucket name
    #[serde(default)]
    pub s3_bucket: Option<String>,

    /// S3 region
    #[serde(default)]
    pub s3_region: Option<String>,

    /// S3 key prefix (e.g. "media/")
    #[serde(default)]
    pub s3_prefix: Option<String>,

    /// Custom S3 endpoint (for MinIO or compatible services)
    #[serde(default)]
    pub s3_endpoint: Option<String>,
}

fn default_provider() -> String {
    "local".to_string()
}

fn default_upload_dir() -> String {
    "./uploads".to_string()
}

fn default_base_url() -> String {
    "/uploads".to_string()
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            local_upload_dir: default_upload_dir(),
            local_base_url: default_base_url(),
            s3_bucket: None,
            s3_region: None,
            s3_prefix: None,
            s3_endpoint: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_config_defaults() {
        let config = StorageConfig::default();
        assert_eq!(config.provider, "local");
        assert_eq!(config.local_upload_dir, "./uploads");
        assert_eq!(config.local_base_url, "/uploads");
        assert!(config.s3_bucket.is_none());
    }
}
