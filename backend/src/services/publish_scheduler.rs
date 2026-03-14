//! Publish scheduler fairing.
//!
//! Spawns a Tokio task on liftoff that periodically checks for scheduled
//! content whose `publish_start` timestamp has passed and auto-publishes it.
//!
//! Uses the same fairing pattern as `FederationWorker` — `Kind::Liftoff`,
//! tokio::spawn, interval-based polling.

use rocket::fairing::{Fairing, Info, Kind};
use rocket::{Orbit, Rocket};
use sqlx::PgPool;
use uuid::Uuid;

use crate::services::publish_hooks;
use crate::AppState;

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

#[rocket::async_trait]
impl Fairing for PublishScheduler {
    fn info(&self) -> Info {
        Info {
            name: "Publish Scheduler",
            kind: Kind::Liftoff,
        }
    }

    async fn on_liftoff(&self, rocket: &Rocket<Orbit>) {
        let state = match rocket.state::<AppState>() {
            Some(s) => s.clone(),
            None => {
                tracing::error!("PublishScheduler: AppState not found in managed state");
                return;
            }
        };

        let pool = state.db.clone();

        tracing::info!("Publish scheduler starting (poll={}s)", POLL_INTERVAL_SECS,);

        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(POLL_INTERVAL_SECS));

            loop {
                interval.tick().await;
                publish_due_content(&pool).await;
            }
        });
    }
}

/// Find all scheduled content that is due and publish it.
async fn publish_due_content(pool: &PgPool) {
    let rows = match fetch_due_content(pool).await {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("Publish scheduler: failed to query due content: {e}");
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

    for row in &rows {
        // Transition: scheduled -> published
        if let Err(e) = mark_as_published(pool, row.content_id).await {
            tracing::warn!(
                content_id = %row.content_id,
                "Publish scheduler: failed to update content status: {e}"
            );
            continue;
        }

        // Fire side effects (webhook, federation, audit)
        publish_hooks::on_content_published(
            pool,
            row.content_id,
            row.site_id,
            &row.entity_type_name,
            row.entity_id,
            None, // system action — no user
            Some("auto-published by scheduler"),
        )
        .await;

        published_count += 1;
    }

    if published_count > 0 {
        tracing::info!(
            "Publish scheduler: auto-published {} item(s)",
            published_count
        );
    }
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
