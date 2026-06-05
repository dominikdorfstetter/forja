//! Form-submission persistence (#620 Slice 2).
//!
//! Owns every SQL query that touches `form_submissions`,
//! `form_submission_status_log`, and `submission_notes`. Slice 2 pulls these
//! out of `models::form_submission` so the model can shrink to pure data
//! structures (Slice 4). The submit orchestrator in
//! `services::form_submission_service` calls `insert_with_unique_code`; admin
//! and self-service handlers call the lookup/mutation functions directly.
//!
//! Reference-code normalization (trim + uppercase + shape check) lives here
//! so callers can hand in raw visitor input without pre-validating.

use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::forms::{
    CreateSubmissionNoteRequest, FormSubmissionStatus, SubmissionDetailResponse,
    SubmissionListItem, SubmissionNoteResponse, SubmissionStatusCounts, SubmissionStatusLogEntry,
};
use crate::errors::{codes, ApiError};
use crate::models::form_submission::FormSubmissionRow;
use crate::utils::list_params::ListParams;
use crate::utils::reference_code;

const MAX_REFCODE_RETRIES: u8 = 3;

// ── Submission persistence (public submit pipeline) ─────────────────────

/// Insert a new submission, retrying on the unique-constraint collision of
/// the reference code (very rare, but the column is the primary external
/// handle and we must not bubble up a 500 to the visitor on a flake).
/// Returns the new row's id and the reference code we successfully reserved.
pub async fn insert_with_unique_code(
    pool: &PgPool,
    form_id: Uuid,
    data: &JsonValue,
    consent_given: bool,
    consent_text: Option<&str>,
    bot_protection_token: Option<&str>,
) -> Result<(Uuid, String), ApiError> {
    let mut attempts: u8 = 0;
    loop {
        attempts += 1;
        let code = reference_code::generate();
        let id = Uuid::new_v4();
        let result = sqlx::query(
            r#"
            INSERT INTO form_submissions
                (id, form_id, reference_code, data, consent_given,
                 consent_text_at_submission, bot_protection_token, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'new')
            "#,
        )
        .bind(id)
        .bind(form_id)
        .bind(&code)
        .bind(data)
        .bind(consent_given)
        .bind(consent_text)
        .bind(bot_protection_token)
        .execute(pool)
        .await;
        match result {
            Ok(_) => return Ok((id, code)),
            Err(e) if is_refcode_unique_violation(&e) => {
                if attempts >= MAX_REFCODE_RETRIES {
                    return Err(ApiError::internal(
                        "Failed to allocate a unique reference code after retries",
                    ));
                }
                continue;
            }
            Err(e) => return Err(e.into()),
        }
    }
}

fn is_refcode_unique_violation(e: &sqlx::Error) -> bool {
    matches!(
        e,
        sqlx::Error::Database(db)
            if db.code().as_deref() == Some("23505")
                && db.constraint() == Some("idx_form_submissions_reference_code")
    )
}

// ── Self-service (#584) ─────────────────────────────────────────────────

/// Minimal lookup: confirms a code exists within the given site without
/// disclosing field data. Returns `(status, created_at)` on a live submission,
/// 410 if already deleted, 404 if the code matches nothing (including
/// cross-tenant probes).
pub async fn lookup_by_reference_code(
    pool: &PgPool,
    code: &str,
    site_id: Uuid,
) -> Result<(String, DateTime<Utc>), ApiError> {
    let code = normalize_reference_code(code)?;
    let row: Option<(String, bool, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT s.status::text, s.is_deleted, s.created_at
          FROM form_submissions s
          JOIN forms f ON f.id = s.form_id
         WHERE s.reference_code = $1
           AND f.site_id = $2
           AND NOT f.is_deleted
        "#,
    )
    .bind(&code)
    .bind(site_id)
    .fetch_optional(pool)
    .await?;
    match row {
        None => Err(ApiError::not_found("Reference code not recognised")
            .with_code(codes::FORM_INVALID_REFERENCE_CODE)),
        Some((_, true, _)) => Err(self_service_gone()),
        Some((status, false, created_at)) => Ok((status, created_at)),
    }
}

/// Full self-service view of a submission by reference code, scoped to the
/// given site. Returns 404 for cross-tenant probes.
pub async fn get_by_reference_code(
    pool: &PgPool,
    code: &str,
    site_id: Uuid,
) -> Result<FormSubmissionRow, ApiError> {
    let code = normalize_reference_code(code)?;
    let row: Option<FormSubmissionRow> = sqlx::query_as(
        r#"
        SELECT s.id, s.form_id, s.reference_code, s.data, s.consent_given,
               s.consent_text_at_submission, s.bot_protection_token,
               s.status::text AS status, s.is_deleted, s.deleted_at,
               s.created_at, s.updated_at
          FROM form_submissions s
          JOIN forms f ON f.id = s.form_id
         WHERE s.reference_code = $1
           AND f.site_id = $2
           AND NOT f.is_deleted
        "#,
    )
    .bind(&code)
    .bind(site_id)
    .fetch_optional(pool)
    .await?;
    match row {
        None => Err(ApiError::not_found("Reference code not recognised")
            .with_code(codes::FORM_INVALID_REFERENCE_CODE)),
        Some(r) if r.is_deleted => Err(self_service_gone()),
        Some(r) => Ok(r),
    }
}

/// Soft-delete a submission via its reference code, scoped to the given site.
/// Idempotent: a second call returns 410 Gone rather than 404. Cross-tenant
/// probes get 404.
pub async fn delete_by_reference_code(
    pool: &PgPool,
    code: &str,
    site_id: Uuid,
) -> Result<(), ApiError> {
    let code = normalize_reference_code(code)?;
    let updated = sqlx::query_scalar::<_, Option<bool>>(
        r#"
        WITH target AS (
          SELECT s.id, s.is_deleted
            FROM form_submissions s
            JOIN forms f ON f.id = s.form_id
           WHERE s.reference_code = $1
             AND f.site_id = $2
             AND NOT f.is_deleted
        )
        UPDATE form_submissions
           SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
          FROM target
         WHERE form_submissions.id = target.id AND NOT target.is_deleted
        RETURNING target.is_deleted
        "#,
    )
    .bind(&code)
    .bind(site_id)
    .fetch_optional(pool)
    .await?;

    match updated {
        Some(Some(false)) => Ok(()),
        None => match sqlx::query_scalar::<_, bool>(
            r#"
            SELECT s.is_deleted
              FROM form_submissions s
              JOIN forms f ON f.id = s.form_id
             WHERE s.reference_code = $1
               AND f.site_id = $2
               AND NOT f.is_deleted
            "#,
        )
        .bind(&code)
        .bind(site_id)
        .fetch_optional(pool)
        .await?
        {
            None => Err(ApiError::not_found("Reference code not recognised")
                .with_code(codes::FORM_INVALID_REFERENCE_CODE)),
            Some(true) => Err(self_service_gone()),
            Some(false) => Err(ApiError::internal("Unexpected delete state")),
        },
        Some(_) => Err(self_service_gone()),
    }
}

// ── Admin: listing & detail ─────────────────────────────────────────────

/// Look up the parent form for a submission, by submission id.
pub async fn find_form_id_by_submission(
    pool: &PgPool,
    submission_id: Uuid,
) -> Result<Uuid, ApiError> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT form_id FROM form_submissions WHERE id = $1 AND NOT is_deleted",
    )
    .bind(submission_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        ApiError::not_found("Submission not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("form_submission")
    })
}

/// List submissions for a form with optional status filter.
pub async fn list_for_form(
    pool: &PgPool,
    form_id: Uuid,
    status: Option<FormSubmissionStatus>,
    params: &ListParams,
) -> Result<(Vec<SubmissionListItem>, i64), ApiError> {
    let (limit, offset) = params.limit_offset();

    let total: i64 = if let Some(s) = status {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM form_submissions
              WHERE form_id = $1 AND status = $2 AND NOT is_deleted",
        )
        .bind(form_id)
        .bind(s)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM form_submissions
              WHERE form_id = $1 AND NOT is_deleted",
        )
        .bind(form_id)
        .fetch_one(pool)
        .await?
    };

    let rows = if let Some(s) = status {
        sqlx::query_as::<_, SubmissionListItem>(
            r#"
            SELECT id, reference_code, status, data, created_at
              FROM form_submissions
             WHERE form_id = $1 AND status = $2 AND NOT is_deleted
             ORDER BY created_at DESC
             LIMIT $3 OFFSET $4
            "#,
        )
        .bind(form_id)
        .bind(s)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, SubmissionListItem>(
            r#"
            SELECT id, reference_code, status, data, created_at
              FROM form_submissions
             WHERE form_id = $1 AND NOT is_deleted
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3
            "#,
        )
        .bind(form_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?
    };

    Ok((rows, total))
}

pub async fn status_counts(
    pool: &PgPool,
    form_id: Uuid,
) -> Result<SubmissionStatusCounts, ApiError> {
    let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
          COUNT(*) FILTER (WHERE status = 'new')        AS new_count,
          COUNT(*) FILTER (WHERE status = 'in_review')  AS in_review_count,
          COUNT(*) FILTER (WHERE status = 'resolved')   AS resolved_count,
          COUNT(*) FILTER (WHERE status = 'rejected')   AS rejected_count,
          COUNT(*) FILTER (WHERE status = 'archived')   AS archived_count
          FROM form_submissions
         WHERE form_id = $1 AND NOT is_deleted
        "#,
    )
    .bind(form_id)
    .fetch_one(pool)
    .await?;
    Ok(SubmissionStatusCounts {
        new: row.0,
        in_review: row.1,
        resolved: row.2,
        rejected: row.3,
        archived: row.4,
    })
}

/// Single submission with its notes and status history.
pub async fn get_detail(
    pool: &PgPool,
    submission_id: Uuid,
) -> Result<SubmissionDetailResponse, ApiError> {
    let core: SubmissionCore = sqlx::query_as(
        r#"
        SELECT id, form_id, reference_code, status, data, consent_given,
               consent_text_at_submission, created_at, updated_at
          FROM form_submissions
         WHERE id = $1 AND NOT is_deleted
        "#,
    )
    .bind(submission_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        ApiError::not_found("Submission not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("form_submission")
    })?;

    let SubmissionCore {
        id,
        form_id,
        reference_code,
        status,
        data,
        consent_given,
        consent_text_at_submission: consent_text,
        created_at: ca,
        updated_at: ua,
    } = core;

    let notes = sqlx::query_as::<_, SubmissionNoteResponse>(
        r#"
        SELECT id, author_id, body, created_at
          FROM submission_notes
         WHERE submission_id = $1
         ORDER BY created_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let status_history = sqlx::query_as::<_, SubmissionStatusLogEntry>(
        r#"
        SELECT from_status, to_status, changed_by, created_at
          FROM form_submission_status_log
         WHERE submission_id = $1
         ORDER BY created_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    Ok(SubmissionDetailResponse {
        id,
        form_id,
        reference_code,
        status,
        data,
        consent_given,
        consent_text_at_submission: consent_text,
        created_at: ca,
        updated_at: ua,
        notes,
        status_history,
    })
}

// ── Admin: mutations ────────────────────────────────────────────────────

/// Change a submission's status with state-machine enforcement and append a
/// row to the status log. Allowed transitions:
///   New      → InReview, Rejected
///   InReview → Resolved, Rejected
///   Resolved → Archived
///   Rejected → Archived
///   Archived → (terminal)
///
/// Archived is the single terminal sink, reachable only after a real outcome
/// (Resolved or Rejected) — there is no longer a direct shortcut from New or
/// InReview to Archived; non-follow-through submissions take the Rejected path.
pub async fn update_status(
    pool: &PgPool,
    submission_id: Uuid,
    next: FormSubmissionStatus,
    actor_clerk_id: Option<&str>,
) -> Result<FormSubmissionStatus, ApiError> {
    let mut tx = pool.begin().await?;
    let current: FormSubmissionStatus = sqlx::query_scalar(
        "SELECT status FROM form_submissions WHERE id = $1 AND NOT is_deleted FOR UPDATE",
    )
    .bind(submission_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        ApiError::not_found("Submission not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("form_submission")
    })?;

    if !is_valid_transition(current, next) {
        return Err(ApiError::bad_request(format!(
            "Cannot transition from {:?} to {:?}",
            current, next
        ))
        .with_code(codes::FORM_INVALID_STATUS_TRANSITION));
    }

    sqlx::query("UPDATE form_submissions SET status = $2, updated_at = NOW() WHERE id = $1")
        .bind(submission_id)
        .bind(next)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO form_submission_status_log
            (submission_id, from_status, to_status, changed_by)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(submission_id)
    .bind(current)
    .bind(next)
    .bind(actor_clerk_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(next)
}

pub async fn soft_delete(pool: &PgPool, submission_id: Uuid) -> Result<(), ApiError> {
    let result = sqlx::query(
        "UPDATE form_submissions
            SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND NOT is_deleted",
    )
    .bind(submission_id)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Submission not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("form_submission"));
    }
    Ok(())
}

pub async fn add_note(
    pool: &PgPool,
    submission_id: Uuid,
    author_clerk_id: Option<&str>,
    req: CreateSubmissionNoteRequest,
) -> Result<SubmissionNoteResponse, ApiError> {
    let _ = find_form_id_by_submission(pool, submission_id).await?;
    let row = sqlx::query_as::<_, SubmissionNoteResponse>(
        r#"
        INSERT INTO submission_notes (submission_id, author_id, body)
        VALUES ($1, $2, $3)
        RETURNING id, author_id, body, created_at
        "#,
    )
    .bind(submission_id)
    .bind(author_clerk_id)
    .bind(&req.body)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn delete_note(
    pool: &PgPool,
    submission_id: Uuid,
    note_id: Uuid,
) -> Result<(), ApiError> {
    let result = sqlx::query("DELETE FROM submission_notes WHERE id = $1 AND submission_id = $2")
        .bind(note_id)
        .bind(submission_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Note not found"));
    }
    Ok(())
}

// ── Internal helpers ────────────────────────────────────────────────────

/// Projection used by `get_detail` — only the fields it consumes, dropping
/// the soft-delete columns and bot_protection_token that the response
/// doesn't expose.
#[derive(sqlx::FromRow)]
struct SubmissionCore {
    id: Uuid,
    form_id: Uuid,
    reference_code: String,
    status: FormSubmissionStatus,
    data: JsonValue,
    consent_given: bool,
    consent_text_at_submission: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

fn is_valid_transition(from: FormSubmissionStatus, to: FormSubmissionStatus) -> bool {
    use FormSubmissionStatus::*;
    matches!(
        (from, to),
        (New, InReview)
            | (New, Rejected)
            | (InReview, Resolved)
            | (InReview, Rejected)
            | (Resolved, Archived)
            | (Rejected, Archived)
    )
}

fn self_service_gone() -> ApiError {
    // 410 Gone — preferred over 404 so visitors who already deleted know
    // their action took effect (and don't retry under the assumption it
    // didn't). Per the #584 spec.
    ApiError::gone("Submission has been deleted").with_code(codes::FORM_SUBMISSION_DELETED)
}

/// Trim, uppercase, and syntactically validate a reference code before any
/// DB lookup. Reference codes are minted uppercase against a fixed alphabet,
/// so an input that doesn't match the shape can never correspond to a stored
/// row — short-circuiting here avoids a DB roundtrip per malformed probe and
/// keeps the lookup endpoint from becoming a "is this string anything?"
/// oracle for any-shape attacker input.
pub(crate) fn normalize_reference_code(code: &str) -> Result<String, ApiError> {
    let normalized = code.trim().to_ascii_uppercase();
    if !reference_code::is_well_formed(&normalized) {
        return Err(ApiError::not_found("Reference code not recognised")
            .with_code(codes::FORM_INVALID_REFERENCE_CODE));
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::reference_code;

    #[test]
    fn normalize_reference_code_accepts_well_formed() {
        let code = reference_code::generate();
        let normalized = normalize_reference_code(&code).expect("generated code is well-formed");
        assert_eq!(normalized, code);
    }

    #[test]
    fn normalize_reference_code_uppercases_lowercase_input() {
        let normalized =
            normalize_reference_code("abcd-efgh-jklm").expect("lowercase well-formed after upper");
        assert_eq!(normalized, "ABCD-EFGH-JKLM");
    }

    #[test]
    fn normalize_reference_code_trims_surrounding_whitespace() {
        let normalized = normalize_reference_code("  ABCD-EFGH-JKLM  \n").expect("trims");
        assert_eq!(normalized, "ABCD-EFGH-JKLM");
    }

    #[test]
    fn normalize_reference_code_rejects_malformed_without_db() {
        for bad in [
            "!!garbage!!",
            "ABCD-EFGH",
            "AAAA-BBBB-CCCC-DDDD",
            "ABCD-EFGH-IJKL", // 'I' is excluded from alphabet
            "1111-1111-1111", // '1' is excluded
        ] {
            let err = normalize_reference_code(bad).expect_err(bad);
            assert_eq!(err.status().as_u16(), 404, "expected 404 for {bad}");
        }
    }
}
