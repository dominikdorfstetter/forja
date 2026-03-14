//! WebFinger discovery endpoint (RFC 7033)

use rocket::serde::json::Json;
use rocket::{Route, State};

use crate::dto::federation::activitypub::{WebFingerLink, WebFingerResponse};
use crate::errors::ApiError;
use crate::models::federation::actor::ApActor;
use crate::models::site::Site;
use crate::models::site_settings::SiteSetting;
use crate::AppState;

/// WebFinger resource discovery
///
/// Resolves `acct:username@domain` to the corresponding ActivityPub actor.
#[get("/.well-known/webfinger?<resource>")]
pub async fn webfinger(
    state: &State<AppState>,
    resource: &str,
) -> Result<Json<WebFingerResponse>, ApiError> {
    // 1. Parse "acct:username@domain" format
    let acct = resource
        .strip_prefix("acct:")
        .ok_or_else(|| ApiError::bad_request("resource must use acct: scheme"))?;

    let (username, domain) = acct
        .split_once('@')
        .ok_or_else(|| ApiError::bad_request("resource must be in acct:user@domain format"))?;

    if username.is_empty() || domain.is_empty() {
        return Err(ApiError::bad_request(
            "resource must contain a non-empty username and domain",
        ));
    }

    // 2. Look up site by slug (username = site slug)
    let site = Site::find_by_slug(&state.db, username).await?;

    // 3. Check federation is enabled for this site
    let fed_enabled =
        SiteSetting::get_value(&state.db, site.id, "module_federation_enabled").await?;
    if !fed_enabled.as_bool().unwrap_or(false) {
        return Err(ApiError::not_found(
            "Federation is not enabled for this site",
        ));
    }

    // 4. Look up actor
    let actor = ApActor::find_by_site_id(&state.db, site.id)
        .await?
        .ok_or_else(|| ApiError::not_found("No ActivityPub actor configured for this site"))?;

    let actor_uri = actor.actor_uri(domain, &site.slug);
    let site_url = format!("https://{}", domain);

    // 5. Build WebFinger response
    let response = WebFingerResponse {
        subject: format!("acct:{}@{}", username, domain),
        aliases: Some(vec![actor_uri.clone()]),
        links: vec![
            WebFingerLink {
                rel: "self".to_string(),
                link_type: Some("application/activity+json".to_string()),
                href: Some(actor_uri),
            },
            WebFingerLink {
                rel: "http://webfinger.net/rel/profile-page".to_string(),
                link_type: Some("text/html".to_string()),
                href: Some(site_url),
            },
        ],
    };

    Ok(Json(response))
}

/// Collect WebFinger routes (mounted at root `/`)
pub fn routes() -> Vec<Route> {
    routes![webfinger]
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_acct_parsing() {
        let resource = "acct:myblog@example.com";
        let acct = resource.strip_prefix("acct:").unwrap();
        let (user, domain) = acct.split_once('@').unwrap();
        assert_eq!(user, "myblog");
        assert_eq!(domain, "example.com");
    }

    #[test]
    fn test_acct_parsing_no_prefix() {
        let resource = "myblog@example.com";
        assert!(resource.strip_prefix("acct:").is_none());
    }
}
