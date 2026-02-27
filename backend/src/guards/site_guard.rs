//! Site guard
//!
//! Request guard for extracting the current site context.

use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use uuid::Uuid;

use crate::models::site::Site;
use crate::AppState;

/// Current site context extracted from the request
pub struct CurrentSite(pub Site);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for CurrentSite {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // Try to get site from X-Site-Domain header
        if let Some(domain) = request.headers().get_one("X-Site-Domain") {
            let state = request
                .rocket()
                .state::<AppState>()
                .expect("AppState not configured");

            match Site::find_by_domain(&state.db, domain).await {
                Ok(site) => return Outcome::Success(CurrentSite(site)),
                Err(_) => return Outcome::Error((Status::NotFound, ())),
            }
        }

        // Try to get site from path parameter
        if let Some(site_id) = request.param::<Uuid>(1).and_then(|r| r.ok()) {
            let state = request
                .rocket()
                .state::<AppState>()
                .expect("AppState not configured");

            match Site::find_by_id(&state.db, site_id).await {
                Ok(site) => return Outcome::Success(CurrentSite(site)),
                Err(_) => return Outcome::Error((Status::NotFound, ())),
            }
        }

        Outcome::Forward(Status::BadRequest)
    }
}
