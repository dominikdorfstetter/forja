//! Publish scheduler fairing.
//!
//! Spawns a Tokio task on liftoff that periodically checks for scheduled
//! content whose `publish_start` timestamp has passed and auto-publishes it.

use sqlx::PgPool;
use uuid::Uuid;

use crate::AppState;
use crate::services::publish_hooks;
use crate::services::worker_lock;

/// How often the scheduler polls for due content (seconds).
const POLL_INTERVAL_SECS: u64 = 60;

/// Row shape returned by the scheduled content query.
#[derive(sqlx::FromRow)]
struct ScheduledContentRow {
    content_id: Uuid,
    entity_type_name: String,
    entity_id: Uuid,
    site_id: Uuid,
}

/// Rocket fairing that spawns the publish scheduler on liftoff.
pub struct PublishScheduler;

impl PublishScheduler {
    /// Framework-agnostic spawn — called by the Rocket fairing below and
    /// directly from `axum_app::spawn_background_workers` post-cutover.
    pub fn spawn(state: AppState) {
        let pool = state.db.clone();
        tracing::info!(
            worker = "publish_scheduler",
            poll_seconds = POLL_INTERVAL_SECS,
            "worker starting"
        );
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));
            loop {
                interval.tick().await;
                worker_lock::run_if_leader(&pool, "publish_scheduler", || async {
                    publish_due_content(&pool).await;
                    archive_expired_content(&pool).await;
                })
                .await;
            }
        });
    }
}

/// Find all scheduled content that is due and publish it.
#[tracing::instrument(name = "publish_scheduler_publish_due", skip_all)]
async fn publish_due_content(pool: &PgPool) {
    let rows = match fetch_due_content(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!(worker = "publish_scheduler", phase = "due_query", error = %e, "query failed");
            return;
        }
    };

    if rows.is_empty() {
        return;
    }

    tracing::info!(
        "Publish scheduler: found {} scheduled item(s) due for publishing",
        rows.len()
    );

    let mut published_count = 0u64;

    // The due query returns one row per (content, site). Group by content so the
    // status transition happens exactly once per content item (the redundant
    // per-row UPDATE is the bug). Publish side-effects then fan out once per site:
    // each site's webhook subscribers and audit trail are independent, so a
    // multi-site item legitimately notifies every site it belongs to.
    for group in group_due_by_content(&rows) {
        // Transition: scheduled -> published (once per content).
        if let Err(e) = mark_as_published(pool, group.content_id).await {
            tracing::warn!(
                content_id = %group.content_id,
                "Publish scheduler: failed to update content status: {e}"
            );
            continue;
        }

        // Fire side effects (webhook, audit) once per site.
        let webhook_event = format!("{}.published", group.entity_type_name);
        for site_id in &group.site_ids {
            publish_hooks::on_content_published(
                pool,
                group.content_id,
                *site_id,
                &group.entity_type_name,
                &webhook_event,
                group.entity_id,
                None, // system action — no user
                Some("auto-published by scheduler"),
            )
            .await;
        }

        published_count += 1;
    }

    if published_count > 0 {
        tracing::info!(
            "Publish scheduler: auto-published {} item(s)",
            published_count
        );
    }
}

/// One content item due for publishing, with every site it belongs to.
struct DueContent {
    content_id: Uuid,
    entity_type_name: String,
    entity_id: Uuid,
    site_ids: Vec<Uuid>,
}

/// Collapse the one-row-per-(content, site) query result into one entry per
/// content, preserving first-seen order and collecting all of its site ids.
fn group_due_by_content(rows: &[ScheduledContentRow]) -> Vec<DueContent> {
    let mut order: Vec<Uuid> = Vec::new();
    let mut by_id: std::collections::HashMap<Uuid, DueContent> = std::collections::HashMap::new();
    for row in rows {
        let entry = by_id.entry(row.content_id).or_insert_with(|| {
            order.push(row.content_id);
            DueContent {
                content_id: row.content_id,
                entity_type_name: row.entity_type_name.clone(),
                entity_id: row.entity_id,
                site_ids: Vec::new(),
            }
        });
        entry.site_ids.push(row.site_id);
    }
    order
        .into_iter()
        .map(|id| by_id.remove(&id).expect("id was just inserted"))
        .collect()
}

/// Query all content that is scheduled and whose publish_start is in the past.
///
/// Joins through the entity type table and the appropriate entity table
/// (blogs or pages) to resolve the entity_id and site_id.
async fn fetch_due_content(pool: &PgPool) -> Result<Vec<ScheduledContentRow>, sqlx::Error> {
    // Union blogs and pages to cover all content types with scheduling support.
    // Each branch joins contents -> entity_types -> (blogs|pages) -> content_sites
    // to get the entity_id and one site_id per content item.
    let rows = sqlx::query_as::<_, ScheduledContentRow>(
        r#"
        SELECT
            c.id AS content_id,
            et.name AS entity_type_name,
            b.id AS entity_id,
            cs.site_id
        FROM contents c
        INNER JOIN entity_types et ON c.entity_type_id = et.id
        INNER JOIN blogs b ON b.content_id = c.id
        INNER JOIN content_sites cs ON c.id = cs.content_id
        WHERE c.status = 'scheduled'
          AND c.publish_start <= NOW()
          AND c.is_deleted = FALSE

        UNION ALL

        SELECT
            c.id AS content_id,
            et.name AS entity_type_name,
            p.id AS entity_id,
            cs.site_id
        FROM contents c
        INNER JOIN entity_types et ON c.entity_type_id = et.id
        INNER JOIN pages p ON p.content_id = c.id
        INNER JOIN content_sites cs ON c.id = cs.content_id
        WHERE c.status = 'scheduled'
          AND c.publish_start <= NOW()
          AND c.is_deleted = FALSE
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Find all published content whose publish_end has passed and archive it.
#[tracing::instrument(name = "publish_scheduler_archive_expired", skip_all)]
async fn archive_expired_content(pool: &PgPool) {
    let rows = match fetch_expired_content(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!(worker = "publish_scheduler", phase = "expired_query", error = %e, "query failed");
            return;
        }
    };

    if rows.is_empty() {
        return;
    }

    tracing::info!(
        "Publish scheduler: found {} published item(s) past publish_end",
        rows.len()
    );

    let mut archived_count = 0u64;

    for row in &rows {
        if let Err(e) = mark_as_archived(pool, row.content_id).await {
            tracing::warn!(
                content_id = %row.content_id,
                "Publish scheduler: failed to archive expired content: {e}"
            );
            continue;
        }

        // Fire side effects (webhook, audit)
        crate::services::audit_service::log_action(
            pool,
            Some(row.site_id),
            None, // system action
            crate::models::audit::AuditAction::Archive,
            &row.entity_type_name,
            row.entity_id,
            Some(serde_json::json!({"reason": "auto-archived: publish_end reached"})),
        )
        .await;

        let payload = serde_json::json!({"reason": "publish_end reached"});
        crate::services::webhook_service::dispatch(
            pool,
            row.site_id,
            &format!("{}.archived", row.entity_type_name),
            row.entity_id,
            &payload,
        )
        .await;

        archived_count += 1;
    }

    if archived_count > 0 {
        tracing::info!(
            "Publish scheduler: auto-archived {} item(s)",
            archived_count
        );
    }
}

/// Query all published content whose publish_end is in the past.
async fn fetch_expired_content(pool: &PgPool) -> Result<Vec<ScheduledContentRow>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ScheduledContentRow>(
        r#"
        SELECT
            c.id AS content_id,
            et.name AS entity_type_name,
            b.id AS entity_id,
            cs.site_id
        FROM contents c
        INNER JOIN entity_types et ON c.entity_type_id = et.id
        INNER JOIN blogs b ON b.content_id = c.id
        INNER JOIN content_sites cs ON c.id = cs.content_id
        WHERE c.status = 'published'
          AND c.publish_end IS NOT NULL
          AND c.publish_end <= NOW()
          AND c.is_deleted = FALSE

        UNION ALL

        SELECT
            c.id AS content_id,
            et.name AS entity_type_name,
            p.id AS entity_id,
            cs.site_id
        FROM contents c
        INNER JOIN entity_types et ON c.entity_type_id = et.id
        INNER JOIN pages p ON p.content_id = c.id
        INNER JOIN content_sites cs ON c.id = cs.content_id
        WHERE c.status = 'published'
          AND c.publish_end IS NOT NULL
          AND c.publish_end <= NOW()
          AND c.is_deleted = FALSE
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Update a content record from published to archived.
async fn mark_as_archived(pool: &PgPool, content_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE contents
        SET status = 'archived',
            updated_at = NOW()
        WHERE id = $1
          AND status = 'published'
          AND is_deleted = FALSE
        "#,
    )
    .bind(content_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Update a content record from scheduled to published.
async fn mark_as_published(pool: &PgPool, content_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE contents
        SET status = 'published',
            published_at = COALESCE(published_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
          AND status = 'scheduled'
          AND is_deleted = FALSE
        "#,
    )
    .bind(content_id)
    .execute(pool)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(content_id: Uuid, site_id: Uuid) -> ScheduledContentRow {
        ScheduledContentRow {
            content_id,
            entity_type_name: "blog".to_string(),
            entity_id: Uuid::new_v4(),
            site_id,
        }
    }

    #[test]
    fn group_collapses_multi_site_content_to_one_entry_with_all_sites() {
        // Tracer: one content scheduled to 2 sites yields ONE group (one status
        // transition) carrying both site ids (one side-effect per site).
        let content = Uuid::new_v4();
        let site_a = Uuid::new_v4();
        let site_b = Uuid::new_v4();
        let groups = group_due_by_content(&[row(content, site_a), row(content, site_b)]);

        assert_eq!(groups.len(), 1, "one transition per content");
        assert_eq!(groups[0].content_id, content);
        assert_eq!(groups[0].site_ids, vec![site_a, site_b]);
    }

    #[test]
    fn group_keeps_distinct_content_separate_in_first_seen_order() {
        let c1 = Uuid::new_v4();
        let c2 = Uuid::new_v4();
        let s = Uuid::new_v4();
        let groups = group_due_by_content(&[row(c1, s), row(c2, s), row(c1, Uuid::new_v4())]);

        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].content_id, c1);
        assert_eq!(groups[0].site_ids.len(), 2);
        assert_eq!(groups[1].content_id, c2);
    }
}
