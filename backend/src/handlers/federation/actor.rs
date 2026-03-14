//! ActivityPub actor profile, outbox, and followers endpoints

use rocket::serde::json::Json;
use rocket::{Route, State};

use crate::dto::federation::activitypub::{
    ap_context, as_context, ActivityPubActor, ActorEndpoints, ActorPublicKey, OrderedCollection,
    OrderedCollectionPage,
};
use crate::errors::ApiError;
use crate::models::federation::actor::ApActor;
use crate::models::federation::featured::ApFeaturedPost;
use crate::models::federation::follower::ApFollower;
use crate::models::site::Site;
use crate::models::site_settings::SiteSetting;
use crate::AppState;

/// Resolve site + actor from a slug, verifying federation is enabled.
async fn resolve_actor(
    state: &AppState,
    site_slug: &str,
) -> Result<(Site, ApActor, String), ApiError> {
    let site = Site::find_by_slug(&state.db, site_slug).await?;

    let fed_enabled =
        SiteSetting::get_value(&state.db, site.id, "module_federation_enabled").await?;
    if !fed_enabled.as_bool().unwrap_or(false) {
        return Err(ApiError::not_found(
            "Federation is not enabled for this site",
        ));
    }

    let actor = ApActor::find_by_site_id(&state.db, site.id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor for this site"))?;

    // Look up the primary production domain for this site
    let domain: String = sqlx::query_scalar(
        "SELECT domain FROM site_domains WHERE site_id = $1 AND is_primary = TRUE AND environment = 'production' LIMIT 1"
    )
    .bind(site.id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or_else(|| "localhost".to_string());

    Ok((site, actor, domain))
}

/// ActivityPub actor profile
///
/// Returns the JSON-LD actor document with public key and endpoints.
#[get("/ap/actor/<site_slug>", format = "application/activity+json")]
pub async fn actor_profile(
    state: &State<AppState>,
    site_slug: &str,
) -> Result<Json<ActivityPubActor>, ApiError> {
    let (site, actor, domain) = resolve_actor(state.inner(), site_slug).await?;

    let actor_uri = actor.actor_uri(&domain, &site.slug);
    let base = format!("https://{}/ap/{}", domain, site.slug);

    let ap_actor = ActivityPubActor {
        context: ap_context(),
        id: actor_uri.clone(),
        actor_type: "Person".to_string(),
        preferred_username: actor.preferred_username.clone(),
        name: actor.display_name.clone(),
        summary: actor.summary.clone(),
        inbox: format!("{}/inbox", base),
        outbox: format!("{}/outbox", base),
        followers: format!("{}/followers", base),
        featured: Some(format!(
            "https://{}/ap/actor/{}/featured",
            domain, site.slug
        )),
        url: Some(format!("https://{}", domain)),
        public_key: ActorPublicKey {
            id: format!("{}#main-key", actor_uri),
            owner: actor_uri.clone(),
            public_key_pem: actor.rsa_public_key.clone(),
        },
        icon: None,
        image: None,
        endpoints: Some(ActorEndpoints {
            shared_inbox: Some(format!("https://{}/ap/inbox", domain)),
        }),
    };

    Ok(Json(ap_actor))
}

/// Actor outbox (ordered collection of published content)
#[get("/ap/actor/<site_slug>/outbox")]
pub async fn actor_outbox(
    state: &State<AppState>,
    site_slug: &str,
) -> Result<Json<OrderedCollection>, ApiError> {
    let (site, _actor, domain) = resolve_actor(state.inner(), site_slug).await?;

    // Count published blog posts for this site
    let total: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM blogs b
        JOIN contents c ON b.content_id = c.id
        JOIN content_sites cs ON c.id = cs.content_id
        WHERE cs.site_id = $1
          AND c.status = 'published'
          AND c.is_deleted = FALSE
        "#,
    )
    .bind(site.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));
    let total = total.0;

    let outbox_uri = format!("https://{}/ap/actor/{}/outbox", domain, site.slug);

    let collection = OrderedCollection {
        context: as_context(),
        id: outbox_uri.clone(),
        collection_type: "OrderedCollection".to_string(),
        total_items: total as u64,
        first: if total > 0 {
            Some(format!("{}?page=1", outbox_uri))
        } else {
            None
        },
        last: None,
    };

    Ok(Json(collection))
}

/// Actor followers collection (privacy-preserving: total count only)
#[get("/ap/actor/<site_slug>/followers")]
pub async fn actor_followers(
    state: &State<AppState>,
    site_slug: &str,
) -> Result<Json<OrderedCollection>, ApiError> {
    let (site, actor, domain) = resolve_actor(state.inner(), site_slug).await?;

    let total = ApFollower::count_by_actor(&state.db, actor.id).await?;

    let followers_uri = format!("https://{}/ap/actor/{}/followers", domain, site.slug);

    let collection = OrderedCollection {
        context: as_context(),
        id: followers_uri,
        collection_type: "OrderedCollection".to_string(),
        total_items: total as u64,
        first: None, // No pages — privacy: don't expose follower list
        last: None,
    };

    Ok(Json(collection))
}

/// Actor featured collection (pinned posts as Article objects)
#[get("/ap/actor/<site_slug>/featured")]
pub async fn actor_featured(
    state: &State<AppState>,
    site_slug: &str,
) -> Result<Json<OrderedCollectionPage>, ApiError> {
    let (site, actor, domain) = resolve_actor(state.inner(), site_slug).await?;

    let featured = ApFeaturedPost::list_by_actor(&state.db, actor.id).await?;
    let actor_uri = actor.actor_uri(&domain, &site.slug);

    let mut items = Vec::new();
    for fp in &featured {
        // Build a minimal Article object for each pinned post
        let post_url = format!(
            "https://{}/blog/{}",
            domain,
            fp.slug.as_deref().unwrap_or("")
        );
        let article = serde_json::json!({
            "type": "Article",
            "id": post_url,
            "attributedTo": actor_uri,
            "name": fp.title.as_deref().unwrap_or("Untitled"),
            "url": post_url
        });
        items.push(article);
    }

    let featured_uri = format!("https://{}/ap/actor/{}/featured", domain, site.slug);

    let page = OrderedCollectionPage {
        context: as_context(),
        id: featured_uri.clone(),
        page_type: "OrderedCollection".to_string(),
        part_of: featured_uri,
        total_items: Some(items.len() as u64),
        ordered_items: items,
        next: None,
        prev: None,
    };

    Ok(Json(page))
}

/// Collect actor routes (mounted at root `/`)
pub fn routes() -> Vec<Route> {
    routes![actor_profile, actor_outbox, actor_followers, actor_featured]
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_routes_count() {
        let routes = super::routes();
        assert_eq!(routes.len(), 4, "Should have 4 actor routes");
    }
}
