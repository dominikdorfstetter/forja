//! Storage backend service for media file management
//!
//! Supports local disk and S3-compatible storage.

use async_trait::async_trait;
use std::path::Path;
use std::sync::Arc;

use crate::config::StorageConfig;
use crate::errors::ApiError;

/// Result of a storage backend health check
pub struct StorageHealthInfo {
    pub provider: String,
    pub status: String,
    pub error: Option<String>,
    pub total_bytes: Option<u64>,
    pub available_bytes: Option<u64>,
    pub used_percent: Option<f64>,
    pub bucket: Option<String>,
}

/// Storage backend trait for saving/deleting/retrieving files
#[async_trait]
pub trait StorageBackend: Send + Sync {
    /// Store file data at the given path, returning the public URL
    async fn store(&self, path: &str, data: &[u8], content_type: &str) -> Result<String, ApiError>;

    /// Delete the file at the given path
    async fn delete(&self, path: &str) -> Result<(), ApiError>;

    /// Check if a file exists at the given path
    async fn exists(&self, path: &str) -> Result<bool, ApiError>;

    /// Get the public URL for a given storage path
    fn public_url(&self, path: &str) -> String;

    /// Check storage backend health and return disk/bucket info
    async fn health_check(&self) -> StorageHealthInfo;
}

// ---------------------------------------------------------------------------
// Local filesystem storage
// ---------------------------------------------------------------------------

/// Stores files on the local filesystem
pub struct LocalStorage {
    upload_dir: String,
    base_url: String,
}

impl LocalStorage {
    pub fn new(upload_dir: String, base_url: String) -> Self {
        Self {
            upload_dir,
            base_url,
        }
    }
}

#[async_trait]
impl StorageBackend for LocalStorage {
    async fn store(
        &self,
        path: &str,
        data: &[u8],
        _content_type: &str,
    ) -> Result<String, ApiError> {
        let full_path = format!("{}/{}", self.upload_dir, path);
        let parent = Path::new(&full_path)
            .parent()
            .ok_or_else(|| ApiError::Internal("Invalid storage path".to_string()))?;

        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to create directory: {e}")))?;

        tokio::fs::write(&full_path, data)
            .await
            .map_err(|e| ApiError::Internal(format!("Failed to write file: {e}")))?;

        Ok(self.public_url(path))
    }

    async fn delete(&self, path: &str) -> Result<(), ApiError> {
        let full_path = format!("{}/{}", self.upload_dir, path);
        if tokio::fs::metadata(&full_path).await.is_ok() {
            tokio::fs::remove_file(&full_path)
                .await
                .map_err(|e| ApiError::Internal(format!("Failed to delete file: {e}")))?;
        }
        Ok(())
    }

    async fn exists(&self, path: &str) -> Result<bool, ApiError> {
        let full_path = format!("{}/{}", self.upload_dir, path);
        Ok(tokio::fs::metadata(&full_path).await.is_ok())
    }

    fn public_url(&self, path: &str) -> String {
        format!("{}/{}", self.base_url, path)
    }

    async fn health_check(&self) -> StorageHealthInfo {
        use std::ffi::CString;

        match CString::new(self.upload_dir.as_str()) {
            Ok(c_path) => match nix::sys::statvfs::statvfs(&*c_path) {
                Ok(stat) => {
                    #[allow(clippy::unnecessary_cast)]
                    let block_size = stat.fragment_size() as u64;
                    #[allow(clippy::unnecessary_cast)]
                    let total = stat.blocks() as u64 * block_size;
                    #[allow(clippy::unnecessary_cast)]
                    let available = stat.blocks_available() as u64 * block_size;
                    let used_percent = if total > 0 {
                        ((total - available) as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };
                    StorageHealthInfo {
                        provider: "local".to_string(),
                        status: "up".to_string(),
                        error: None,
                        total_bytes: Some(total),
                        available_bytes: Some(available),
                        used_percent: Some((used_percent * 10.0).round() / 10.0),
                        bucket: None,
                    }
                }
                Err(e) => StorageHealthInfo {
                    provider: "local".to_string(),
                    status: "down".to_string(),
                    error: Some(format!("statvfs failed: {e}")),
                    total_bytes: None,
                    available_bytes: None,
                    used_percent: None,
                    bucket: None,
                },
            },
            Err(e) => StorageHealthInfo {
                provider: "local".to_string(),
                status: "down".to_string(),
                error: Some(format!("Invalid path: {e}")),
                total_bytes: None,
                available_bytes: None,
                used_percent: None,
                bucket: None,
            },
        }
    }
}

// ---------------------------------------------------------------------------
// S3-compatible storage
// ---------------------------------------------------------------------------

/// Stores files on S3 (or compatible services like MinIO)
pub struct S3Storage {
    client: aws_sdk_s3::Client,
    bucket: String,
    prefix: String,
    region: String,
    custom_endpoint: Option<String>,
}

impl S3Storage {
    pub fn new(
        client: aws_sdk_s3::Client,
        bucket: String,
        region: String,
        prefix: Option<String>,
        custom_endpoint: Option<String>,
    ) -> Self {
        Self {
            client,
            bucket,
            prefix: prefix.unwrap_or_default(),
            region,
            custom_endpoint,
        }
    }

    fn full_key(&self, path: &str) -> String {
        if self.prefix.is_empty() {
            path.to_string()
        } else {
            format!("{}{}", self.prefix, path)
        }
    }
}

#[async_trait]
impl StorageBackend for S3Storage {
    async fn store(&self, path: &str, data: &[u8], content_type: &str) -> Result<String, ApiError> {
        let key = self.full_key(path);
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(aws_sdk_s3::primitives::ByteStream::from(data.to_vec()))
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("S3 PutObject failed: {e}")))?;

        Ok(self.public_url(path))
    }

    async fn delete(&self, path: &str) -> Result<(), ApiError> {
        let key = self.full_key(path);
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_err(|e| ApiError::Internal(format!("S3 DeleteObject failed: {e}")))?;

        Ok(())
    }

    async fn exists(&self, path: &str) -> Result<bool, ApiError> {
        let key = self.full_key(path);
        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    fn public_url(&self, path: &str) -> String {
        let key = self.full_key(path);
        if let Some(ref endpoint) = self.custom_endpoint {
            format!("{}/{}/{}", endpoint, self.bucket, key)
        } else {
            format!(
                "https://{}.s3.{}.amazonaws.com/{}",
                self.bucket, self.region, key
            )
        }
    }

    async fn health_check(&self) -> StorageHealthInfo {
        match self.client.head_bucket().bucket(&self.bucket).send().await {
            Ok(_) => StorageHealthInfo {
                provider: "s3".to_string(),
                status: "up".to_string(),
                error: None,
                total_bytes: None,
                available_bytes: None,
                used_percent: None,
                bucket: Some(self.bucket.clone()),
            },
            Err(e) => StorageHealthInfo {
                provider: "s3".to_string(),
                status: "down".to_string(),
                error: Some(format!("HeadBucket failed: {e}")),
                total_bytes: None,
                available_bytes: None,
                used_percent: None,
                bucket: Some(self.bucket.clone()),
            },
        }
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Create a storage backend from configuration
pub async fn create_storage(config: &StorageConfig) -> Result<Arc<dyn StorageBackend>, ApiError> {
    match config.provider.as_str() {
        "local" => {
            // Ensure the upload directory exists
            tokio::fs::create_dir_all(&config.local_upload_dir)
                .await
                .map_err(|e| ApiError::Internal(format!("Failed to create upload dir: {e}")))?;

            Ok(Arc::new(LocalStorage::new(
                config.local_upload_dir.clone(),
                config.local_base_url.clone(),
            )))
        }
        "s3" => {
            let bucket = config
                .s3_bucket
                .as_ref()
                .ok_or_else(|| ApiError::Internal("S3 bucket not configured".to_string()))?
                .clone();
            let region = config.s3_region.as_deref().unwrap_or("us-east-1");

            let mut aws_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
                .region(aws_config::Region::new(region.to_string()));

            if let Some(ref endpoint) = config.s3_endpoint {
                aws_config = aws_config.endpoint_url(endpoint);
            }

            let sdk_config = aws_config.load().await;
            let client = aws_sdk_s3::Client::new(&sdk_config);

            Ok(Arc::new(S3Storage::new(
                client,
                bucket,
                region.to_string(),
                config.s3_prefix.clone(),
                config.s3_endpoint.clone(),
            )))
        }
        other => Err(ApiError::Internal(format!(
            "Unknown storage provider: {other}"
        ))),
    }
}
