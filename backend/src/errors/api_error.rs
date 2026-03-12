//! API Error types and handling
//!
//! Implements RFC 7807 (Problem Details for HTTP APIs) compliant error responses.
//! Error codes follow the `{DOMAIN}_{ACTION}_{REASON}` pattern from `errors::codes`.

use rocket::http::{ContentType, Status};
use rocket::response::{self, Responder, Response};
use rocket::Request;
use serde::Serialize;
use std::io::Cursor;

use super::codes;

// ── ErrorMeta ───────────────────────────────────────────────────────────

/// Internal payload carried by every `ApiError` variant.
/// Fields are not part of the public API — use constructor methods and builders instead.
#[derive(Debug)]
#[doc(hidden)]
pub struct ErrorMeta {
    pub(crate) message: String,
    pub(crate) error_code: Option<&'static str>,
    pub(crate) field_errors: Vec<FieldError>,
}

impl ErrorMeta {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            error_code: None,
            field_errors: Vec::new(),
        }
    }
}

// ── ApiError ────────────────────────────────────────────────────────────

/// API Error type — each variant maps to an HTTP status code.
///
/// Construct via methods: `ApiError::not_found(...)`, `ApiError::bad_request(...)`, etc.
/// Chain `.with_code(codes::BLOG_NOT_FOUND)` to attach a domain-specific error code.
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
            | Self::RateLimited(m) => m,
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
            | Self::RateLimited(m) => m,
        }
    }

    /// HTTP status code for this error.
    pub fn status(&self) -> Status {
        match self {
            Self::NotFound(_) => Status::NotFound,
            Self::BadRequest(_) => Status::BadRequest,
            Self::Validation(_) => Status::UnprocessableEntity,
            Self::Unauthorized(_) => Status::Unauthorized,
            Self::Forbidden(_) => Status::Forbidden,
            Self::Conflict(_) => Status::Conflict,
            Self::Database(_) | Self::Internal(_) => Status::InternalServerError,
            Self::ServiceUnavailable(_) => Status::ServiceUnavailable,
            Self::RateLimited(_) => Status::TooManyRequests,
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
        }
    }

    /// Build RFC 7807 Problem Details response body.
    pub fn to_problem_details(&self) -> ProblemDetails {
        let code = self.code();
        let field_errors = &self.meta().field_errors;

        ProblemDetails {
            problem_type: format!("https://forja.dev/errors/{}", code.to_lowercase()),
            title: self.title().to_string(),
            status: self.status().code,
            detail: Some(self.to_string()),
            instance: None,
            code: code.to_string(),
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

// ── Responder ───────────────────────────────────────────────────────────

impl<'r> Responder<'r, 'static> for ApiError {
    fn respond_to(self, _req: &'r Request<'_>) -> response::Result<'static> {
        let status = self.status();
        let code = self.code().to_string();
        let body = self.to_problem_details();

        tracing::error!(
            error = %self,
            status = %status,
            code = %code,
            "API error response"
        );

        let json = serde_json::to_string(&body).map_err(|_| Status::InternalServerError)?;

        let mut response = Response::build();
        response
            .status(status)
            .header(ContentType::JSON)
            .sized_body(json.len(), Cursor::new(json));

        if matches!(self, ApiError::RateLimited(_)) {
            response.header(rocket::http::Header::new("Retry-After", "1"));
        }

        response.ok()
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
    #[schema(example = "BLOG_NOT_FOUND")]
    pub code: String,

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
    use rocket::http::Status;

    #[test]
    fn test_not_found_error() {
        let error = ApiError::not_found("User not found");
        assert_eq!(error.status(), Status::NotFound);
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        assert_eq!(error.title(), "Resource Not Found");
    }

    #[test]
    fn test_bad_request_error() {
        let error = ApiError::bad_request("Invalid input");
        assert_eq!(error.status(), Status::BadRequest);
        assert_eq!(error.code(), "BAD_REQUEST");
    }

    #[test]
    fn test_validation_error() {
        let error = ApiError::validation("Email is invalid");
        assert_eq!(error.status(), Status::UnprocessableEntity);
        assert_eq!(error.code(), "VALIDATION_ERROR");
    }

    #[test]
    fn test_with_code_overrides_default() {
        let error = ApiError::not_found("Blog not found").with_code(codes::BLOG_NOT_FOUND);
        let details = error.to_problem_details();
        assert_eq!(details.code, "BLOG_NOT_FOUND");
        assert_eq!(details.status, 404);
        assert!(details.problem_type.contains("blog_not_found"));
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
        let error = ApiError::not_found_resource("Blog", "abc-123", codes::BLOG_NOT_FOUND);
        assert_eq!(error.to_string(), "Blog with id 'abc-123' not found");
        assert_eq!(error.code(), "BLOG_NOT_FOUND");
    }

    #[test]
    fn test_problem_details_serialization() {
        let error = ApiError::not_found("Site not found").with_code(codes::SITE_NOT_FOUND);
        let details = error.to_problem_details();

        assert_eq!(details.status, 404);
        assert_eq!(details.code, "SITE_NOT_FOUND");
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
        let cases: Vec<(ApiError, Status)> = vec![
            (ApiError::not_found("x"), Status::NotFound),
            (ApiError::bad_request("x"), Status::BadRequest),
            (ApiError::validation("x"), Status::UnprocessableEntity),
            (ApiError::unauthorized("x"), Status::Unauthorized),
            (ApiError::forbidden("x"), Status::Forbidden),
            (ApiError::conflict("x"), Status::Conflict),
            (ApiError::database("x"), Status::InternalServerError),
            (ApiError::internal("x"), Status::InternalServerError),
            (
                ApiError::service_unavailable("x"),
                Status::ServiceUnavailable,
            ),
            (ApiError::rate_limited("x"), Status::TooManyRequests),
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
}
