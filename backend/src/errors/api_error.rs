//! API Error types and handling
//!
//! Implements RFC 7807 (Problem Details for HTTP APIs) compliant error responses.
//! Error codes follow the `{DOMAIN}_{ACTION}_{REASON}` pattern from `errors::codes`.

use axum::http::StatusCode;
use serde::Serialize;

use super::codes;

// ── ErrorMeta ───────────────────────────────────────────────────────────

/// Internal payload carried by every `ApiError` variant.
/// Fields are not part of the public API — use constructor methods and builders instead.
#[derive(Debug)]
#[doc(hidden)]
pub struct ErrorMeta {
    pub(crate) message: String,
    pub(crate) error_code: Option<&'static str>,
    pub(crate) entity_type: Option<&'static str>,
    pub(crate) field_errors: Vec<FieldError>,
}

impl ErrorMeta {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            error_code: None,
            entity_type: None,
            field_errors: Vec::new(),
        }
    }
}

// ── ApiError ────────────────────────────────────────────────────────────

/// API Error type — each variant maps to an HTTP status code.
///
/// Construct via methods: `ApiError::not_found(...)`, `ApiError::bad_request(...)`, etc.
/// Chain `.with_code(codes::ENTITY_NOT_FOUND).with_entity_type("blog")` to attach
/// a machine-readable code (and entity tag, where applicable).
#[derive(Debug)]
pub enum ApiError {
    NotFound(ErrorMeta),
    BadRequest(ErrorMeta),
    Validation(ErrorMeta),
    Unauthorized(ErrorMeta),
    Forbidden(ErrorMeta),
    Conflict(ErrorMeta),
    Database(ErrorMeta),
    Internal(ErrorMeta),
    ServiceUnavailable(ErrorMeta),
    RateLimited(ErrorMeta),
    PayloadTooLarge(ErrorMeta),
    /// 410 Gone — resource existed but has been intentionally deleted and
    /// the deletion is permanent. Distinct from 404 (never existed) so
    /// clients can communicate "your action took effect" instead of
    /// silently no-op'ing on idempotent self-service deletes.
    Gone(ErrorMeta),
    /// 423 Locked — the resource exists but is temporarily inaccessible
    /// due to a self-protection mechanism (e.g. 3-attempt password
    /// lockout on a private document). Distinct from 403 so clients can
    /// surface a "contact the owner" affordance rather than just
    /// "wrong password".
    Locked(ErrorMeta),
}

// ── Constructors ────────────────────────────────────────────────────────

impl ApiError {
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(ErrorMeta::new(msg))
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(ErrorMeta::new(msg))
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(ErrorMeta::new(msg))
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(ErrorMeta::new(msg))
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden(ErrorMeta::new(msg))
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(ErrorMeta::new(msg))
    }

    pub fn database(msg: impl Into<String>) -> Self {
        Self::Database(ErrorMeta::new(msg))
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(ErrorMeta::new(msg))
    }

    pub fn service_unavailable(msg: impl Into<String>) -> Self {
        Self::ServiceUnavailable(ErrorMeta::new(msg))
    }

    pub fn rate_limited(msg: impl Into<String>) -> Self {
        Self::RateLimited(ErrorMeta::new(msg))
    }

    pub fn payload_too_large(msg: impl Into<String>) -> Self {
        Self::PayloadTooLarge(ErrorMeta::new(msg))
    }

    pub fn gone(msg: impl Into<String>) -> Self {
        Self::Gone(ErrorMeta::new(msg))
    }

    pub fn locked(msg: impl Into<String>) -> Self {
        Self::Locked(ErrorMeta::new(msg))
    }

    /// Helper: "X with id 'Y' not found" with an attached error code.
    pub fn not_found_resource(
        resource: &str,
        id: impl std::fmt::Display,
        code: &'static str,
    ) -> Self {
        Self::not_found(format!("{} with id '{}' not found", resource, id)).with_code(code)
    }

    /// Create a validation error with field-level details.
    pub fn validation_with_errors(message: impl Into<String>, errors: Vec<FieldError>) -> Self {
        Self::validation(message).with_field_errors(errors)
    }
}

// ── Builders ────────────────────────────────────────────────────────────

impl ApiError {
    /// Attach a domain-specific error code from `errors::codes`.
    pub fn with_code(mut self, code: &'static str) -> Self {
        self.meta_mut().error_code = Some(code);
        self
    }

    /// Attach field-level validation errors.
    pub fn with_field_errors(mut self, errors: Vec<FieldError>) -> Self {
        self.meta_mut().field_errors = errors;
        self
    }

    /// Attach an entity-type tag (e.g. `"blog"`, `"page"`, `"document"`).
    ///
    /// Used together with the general-purpose `ENTITY_*` codes so a single
    /// `ENTITY_NOT_FOUND` carries which entity domain it applies to.
    pub fn with_entity_type(mut self, entity_type: &'static str) -> Self {
        self.meta_mut().entity_type = Some(entity_type);
        self
    }
}

// ── Accessors ───────────────────────────────────────────────────────────

impl ApiError {
    fn meta(&self) -> &ErrorMeta {
        match self {
            Self::NotFound(m)
            | Self::BadRequest(m)
            | Self::Validation(m)
            | Self::Unauthorized(m)
            | Self::Forbidden(m)
            | Self::Conflict(m)
            | Self::Database(m)
            | Self::Internal(m)
            | Self::ServiceUnavailable(m)
            | Self::RateLimited(m)
            | Self::PayloadTooLarge(m)
            | Self::Gone(m)
            | Self::Locked(m) => m,
        }
    }

    fn meta_mut(&mut self) -> &mut ErrorMeta {
        match self {
            Self::NotFound(m)
            | Self::BadRequest(m)
            | Self::Validation(m)
            | Self::Unauthorized(m)
            | Self::Forbidden(m)
            | Self::Conflict(m)
            | Self::Database(m)
            | Self::Internal(m)
            | Self::ServiceUnavailable(m)
            | Self::RateLimited(m)
            | Self::PayloadTooLarge(m)
            | Self::Gone(m)
            | Self::Locked(m) => m,
        }
    }

    /// HTTP status code for this error.
    pub fn status(&self) -> StatusCode {
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Database(_) | Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::RateLimited(_) => StatusCode::TOO_MANY_REQUESTS,
            Self::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            Self::Gone(_) => StatusCode::GONE,
            Self::Locked(_) => StatusCode::LOCKED,
        }
    }

    /// Machine-readable error code. Returns the `.with_code()` override
    /// if set, otherwise a fallback code derived from the variant.
    pub fn code(&self) -> &str {
        if let Some(code) = self.meta().error_code {
            return code;
        }
        match self {
            Self::NotFound(_) => codes::RESOURCE_NOT_FOUND,
            Self::BadRequest(_) => codes::BAD_REQUEST,
            Self::Validation(_) => codes::VALIDATION_ERROR,
            Self::Unauthorized(_) => codes::UNAUTHORIZED,
            Self::Forbidden(_) => codes::FORBIDDEN,
            Self::Conflict(_) => codes::CONFLICT,
            Self::Database(_) => codes::DATABASE_ERROR,
            Self::Internal(_) => codes::INTERNAL_ERROR,
            Self::ServiceUnavailable(_) => codes::SERVICE_UNAVAILABLE,
            Self::RateLimited(_) => codes::RATE_LIMIT_EXCEEDED,
            Self::PayloadTooLarge(_) => codes::PAYLOAD_TOO_LARGE,
            Self::Gone(_) => codes::RESOURCE_NOT_FOUND,
            Self::Locked(_) => codes::FORBIDDEN,
        }
    }

    /// Human-readable problem type title.
    pub fn title(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "Resource Not Found",
            Self::BadRequest(_) => "Bad Request",
            Self::Validation(_) => "Validation Error",
            Self::Unauthorized(_) => "Unauthorized",
            Self::Forbidden(_) => "Forbidden",
            Self::Conflict(_) => "Resource Conflict",
            Self::Database(_) => "Database Error",
            Self::Internal(_) => "Internal Server Error",
            Self::ServiceUnavailable(_) => "Service Unavailable",
            Self::RateLimited(_) => "Rate Limit Exceeded",
            Self::PayloadTooLarge(_) => "Payload Too Large",
            Self::Gone(_) => "Resource Gone",
            Self::Locked(_) => "Resource Locked",
        }
    }

    /// Build RFC 7807 Problem Details response body.
    pub fn to_problem_details(&self) -> ProblemDetails {
        let code = self.code();
        let meta = self.meta();
        let field_errors = &meta.field_errors;

        ProblemDetails {
            problem_type: format!("https://forja.dev/errors/{}", code.to_lowercase()),
            title: self.title().to_string(),
            status: self.status().as_u16(),
            detail: Some(self.to_string()),
            instance: None,
            code: code.to_string(),
            entity_type: meta.entity_type.map(str::to_string),
            errors: if field_errors.is_empty() {
                None
            } else {
                Some(field_errors.clone())
            },
        }
    }
}

// ── Display + Error ─────────────────────────────────────────────────────

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.meta().message)
    }
}

impl std::error::Error for ApiError {}

// ── Response logging (shared by both framework adapters) ────────────────

/// Emit a tracing event for an `ApiError` based on its HTTP severity tier.
fn log_response_severity(err: &ApiError) {
    let status = err.status();
    let code = err.code();
    let status_code = status.as_u16();
    if status_code >= 500 {
        tracing::error!(error = %err, status = %status, code = %code, "🔴 Server error");
    } else if status_code == 429 {
        tracing::warn!(error = %err, status = %status, code = %code, "🟠 Rate limited");
    } else {
        tracing::warn!(error = %err, status = %status, code = %code, "🟡 Client error");
    }
}

// ── Axum IntoResponse ───────────────────────────────────────────────────

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        log_response_severity(&self);

        let status = self.status();
        let is_rate_limited = matches!(self, ApiError::RateLimited(_));

        let mut response = axum::Json(self.to_problem_details()).into_response();
        *response.status_mut() = status;

        if is_rate_limited {
            response.headers_mut().insert(
                axum::http::header::RETRY_AFTER,
                axum::http::HeaderValue::from_static("1"),
            );
        }

        response
    }
}

// ── ProblemDetails + FieldError ─────────────────────────────────────────

/// RFC 7807 Problem Details response
#[derive(Debug, Serialize, utoipa::ToSchema)]
#[schema(description = "RFC 7807 Problem Details error response")]
pub struct ProblemDetails {
    /// A URI reference that identifies the problem type
    #[serde(rename = "type")]
    #[schema(example = "https://forja.dev/errors/blog_not_found")]
    pub problem_type: String,

    /// A short, human-readable summary of the problem type
    #[schema(example = "Resource Not Found")]
    pub title: String,

    /// The HTTP status code
    #[schema(example = 404)]
    pub status: u16,

    /// A human-readable explanation specific to this occurrence
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "Blog with id '550e8400' not found")]
    pub detail: Option<String>,

    /// A URI reference that identifies the specific occurrence
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,

    /// Machine-readable error code for client handling
    #[schema(example = "ENTITY_NOT_FOUND")]
    pub code: String,

    /// Entity-type tag for general-purpose `ENTITY_*` codes (e.g. `"blog"`, `"page"`).
    /// Absent when the code is not an `ENTITY_*` code or no tag was attached.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "blog")]
    pub entity_type: Option<String>,

    /// Field-level validation errors
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<FieldError>>,
}

/// Field-level error for validation
#[derive(Debug, Serialize, Clone, utoipa::ToSchema)]
#[schema(description = "Field-level validation error")]
pub struct FieldError {
    #[schema(example = "email")]
    pub field: String,
    #[schema(example = "Invalid email format")]
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "INVALID_FORMAT")]
    pub code: Option<String>,
}

// ── From conversions ────────────────────────────────────────────────────

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ApiError::not_found("Resource not found"),
            sqlx::Error::Database(db_err) => {
                if db_err.code().map(|c| c == "23505").unwrap_or(false) {
                    ApiError::conflict("Resource already exists")
                } else if db_err.code().map(|c| c == "23503").unwrap_or(false) {
                    ApiError::bad_request("Referenced resource does not exist")
                } else if db_err.code().map(|c| c == "23514").unwrap_or(false) {
                    ApiError::bad_request("Data constraint violation")
                } else {
                    tracing::error!(error = %db_err, "Database error");
                    ApiError::database("A database error occurred")
                }
            }
            sqlx::Error::PoolTimedOut => {
                ApiError::service_unavailable("Database connection pool exhausted")
                    .with_code(codes::SERVICE_UNAVAILABLE)
            }
            _ => {
                tracing::error!(error = %err, "Unexpected database error");
                ApiError::database("A database error occurred")
            }
        }
    }
}

impl From<validator::ValidationErrors> for ApiError {
    fn from(err: validator::ValidationErrors) -> Self {
        let field_errors: Vec<FieldError> = err
            .field_errors()
            .iter()
            .flat_map(|(field, errors)| {
                errors.iter().map(move |e| FieldError {
                    field: field.to_string(),
                    message: e
                        .message
                        .clone()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| format!("Validation failed for field '{}'", field)),
                    code: e.code.to_string().into(),
                })
            })
            .collect();

        let message = if field_errors.len() == 1 {
            field_errors[0].message.clone()
        } else {
            format!("{} validation errors occurred", field_errors.len())
        };

        ApiError::validation(message).with_field_errors(field_errors)
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::bad_request(format!("JSON serialization error: {err}"))
    }
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    #[test]
    fn test_not_found_error() {
        let error = ApiError::not_found("User not found");
        assert_eq!(error.status(), StatusCode::NOT_FOUND);
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        assert_eq!(error.title(), "Resource Not Found");
    }

    #[test]
    fn test_bad_request_error() {
        let error = ApiError::bad_request("Invalid input");
        assert_eq!(error.status(), StatusCode::BAD_REQUEST);
        assert_eq!(error.code(), "BAD_REQUEST");
    }

    #[test]
    fn test_validation_error() {
        let error = ApiError::validation("Email is invalid");
        assert_eq!(error.status(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(error.code(), "VALIDATION_ERROR");
    }

    #[test]
    fn test_with_code_overrides_default() {
        let error = ApiError::not_found("Blog not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("blog");
        let details = error.to_problem_details();
        assert_eq!(details.code, "ENTITY_NOT_FOUND");
        assert_eq!(details.entity_type.as_deref(), Some("blog"));
        assert_eq!(details.status, 404);
        assert!(details.problem_type.contains("entity_not_found"));
    }

    #[test]
    fn test_default_code_without_override() {
        let error = ApiError::not_found("something");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
    }

    #[test]
    fn test_validation_with_field_errors_propagates() {
        let errors = vec![FieldError {
            field: "email".to_string(),
            message: "Invalid format".to_string(),
            code: Some("INVALID_FORMAT".to_string()),
        }];
        let error = ApiError::validation("Validation failed").with_field_errors(errors);
        let details = error.to_problem_details();
        assert!(details.errors.is_some());
        assert_eq!(details.errors.unwrap().len(), 1);
    }

    #[test]
    fn test_not_found_resource_attaches_code() {
        let error = ApiError::not_found_resource("Blog", "abc-123", codes::ENTITY_NOT_FOUND);
        assert_eq!(error.to_string(), "Blog with id 'abc-123' not found");
        assert_eq!(error.code(), "ENTITY_NOT_FOUND");
    }

    #[test]
    fn test_problem_details_serialization() {
        let error = ApiError::not_found("Site not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("site");
        let details = error.to_problem_details();

        assert_eq!(details.status, 404);
        assert_eq!(details.code, "ENTITY_NOT_FOUND");
        assert_eq!(details.title, "Resource Not Found");
        assert_eq!(details.detail, Some("Site not found".to_string()));

        let json = serde_json::to_string(&details).unwrap();
        assert!(json.contains("\"type\""));
        assert!(json.contains("\"title\""));
        assert!(json.contains("\"status\""));
        assert!(json.contains("\"code\""));
    }

    #[test]
    fn test_field_error_serialization() {
        let field_error = FieldError {
            field: "email".to_string(),
            message: "Invalid email format".to_string(),
            code: Some("INVALID_FORMAT".to_string()),
        };

        let json = serde_json::to_string(&field_error).unwrap();
        assert!(json.contains("\"field\":\"email\""));
        assert!(json.contains("\"message\":\"Invalid email format\""));
        assert!(json.contains("\"code\":\"INVALID_FORMAT\""));
    }

    #[test]
    fn test_validation_with_errors_helper() {
        let errors = vec![
            FieldError {
                field: "name".to_string(),
                message: "required".to_string(),
                code: None,
            },
            FieldError {
                field: "slug".to_string(),
                message: "invalid".to_string(),
                code: None,
            },
        ];
        let error = ApiError::validation_with_errors("2 validation errors", errors);
        let details = error.to_problem_details();
        assert_eq!(details.errors.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn test_all_constructors_produce_correct_status() {
        let cases: Vec<(ApiError, StatusCode)> = vec![
            (ApiError::not_found("x"), StatusCode::NOT_FOUND),
            (ApiError::bad_request("x"), StatusCode::BAD_REQUEST),
            (ApiError::validation("x"), StatusCode::UNPROCESSABLE_ENTITY),
            (ApiError::unauthorized("x"), StatusCode::UNAUTHORIZED),
            (ApiError::forbidden("x"), StatusCode::FORBIDDEN),
            (ApiError::conflict("x"), StatusCode::CONFLICT),
            (ApiError::database("x"), StatusCode::INTERNAL_SERVER_ERROR),
            (ApiError::internal("x"), StatusCode::INTERNAL_SERVER_ERROR),
            (
                ApiError::service_unavailable("x"),
                StatusCode::SERVICE_UNAVAILABLE,
            ),
            (ApiError::rate_limited("x"), StatusCode::TOO_MANY_REQUESTS),
        ];
        for (error, expected) in cases {
            assert_eq!(error.status(), expected, "Failed for: {}", error);
        }
    }

    #[test]
    fn test_display_shows_message() {
        let error = ApiError::not_found("Blog with id '123' not found");
        assert_eq!(error.to_string(), "Blog with id '123' not found");
    }

    #[test]
    fn test_problem_details_without_field_errors_omits_field() {
        let error = ApiError::not_found("x");
        let details = error.to_problem_details();
        assert!(details.errors.is_none());

        let json = serde_json::to_string(&details).unwrap();
        assert!(!json.contains("\"errors\""));
    }

    // ── Axum IntoResponse ────────────────────────────────────────────────
    // These verify the response shape so handlers/extractors can return
    // ApiError directly and trust the wire format.

    use axum::body::to_bytes;
    use axum::http::StatusCode as AxumStatus;
    use axum::response::IntoResponse;

    #[tokio::test]
    async fn into_response_maps_status_and_body() {
        let response = ApiError::not_found("User 42 not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("user")
            .into_response();

        assert_eq!(response.status(), AxumStatus::NOT_FOUND);
        assert_eq!(
            response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok()),
            Some("application/json")
        );

        let body_bytes = to_bytes(response.into_body(), 4096).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(body["status"], 404);
        assert_eq!(body["code"], codes::ENTITY_NOT_FOUND);
        assert_eq!(body["detail"], "User 42 not found");
    }

    #[tokio::test]
    async fn into_response_rate_limited_sets_retry_after() {
        let response = ApiError::rate_limited("Slow down").into_response();
        assert_eq!(response.status(), AxumStatus::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get(axum::http::header::RETRY_AFTER)
                .and_then(|v| v.to_str().ok()),
            Some("1")
        );
    }

    #[tokio::test]
    async fn into_response_non_rate_limited_omits_retry_after() {
        let response = ApiError::bad_request("Bad").into_response();
        assert!(!response
            .headers()
            .contains_key(axum::http::header::RETRY_AFTER));
    }

    #[tokio::test]
    async fn into_response_internal_error_uses_500() {
        let response = ApiError::internal("boom").into_response();
        assert_eq!(response.status(), AxumStatus::INTERNAL_SERVER_ERROR);
    }

    // ── entity_type plumbing (issue #529) ────────────────────────────────

    #[tokio::test]
    async fn tracer_bullet_entity_type_flows_to_wire() {
        // GET non-existent blog → response includes
        // `code: ENTITY_NOT_FOUND, entity_type: blog` end-to-end.
        let response = ApiError::not_found("Blog with id '550e8400' not found")
            .with_code(codes::ENTITY_NOT_FOUND)
            .with_entity_type("blog")
            .into_response();

        assert_eq!(response.status(), AxumStatus::NOT_FOUND);
        let body_bytes = to_bytes(response.into_body(), 4096).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(body["status"], 404);
        assert_eq!(body["code"], "ENTITY_NOT_FOUND");
        assert_eq!(body["entity_type"], "blog");
        assert_eq!(body["detail"], "Blog with id '550e8400' not found");
    }

    #[test]
    fn entity_type_omitted_when_not_set() {
        // No with_entity_type call → field absent from serialization.
        let error = ApiError::not_found("x").with_code(codes::ENTITY_NOT_FOUND);
        let details = error.to_problem_details();
        assert!(details.entity_type.is_none());

        let json = serde_json::to_string(&details).unwrap();
        assert!(
            !json.contains("entity_type"),
            "entity_type should be omitted when None: {}",
            json
        );
    }

    #[test]
    fn entity_codes_exist_in_catalog() {
        // The four general-purpose entity codes must be findable in ALL[].
        for code in [
            codes::ENTITY_NOT_FOUND,
            codes::ENTITY_SLUG_TAKEN,
            codes::ENTITY_LOCALIZATION_EXISTS,
            codes::ENTITY_LOCALIZATION_NOT_FOUND,
        ] {
            assert!(
                codes::find_by_code(code).is_some(),
                "Expected {} in ALL[] catalog",
                code
            );
        }
    }
}
