//! Redirect model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::redirect::{CreateRedirectRequest, UpdateRedirectRequest};
use crate::errors::codes;
use crate::errors::ApiError;
use crate::utils::list_params::ListParams;

/// URL redirect model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Redirect {
    pub id: Uuid,
    pub site_id: Uuid,
    pub source_path: String,
    pub destination_path: String,
    pub status_code: i16,
    pub is_active: bool,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Redirect {
    /// Find all redirects for a site (paginated)
    pub async fn find_all_for_site(
        pool: &PgPool,
        site_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, ApiError> {
        let redirects = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, source_path, destination_path, status_code,
                   is_active, description, created_at, updated_at
            FROM redirects
            WHERE site_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(site_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(redirects)
    }

    /// Count redirects for a site
    pub async fn count_for_site(pool: &PgPool, site_id: Uuid) -> Result<i64, ApiError> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM redirects WHERE site_id = $1")
            .bind(site_id)
            .fetch_one(pool)
            .await?;
        Ok(row.0)
    }

    /// Find all redirects for a site (filtered, paginated, sortable)
    pub async fn find_all_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        params: &ListParams,
    ) -> Result<Vec<Self>, ApiError> {
        let (limit, offset) = params.limit_offset();
        let order_col = match params.sort.field_or("created_at") {
            "source_path" => "r.source_path",
            _ => "r.created_at",
        };
        let order_dir = params.sort.direction();

        let mut where_clauses = vec!["r.site_id = $1".to_string()];
        let mut bind_idx = 4u32; // $1=site_id, $2=limit, $3=offset

        if params.search.is_some() {
            where_clauses.push(format!(
                "(r.source_path ILIKE '%' || ${bind_idx} || '%' OR r.destination_path ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            "SELECT r.id, r.site_id, r.source_path, r.destination_path, r.status_code, \
                    r.is_active, r.description, r.created_at, r.updated_at \
             FROM redirects r \
             WHERE {} \
             ORDER BY {} {} \
             LIMIT $2 OFFSET $3",
            where_clauses.join(" AND "),
            order_col,
            order_dir
        );

        let mut query = sqlx::query_as::<_, Self>(&sql)
            .bind(site_id)
            .bind(limit)
            .bind(offset);
        if let Some(s) = params.search_ref() {
            query = query.bind(s);
        }

        let redirects = query.fetch_all(pool).await?;
        Ok(redirects)
    }

    /// Count redirects for a site (with optional search filter)
    pub async fn count_for_site_filtered(
        pool: &PgPool,
        site_id: Uuid,
        search: Option<&str>,
    ) -> Result<i64, ApiError> {
        let mut where_clauses = vec!["r.site_id = $1".to_string()];
        let mut bind_idx = 2u32;

        if search.is_some() {
            where_clauses.push(format!(
                "(r.source_path ILIKE '%' || ${bind_idx} || '%' OR r.destination_path ILIKE '%' || ${bind_idx} || '%')"
            ));
            bind_idx += 1;
        }
        let _ = bind_idx;

        let sql = format!(
            "SELECT COUNT(*) FROM redirects r WHERE {}",
            where_clauses.join(" AND "),
        );

        let mut query = sqlx::query_as::<_, (i64,)>(&sql).bind(site_id);
        if let Some(s) = search {
            query = query.bind(s);
        }

        let row = query.fetch_one(pool).await?;
        Ok(row.0)
    }

    /// Find redirect by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Self, ApiError> {
        let redirect = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, source_path, destination_path, status_code,
                   is_active, description, created_at, updated_at
            FROM redirects
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Redirect with ID {} not found", id))
                .with_code(codes::REDIRECT_NOT_FOUND)
        })?;

        Ok(redirect)
    }

    /// Lookup an active redirect by source path for a site
    pub async fn find_by_source_path(
        pool: &PgPool,
        site_id: Uuid,
        source_path: &str,
    ) -> Result<Option<Self>, ApiError> {
        let redirect = sqlx::query_as::<_, Self>(
            r#"
            SELECT id, site_id, source_path, destination_path, status_code,
                   is_active, description, created_at, updated_at
            FROM redirects
            WHERE site_id = $1 AND source_path = $2 AND is_active = TRUE
            "#,
        )
        .bind(site_id)
        .bind(source_path)
        .fetch_optional(pool)
        .await?;

        Ok(redirect)
    }

    /// Create a new redirect
    pub async fn create(pool: &PgPool, req: CreateRedirectRequest) -> Result<Self, ApiError> {
        let redirect = sqlx::query_as::<_, Self>(
            r#"
            INSERT INTO redirects (site_id, source_path, destination_path, status_code, is_active, description)
            VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6)
            RETURNING id, site_id, source_path, destination_path, status_code,
                      is_active, description, created_at, updated_at
            "#,
        )
        .bind(req.site_id)
        .bind(&req.source_path)
        .bind(&req.destination_path)
        .bind(req.status_code)
        .bind(req.is_active)
        .bind(&req.description)
        .fetch_one(pool)
        .await?;

        Ok(redirect)
    }

    /// Update a redirect (partial update with COALESCE)
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        req: UpdateRedirectRequest,
    ) -> Result<Self, ApiError> {
        let redirect = sqlx::query_as::<_, Self>(
            r#"
            UPDATE redirects
            SET source_path = COALESCE($2, source_path),
                destination_path = COALESCE($3, destination_path),
                status_code = COALESCE($4, status_code),
                is_active = COALESCE($5, is_active),
                description = COALESCE($6, description),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, site_id, source_path, destination_path, status_code,
                      is_active, description, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&req.source_path)
        .bind(&req.destination_path)
        .bind(req.status_code)
        .bind(req.is_active)
        .bind(&req.description)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            ApiError::not_found(format!("Redirect with ID {} not found", id))
                .with_code(codes::REDIRECT_NOT_FOUND)
        })?;

        Ok(redirect)
    }

    /// Delete a redirect (hard delete)
    pub async fn delete(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
        let result = sqlx::query("DELETE FROM redirects WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(
                ApiError::not_found(format!("Redirect with ID {} not found", id))
                    .with_code(codes::REDIRECT_NOT_FOUND),
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redirect_serialization() {
        let redirect = Redirect {
            id: Uuid::new_v4(),
            site_id: Uuid::new_v4(),
            source_path: "/old-page".to_string(),
            destination_path: "/new-page".to_string(),
            status_code: 301,
            is_active: true,
            description: Some("Moved permanently".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&redirect).unwrap();
        assert!(json.contains("\"source_path\":\"/old-page\""));
        assert!(json.contains("\"status_code\":301"));
    }
}
