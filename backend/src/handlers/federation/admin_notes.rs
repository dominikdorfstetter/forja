//! Federation notes (Quick Post) admin endpoints

use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::{Route, State};
use uuid::Uuid;
use validator::Validate;

use crate::dto::federation::requests::{CreateNoteRequest, UpdateNoteRequest};
use crate::dto::federation::responses::NoteResponse;
use crate::errors::{ApiError, ProblemDetails};
use crate::guards::auth_guard::ReadKey;
use crate::guards::federation_guard::{
    can_manage_federation, can_publish_to_fediverse, can_view_federation,
};
use crate::guards::module_guard::{FederationModule, ModuleGuard};
use crate::models::federation::activity::ApActivity;
use crate::models::federation::actor::ApActor;
use crate::models::federation::block::ApBlockedInstance;
use crate::models::federation::follower::{self, ApFollower};
use crate::models::federation::note::ApNote;
use crate::models::federation::types::{ApActivityDirection, ApActivityStatus};
use crate::models::site::Site;
use crate::models::site_membership::SiteRole;
use crate::services::federation::queue::DeliveryQueue;
use crate::utils::pagination::{Paginated, PaginationParams};
use crate::AppState;

/// Convert plain text to simple HTML: wrap in `<p>`, auto-linkify URLs.
fn text_to_html(text: &str) -> String {
    let escaped = text
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");

    // Simple URL regex: match http(s)://...
    let url_re = regex::Regex::new(r"(https?://[^\s<>\)\]\}]+)").expect("valid regex");

    let linked = url_re.replace_all(
        &escaped,
        r#"<a href="$1" rel="nofollow noopener" target="_blank">$1</a>"#,
    );

    // Wrap each paragraph (split on double newlines)
    let paragraphs: Vec<String> = linked
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .map(|p| format!("<p>{}</p>", p.replace('\n', "<br>")))
        .collect();

    if paragraphs.is_empty() {
        format!("<p>{}</p>", linked)
    } else {
        paragraphs.join("\n")
    }
}

/// Create a Note and federate it
#[utoipa::path(
    tag = "Federation",
    operation_id = "create_federation_note",
    description = "Create a short-form Note and federate it to the Fediverse",
    params(("site_id" = Uuid, Path, description = "Site UUID")),
    request_body(content = CreateNoteRequest, description = "Note body"),
    responses(
        (status = 201, description = "Note created", body = NoteResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[post("/sites/<site_id>/federation/notes", data = "<body>")]
pub async fn create_note(
    state: &State<AppState>,
    site_id: Uuid,
    body: Json<CreateNoteRequest>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<(Status, Json<NoteResponse>), ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_publish_to_fediverse(&role) {
        return Err(ApiError::forbidden(
            "Insufficient role to post to the Fediverse",
        ));
    }

    let site = Site::find_by_id(&state.db, site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {e}")))?;

    // Parse optional scheduled_at
    let scheduled_at = req.scheduled_at.as_deref().and_then(|s| {
        chrono::DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.with_timezone(&chrono::Utc))
    });

    // Convert body to HTML
    let body_html = text_to_html(&req.body);

    // Insert into ap_notes (with optional scheduling)
    let note = ApNote::create(
        &state.db,
        site_id,
        &req.body,
        &body_html,
        None,
        scheduled_at,
    )
    .await?;

    // If scheduled for the future, return early without federating
    if note.status == "scheduled" {
        let response: NoteResponse = note.into();
        return Ok((Status::Created, Json(response)));
    }

    // Get actor
    let actor = ApActor::find_by_site_id(&state.db, site_id)
        .await?
        .ok_or_else(|| ApiError::internal("No actor configured for federated site"))?;

    // Resolve domain
    let domain = Site::resolve_domain(&state.db, site_id).await?;

    let actor_uri = actor.actor_uri(&domain, &site.slug);
    let note_uri = format!("https://{}/ap/{}/notes/{}", domain, site.slug, note.id);
    let followers_url = actor.followers_url.clone();

    // Build ActivityPub Note object
    let ap_note = serde_json::json!({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Note",
        "id": note_uri,
        "attributedTo": actor_uri,
        "content": body_html,
        "published": note.published_at.to_rfc3339(),
        "to": ["https://www.w3.org/ns/activitystreams#Public"],
        "cc": [followers_url]
    });

    // Wrap in Create activity
    let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());
    let activity_payload = serde_json::json!({
        "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
        "type": "Create",
        "id": activity_uri,
        "actor": actor_uri,
        "object": ap_note,
        "to": ["https://www.w3.org/ns/activitystreams#Public"],
        "cc": [followers_url],
        "published": note.published_at.to_rfc3339()
    });

    // Store activity
    let stored = ApActivity::create(
        &state.db,
        site_id,
        "Create",
        &activity_uri,
        &actor_uri,
        Some(&note_uri),
        Some("Note"),
        &activity_payload,
        ApActivityDirection::Out,
        ApActivityStatus::Pending,
        None, // no content_id — this is a standalone note
    )
    .await?;

    // Update note with activity URI
    ApNote::set_activity_uri(&state.db, note.id, &note_uri).await?;

    // Fan out to followers
    let followers = ApFollower::find_by_actor(&state.db, actor.id).await?;
    let targets = follower::delivery_targets(&followers);

    let queue = crate::services::federation::queue::CompositeQueue::new(state.db.clone(), None);

    for target in &targets {
        if let Some(target_domain) =
            crate::models::federation::block::extract_domain(&target.inbox_uri)
        {
            if ApBlockedInstance::is_instance_blocked(&state.db, actor.id, &target_domain).await? {
                continue;
            }
        }
        queue.enqueue(stored.id, &target.inbox_uri).await?;
    }

    tracing::info!(
        note_id = %note.id,
        targets = targets.len(),
        "Quick Post: enqueued Create Note activity"
    );

    let response: NoteResponse = note.into();
    Ok((Status::Created, Json(response)))
}

/// List notes for a site (paginated)
#[utoipa::path(
    tag = "Federation",
    operation_id = "list_federation_notes",
    description = "List quick-post notes for a site (paginated, newest first)",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("page_size" = Option<i64>, Query, description = "Items per page (default: 10, max: 100)")
    ),
    responses(
        (status = 200, description = "Paginated note list", body = Paginated<NoteResponse>),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Site not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[get("/sites/<site_id>/federation/notes?<page>&<page_size>")]
pub async fn list_notes(
    state: &State<AppState>,
    site_id: Uuid,
    page: Option<i64>,
    page_size: Option<i64>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<Paginated<NoteResponse>>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_view_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to view notes"));
    }

    Site::find_by_id(&state.db, site_id).await?;

    let params = PaginationParams::new(page, page_size);
    let (limit, offset) = params.limit_offset();

    let notes = ApNote::find_by_site(&state.db, site_id, limit, offset).await?;
    let total = ApNote::count_by_site(&state.db, site_id).await?;

    let items: Vec<NoteResponse> = notes.into_iter().map(NoteResponse::from).collect();
    let paginated = params.paginate(items, total);

    Ok(Json(paginated))
}

/// Update a note body and send an Update activity
#[utoipa::path(
    tag = "Federation",
    operation_id = "update_federation_note",
    description = "Update the body of a quick-post note and send an Update activity to the Fediverse",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("note_id" = Uuid, Path, description = "Note UUID")
    ),
    request_body(content = UpdateNoteRequest, description = "Updated note body"),
    responses(
        (status = 200, description = "Note updated", body = NoteResponse),
        (status = 400, description = "Validation error", body = ProblemDetails),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Note not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[put("/sites/<site_id>/federation/notes/<note_id>", data = "<body>")]
pub async fn update_note(
    state: &State<AppState>,
    site_id: Uuid,
    note_id: Uuid,
    body: Json<UpdateNoteRequest>,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Json<NoteResponse>, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Reviewer)
        .await?;
    if !can_publish_to_fediverse(&role) {
        return Err(ApiError::forbidden("Insufficient role to edit notes"));
    }

    let site = Site::find_by_id(&state.db, site_id).await?;

    let req = body.into_inner();
    req.validate()
        .map_err(|e| ApiError::bad_request(format!("Validation error: {e}")))?;

    // Convert body to HTML
    let body_html = text_to_html(&req.body);

    // Update the note
    let note = ApNote::update_body(&state.db, note_id, &req.body, &body_html)
        .await?
        .ok_or_else(|| ApiError::not_found("Note not found"))?;

    // If the note was federated, send an Update activity
    if let Some(ref note_uri) = note.activity_uri {
        let actor = ApActor::find_by_site_id(&state.db, site_id).await?;

        if let Some(actor) = actor {
            let domain = Site::resolve_domain(&state.db, site_id).await?;

            let actor_uri = actor.actor_uri(&domain, &site.slug);
            let followers_url = actor.followers_url.clone();

            // Build updated Note object
            let ap_note = serde_json::json!({
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "Note",
                "id": note_uri,
                "attributedTo": actor_uri,
                "content": body_html,
                "published": note.published_at.to_rfc3339(),
                "updated": chrono::Utc::now().to_rfc3339(),
                "to": ["https://www.w3.org/ns/activitystreams#Public"],
                "cc": [followers_url]
            });

            // Wrap in Update activity
            let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());
            let activity_payload = serde_json::json!({
                "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
                "type": "Update",
                "id": activity_uri,
                "actor": actor_uri,
                "object": ap_note,
                "to": ["https://www.w3.org/ns/activitystreams#Public"],
                "cc": [followers_url],
                "published": chrono::Utc::now().to_rfc3339()
            });

            let stored = ApActivity::create(
                &state.db,
                site_id,
                "Update",
                &activity_uri,
                &actor_uri,
                Some(note_uri),
                Some("Note"),
                &activity_payload,
                ApActivityDirection::Out,
                ApActivityStatus::Pending,
                None,
            )
            .await?;

            // Fan out Update to followers
            let followers = ApFollower::find_by_actor(&state.db, actor.id).await?;
            let targets = follower::delivery_targets(&followers);

            let queue =
                crate::services::federation::queue::CompositeQueue::new(state.db.clone(), None);

            for target in &targets {
                if let Some(target_domain) =
                    crate::models::federation::block::extract_domain(&target.inbox_uri)
                {
                    if ApBlockedInstance::is_instance_blocked(&state.db, actor.id, &target_domain)
                        .await?
                    {
                        continue;
                    }
                }
                queue.enqueue(stored.id, &target.inbox_uri).await?;
            }

            tracing::info!(
                note_id = %note_id,
                "Quick Post: enqueued Update Note activity"
            );
        }
    }

    let response: NoteResponse = note.into();
    Ok(Json(response))
}

/// Delete a note and send a Delete activity
#[utoipa::path(
    tag = "Federation",
    operation_id = "delete_federation_note",
    description = "Delete a quick-post note and send a Delete activity to the Fediverse",
    params(
        ("site_id" = Uuid, Path, description = "Site UUID"),
        ("note_id" = Uuid, Path, description = "Note UUID")
    ),
    responses(
        (status = 204, description = "Note deleted"),
        (status = 401, description = "Unauthorized", body = ProblemDetails),
        (status = 403, description = "Forbidden", body = ProblemDetails),
        (status = 404, description = "Note not found", body = ProblemDetails)
    ),
    security(("api_key" = []))
)]
#[delete("/sites/<site_id>/federation/notes/<note_id>")]
pub async fn delete_note(
    state: &State<AppState>,
    site_id: Uuid,
    note_id: Uuid,
    auth: ReadKey,
    _module: ModuleGuard<FederationModule>,
) -> Result<Status, ApiError> {
    let role = auth
        .0
        .require_site_role(&state.db, site_id, &SiteRole::Admin)
        .await?;
    if !can_manage_federation(&role) {
        return Err(ApiError::forbidden("Insufficient role to delete notes"));
    }

    let site = Site::find_by_id(&state.db, site_id).await?;

    // Delete the note and retrieve it
    let note = ApNote::delete(&state.db, note_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Note not found"))?;

    // If the note was federated, send a Delete activity
    if let Some(ref note_uri) = note.activity_uri {
        let actor = ApActor::find_by_site_id(&state.db, site_id).await?;

        if let Some(actor) = actor {
            let domain = Site::resolve_domain(&state.db, site_id).await?;

            let actor_uri = actor.actor_uri(&domain, &site.slug);
            let activity_uri = format!("https://{}/ap/activities/{}", domain, Uuid::new_v4());

            let activity_payload = serde_json::json!({
                "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
                "type": "Delete",
                "id": activity_uri,
                "actor": actor_uri,
                "object": note_uri,
                "to": ["https://www.w3.org/ns/activitystreams#Public"],
                "cc": [actor.followers_url]
            });

            let stored = ApActivity::create(
                &state.db,
                site_id,
                "Delete",
                &activity_uri,
                &actor_uri,
                Some(note_uri),
                Some("Note"),
                &activity_payload,
                ApActivityDirection::Out,
                ApActivityStatus::Pending,
                None,
            )
            .await?;

            // Fan out Delete to followers
            let followers = ApFollower::find_by_actor(&state.db, actor.id).await?;
            let targets = follower::delivery_targets(&followers);

            let queue =
                crate::services::federation::queue::CompositeQueue::new(state.db.clone(), None);

            for target in &targets {
                if let Some(target_domain) =
                    crate::models::federation::block::extract_domain(&target.inbox_uri)
                {
                    if ApBlockedInstance::is_instance_blocked(&state.db, actor.id, &target_domain)
                        .await?
                    {
                        continue;
                    }
                }
                queue.enqueue(stored.id, &target.inbox_uri).await?;
            }

            tracing::info!(
                note_id = %note_id,
                "Quick Post: enqueued Delete Note activity"
            );
        }
    }

    Ok(Status::NoContent)
}

/// Collect admin notes routes
pub fn routes() -> Vec<Route> {
    routes![create_note, list_notes, update_note, delete_note]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_to_html_simple() {
        let html = text_to_html("Hello world");
        assert_eq!(html, "<p>Hello world</p>");
    }

    #[test]
    fn test_text_to_html_escapes_html() {
        let html = text_to_html("<script>alert('xss')</script>");
        assert!(html.contains("&lt;script&gt;"));
        assert!(!html.contains("<script>"));
    }

    #[test]
    fn test_text_to_html_linkifies_urls() {
        let html = text_to_html("Check out https://example.com today");
        assert!(html.contains(r#"<a href="https://example.com""#));
        assert!(html.contains("nofollow"));
    }

    #[test]
    fn test_text_to_html_multiple_paragraphs() {
        let html = text_to_html("First paragraph\n\nSecond paragraph");
        assert!(html.contains("<p>First paragraph</p>"));
        assert!(html.contains("<p>Second paragraph</p>"));
    }

    #[test]
    fn test_text_to_html_line_breaks() {
        let html = text_to_html("Line one\nLine two");
        assert!(html.contains("Line one<br>Line two"));
    }

    #[test]
    fn test_text_to_html_ampersand() {
        let html = text_to_html("A & B");
        assert!(html.contains("A &amp; B"));
    }

    #[test]
    fn test_routes_count() {
        let routes = routes();
        assert_eq!(routes.len(), 4, "Should have 4 admin notes routes");
    }
}
