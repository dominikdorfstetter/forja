//! Public, no-auth Imprint (Impressum) endpoint. Serves the deployment
//! operator's legal details from runtime env config so the pre-built admin SPA
//! can render an Impressum without baking operator PII into the image. Mounted
//! under `/api/v1` (public path: `/api/v1/imprint`).

use axum::extract::State;
use axum::response::Json;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::dto::imprint::ImprintResponse;
use crate::errors::codes;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/imprint",
    tag = "System",
    operation_id = "get_imprint",
    description = "Public deployment-operator imprint (Impressum). No authentication required. Returns `{configured:false}` when the required operator details are not set, so the frontend can hide the imprint link.",
    responses(
        (status = 200, description = "Imprint details, or {configured:false} when unset", body = ImprintResponse)
    )
)]
async fn get_imprint(State(state): State<AppState>) -> Json<ImprintResponse> {
    let imprint = &state.settings.imprint;
    if imprint.is_partially_configured() {
        tracing::warn!(
            code = codes::ERR_IMPRINT_INCOMPLETE,
            "Imprint partially configured — set IMPRINT_OPERATOR_NAME, IMPRINT_ADDRESS and IMPRINT_EMAIL together, or leave all unset"
        );
    }
    Json(ImprintResponse::from_config(imprint))
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_imprint))
}
