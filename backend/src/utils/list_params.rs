//! Shared list parameters for paginated, searchable, sortable endpoints

use crate::utils::pagination::PaginationParams;

/// Sort parameters for list endpoints
#[derive(Debug, Clone, Default)]
pub struct SortParams {
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

impl SortParams {
    /// Get sort direction as SQL keyword. Defaults to DESC.
    pub fn direction(&self) -> &'static str {
        match self.sort_dir.as_deref() {
            Some("asc" | "ASC") => "ASC",
            _ => "DESC",
        }
    }

    /// Get the requested sort field, falling back to a default.
    pub fn field_or<'a>(&'a self, default: &'a str) -> &'a str {
        self.sort_by.as_deref().unwrap_or(default)
    }
}

/// Standard list parameters shared across all paginated endpoints.
///
/// Combines pagination, free-text search, and sort controls.
/// Domain-specific filters (status, entry_type, etc.) remain as
/// separate handler parameters.
#[derive(Debug, Clone)]
pub struct ListParams {
    pub pagination: PaginationParams,
    pub search: Option<String>,
    pub sort: SortParams,
}

impl ListParams {
    /// Construct from individual query parameter values.
    pub fn new(
        page: Option<i64>,
        page_size: Option<i64>,
        search: Option<String>,
        sort_by: Option<String>,
        sort_dir: Option<String>,
    ) -> Self {
        Self {
            pagination: PaginationParams::new(page, page_size),
            search,
            sort: SortParams { sort_by, sort_dir },
        }
    }

    /// Shorthand for `self.pagination.limit_offset()`.
    pub fn limit_offset(&self) -> (i64, i64) {
        self.pagination.limit_offset()
    }

    /// Shorthand for `self.search.as_deref()`.
    pub fn search_ref(&self) -> Option<&str> {
        self.search.as_deref()
    }

    /// Create a paginated response (consumes self for the pagination metadata).
    pub fn paginate<T: serde::Serialize + utoipa::ToSchema>(
        self,
        items: Vec<T>,
        total: i64,
    ) -> crate::utils::pagination::Paginated<T> {
        self.pagination.paginate(items, total)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_direction_defaults_to_desc() {
        let sort = SortParams {
            sort_by: None,
            sort_dir: None,
        };
        assert_eq!(sort.direction(), "DESC");
    }

    #[test]
    fn sort_direction_asc() {
        let sort = SortParams {
            sort_by: None,
            sort_dir: Some("asc".into()),
        };
        assert_eq!(sort.direction(), "ASC");
    }

    #[test]
    fn sort_direction_asc_uppercase() {
        let sort = SortParams {
            sort_by: None,
            sort_dir: Some("ASC".into()),
        };
        assert_eq!(sort.direction(), "ASC");
    }

    #[test]
    fn sort_direction_invalid_defaults_desc() {
        let sort = SortParams {
            sort_by: None,
            sort_dir: Some("bogus".into()),
        };
        assert_eq!(sort.direction(), "DESC");
    }

    #[test]
    fn sort_field_or_returns_field_when_present() {
        let sort = SortParams {
            sort_by: Some("name".into()),
            sort_dir: None,
        };
        assert_eq!(sort.field_or("created_at"), "name");
    }

    #[test]
    fn sort_field_or_returns_default_when_none() {
        let sort = SortParams {
            sort_by: None,
            sort_dir: None,
        };
        assert_eq!(sort.field_or("created_at"), "created_at");
    }

    #[test]
    fn list_params_delegates_pagination() {
        let params = ListParams::new(Some(3), Some(25), None, None, None);
        let (limit, offset) = params.limit_offset();
        assert_eq!(limit, 25);
        assert_eq!(offset, 50);
    }

    #[test]
    fn list_params_search_ref() {
        let params = ListParams::new(None, None, Some("hello".into()), None, None);
        assert_eq!(params.search_ref(), Some("hello"));

        let params = ListParams::new(None, None, None, None, None);
        assert_eq!(params.search_ref(), None);
    }

    #[test]
    fn list_params_defaults() {
        let params = ListParams::new(None, None, None, None, None);
        let (limit, offset) = params.limit_offset();
        assert_eq!(limit, 10);
        assert_eq!(offset, 0);
        assert_eq!(params.sort.direction(), "DESC");
        assert_eq!(params.sort.field_or("id"), "id");
    }
}
