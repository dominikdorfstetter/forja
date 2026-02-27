//! Cross-cutting API tests
//!
//! These tests verify error handling, RFC 7807 ProblemDetails format, and
//! shared API contracts. DTO-specific validation tests live inline in each
//! DTO module under `backend/src/dto/`.

mod common;

use openyapper::errors::{ApiError, FieldError, ProblemDetails};
use rocket::http::Status;

// =========================================================================
// Error handling & RFC 7807 ProblemDetails
// =========================================================================

/// Test that API errors generate correct Problem Details format
#[test]
fn test_error_response_format() {
    let error = ApiError::NotFound("Site not found".to_string());
    let details = error.to_problem_details();

    // Verify RFC 7807 fields
    assert_eq!(details.status, 404);
    assert_eq!(details.code, "NOT_FOUND");
    assert_eq!(details.title, "Resource Not Found");
    assert!(details.detail.is_some());
    assert!(details.problem_type.contains("not_found"));

    // Verify JSON serialization
    let json = serde_json::to_string(&details).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

    assert!(parsed.get("type").is_some(), "Must have 'type' field");
    assert!(parsed.get("title").is_some(), "Must have 'title' field");
    assert!(parsed.get("status").is_some(), "Must have 'status' field");
    assert!(parsed.get("code").is_some(), "Must have 'code' field");
}

/// Test all error types generate correct status codes
#[test]
fn test_error_status_codes() {
    let test_cases = vec![
        (ApiError::NotFound("test".into()), Status::NotFound),
        (ApiError::BadRequest("test".into()), Status::BadRequest),
        (
            ApiError::Validation("test".into()),
            Status::UnprocessableEntity,
        ),
        (ApiError::Unauthorized("test".into()), Status::Unauthorized),
        (ApiError::Forbidden("test".into()), Status::Forbidden),
        (ApiError::Conflict("test".into()), Status::Conflict),
        (
            ApiError::Database("test".into()),
            Status::InternalServerError,
        ),
        (
            ApiError::Internal("test".into()),
            Status::InternalServerError,
        ),
        (
            ApiError::ServiceUnavailable("test".into()),
            Status::ServiceUnavailable,
        ),
    ];

    for (error, expected_status) in test_cases {
        assert_eq!(
            error.status(),
            expected_status,
            "Error {:?} should have status {}",
            error,
            expected_status
        );
    }
}

/// Test ProblemDetails follows RFC 7807 format
#[test]
fn test_problem_details_rfc7807_compliance() {
    let details = ProblemDetails {
        problem_type: "https://api.example.com/errors/not_found".to_string(),
        title: "Resource Not Found".to_string(),
        status: 404,
        detail: Some("The requested resource was not found".to_string()),
        instance: Some("/api/v1/sites/123".to_string()),
        code: "NOT_FOUND".to_string(),
        errors: None,
    };

    let json = serde_json::to_string(&details).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

    // RFC 7807 required fields
    assert!(parsed.get("type").is_some(), "RFC 7807 requires 'type'");
    assert!(parsed.get("title").is_some(), "RFC 7807 requires 'title'");
    assert!(parsed.get("status").is_some(), "RFC 7807 requires 'status'");

    // Optional fields present when set
    assert!(parsed.get("detail").is_some());
    assert!(parsed.get("instance").is_some());
}

/// Test error helper functions
#[test]
fn test_error_helpers() {
    let error = ApiError::not_found_resource("Site", "abc123");
    assert_eq!(error.to_string(), "Site with id 'abc123' not found");
    assert_eq!(error.status(), Status::NotFound);
    assert_eq!(error.code(), "NOT_FOUND");
}

/// Test validation error conversion preserves field information
#[test]
fn test_validation_error_field_info() {
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

/// Test ProblemDetails with field-level errors
#[test]
fn test_problem_details_with_field_errors() {
    let details = ProblemDetails {
        problem_type: "https://api.example.com/errors/validation".to_string(),
        title: "Validation Error".to_string(),
        status: 422,
        detail: Some("One or more fields failed validation".to_string()),
        instance: None,
        code: "VALIDATION_ERROR".to_string(),
        errors: Some(vec![
            FieldError {
                field: "name".to_string(),
                message: "Name is required".to_string(),
                code: Some("REQUIRED".to_string()),
            },
            FieldError {
                field: "slug".to_string(),
                message: "Slug format is invalid".to_string(),
                code: Some("INVALID_FORMAT".to_string()),
            },
        ]),
    };

    let json = serde_json::to_string(&details).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

    let errors = parsed.get("errors").expect("Must have 'errors' array");
    assert!(errors.is_array());
    assert_eq!(errors.as_array().unwrap().len(), 2);
}

/// Test ProblemDetails without optional fields omits them
#[test]
fn test_problem_details_optional_fields_omitted() {
    let details = ProblemDetails {
        problem_type: "https://api.example.com/errors/not_found".to_string(),
        title: "Not Found".to_string(),
        status: 404,
        detail: None,
        instance: None,
        code: "NOT_FOUND".to_string(),
        errors: None,
    };

    let json = serde_json::to_string(&details).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

    // Optional fields should be absent or null
    assert!(
        parsed.get("instance").is_none() || parsed.get("instance").unwrap().is_null(),
        "instance should be omitted or null when None"
    );
}

/// Test all error variants produce valid ProblemDetails
#[test]
fn test_all_errors_produce_valid_problem_details() {
    let errors = vec![
        ApiError::NotFound("not found".into()),
        ApiError::BadRequest("bad request".into()),
        ApiError::Validation("validation".into()),
        ApiError::Unauthorized("unauthorized".into()),
        ApiError::Forbidden("forbidden".into()),
        ApiError::Conflict("conflict".into()),
        ApiError::Database("database".into()),
        ApiError::Internal("internal".into()),
        ApiError::ServiceUnavailable("unavailable".into()),
    ];

    for error in errors {
        let details = error.to_problem_details();

        // Every ProblemDetails must have these fields
        assert!(!details.problem_type.is_empty(), "type must not be empty");
        assert!(!details.title.is_empty(), "title must not be empty");
        assert!(details.status >= 400, "status must be an error code");
        assert!(!details.code.is_empty(), "code must not be empty");

        // Must be valid JSON
        let json = serde_json::to_string(&details).unwrap();
        let _parsed: serde_json::Value =
            serde_json::from_str(&json).expect("ProblemDetails must produce valid JSON");
    }
}
