//! API Error types and handling
//!
//! Implements RFC 7807 (Problem Details for HTTP APIs) compliant error responses.

use rocket::http::{ContentType, Status};
use rocket::response::{self, Responder, Response};
use rocket::Request;
use serde::Serialize;
use std::io::Cursor;
use thiserror::Error;

/// API Error type
#[derive(Debug, Error)]
pub enum ApiError {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Validation(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    Conflict(String),

    #[error("{0}")]
    Database(String),

    #[error("{0}")]
    Internal(String),

    #[error("{0}")]
    ServiceUnavailable(String),

    #[error("{0}")]
    RateLimited(String),
}

/// RFC 7807 Problem Details response
#[derive(Debug, Serialize, utoipa::ToSchema)]
#[schema(description = "RFC 7807 Problem Details error response")]
pub struct ProblemDetails {
    /// A URI reference that identifies the problem type
    #[serde(rename = "type")]
    #[schema(example = "https://openyapper.dev/errors/not_found")]
    pub problem_type: String,

    /// A short, human-readable summary of the problem type
    #[schema(example = "Resource Not Found")]
    pub title: String,

    /// The HTTP status code
    #[schema(example = 404)]
    pub status: u16,

    /// A human-readable explanation specific to this occurrence
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = "Site with id '550e8400' not found")]
    pub detail: Option<String>,

    /// A URI reference that identifies the specific occurrence
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,

    /// Machine-readable error code for client handling
    #[schema(example = "NOT_FOUND")]
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

impl ApiError {
    /// Get the HTTP status code for this error
    pub fn status(&self) -> Status {
        match self {
            ApiError::NotFound(_) => Status::NotFound,
            ApiError::BadRequest(_) => Status::BadRequest,
            ApiError::Validation(_) => Status::UnprocessableEntity,
            ApiError::Unauthorized(_) => Status::Unauthorized,
            ApiError::Forbidden(_) => Status::Forbidden,
            ApiError::Conflict(_) => Status::Conflict,
            ApiError::Database(_) => Status::InternalServerError,
            ApiError::Internal(_) => Status::InternalServerError,
            ApiError::ServiceUnavailable(_) => Status::ServiceUnavailable,
            ApiError::RateLimited(_) => Status::TooManyRequests,
        }
    }

    /// Get the error code string
    pub fn code(&self) -> &'static str {
        match self {
            ApiError::NotFound(_) => "NOT_FOUND",
            ApiError::BadRequest(_) => "BAD_REQUEST",
            ApiError::Validation(_) => "VALIDATION_ERROR",
            ApiError::Unauthorized(_) => "UNAUTHORIZED",
            ApiError::Forbidden(_) => "FORBIDDEN",
            ApiError::Conflict(_) => "CONFLICT",
            ApiError::Database(_) => "DATABASE_ERROR",
            ApiError::Internal(_) => "INTERNAL_ERROR",
            ApiError::ServiceUnavailable(_) => "SERVICE_UNAVAILABLE",
            ApiError::RateLimited(_) => "RATE_LIMITED",
        }
    }

    /// Get the problem type title
    pub fn title(&self) -> &'static str {
        match self {
            ApiError::NotFound(_) => "Resource Not Found",
            ApiError::BadRequest(_) => "Bad Request",
            ApiError::Validation(_) => "Validation Error",
            ApiError::Unauthorized(_) => "Unauthorized",
            ApiError::Forbidden(_) => "Forbidden",
            ApiError::Conflict(_) => "Resource Conflict",
            ApiError::Database(_) => "Database Error",
            ApiError::Internal(_) => "Internal Server Error",
            ApiError::ServiceUnavailable(_) => "Service Unavailable",
            ApiError::RateLimited(_) => "Rate Limit Exceeded",
        }
    }

    /// Create a Problem Details response
    pub fn to_problem_details(&self) -> ProblemDetails {
        let status = self.status();
        ProblemDetails {
            problem_type: format!(
                "https://openyapper.dev/errors/{}",
                self.code().to_lowercase()
            ),
            title: self.title().to_string(),
            status: status.code,
            detail: Some(self.to_string()),
            instance: None,
            code: self.code().to_string(),
            errors: None,
        }
    }

    /// Create a validation error with field-level details
    pub fn validation_with_errors(message: String, _errors: Vec<FieldError>) -> Self {
        ApiError::Validation(message)
    }

    /// Helper to create a not found error for a specific resource
    pub fn not_found_resource(resource: &str, id: impl std::fmt::Display) -> Self {
        ApiError::NotFound(format!("{} with id '{}' not found", resource, id))
    }
}

impl<'r> Responder<'r, 'static> for ApiError {
    fn respond_to(self, _req: &'r Request<'_>) -> response::Result<'static> {
        let status = self.status();
        let body = self.to_problem_details();

        tracing::error!(
            error = %self,
            status = %status,
            code = %self.code(),
            "API error response"
        );

        let json = serde_json::to_string(&body).map_err(|_| Status::InternalServerError)?;

        let mut response = Response::build();
        response
            .status(status)
            .header(ContentType::JSON)
            .sized_body(json.len(), Cursor::new(json));

        // Add Retry-After header for rate limited responses
        if matches!(self, ApiError::RateLimited(_)) {
            response.header(rocket::http::Header::new("Retry-After", "1"));
        }

        response.ok()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => ApiError::NotFound("Resource not found".to_string()),
            sqlx::Error::Database(db_err) => {
                // Check for unique constraint violation (PostgreSQL code 23505)
                if db_err.code().map(|c| c == "23505").unwrap_or(false) {
                    ApiError::Conflict("Resource already exists".to_string())
                // Check for foreign key violation (PostgreSQL code 23503)
                } else if db_err.code().map(|c| c == "23503").unwrap_or(false) {
                    ApiError::BadRequest("Referenced resource does not exist".to_string())
                // Check for check constraint violation (PostgreSQL code 23514)
                } else if db_err.code().map(|c| c == "23514").unwrap_or(false) {
                    ApiError::BadRequest("Data constraint violation".to_string())
                } else {
                    // Log the full error but return a sanitized message
                    tracing::error!(error = %db_err, "Database error");
                    ApiError::Database("A database error occurred".to_string())
                }
            }
            sqlx::Error::PoolTimedOut => {
                ApiError::ServiceUnavailable("Database connection pool exhausted".to_string())
            }
            _ => {
                tracing::error!(error = %err, "Unexpected database error");
                ApiError::Database("A database error occurred".to_string())
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

        ApiError::Validation(message)
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::BadRequest(format!("JSON serialization error: {err}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found_error() {
        let error = ApiError::NotFound("User not found".to_string());
        assert_eq!(error.status(), Status::NotFound);
        assert_eq!(error.code(), "NOT_FOUND");
        assert_eq!(error.title(), "Resource Not Found");
    }

    #[test]
    fn test_bad_request_error() {
        let error = ApiError::BadRequest("Invalid input".to_string());
        assert_eq!(error.status(), Status::BadRequest);
        assert_eq!(error.code(), "BAD_REQUEST");
    }

    #[test]
    fn test_validation_error() {
        let error = ApiError::Validation("Email is invalid".to_string());
        assert_eq!(error.status(), Status::UnprocessableEntity);
        assert_eq!(error.code(), "VALIDATION_ERROR");
    }

    #[test]
    fn test_problem_details_serialization() {
        let error = ApiError::NotFound("Site not found".to_string());
        let details = error.to_problem_details();

        assert_eq!(details.status, 404);
        assert_eq!(details.code, "NOT_FOUND");
        assert_eq!(details.title, "Resource Not Found");
        assert_eq!(details.detail, Some("Site not found".to_string()));

        // Verify it serializes to valid JSON
        let json = serde_json::to_string(&details).unwrap();
        assert!(json.contains("\"type\""));
        assert!(json.contains("\"title\""));
        assert!(json.contains("\"status\""));
        assert!(json.contains("\"code\""));
    }

    #[test]
    fn test_not_found_resource_helper() {
        let error = ApiError::not_found_resource("Site", "123e4567-e89b-12d3-a456-426614174000");
        assert_eq!(
            error.to_string(),
            "Site with id '123e4567-e89b-12d3-a456-426614174000' not found"
        );
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
}
