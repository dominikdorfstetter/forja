//! Query parameter parsing utilities

use serde::Deserialize;

/// Common query parameters for list endpoints
#[derive(Debug, Default, Deserialize)]
pub struct ListQueryParams {
    /// Locale filter
    pub locale: Option<String>,

    /// Environment filter
    pub environment: Option<String>,

    /// Status filter
    pub status: Option<String>,

    /// Search query
    pub search: Option<String>,

    /// Sorting (e.g., "created_at:desc")
    pub sort: Option<String>,

    /// Fields to include
    pub fields: Option<String>,

    /// Relations to include
    pub include: Option<String>,

    /// Include global/shared content
    pub include_global: Option<bool>,
}

impl ListQueryParams {
    /// Parse sort parameter into (field, direction)
    pub fn parse_sort(&self) -> Option<(String, SortDirection)> {
        self.sort.as_ref().map(|s| {
            let parts: Vec<&str> = s.split(':').collect();
            let field = parts.first().unwrap_or(&"created_at").to_string();
            let direction = parts
                .get(1)
                .map(|d| {
                    if *d == "asc" {
                        SortDirection::Asc
                    } else {
                        SortDirection::Desc
                    }
                })
                .unwrap_or(SortDirection::Desc);
            (field, direction)
        })
    }

    /// Parse fields to include
    pub fn parse_fields(&self) -> Option<Vec<String>> {
        self.fields
            .as_ref()
            .map(|f| f.split(',').map(|s| s.trim().to_string()).collect())
    }

    /// Parse relations to include
    pub fn parse_includes(&self) -> Option<Vec<String>> {
        self.include
            .as_ref()
            .map(|i| i.split(',').map(|s| s.trim().to_string()).collect())
    }
}

/// Sort direction
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortDirection {
    Asc,
    Desc,
}

impl SortDirection {
    pub fn as_sql(&self) -> &'static str {
        match self {
            SortDirection::Asc => "ASC",
            SortDirection::Desc => "DESC",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- parse_sort ---

    #[test]
    fn parse_sort_field_and_asc() {
        let params = ListQueryParams {
            sort: Some("name:asc".into()),
            ..Default::default()
        };
        let (field, dir) = params.parse_sort().unwrap();
        assert_eq!(field, "name");
        assert_eq!(dir, SortDirection::Asc);
    }

    #[test]
    fn parse_sort_field_and_desc() {
        let params = ListQueryParams {
            sort: Some("created_at:desc".into()),
            ..Default::default()
        };
        let (field, dir) = params.parse_sort().unwrap();
        assert_eq!(field, "created_at");
        assert_eq!(dir, SortDirection::Desc);
    }

    #[test]
    fn parse_sort_field_only_defaults_desc() {
        let params = ListQueryParams {
            sort: Some("updated_at".into()),
            ..Default::default()
        };
        let (field, dir) = params.parse_sort().unwrap();
        assert_eq!(field, "updated_at");
        assert_eq!(dir, SortDirection::Desc);
    }

    #[test]
    fn parse_sort_unknown_direction_defaults_desc() {
        let params = ListQueryParams {
            sort: Some("name:bogus".into()),
            ..Default::default()
        };
        let (_, dir) = params.parse_sort().unwrap();
        assert_eq!(dir, SortDirection::Desc);
    }

    #[test]
    fn parse_sort_none_returns_none() {
        let params = ListQueryParams::default();
        assert!(params.parse_sort().is_none());
    }

    // --- parse_fields ---

    #[test]
    fn parse_fields_single() {
        let params = ListQueryParams {
            fields: Some("title".into()),
            ..Default::default()
        };
        assert_eq!(params.parse_fields().unwrap(), vec!["title"]);
    }

    #[test]
    fn parse_fields_multiple_comma_separated() {
        let params = ListQueryParams {
            fields: Some("title,slug,status".into()),
            ..Default::default()
        };
        assert_eq!(
            params.parse_fields().unwrap(),
            vec!["title", "slug", "status"]
        );
    }

    #[test]
    fn parse_fields_trims_whitespace() {
        let params = ListQueryParams {
            fields: Some(" title , slug ".into()),
            ..Default::default()
        };
        assert_eq!(params.parse_fields().unwrap(), vec!["title", "slug"]);
    }

    #[test]
    fn parse_fields_none_returns_none() {
        let params = ListQueryParams::default();
        assert!(params.parse_fields().is_none());
    }

    // --- parse_includes ---

    #[test]
    fn parse_includes_multiple() {
        let params = ListQueryParams {
            include: Some("tags,categories".into()),
            ..Default::default()
        };
        assert_eq!(params.parse_includes().unwrap(), vec!["tags", "categories"]);
    }

    #[test]
    fn parse_includes_none_returns_none() {
        let params = ListQueryParams::default();
        assert!(params.parse_includes().is_none());
    }

    // --- SortDirection::as_sql ---

    #[test]
    fn sort_direction_asc_as_sql() {
        assert_eq!(SortDirection::Asc.as_sql(), "ASC");
    }

    #[test]
    fn sort_direction_desc_as_sql() {
        assert_eq!(SortDirection::Desc.as_sql(), "DESC");
    }
}
