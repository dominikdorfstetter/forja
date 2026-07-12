//! Per-site AI usage endpoints — the read side of the `ai_usage_logs` table.
//!
//! `GET  /sites/{site_id}/ai-usage          ` — JSON list + aggregation
//! `GET  /sites/{site_id}/ai-usage/export   ` — CSV export (owner / admin only)
//!
//! See issue #647. Editor / Author can read their own rows only; the filter
//! is applied at the SQL level so 403 hides behind a filtered query rather
//! than a separate code path.

use axum::extract::{Path, Query, State};
use axum::http::HeaderValue;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::Json;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use crate::AppState;
use crate::dto::ai_usage::AiUsageResponse;
use crate::errors::codes;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::actor::Actor;
use crate::models::ai_usage::{AiUsageFilters, AiUsageLog, GroupBy};
use crate::models::site_membership::SiteRole;

/// Cap on the number of raw rows returned in the JSON response. Aggregates
/// see every row regardless; this is just the table preview.
const MAX_RAW_ROWS: i64 = 500;

#[derive(Debug, Deserialize)]
struct AiUsageQuery {
    from: Option<String>,
    to: Option<String>,
    action: Option<String>,
    provider: Option<String>,
    group_by: Option<GroupBy>,
}

/// Roles that can see all rows for a site. Anyone outside this set is
/// silently scoped to their own actor_id.
fn can_see_all(role: SiteRole) -> bool {
    matches!(role, SiteRole::Owner | SiteRole::Admin)
}

/// Roles that may export the CSV. Tighter than read because export is
/// an audit-able operation per the issue's access control table.
fn can_export(role: SiteRole) -> bool {
    matches!(role, SiteRole::Owner | SiteRole::Admin)
}

fn parse_iso(raw: &Option<String>) -> Result<Option<DateTime<Utc>>, ApiError> {
    match raw.as_deref() {
        None => Ok(None),
        Some(s) => DateTime::parse_from_rfc3339(s)
            .map(|dt| Some(dt.with_timezone(&Utc)))
            .map_err(|e| {
                ApiError::bad_request(format!("Invalid ISO-8601 date: {e}"))
                    .with_code(codes::BAD_REQUEST)
            }),
    }
}

async fn role_for(state: &AppState, actor: &Actor, site_id: Uuid) -> Result<SiteRole, ApiError> {
    Ok(actor
        .effective_site_role(&state.db, site_id)
        .await?
        .unwrap_or(SiteRole::Viewer))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/ai-usage",
    tag = "AI",
    operation_id = "list_ai_usage",
    description = "Per-site AI usage log — raw rows + aggregation. Owner/Admin see all rows; \
                   Editor/Author see their own. Viewer/Guest get 403.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("from" = Option<String>, Query, description = "ISO-8601 lower bound for created_at"),
        ("to" = Option<String>, Query, description = "ISO-8601 upper bound for created_at"),
        ("action" = Option<String>, Query, description = "Filter by AiAction name (e.g. seo, translate)"),
        ("provider" = Option<String>, Query, description = "Filter by provider name"),
        ("group_by" = Option<GroupBy>, Query, description = "Aggregate axis: action, provider, or user")
    ),
    responses(
        (status = 200, description = "Usage rows + aggregation", body = AiUsageResponse),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Insufficient role for this site", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn list_ai_usage(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<AiUsageQuery>,
    auth: Actor,
) -> Result<Json<AiUsageResponse>, ApiError> {
    let role = role_for(&state, &auth, site_id).await?;
    if matches!(role, SiteRole::Viewer) {
        return Err(ApiError::forbidden("Viewers cannot read AI usage")
            .with_code(crate::errors::codes::AUTH_INSUFFICIENT_ROLE));
    }

    let own_only = !can_see_all(role);
    let filters = AiUsageFilters {
        from_date: parse_iso(&q.from)?,
        to_date: parse_iso(&q.to)?,
        action: q.action,
        provider: q.provider,
        actor_id: if own_only { Some(auth.id) } else { None },
    };
    let group_by = q.group_by.unwrap_or(GroupBy::Action);

    let items = AiUsageLog::list_for_site(&state.db, site_id, &filters, MAX_RAW_ROWS, 0).await?;
    let buckets = AiUsageLog::aggregate_for_site(&state.db, site_id, group_by, &filters).await?;

    Ok(Json(AiUsageResponse {
        group_by,
        buckets: buckets.into_iter().map(Into::into).collect(),
        items: items.into_iter().map(Into::into).collect(),
        own_only,
    }))
}

#[utoipa::path(
    get,
    path = "/sites/{site_id}/ai-usage/export",
    tag = "AI",
    operation_id = "export_ai_usage_csv",
    description = "Export filtered AI usage rows as CSV. Owner / Admin only.",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("from" = Option<String>, Query, description = "ISO-8601 lower bound"),
        ("to" = Option<String>, Query, description = "ISO-8601 upper bound"),
        ("action" = Option<String>, Query, description = "Filter by AiAction name"),
        ("provider" = Option<String>, Query, description = "Filter by provider name")
    ),
    responses(
        (status = 200, description = "CSV file", content_type = "text/csv"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Insufficient role", body = ProblemDetails)
    ),
    security(("bearer_auth" = []), ("api_key" = []))
)]
async fn export_ai_usage_csv(
    State(state): State<AppState>,
    Path(site_id): Path<Uuid>,
    Query(q): Query<AiUsageQuery>,
    auth: Actor,
) -> Result<([(axum::http::HeaderName, HeaderValue); 2], String), ApiError> {
    let role = role_for(&state, &auth, site_id).await?;
    if !can_export(role) {
        return Err(
            ApiError::forbidden("Only site owners or admins can export AI usage")
                .with_code(crate::errors::codes::AUTH_INSUFFICIENT_ROLE),
        );
    }

    let filters = AiUsageFilters {
        from_date: parse_iso(&q.from)?,
        to_date: parse_iso(&q.to)?,
        action: q.action,
        provider: q.provider,
        actor_id: None,
    };

    // CSV is intended for spreadsheet/billing reconciliation, so we expose
    // the full filtered set rather than the table-preview cap.
    let rows = AiUsageLog::list_for_site(&state.db, site_id, &filters, i64::MAX, 0).await?;
    let csv = rows_to_csv(&rows);

    Ok((
        [
            (
                CONTENT_TYPE,
                HeaderValue::from_static("text/csv; charset=utf-8"),
            ),
            (
                CONTENT_DISPOSITION,
                HeaderValue::from_static("attachment; filename=\"ai-usage.csv\""),
            ),
        ],
        csv,
    ))
}

/// Build the CSV body. Internal-only; pub(crate) so it can be unit tested
/// without spinning up a handler / DB.
pub(crate) fn rows_to_csv(rows: &[AiUsageLog]) -> String {
    let mut out = String::with_capacity(rows.len() * 96 + 80);
    out.push_str(
        "id,site_id,actor_id,action,provider,model,input_tokens,output_tokens,created_at\n",
    );
    for r in rows {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{}\n",
            r.id,
            r.site_id,
            r.actor_id.map(|u| u.to_string()).unwrap_or_default(),
            csv_escape(&r.action),
            csv_escape(&r.provider),
            csv_escape(&r.model),
            r.input_tokens.map(|n| n.to_string()).unwrap_or_default(),
            r.output_tokens.map(|n| n.to_string()).unwrap_or_default(),
            r.created_at.to_rfc3339(),
        ));
    }
    out
}

/// Minimal CSV field escape: wrap in quotes if the value contains `,`, `"`,
/// or a newline; double-escape any internal quotes. Sufficient for the
/// fields we emit (all controlled strings) — not a general-purpose escaper.
fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        let escaped = s.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        s.to_string()
    }
}

/// Re-export the helper consumers compose to mount this router. Matches the
/// shape of every other handler module in `axum_app/handlers/`.
pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_ai_usage))
        .routes(routes!(export_ai_usage_csv))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn row(action: &str, provider: &str) -> AiUsageLog {
        AiUsageLog {
            id: Uuid::nil(),
            site_id: Uuid::nil(),
            actor_id: None,
            action: action.to_string(),
            provider: provider.to_string(),
            model: "gpt-4o".to_string(),
            input_tokens: Some(10),
            output_tokens: Some(20),
            created_at: Utc.with_ymd_and_hms(2026, 5, 13, 12, 0, 0).unwrap(),
        }
    }

    #[test]
    fn csv_header_is_present_with_no_rows() {
        let s = rows_to_csv(&[]);
        assert!(s.starts_with(
            "id,site_id,actor_id,action,provider,model,input_tokens,output_tokens,created_at"
        ));
        assert_eq!(s.lines().count(), 1);
    }

    #[test]
    fn csv_renders_one_row_per_log_plus_header() {
        let s = rows_to_csv(&[row("seo", "openai"), row("translate", "anthropic")]);
        assert_eq!(s.lines().count(), 3);
    }

    #[test]
    fn csv_escapes_commas_and_quotes_in_fields() {
        let mut r = row("custom,with,commas", "ollama");
        r.model = "model \"alpha\"".to_string();
        let s = rows_to_csv(&[r]);
        // commas inside the action field must not split it across columns
        assert!(s.contains("\"custom,with,commas\""));
        // quotes must be doubled
        assert!(s.contains("\"model \"\"alpha\"\"\""));
    }
}
