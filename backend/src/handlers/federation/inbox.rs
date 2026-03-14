//! ActivityPub inbox handlers (per-actor and shared)

use rocket::http::Status;
use rocket::{Route, State};

use crate::dto::federation::activitypub::ACTIVITY_STREAMS_CONTEXT;
use crate::errors::ApiError;
use crate::models::federation::activity::ApActivity;
use crate::models::federation::actor::ApActor;
use crate::models::federation::block::{extract_domain, ApBlockedInstance};
use crate::models::federation::types::{ApActivityDirection, ApActivityStatus};
use crate::models::site::Site;
use crate::models::site_settings::SiteSetting;
use crate::services::federation::sanitizer::sanitize_html;
use crate::AppState;

/// Allowed activity types for inbound processing.
const ALLOWED_ACTIVITY_TYPES: &[&str] = &[
    "Follow", "Undo", "Create", "Update", "Delete", "Like", "Announce", "Accept", "Reject",
];

/// Maximum payload size for inbox bodies (256 KB).
const MAX_INBOX_PAYLOAD_BYTES: usize = 256 * 1024;

/// Per-actor inbox endpoint
///
/// Receives ActivityPub activities targeted at a specific actor.
#[post("/ap/actor/<site_slug>/inbox", data = "<body>")]
pub async fn actor_inbox(
    state: &State<AppState>,
    site_slug: &str,
    body: String,
) -> Result<Status, ApiError> {
    process_inbox(state.inner(), Some(site_slug), &body).await
}

/// Shared inbox endpoint
///
/// Receives ActivityPub activities that may target any actor on this instance.
#[post("/ap/inbox", data = "<body>")]
pub async fn shared_inbox(state: &State<AppState>, body: String) -> Result<Status, ApiError> {
    process_inbox(state.inner(), None, &body).await
}

/// Core inbox processing logic shared by per-actor and shared inbox.
async fn process_inbox(
    state: &AppState,
    site_slug: Option<&str>,
    body: &str,
) -> Result<Status, ApiError> {
    // 0. Size check
    if body.len() > MAX_INBOX_PAYLOAD_BYTES {
        return Err(ApiError::bad_request("Payload too large"));
    }

    // 1. Parse JSON
    let payload: serde_json::Value = serde_json::from_str(body)
        .map_err(|e| ApiError::bad_request(format!("Invalid JSON: {e}")))?;

    // 2. Validate @context includes ActivityStreams
    let context_valid = match payload.get("@context") {
        Some(serde_json::Value::String(s)) => s == ACTIVITY_STREAMS_CONTEXT,
        Some(serde_json::Value::Array(arr)) => arr.iter().any(|v| {
            v.as_str()
                .map(|s| s == ACTIVITY_STREAMS_CONTEXT)
                .unwrap_or(false)
        }),
        _ => false,
    };
    if !context_valid {
        return Err(ApiError::bad_request(
            "Missing or invalid @context: must include ActivityStreams",
        ));
    }

    // 3. Extract required fields
    let activity_type = payload
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request("Missing 'type' field"))?;

    let actor_field = payload
        .get("actor")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request("Missing 'actor' field"))?;

    let activity_id = payload.get("id").and_then(|v| v.as_str()).unwrap_or("");

    // 4. Check activity type whitelist
    if !ALLOWED_ACTIVITY_TYPES.contains(&activity_type) {
        tracing::warn!(
            activity_type = activity_type,
            "Inbox: rejected unsupported activity type"
        );
        return Err(ApiError::bad_request(format!(
            "Unsupported activity type: {activity_type}"
        )));
    }

    // 5. Resolve the target site + actor
    let (site, actor) = if let Some(slug) = site_slug {
        // Per-actor inbox: resolve from path
        let site = Site::find_by_slug(&state.db, slug).await?;
        let actor = ApActor::find_by_site_id(&state.db, site.id)
            .await?
            .ok_or_else(|| ApiError::not_found("Actor not found"))?;
        (site, actor)
    } else {
        // Shared inbox: extract target from the object or to/cc fields
        let target_slug = extract_target_slug(&payload)
            .ok_or_else(|| ApiError::bad_request("Cannot determine target actor from payload"))?;
        let site = Site::find_by_slug(&state.db, &target_slug).await?;
        let actor = ApActor::find_by_site_id(&state.db, site.id)
            .await?
            .ok_or_else(|| ApiError::not_found("Actor not found"))?;
        (site, actor)
    };

    // 6. Check federation is enabled
    let fed_enabled =
        SiteSetting::get_value(&state.db, site.id, "module_federation_enabled").await?;
    if !fed_enabled.as_bool().unwrap_or(false) {
        return Err(ApiError::not_found(
            "Federation is not enabled for this site",
        ));
    }

    // 7. Check blocked instances
    if let Some(sender_domain) = extract_domain(actor_field) {
        if ApBlockedInstance::is_instance_blocked(&state.db, actor.id, &sender_domain).await? {
            tracing::info!(
                domain = sender_domain,
                "Inbox: rejected activity from blocked instance"
            );
            return Ok(Status::Accepted); // Silent drop — don't reveal block status
        }
    }

    // 8. Anti-spoofing: verify actor domain matches id domain (basic check)
    if !activity_id.is_empty() {
        let id_domain = extract_domain(activity_id);
        let actor_domain = extract_domain(actor_field);
        if id_domain.is_some() && actor_domain.is_some() && id_domain != actor_domain {
            tracing::warn!(
                activity_id = activity_id,
                actor = actor_field,
                "Inbox: actor/id domain mismatch (potential spoofing)"
            );
            // Log but don't reject — full HTTP signature verification comes later
        }
    }

    // 9. Sanitize content fields in the payload
    let mut sanitized_payload = payload.clone();
    sanitize_payload_content(&mut sanitized_payload);

    // 10. Extract object URI if present
    let object_uri = sanitized_payload.get("object").and_then(|v| {
        v.as_str().map(|s| s.to_string()).or_else(|| {
            v.get("id")
                .and_then(|id| id.as_str().map(|s| s.to_string()))
        })
    });

    let object_type = sanitized_payload
        .get("object")
        .and_then(|v| v.get("type"))
        .and_then(|v| v.as_str());

    // 11. Store in ap_activities
    ApActivity::create(
        &state.db,
        site.id,
        activity_type,
        activity_id,
        actor_field,
        object_uri.as_deref(),
        object_type,
        &sanitized_payload,
        ApActivityDirection::In,
        ApActivityStatus::Pending,
        None,
    )
    .await?;

    tracing::info!(
        activity_type = activity_type,
        actor = actor_field,
        site_slug = site.slug,
        "Inbox: accepted inbound activity"
    );

    // 12. Return 202 Accepted
    Ok(Status::Accepted)
}

/// Extract a target site slug from an ActivityPub payload.
///
/// Looks in `to`, `cc`, and `object` fields for URIs matching `/ap/<slug>/`.
fn extract_target_slug(payload: &serde_json::Value) -> Option<String> {
    let uri_lists = [
        payload.get("to").and_then(|v| v.as_array()),
        payload.get("cc").and_then(|v| v.as_array()),
    ];

    for list in uri_lists.into_iter().flatten() {
        for uri in list {
            if let Some(slug) = slug_from_actor_uri(uri.as_str().unwrap_or("")) {
                return Some(slug);
            }
        }
    }

    // Try extracting from the object field
    if let Some(obj) = payload.get("object") {
        let obj_str = obj.as_str().unwrap_or("");
        if let Some(slug) = slug_from_actor_uri(obj_str) {
            return Some(slug);
        }
        // If object is inline, check attributedTo
        if let Some(attr) = obj.get("attributedTo").and_then(|v| v.as_str()) {
            if let Some(slug) = slug_from_actor_uri(attr) {
                return Some(slug);
            }
        }
    }

    None
}

/// Extract site slug from a URI like `https://example.com/ap/<slug>/actor`.
fn slug_from_actor_uri(uri: &str) -> Option<String> {
    let parts: Vec<&str> = uri.split('/').collect();
    for (i, seg) in parts.iter().enumerate() {
        if *seg == "ap" {
            // Next segment is the slug
            if let Some(slug) = parts.get(i + 1) {
                if !slug.is_empty() && *slug != "inbox" {
                    return Some(slug.to_string());
                }
            }
        }
    }
    None
}

/// Recursively sanitize `content`, `summary`, and `name` string fields in a JSON value.
fn sanitize_payload_content(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, val) in map.iter_mut() {
                match key.as_str() {
                    "content" | "summary" | "name" => {
                        if let serde_json::Value::String(s) = val {
                            *s = sanitize_html(s);
                        }
                    }
                    _ => sanitize_payload_content(val),
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                sanitize_payload_content(item);
            }
        }
        _ => {}
    }
}

/// Collect inbox routes (mounted at root `/`)
pub fn routes() -> Vec<Route> {
    routes![actor_inbox, shared_inbox]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slug_from_actor_uri() {
        assert_eq!(
            slug_from_actor_uri("https://example.com/ap/myblog/actor"),
            Some("myblog".to_string())
        );
        assert_eq!(
            slug_from_actor_uri("https://example.com/ap/tech/inbox"),
            Some("tech".to_string())
        );
        assert_eq!(slug_from_actor_uri("https://example.com/users/alice"), None);
    }

    #[test]
    fn test_slug_from_actor_uri_inbox_only() {
        // /ap/inbox should not match (shared inbox, no slug)
        assert_eq!(slug_from_actor_uri("https://example.com/ap/inbox"), None);
    }

    #[test]
    fn test_extract_target_slug_from_to() {
        let payload = serde_json::json!({
            "type": "Follow",
            "actor": "https://remote.example/users/alice",
            "to": ["https://example.com/ap/myblog/actor"],
            "object": "https://example.com/ap/myblog/actor"
        });
        assert_eq!(extract_target_slug(&payload), Some("myblog".to_string()));
    }

    #[test]
    fn test_extract_target_slug_from_object() {
        let payload = serde_json::json!({
            "type": "Follow",
            "actor": "https://remote.example/users/alice",
            "object": "https://example.com/ap/tech/actor"
        });
        assert_eq!(extract_target_slug(&payload), Some("tech".to_string()));
    }

    #[test]
    fn test_sanitize_payload_content() {
        let mut payload = serde_json::json!({
            "type": "Create",
            "object": {
                "type": "Note",
                "content": "<p>Hello</p><script>alert('xss')</script>",
                "summary": "<b>test</b><img src=x>",
                "name": "Safe <em>title</em>"
            }
        });
        sanitize_payload_content(&mut payload);

        let content = payload["object"]["content"].as_str().unwrap();
        assert!(!content.contains("<script>"));
        assert!(content.contains("<p>Hello</p>"));

        let summary = payload["object"]["summary"].as_str().unwrap();
        assert!(!summary.contains("<img"));
    }

    #[test]
    fn test_allowed_activity_types() {
        assert!(ALLOWED_ACTIVITY_TYPES.contains(&"Follow"));
        assert!(ALLOWED_ACTIVITY_TYPES.contains(&"Create"));
        assert!(ALLOWED_ACTIVITY_TYPES.contains(&"Undo"));
        assert!(!ALLOWED_ACTIVITY_TYPES.contains(&"Move"));
        assert!(!ALLOWED_ACTIVITY_TYPES.contains(&"Block"));
    }
}
