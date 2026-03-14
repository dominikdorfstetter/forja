//! Outbound delivery service for ActivityPub federation.
//!
//! Handles Create, Update, and Delete flows when blog posts are
//! published, edited, or removed.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::federation::activitypub::{ap_context, as_context, Activity, Article};
use crate::errors::ApiError;
use crate::guards::federation_guard::can_publish_to_fediverse;
use crate::models::federation::activity::ApActivity;
use crate::models::federation::actor::ApActor;
use crate::models::federation::block::ApBlockedInstance;
use crate::models::federation::follower::{self, ApFollower};
use crate::models::federation::types::{ApActivityDirection, ApActivityStatus};
use crate::models::site_membership::SiteRole;
use crate::models::site_settings::SiteSetting;
use crate::services::federation::queue::DeliveryQueue;

/// Triggered when a blog post is published.
///
/// Builds an Article, wraps it in a Create activity, stores it, and
/// enqueues delivery to all followers (deduplicating shared inboxes).
pub async fn handle_post_published(
    pool: &PgPool,
    queue: &dyn DeliveryQueue,
    site_id: Uuid,
    content_id: Uuid,
    user_role: &SiteRole,
    domain: &str,
) -> Result<(), ApiError> {
    // 1. Check federation enabled
    let fed_enabled = SiteSetting::get_value(pool, site_id, "module_federation_enabled").await?;
    if !fed_enabled.as_bool().unwrap_or(false) {
        return Ok(()); // Silently skip — federation not enabled
    }

    // 2. RBAC check
    if !can_publish_to_fediverse(user_role) {
        tracing::debug!(
            role = ?user_role,
            "Delivery: user role cannot publish to fediverse"
        );
        return Ok(());
    }

    // 3. Get actor
    let actor = ApActor::find_by_site_id(pool, site_id)
        .await?
        .ok_or_else(|| ApiError::internal("No actor configured for federated site"))?;

    // 4. Fetch blog post data
    let post = fetch_blog_post_data(pool, content_id).await?;

    // 5. Get the site slug
    let site_slug: String = sqlx::query_scalar("SELECT slug FROM sites WHERE id = $1")
        .bind(site_id)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to fetch site slug: {e}")))?;

    let actor_uri = actor.actor_uri(domain, &site_slug);
    let article_uri = format!("https://{}/blog/{}", domain, post.slug);

    // 6. Build Article
    let article = Article {
        context: Some(as_context()),
        id: article_uri.clone(),
        object_type: "Article".to_string(),
        attributed_to: actor_uri.clone(),
        name: post.title.clone(),
        content: post.body_html.clone(),
        summary: post.excerpt.clone(),
        url: article_uri.clone(),
        published: post.published_at.clone(),
        updated: None,
        to: Some(vec![
            "https://www.w3.org/ns/activitystreams#Public".to_string()
        ]),
        cc: Some(vec![format!(
            "https://{}/ap/actor/{}/followers",
            domain, site_slug
        )]),
    };

    // 7. Wrap in Create activity
    let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());
    let activity = Activity {
        context: ap_context(),
        id: activity_uri.clone(),
        activity_type: "Create".to_string(),
        actor: actor_uri.clone(),
        object: serde_json::to_value(&article)
            .map_err(|e| ApiError::internal(format!("Failed to serialize article: {e}")))?,
        to: article.to.clone(),
        cc: article.cc.clone(),
        published: Some(post.published_at.clone()),
    };

    let payload = serde_json::to_value(&activity)
        .map_err(|e| ApiError::internal(format!("Failed to serialize activity: {e}")))?;

    // 8. Store in ap_activities
    let stored = ApActivity::create(
        pool,
        site_id,
        "Create",
        &activity_uri,
        &actor_uri,
        Some(&article_uri),
        Some("Article"),
        &payload,
        ApActivityDirection::Out,
        ApActivityStatus::Pending,
        Some(content_id),
    )
    .await?;

    // 9. Get followers and compute delivery targets
    let followers = ApFollower::find_by_actor(pool, actor.id).await?;
    let targets = follower::delivery_targets(&followers);

    // 10. Filter out blocked instances
    let mut delivery_uris = Vec::new();
    for target in &targets {
        if let Some(target_domain) =
            crate::models::federation::block::extract_domain(&target.inbox_uri)
        {
            if ApBlockedInstance::is_instance_blocked(pool, actor.id, &target_domain).await? {
                continue;
            }
        }
        delivery_uris.push(target.inbox_uri.clone());
    }

    // 11. Enqueue delivery jobs
    for inbox_uri in &delivery_uris {
        queue.enqueue(stored.id, inbox_uri).await?;
    }

    tracing::info!(
        content_id = %content_id,
        targets = delivery_uris.len(),
        "Delivery: enqueued Create activity"
    );

    Ok(())
}

/// Triggered when a previously federated blog post is edited.
///
/// Only sends an Update if the post was previously federated
/// (i.e., has an outbound Create activity).
pub async fn handle_post_updated(
    pool: &PgPool,
    queue: &dyn DeliveryQueue,
    site_id: Uuid,
    content_id: Uuid,
    user_role: &SiteRole,
    domain: &str,
) -> Result<(), ApiError> {
    // Check federation enabled
    let fed_enabled = SiteSetting::get_value(pool, site_id, "module_federation_enabled").await?;
    if !fed_enabled.as_bool().unwrap_or(false) {
        return Ok(());
    }

    // RBAC check
    if !can_publish_to_fediverse(user_role) {
        return Ok(());
    }

    // Only if post was previously federated
    let existing = ApActivity::find_outbound_for_content(pool, content_id).await?;
    if existing.is_none() {
        return Ok(()); // Never federated — skip
    }

    // Get actor
    let actor = ApActor::find_by_site_id(pool, site_id)
        .await?
        .ok_or_else(|| ApiError::internal("No actor configured for federated site"))?;

    let post = fetch_blog_post_data(pool, content_id).await?;

    let site_slug: String = sqlx::query_scalar("SELECT slug FROM sites WHERE id = $1")
        .bind(site_id)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to fetch site slug: {e}")))?;

    let actor_uri = actor.actor_uri(domain, &site_slug);
    let article_uri = format!("https://{}/blog/{}", domain, post.slug);

    // Build updated Article
    let article = Article {
        context: Some(as_context()),
        id: article_uri.clone(),
        object_type: "Article".to_string(),
        attributed_to: actor_uri.clone(),
        name: post.title.clone(),
        content: post.body_html.clone(),
        summary: post.excerpt.clone(),
        url: article_uri.clone(),
        published: post.published_at.clone(),
        updated: Some(chrono::Utc::now().to_rfc3339()),
        to: Some(vec![
            "https://www.w3.org/ns/activitystreams#Public".to_string()
        ]),
        cc: Some(vec![format!(
            "https://{}/ap/actor/{}/followers",
            domain, site_slug
        )]),
    };

    let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());
    let activity = Activity {
        context: ap_context(),
        id: activity_uri.clone(),
        activity_type: "Update".to_string(),
        actor: actor_uri.clone(),
        object: serde_json::to_value(&article)
            .map_err(|e| ApiError::internal(format!("Failed to serialize article: {e}")))?,
        to: article.to.clone(),
        cc: article.cc.clone(),
        published: Some(chrono::Utc::now().to_rfc3339()),
    };

    let payload = serde_json::to_value(&activity)
        .map_err(|e| ApiError::internal(format!("Failed to serialize activity: {e}")))?;

    let stored = ApActivity::create(
        pool,
        site_id,
        "Update",
        &activity_uri,
        &actor_uri,
        Some(&article_uri),
        Some("Article"),
        &payload,
        ApActivityDirection::Out,
        ApActivityStatus::Pending,
        Some(content_id),
    )
    .await?;

    // Deliver to followers
    let followers = ApFollower::find_by_actor(pool, actor.id).await?;
    let targets = follower::delivery_targets(&followers);

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
        content_id = %content_id,
        "Delivery: enqueued Update activity"
    );

    Ok(())
}

/// Triggered when a previously federated post is unpublished or deleted.
///
/// No RBAC check -- retracting content is always allowed.
/// Only sends a Delete if the post was previously federated.
pub async fn handle_post_deleted(
    pool: &PgPool,
    queue: &dyn DeliveryQueue,
    site_id: Uuid,
    content_id: Uuid,
    domain: &str,
) -> Result<(), ApiError> {
    // Check federation enabled
    let fed_enabled = SiteSetting::get_value(pool, site_id, "module_federation_enabled").await?;
    if !fed_enabled.as_bool().unwrap_or(false) {
        return Ok(());
    }

    // Only if post was previously federated
    let existing = ApActivity::find_outbound_for_content(pool, content_id).await?;
    let existing = match existing {
        Some(e) => e,
        None => return Ok(()), // Never federated — skip
    };

    let actor = ApActor::find_by_site_id(pool, site_id)
        .await?
        .ok_or_else(|| ApiError::internal("No actor configured for federated site"))?;

    let site_slug: String = sqlx::query_scalar("SELECT slug FROM sites WHERE id = $1")
        .bind(site_id)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to fetch site slug: {e}")))?;

    let actor_uri = actor.actor_uri(domain, &site_slug);

    // The object of the Delete is the original object URI
    let object_uri = existing
        .object_uri
        .unwrap_or_else(|| format!("https://{}/blog/deleted-{}", domain, content_id));

    let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());
    let activity = Activity {
        context: ap_context(),
        id: activity_uri.clone(),
        activity_type: "Delete".to_string(),
        actor: actor_uri.clone(),
        object: serde_json::json!(object_uri),
        to: Some(vec![
            "https://www.w3.org/ns/activitystreams#Public".to_string()
        ]),
        cc: Some(vec![format!(
            "https://{}/ap/actor/{}/followers",
            domain, site_slug
        )]),
        published: Some(chrono::Utc::now().to_rfc3339()),
    };

    let payload = serde_json::to_value(&activity)
        .map_err(|e| ApiError::internal(format!("Failed to serialize activity: {e}")))?;

    let stored = ApActivity::create(
        pool,
        site_id,
        "Delete",
        &activity_uri,
        &actor_uri,
        Some(&object_uri),
        None,
        &payload,
        ApActivityDirection::Out,
        ApActivityStatus::Pending,
        Some(content_id),
    )
    .await?;

    // Deliver to followers
    let followers = ApFollower::find_by_actor(pool, actor.id).await?;
    let targets = follower::delivery_targets(&followers);

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
        content_id = %content_id,
        "Delivery: enqueued Delete activity"
    );

    Ok(())
}

/// Minimal blog post data needed to build an Article.
struct BlogPostData {
    slug: String,
    title: String,
    body_html: String,
    excerpt: Option<String>,
    published_at: String,
}

/// Raw row shape returned by the blog post query.
#[derive(sqlx::FromRow)]
struct BlogPostRow {
    slug: String,
    title: String,
    body: Option<String>,
    excerpt: Option<String>,
    published_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Fetch the data needed to build an Article from a content ID.
async fn fetch_blog_post_data(pool: &PgPool, content_id: Uuid) -> Result<BlogPostData, ApiError> {
    // Join content, blog, and the primary localization to get title + body
    let row: Option<BlogPostRow> = sqlx::query_as(
        r#"
            SELECT
                COALESCE(c.slug, b.id::text) as slug,
                COALESCE(cl.title, '') as title,
                cl.body,
                cl.excerpt,
                c.published_at
            FROM content c
            JOIN blogs b ON b.content_id = c.id
            LEFT JOIN content_localizations cl ON cl.content_id = c.id
            WHERE c.id = $1
            ORDER BY cl.created_at ASC
            LIMIT 1
            "#,
    )
    .bind(content_id)
    .fetch_optional(pool)
    .await?;

    let row = row.ok_or_else(|| ApiError::not_found(format!("Content {content_id} not found")))?;

    Ok(BlogPostData {
        slug: row.slug,
        title: row.title,
        body_html: row.body.unwrap_or_default(),
        excerpt: row.excerpt,
        published_at: row
            .published_at
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_blog_post_data_defaults() {
        // Basic struct construction test
        let data = super::BlogPostData {
            slug: "test".to_string(),
            title: "Test".to_string(),
            body_html: "<p>Hello</p>".to_string(),
            excerpt: None,
            published_at: "2026-03-14T12:00:00Z".to_string(),
        };
        assert_eq!(data.slug, "test");
        assert!(data.excerpt.is_none());
    }
}
