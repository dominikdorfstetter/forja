//! Storage backend service for media file management
//!
//! Supports local disk and S3-compatible storage.
//! S3 files are served through a backend proxy (`/files/<path>`) to avoid
//! needing public bucket ACLs — works with any S3-compatible provider.

use async_trait::async_trait;
use std::sync::Arc;

use crate::config::StorageConfig;
use crate::errors::codes;
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

    /// Store a file by streaming it from a local path, returning the public URL.
    /// Peak memory is bounded regardless of file size — unlike [`store`], which
    /// holds the whole payload in memory. Use for large artifacts (e.g. site
    /// export ZIPs) that would otherwise OOM a small container.
    async fn store_file(
        &self,
        path: &str,
        local_path: &std::path::Path,
        content_type: &str,
    ) -> Result<String, ApiError>;

    /// Fetch file data from the given path, returning (bytes, content_type)
    async fn fetch(&self, path: &str) -> Result<(Vec<u8>, String), ApiError>;

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

    /// Validate a storage path, rejecting path traversal attempts.
    /// Returns the joined path within the upload directory.
    fn validated_path(&self, path: &str) -> Result<std::path::PathBuf, ApiError> {
        use std::path::{Component, PathBuf};

        for component in PathBuf::from(path).components() {
            if matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix { .. }
            ) {
                return Err(
                    ApiError::forbidden("Invalid storage path").with_code(codes::STORAGE_ERROR)
                );
            }
        }

        Ok(PathBuf::from(&self.upload_dir).join(path))
    }

    /// Canonicalize a path and verify it stays within the upload directory.
    /// Requires the path to exist on the filesystem.
    fn verify_within_upload_dir(
        &self,
        path: &std::path::Path,
    ) -> Result<std::path::PathBuf, ApiError> {
        let canonical = path
            .canonicalize()
            .map_err(|_| ApiError::not_found("File not found").with_code(codes::STORAGE_ERROR))?;

        let upload_canonical = std::path::PathBuf::from(&self.upload_dir)
            .canonicalize()
            .map_err(|_| {
                ApiError::internal("Storage directory not accessible")
                    .with_code(codes::STORAGE_ERROR)
            })?;

        if !canonical.starts_with(&upload_canonical) {
            return Err(ApiError::forbidden("Invalid storage path").with_code(codes::STORAGE_ERROR));
        }

        Ok(canonical)
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
        let full_path = self.validated_path(path)?;
        let parent = full_path.parent().ok_or_else(|| {
            ApiError::internal("Invalid storage path").with_code(codes::STORAGE_ERROR)
        })?;

        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            ApiError::internal(format!("Failed to create directory: {e}"))
                .with_code(codes::STORAGE_ERROR)
        })?;

        // Verify the parent directory is within the upload directory
        self.verify_within_upload_dir(parent)?;

        tokio::fs::write(&full_path, data).await.map_err(|e| {
            ApiError::internal(format!("Failed to write file: {e}")).with_code(codes::STORAGE_ERROR)
        })?;

        Ok(self.public_url(path))
    }

    async fn store_file(
        &self,
        path: &str,
        local_path: &std::path::Path,
        _content_type: &str,
    ) -> Result<String, ApiError> {
        let full_path = self.validated_path(path)?;
        let parent = full_path.parent().ok_or_else(|| {
            ApiError::internal("Invalid storage path").with_code(codes::STORAGE_ERROR)
        })?;

        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            ApiError::internal(format!("Failed to create directory: {e}"))
                .with_code(codes::STORAGE_ERROR)
        })?;
        self.verify_within_upload_dir(parent)?;

        // Stream-copy at the OS level — never loads the whole file into memory.
        tokio::fs::copy(local_path, &full_path).await.map_err(|e| {
            ApiError::internal(format!("Failed to copy file: {e}")).with_code(codes::STORAGE_ERROR)
        })?;

        Ok(self.public_url(path))
    }

    async fn fetch(&self, path: &str) -> Result<(Vec<u8>, String), ApiError> {
        let full_path = self.validated_path(path)?;
        let canonical = self.verify_within_upload_dir(&full_path)?;
        let data = tokio::fs::read(&canonical).await.map_err(|e| {
            ApiError::not_found(format!("File not found: {e}")).with_code(codes::STORAGE_ERROR)
        })?;
        let content_type = infer::get(&data)
            .map(|t| t.mime_type().to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());
        Ok((data, content_type))
    }

    async fn delete(&self, path: &str) -> Result<(), ApiError> {
        let full_path = self.validated_path(path)?;
        if tokio::fs::metadata(&full_path).await.is_ok() {
            let canonical = self.verify_within_upload_dir(&full_path)?;
            tokio::fs::remove_file(&canonical).await.map_err(|e| {
                ApiError::internal(format!("Failed to delete file: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?;
        }
        Ok(())
    }

    async fn exists(&self, path: &str) -> Result<bool, ApiError> {
        let full_path = self.validated_path(path)?;
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

/// Stores files on S3 (or compatible services like MinIO, Tigris)
///
/// Files are served through a backend proxy endpoint (`/files/<path>`) rather
/// than direct S3 URLs. This avoids needing public bucket ACLs, which many
/// providers (Railway/Tigris) don't easily support.
pub struct S3Storage {
    client: aws_sdk_s3::Client,
    bucket: String,
    prefix: String,
    #[allow(dead_code)]
    region: String,
    #[allow(dead_code)]
    custom_endpoint: Option<String>,
    /// Base URL for the proxy endpoint (e.g. "https://cms.example.com")
    proxy_base_url: String,
}

impl S3Storage {
    pub fn new(
        client: aws_sdk_s3::Client,
        bucket: String,
        region: String,
        prefix: Option<String>,
        custom_endpoint: Option<String>,
        proxy_base_url: String,
    ) -> Self {
        Self {
            client,
            bucket,
            prefix: prefix.unwrap_or_default(),
            region,
            custom_endpoint,
            proxy_base_url: proxy_base_url.trim_end_matches('/').to_string(),
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
            .map_err(|e| {
                ApiError::internal(format!("S3 PutObject failed: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?;

        Ok(self.public_url(path))
    }

    async fn store_file(
        &self,
        path: &str,
        local_path: &std::path::Path,
        content_type: &str,
    ) -> Result<String, ApiError> {
        let key = self.full_key(path);
        // ByteStream::from_path streams the file from disk in chunks — the whole
        // object is never resident in memory.
        let body = aws_sdk_s3::primitives::ByteStream::from_path(local_path)
            .await
            .map_err(|e| {
                ApiError::internal(format!("Failed to open file for upload: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?;
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(body)
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| {
                ApiError::internal(format!("S3 PutObject failed: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?;

        Ok(self.public_url(path))
    }

    async fn fetch(&self, path: &str) -> Result<(Vec<u8>, String), ApiError> {
        let key = self.full_key(path);
        let result = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_err(|e| {
                ApiError::not_found(format!("S3 GetObject failed: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?;

        let stored_content_type = result.content_type().map(|s| s.to_string());

        let data = result
            .body
            .collect()
            .await
            .map_err(|e| {
                ApiError::internal(format!("Failed to read S3 object body: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?
            .into_bytes()
            .to_vec();

        // Some S3-compatible providers (and older uploads) don't preserve a
        // useful Content-Type. Fall back to magic-byte sniffing so callers get
        // the same shape of result LocalStorage::fetch returns.
        let content_type = match stored_content_type {
            Some(ct) if ct != "application/octet-stream" && ct != "binary/octet-stream" => ct,
            _ => infer::get(&data)
                .map(|t| t.mime_type().to_string())
                .unwrap_or_else(|| "application/octet-stream".to_string()),
        };

        Ok((data, content_type))
    }

    async fn delete(&self, path: &str) -> Result<(), ApiError> {
        let key = self.full_key(path);
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_err(|e| {
                ApiError::internal(format!("S3 DeleteObject failed: {e}"))
                    .with_code(codes::STORAGE_ERROR)
            })?;

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
        format!("{}/files/{}", self.proxy_base_url, path)
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
pub async fn create_storage(
    config: &StorageConfig,
    public_url: &str,
) -> Result<Arc<dyn StorageBackend>, ApiError> {
    match config.provider.as_str() {
        "local" => {
            // Ensure the upload directory exists
            tokio::fs::create_dir_all(&config.local_upload_dir)
                .await
                .map_err(|e| {
                    ApiError::internal(format!("Failed to create upload dir: {e}"))
                        .with_code(codes::STORAGE_ERROR)
                })?;

            Ok(Arc::new(LocalStorage::new(
                config.local_upload_dir.clone(),
                config.local_base_url.clone(),
            )))
        }
        "s3" => {
            let bucket = config
                .s3_bucket
                .as_ref()
                .ok_or_else(|| {
                    ApiError::internal("S3 bucket not configured").with_code(codes::STORAGE_ERROR)
                })?
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
                public_url.to_string(),
            )))
        }
        other => Err(
            ApiError::internal(format!("Unknown storage provider: {other}"))
                .with_code(codes::STORAGE_ERROR),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_storage(dir: &str) -> LocalStorage {
        LocalStorage::new(dir.to_string(), "http://localhost:8000/files".to_string())
    }

    #[test]
    fn test_validated_path_rejects_parent_traversal() {
        let storage = local_storage("/tmp/uploads");
        let result = storage.validated_path("../../etc/passwd");
        assert!(result.is_err());
    }

    #[test]
    fn test_validated_path_rejects_mid_path_traversal() {
        let storage = local_storage("/tmp/uploads");
        let result = storage.validated_path("subdir/../../etc/passwd");
        assert!(result.is_err());
    }

    #[test]
    fn test_validated_path_rejects_absolute_path() {
        let storage = local_storage("/tmp/uploads");
        let result = storage.validated_path("/etc/passwd");
        assert!(result.is_err());
    }

    #[test]
    fn test_validated_path_accepts_valid_path() {
        let storage = local_storage("/tmp/uploads");
        let result = storage.validated_path("site-id/2026/03/image.png");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert_eq!(
            path.to_string_lossy(),
            "/tmp/uploads/site-id/2026/03/image.png"
        );
    }

    #[test]
    fn test_validated_path_accepts_simple_filename() {
        let storage = local_storage("/tmp/uploads");
        let result = storage.validated_path("test.txt");
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_verify_within_upload_dir_rejects_outside_path() {
        let dir = tempfile::tempdir().unwrap();
        let storage = local_storage(dir.path().to_str().unwrap());

        // Create a file outside the upload dir
        let outside = tempfile::NamedTempFile::new().unwrap();
        let result = storage.verify_within_upload_dir(outside.path());
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_verify_within_upload_dir_accepts_inside_path() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        tokio::fs::write(&file_path, b"hello").await.unwrap();

        let storage = local_storage(dir.path().to_str().unwrap());
        let result = storage.verify_within_upload_dir(&file_path);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_fetch_rejects_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let storage = local_storage(dir.path().to_str().unwrap());

        let result = storage.fetch("../../etc/passwd").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_store_rejects_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let storage = local_storage(dir.path().to_str().unwrap());

        let result = storage
            .store("../../etc/evil.txt", b"malicious", "text/plain")
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_rejects_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let storage = local_storage(dir.path().to_str().unwrap());

        let result = storage.delete("../../etc/passwd").await;
        assert!(result.is_err());
    }
}
