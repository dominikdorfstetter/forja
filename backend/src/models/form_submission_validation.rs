//! Form-submission validation engine (#620 Slice 4).
//!
//! Pure functions that validate a visitor's `SubmitFormRequest::data` blob
//! against the declared fields of a form. No DB, no I/O — split out of
//! `models::form_submission` so the model file can shrink to data structures
//! only. Consumed by `services::form_submission_service::submit`.

use std::collections::HashMap;

use lazy_static::lazy_static;
use regex::Regex;
use serde_json::Value as JsonValue;

use crate::dto::forms::{FormFieldResponse, FormFieldType};
use crate::errors::{codes, ApiError, FieldError};

/// Validation error map: `{ field_label: error_message }`.
pub type FieldErrors = HashMap<String, String>;

/// Restrict the submitted `data` object to keys that match a declared field
/// label on the form. Anything else gets dropped silently — visitors using
/// the standard renderer never hit this; hand-rolled clients trying to
/// pollute the JSONB blob with extra keys do.
pub(crate) fn filter_to_declared_fields(
    data: &JsonValue,
    fields: &[FormFieldResponse],
) -> JsonValue {
    let Some(obj) = data.as_object() else {
        return data.clone();
    };
    let labels: std::collections::HashSet<&str> = fields.iter().map(|f| f.label.as_str()).collect();
    let filtered: serde_json::Map<String, JsonValue> = obj
        .iter()
        .filter(|(k, _)| labels.contains(k.as_str()))
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    JsonValue::Object(filtered)
}

/// Validate a submission `data` value against a form's field definitions.
/// Empty map = success. Each entry maps field label → human error message.
pub fn validate_submission(fields: &[FormFieldResponse], data: &JsonValue) -> FieldErrors {
    let mut errors: FieldErrors = HashMap::new();
    let empty = serde_json::Map::new();
    let data_map = data.as_object().unwrap_or(&empty);

    for field in fields {
        let value = data_map.get(&field.label);
        if let Err(msg) = validate_field(field, value) {
            errors.insert(field.label.clone(), msg);
        }
    }
    errors
}

fn validate_field(field: &FormFieldResponse, value: Option<&JsonValue>) -> Result<(), String> {
    let v = match value {
        None => JsonValue::Null,
        Some(v) => v.clone(),
    };

    let is_empty = match &v {
        JsonValue::Null => true,
        JsonValue::String(s) => s.is_empty(),
        JsonValue::Array(a) => a.is_empty(),
        _ => false,
    };

    if (field.is_required || rule_bool(&field.validation, "required")) && is_empty {
        return Err(format!("{} is required", field.label));
    }
    if is_empty {
        return Ok(());
    }

    match field.field_type {
        FormFieldType::Text | FormFieldType::Textarea | FormFieldType::Custom => {
            let s = v.as_str().ok_or_else(|| "Must be a string".to_string())?;
            check_length(&field.validation, s)?;
            check_pattern(&field.validation, s)?;
        }
        FormFieldType::Email => {
            let s = v.as_str().ok_or_else(|| "Must be a string".to_string())?;
            if !is_valid_email(s) {
                return Err("Invalid email format".to_string());
            }
            check_length(&field.validation, s)?;
        }
        FormFieldType::Number => {
            let n = value_as_f64(&v).ok_or_else(|| "Must be a number".to_string())?;
            if let Some(min) = rule_f64(&field.validation, "min") {
                if n < min {
                    return Err(format!("Must be at least {}", min));
                }
            }
            if let Some(max) = rule_f64(&field.validation, "max") {
                if n > max {
                    return Err(format!("Must be at most {}", max));
                }
            }
        }
        FormFieldType::Date => {
            let s = v
                .as_str()
                .ok_or_else(|| "Must be a date string".to_string())?;
            // Accept either RFC 3339 timestamp or YYYY-MM-DD.
            if chrono::DateTime::parse_from_rfc3339(s).is_err()
                && chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_err()
            {
                return Err("Invalid date format (expected YYYY-MM-DD or RFC 3339)".to_string());
            }
        }
        FormFieldType::Select | FormFieldType::Radio => {
            let s = v.as_str().ok_or_else(|| "Must be a string".to_string())?;
            if let Some(opts) = field.options.as_ref().and_then(option_keys) {
                if !opts.iter().any(|o| o == s) {
                    return Err("Value is not one of the allowed options".to_string());
                }
            }
        }
        FormFieldType::Checkbox => {
            if let Some(arr) = v.as_array() {
                if let Some(opts) = field.options.as_ref().and_then(option_keys) {
                    for item in arr {
                        let s = item
                            .as_str()
                            .ok_or_else(|| "Must be a string".to_string())?;
                        if !opts.iter().any(|o| o == s) {
                            return Err(format!("\"{}\" is not one of the allowed options", s));
                        }
                    }
                }
            } else if v.as_bool().is_none() {
                return Err("Must be a boolean or an array of option keys".to_string());
            }
        }
    }
    Ok(())
}

fn check_length(validation: &JsonValue, s: &str) -> Result<(), String> {
    let len = s.chars().count();
    if let Some(min) = rule_u64(validation, "min_length") {
        if (len as u64) < min {
            return Err(format!("Must be at least {} characters", min));
        }
    }
    if let Some(max) = rule_u64(validation, "max_length") {
        if (len as u64) > max {
            return Err(format!("Must be at most {} characters", max));
        }
    }
    Ok(())
}

fn check_pattern(validation: &JsonValue, s: &str) -> Result<(), String> {
    if let Some(pat) = validation.get("pattern").and_then(|v| v.as_str()) {
        // Compile per-field-per-submission. Forms have <50 fields and
        // submissions are not hot-path; not worth caching.
        match Regex::new(pat) {
            Ok(re) if re.is_match(s) => Ok(()),
            Ok(_) => Err("Value does not match the required pattern".to_string()),
            // A bad pattern in the form definition is the admin's problem,
            // not the visitor's — surface it but don't crash the request.
            Err(_) => Err("Field has an invalid validation pattern".to_string()),
        }
    } else {
        Ok(())
    }
}

fn rule_bool(validation: &JsonValue, key: &str) -> bool {
    validation
        .get(key)
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

fn rule_u64(validation: &JsonValue, key: &str) -> Option<u64> {
    validation.get(key).and_then(|v| v.as_u64())
}

fn rule_f64(validation: &JsonValue, key: &str) -> Option<f64> {
    validation.get(key).and_then(|v| v.as_f64())
}

fn value_as_f64(v: &JsonValue) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.parse::<f64>().ok()))
}

fn option_keys(opts: &JsonValue) -> Option<Vec<String>> {
    // Accept either an array of strings or an array of `{key, label}` objects.
    let arr = opts.as_array()?;
    arr.iter()
        .map(|item| {
            item.as_str()
                .or_else(|| item.get("key").and_then(|v| v.as_str()))
                .map(str::to_string)
        })
        .collect()
}

lazy_static! {
    /// Pragmatic RFC-5322-ish email regex. Not bulletproof, but sufficient
    /// for blocking obvious typos like "notanemail".
    static ref EMAIL_RE: Regex = Regex::new(
        r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"
    ).expect("static email regex");
}

fn is_valid_email(s: &str) -> bool {
    EMAIL_RE.is_match(s)
}

pub(crate) fn validation_failed_error(errors: FieldErrors) -> ApiError {
    let field_errors: Vec<FieldError> = errors
        .into_iter()
        .map(|(field, message)| FieldError {
            field,
            message,
            code: Some(codes::FORM_VALIDATION_FAILED.to_string()),
        })
        .collect();
    ApiError::bad_request("Validation failed")
        .with_code(codes::FORM_VALIDATION_FAILED)
        .with_field_errors(field_errors)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::forms::FormFieldResponse;
    use serde_json::json;
    use uuid::Uuid;

    fn field(
        label: &str,
        ty: FormFieldType,
        required: bool,
        validation: JsonValue,
    ) -> FormFieldResponse {
        FormFieldResponse {
            id: Uuid::new_v4(),
            label: label.into(),
            field_type: ty,
            placeholder: None,
            help_text: None,
            validation,
            options: None,
            is_required: required,
            display_order: 0,
            localizations: vec![],
        }
    }

    #[test]
    fn email_field_rejects_invalid_format() {
        let fields = vec![field("Email", FormFieldType::Email, true, json!({}))];
        let errors = validate_submission(&fields, &json!({"Email": "notanemail"}));
        assert_eq!(errors.get("Email").unwrap(), "Invalid email format");
    }

    #[test]
    fn email_field_accepts_valid_address() {
        let fields = vec![field("Email", FormFieldType::Email, true, json!({}))];
        let errors = validate_submission(&fields, &json!({"Email": "user@example.com"}));
        assert!(errors.is_empty(), "got: {errors:?}");
    }

    #[test]
    fn required_field_missing_is_rejected() {
        let fields = vec![field("Name", FormFieldType::Text, true, json!({}))];
        let errors = validate_submission(&fields, &json!({}));
        assert!(errors.contains_key("Name"));
    }

    #[test]
    fn text_field_enforces_min_max_length() {
        let fields = vec![field(
            "Body",
            FormFieldType::Textarea,
            true,
            json!({"min_length": 10, "max_length": 20}),
        )];
        let too_short = validate_submission(&fields, &json!({"Body": "short"}));
        assert!(too_short.get("Body").unwrap().contains("at least 10"));

        let too_long = validate_submission(&fields, &json!({"Body": "x".repeat(21)}));
        assert!(too_long.get("Body").unwrap().contains("at most 20"));

        let ok = validate_submission(&fields, &json!({"Body": "just enough"}));
        assert!(ok.is_empty());
    }

    #[test]
    fn number_field_enforces_min_max() {
        let fields = vec![field(
            "Age",
            FormFieldType::Number,
            true,
            json!({"min": 18, "max": 100}),
        )];
        assert!(validate_submission(&fields, &json!({"Age": 10}))
            .get("Age")
            .unwrap()
            .contains("at least 18"));
        assert!(validate_submission(&fields, &json!({"Age": 150}))
            .get("Age")
            .unwrap()
            .contains("at most 100"));
        assert!(validate_submission(&fields, &json!({"Age": 42})).is_empty());
    }

    #[test]
    fn custom_field_enforces_pattern() {
        let fields = vec![field(
            "ZIP",
            FormFieldType::Custom,
            true,
            json!({"pattern": "^[0-9]{5}$"}),
        )];
        assert!(validate_submission(&fields, &json!({"ZIP": "abcde"})).contains_key("ZIP"));
        assert!(validate_submission(&fields, &json!({"ZIP": "12345"})).is_empty());
    }

    #[test]
    fn optional_field_can_be_empty() {
        let fields = vec![field("Note", FormFieldType::Text, false, json!({}))];
        assert!(validate_submission(&fields, &json!({})).is_empty());
        assert!(validate_submission(&fields, &json!({"Note": ""})).is_empty());
    }

    #[test]
    fn date_field_accepts_iso_dates() {
        let fields = vec![field("DOB", FormFieldType::Date, true, json!({}))];
        assert!(validate_submission(&fields, &json!({"DOB": "2026-05-11"})).is_empty());
        assert!(validate_submission(&fields, &json!({"DOB": "not-a-date"})).contains_key("DOB"));
    }

    #[test]
    fn filter_to_declared_fields_drops_undeclared_keys() {
        let fields = vec![field("Email", FormFieldType::Email, true, json!({}))];
        let submitted = json!({
            "Email": "v@example.com",
            "__exfil": "<script>alert(1)</script>",
            "padding": "x".repeat(100),
        });
        let filtered = filter_to_declared_fields(&submitted, &fields);
        let obj = filtered.as_object().expect("object");
        assert_eq!(obj.len(), 1);
        assert_eq!(
            obj.get("Email").and_then(|v| v.as_str()),
            Some("v@example.com")
        );
        assert!(obj.get("__exfil").is_none());
        assert!(obj.get("padding").is_none());
    }

    #[test]
    fn filter_to_declared_fields_passes_through_non_object_data() {
        let fields: Vec<FormFieldResponse> = vec![];
        let value = json!("not an object");
        let filtered = filter_to_declared_fields(&value, &fields);
        assert_eq!(filtered, json!("not an object"));
    }
}
