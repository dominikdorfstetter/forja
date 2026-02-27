//! Pagination utilities

use serde::{Deserialize, Serialize};

/// Pagination parameters
#[derive(Debug, Clone, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: u32,

    #[serde(default = "default_page_size")]
    pub page_size: u32,
}

fn default_page() -> u32 {
    1
}

fn default_page_size() -> u32 {
    10
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: default_page(),
            page_size: default_page_size(),
        }
    }
}

impl PaginationParams {
    /// Maximum allowed page size
    pub const MAX_PAGE_SIZE: u32 = 100;

    /// Create new pagination params from optional query parameters
    pub fn new(page: Option<i64>, per_page: Option<i64>) -> Self {
        Self {
            page: page.unwrap_or(1).max(1) as u32,
            page_size: per_page.unwrap_or(10).max(1) as u32,
        }
    }

    /// Get the offset for SQL queries
    pub fn offset(&self) -> u32 {
        (self.page.saturating_sub(1)) * self.page_size
    }

    /// Get the limit for SQL queries (capped at MAX_PAGE_SIZE)
    pub fn limit(&self) -> u32 {
        self.page_size.min(Self::MAX_PAGE_SIZE)
    }

    /// Get limit and offset as i64 tuple for SQL queries
    pub fn limit_offset(&self) -> (i64, i64) {
        (self.limit() as i64, self.offset() as i64)
    }

    /// Create a paginated response from items and total count
    pub fn paginate<T: Serialize + utoipa::ToSchema>(
        self,
        items: Vec<T>,
        total: i64,
    ) -> Paginated<T> {
        Paginated::new(items, self.page, self.limit(), total as u64)
    }
}

/// Pagination metadata in responses
#[derive(Debug, Serialize, utoipa::ToSchema)]
#[schema(description = "Pagination metadata")]
pub struct PaginationMeta {
    #[schema(example = 1)]
    pub page: u32,
    #[schema(example = 10)]
    pub page_size: u32,
    #[serde(rename = "total_pages")]
    #[schema(example = 5)]
    pub page_count: u32,
    #[serde(rename = "total_items")]
    #[schema(example = 42)]
    pub total: u64,
}

impl PaginationMeta {
    pub fn new(page: u32, page_size: u32, total: u64) -> Self {
        let page_count = ((total as f64) / (page_size as f64)).ceil() as u32;
        Self {
            page,
            page_size,
            page_count,
            total,
        }
    }
}

/// Paginated response wrapper
#[derive(Debug, Serialize, utoipa::ToSchema)]
#[schema(description = "Paginated response wrapper")]
pub struct Paginated<T: utoipa::ToSchema> {
    pub data: Vec<T>,
    pub meta: PaginationMeta,
}

impl<T: utoipa::ToSchema> Paginated<T> {
    pub fn new(data: Vec<T>, page: u32, page_size: u32, total: u64) -> Self {
        Self {
            data,
            meta: PaginationMeta::new(page, page_size, total),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_params_defaults() {
        let params = PaginationParams::default();
        assert_eq!(params.page, 1);
        assert_eq!(params.page_size, 10);
    }

    #[test]
    fn test_pagination_offset_calculation() {
        let params = PaginationParams {
            page: 1,
            page_size: 10,
        };
        assert_eq!(params.offset(), 0);

        let params = PaginationParams {
            page: 2,
            page_size: 10,
        };
        assert_eq!(params.offset(), 10);

        let params = PaginationParams {
            page: 3,
            page_size: 25,
        };
        assert_eq!(params.offset(), 50);
    }

    #[test]
    fn test_pagination_offset_page_zero() {
        // Page 0 should be treated like page 1 (no negative offset)
        let params = PaginationParams {
            page: 0,
            page_size: 10,
        };
        assert_eq!(params.offset(), 0);
    }

    #[test]
    fn test_pagination_limit_capped() {
        let params = PaginationParams {
            page: 1,
            page_size: 200,
        };
        assert_eq!(params.limit(), PaginationParams::MAX_PAGE_SIZE);

        let params = PaginationParams {
            page: 1,
            page_size: 50,
        };
        assert_eq!(params.limit(), 50);
    }

    #[test]
    fn test_pagination_meta_calculation() {
        let meta = PaginationMeta::new(1, 10, 25);
        assert_eq!(meta.page, 1);
        assert_eq!(meta.page_size, 10);
        assert_eq!(meta.page_count, 3); // 25 items / 10 per page = 3 pages
        assert_eq!(meta.total, 25);
    }

    #[test]
    fn test_pagination_meta_exact_division() {
        let meta = PaginationMeta::new(1, 10, 30);
        assert_eq!(meta.page_count, 3); // Exactly 3 pages
    }

    #[test]
    fn test_pagination_meta_empty() {
        let meta = PaginationMeta::new(1, 10, 0);
        assert_eq!(meta.page_count, 0);
        assert_eq!(meta.total, 0);
    }

    #[test]
    fn test_paginated_response() {
        let items = vec!["a", "b", "c"];
        let paginated = Paginated::new(items, 1, 10, 3);

        assert_eq!(paginated.data.len(), 3);
        assert_eq!(paginated.meta.page, 1);
        assert_eq!(paginated.meta.total, 3);
    }

    #[test]
    fn test_paginated_serialization() {
        let items = vec!["item1".to_string(), "item2".to_string()];
        let paginated = Paginated::new(items, 2, 10, 15);

        let json = serde_json::to_string(&paginated).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert!(parsed.get("data").is_some());
        assert!(parsed.get("meta").is_some());
        assert_eq!(parsed["meta"]["page"], 2);
        assert_eq!(parsed["meta"]["total_items"], 15);
        assert_eq!(parsed["meta"]["total_pages"], 2);
    }

    #[test]
    fn test_pagination_params_deserialization() {
        let json = r#"{"page": 5, "page_size": 25}"#;
        let params: PaginationParams = serde_json::from_str(json).unwrap();

        assert_eq!(params.page, 5);
        assert_eq!(params.page_size, 25);
    }

    #[test]
    fn test_pagination_params_partial_deserialization() {
        // Only page specified, page_size should use default
        let json = r#"{"page": 3}"#;
        let params: PaginationParams = serde_json::from_str(json).unwrap();

        assert_eq!(params.page, 3);
        assert_eq!(params.page_size, 10); // default
    }
}
