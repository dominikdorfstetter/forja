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

use crate::models::federation::activity::ApActivity;
use crate::models::federation::actor::ApActor;
use crate::models::federation::block::ApBlockedInstance;
use crate::models::federation::follower::{self, ApFollower};
use crate::models::federation::note::ApNote;
use crate::models::federation::types::{ApActivityDirection, ApActivityStatus};
use crate::models::site::Site;
use crate::services::federation::queue::DeliveryQueue;
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
                publish_due_notes(&pool).await;
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

/// Find scheduled federation notes that are due and publish + federate them.
async fn publish_due_notes(pool: &PgPool) {
    let notes = match ApNote::find_due_scheduled(pool).await {
        Ok(notes) => notes,
        Err(e) => {
            tracing::warn!("Publish scheduler: failed to query due notes: {e}");
            return;
        }
    };

    if notes.is_empty() {
        return;
    }

    tracing::info!(
        "Publish scheduler: found {} scheduled note(s) due for publishing",
        notes.len()
    );

    for note in &notes {
        // Mark as published
        if let Err(e) = ApNote::mark_published(pool, note.id).await {
            tracing::warn!(
                note_id = %note.id,
                "Publish scheduler: failed to mark note as published: {e}"
            );
            continue;
        }

        // Federate the note — same logic as create_note handler
        if let Err(e) = federate_note(pool, note).await {
            tracing::warn!(
                note_id = %note.id,
                "Publish scheduler: failed to federate scheduled note: {e}"
            );
        }
    }
}

/// Federate a single note (build Create activity and fan out to followers).
async fn federate_note(pool: &PgPool, note: &ApNote) -> Result<(), crate::errors::ApiError> {
    let site = Site::find_by_id(pool, note.site_id).await?;

    let actor = ApActor::find_by_site_id(pool, note.site_id)
        .await?
        .ok_or_else(|| crate::errors::ApiError::internal("No actor for site"))?;

    let domain = Site::resolve_domain(pool, note.site_id).await?;

    let actor_uri = actor.actor_uri(&domain, &site.slug);
    let note_uri = format!("https://{}/ap/{}/notes/{}", domain, site.slug, note.id);
    let followers_url = actor.followers_url.clone();

    let ap_note = serde_json::json!({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Note",
        "id": note_uri,
        "attributedTo": actor_uri,
        "content": note.body_html,
        "published": chrono::Utc::now().to_rfc3339(),
        "to": ["https://www.w3.org/ns/activitystreams#Public"],
        "cc": [followers_url]
    });

    let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());
    let activity_payload = serde_json::json!({
        "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
        "type": "Create",
        "id": activity_uri,
        "actor": actor_uri,
        "object": ap_note,
        "to": ["https://www.w3.org/ns/activitystreams#Public"],
        "cc": [followers_url],
        "published": chrono::Utc::now().to_rfc3339()
    });

    let stored = ApActivity::create(
        pool,
        note.site_id,
        "Create",
        &activity_uri,
        &actor_uri,
        Some(&note_uri),
        Some("Note"),
        &activity_payload,
        ApActivityDirection::Out,
        ApActivityStatus::Pending,
        None,
    )
    .await?;

    ApNote::set_activity_uri(pool, note.id, &note_uri).await?;

    let followers = ApFollower::find_by_actor(pool, actor.id).await?;
    let targets = follower::delivery_targets(&followers);

    let queue = crate::services::federation::queue::CompositeQueue::new(pool.clone(), None);

    for target in &targets {
        if let Some(target_domain) =
            crate::models::federation::block::extract_domain(&target.inbox_uri)
        {
            if ApBlockedInstance::is_instance_blocked(pool, actor.id, &target_domain).await? {
                continue;
            }
        }
        queue.enqueue(stored.id, &target.inbox_uri).await?;
    }

    tracing::info!(
        note_id = %note.id,
        targets = targets.len(),
        "Publish scheduler: federated scheduled note"
    );

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
