//! Runtime entry validator (#792) — the novel core.
//!
//! The runtime sibling to the compile-time `Validated<T>` wall: a pure
//! `(schema, payload) -> Result` function that checks submitted field values
//! against a stored custom-type schema. No database, no side effects — so it
//! is exhaustively unit-testable. Storage, PII encryption, and the HTTP wall
//! build on top of it (see `custom_entry.rs` and #793).
//!
//! Checks: unknown keys rejected, localized-vs-shared routing, required-field
//! presence, per-type coercion (text/richtext/number/boolean/date/enum/media),
//! enum membership, numeric min/max, text length, and regex pattern.

use serde_json::Value;

use crate::dto::custom_entry::CustomEntryRequest;
use crate::dto::custom_type::{CustomFieldResponse, CustomFieldType};
use crate::errors::{ApiError, codes};

fn invalid(field: &str, msg: &str) -> ApiError {
    ApiError::validation(format!("Field '{field}': {msg}"))
        .with_code(codes::ERR_CUSTOM_ENTRY_VALIDATION)
}

fn missing(field: &str) -> ApiError {
    ApiError::validation(format!("Required field '{field}' is missing"))
        .with_code(codes::ERR_CUSTOM_ENTRY_REQUIRED_FIELD)
}

/// Validate a single non-null value against a field's type + constraints.
fn validate_value(field: &CustomFieldResponse, value: &Value) -> Result<(), ApiError> {
    match field.field_type {
        CustomFieldType::Text | CustomFieldType::Richtext => {
            let s = value
                .as_str()
                .ok_or_else(|| invalid(&field.key, "expected a string"))?;
            let len = s.chars().count() as i64;
            if let Some(min) = field.min_length
                && len < min as i64
            {
                return Err(invalid(&field.key, "shorter than the minimum length"));
            }
            if let Some(max) = field.max_length
                && len > max as i64
            {
                return Err(invalid(&field.key, "longer than the maximum length"));
            }
            if let Some(pattern) = &field.pattern {
                // Compiled at schema-save time (#791); recompiled here is cheap
                // and linear-time (regex crate, never fancy-regex).
                let re = regex::Regex::new(pattern)
                    .map_err(|_| invalid(&field.key, "schema pattern is invalid"))?;
                if !re.is_match(s) {
                    return Err(invalid(&field.key, "does not match the required pattern"));
                }
            }
        }
        CustomFieldType::Number => {
            let n = value
                .as_f64()
                .ok_or_else(|| invalid(&field.key, "expected a number"))?;
            if let Some(min) = field.min
                && n < min
            {
                return Err(invalid(&field.key, "below the minimum"));
            }
            if let Some(max) = field.max
                && n > max
            {
                return Err(invalid(&field.key, "above the maximum"));
            }
        }
        CustomFieldType::Boolean => {
            if !value.is_boolean() {
                return Err(invalid(&field.key, "expected a boolean"));
            }
        }
        CustomFieldType::Date => {
            let s = value
                .as_str()
                .ok_or_else(|| invalid(&field.key, "expected a date string"))?;
            let ok = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
                || chrono::DateTime::parse_from_rfc3339(s).is_ok();
            if !ok {
                return Err(invalid(&field.key, "is not a valid date"));
            }
        }
        CustomFieldType::Enum => {
            let s = value
                .as_str()
                .ok_or_else(|| invalid(&field.key, "expected one of the enum options"))?;
            let allowed = field
                .enum_options
                .as_ref()
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().any(|o| o.as_str() == Some(s)))
                .unwrap_or(false);
            if !allowed {
                return Err(invalid(&field.key, "is not a permitted enum option"));
            }
        }
        CustomFieldType::Media => {
            // Shape only here; asset existence/ownership is checked in storage.
            let s = value
                .as_str()
                .ok_or_else(|| invalid(&field.key, "expected a media asset id"))?;
            if uuid::Uuid::parse_str(s).is_err() {
                return Err(invalid(&field.key, "is not a valid media asset id"));
            }
        }
    }
    Ok(())
}

/// Treat JSON `null` the same as an absent value.
fn present<'a>(map: &'a std::collections::HashMap<String, Value>, key: &str) -> Option<&'a Value> {
    map.get(key).filter(|v| !v.is_null())
}

/// Validate a whole entry payload against a type's field schema.
pub fn validate_entry(
    fields: &[CustomFieldResponse],
    req: &CustomEntryRequest,
) -> Result<(), ApiError> {
    let by_key: std::collections::HashMap<&str, &CustomFieldResponse> =
        fields.iter().map(|f| (f.key.as_str(), f)).collect();

    // Reject unknown keys (typos / stale clients) up front.
    for key in req.shared.keys() {
        if !by_key.contains_key(key.as_str()) {
            return Err(invalid(key, "is not a field of this type"));
        }
    }
    for values in req.localized.values() {
        for key in values.keys() {
            if !by_key.contains_key(key.as_str()) {
                return Err(invalid(key, "is not a field of this type"));
            }
        }
    }

    for field in fields {
        // Routing: a value must live in the right bucket for its `localized` flag.
        if field.localized {
            if req.shared.contains_key(&field.key) {
                return Err(invalid(
                    &field.key,
                    "is localized and must be supplied per-locale, not in shared",
                ));
            }
        } else {
            for values in req.localized.values() {
                if values.contains_key(&field.key) {
                    return Err(invalid(
                        &field.key,
                        "is not localized and must be supplied in shared",
                    ));
                }
            }
        }

        if field.localized {
            // Validate each provided locale; enforce required presence per locale.
            for values in req.localized.values() {
                match present(values, &field.key) {
                    Some(v) => validate_value(field, v)?,
                    None if field.required => return Err(missing(&field.key)),
                    None => {}
                }
            }
        } else {
            match present(&req.shared, &field.key) {
                Some(v) => validate_value(field, v)?,
                None if field.required => return Err(missing(&field.key)),
                None => {}
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn f(key: &str, ft: CustomFieldType, localized: bool, required: bool) -> CustomFieldResponse {
        CustomFieldResponse {
            id: uuid::Uuid::new_v4(),
            key: key.to_string(),
            label: key.to_string(),
            labels: None,
            field_type: ft,
            required,
            localized,
            is_title: false,
            is_pii: false,
            data_category: None,
            processing_purpose: None,
            legal_basis: None,
            enum_options: None,
            min: None,
            max: None,
            min_length: None,
            max_length: None,
            pattern: None,
            is_unique: false,
            display_order: 0,
            deprecated_at: None,
        }
    }

    fn shared(pairs: &[(&str, Value)]) -> CustomEntryRequest {
        CustomEntryRequest {
            slug: None,
            shared: pairs
                .iter()
                .map(|(k, v)| (k.to_string(), v.clone()))
                .collect(),
            localized: HashMap::new(),
        }
    }

    #[test]
    fn accepts_a_well_formed_entry() {
        let fields = vec![
            f("title", CustomFieldType::Text, false, true),
            f("servings", CustomFieldType::Number, false, false),
        ];
        let req = shared(&[
            ("title", Value::from("Spaghetti")),
            ("servings", Value::from(4)),
        ]);
        assert!(validate_entry(&fields, &req).is_ok());
    }

    #[test]
    fn rejects_wrong_type() {
        let fields = vec![f("servings", CustomFieldType::Number, false, false)];
        let req = shared(&[("servings", Value::from("four"))]);
        assert_eq!(
            validate_entry(&fields, &req).unwrap_err().code(),
            codes::ERR_CUSTOM_ENTRY_VALIDATION
        );
    }

    #[test]
    fn rejects_missing_required() {
        let fields = vec![f("title", CustomFieldType::Text, false, true)];
        let req = shared(&[]);
        assert_eq!(
            validate_entry(&fields, &req).unwrap_err().code(),
            codes::ERR_CUSTOM_ENTRY_REQUIRED_FIELD
        );
    }

    #[test]
    fn rejects_bad_enum_member() {
        let mut field = f("spice", CustomFieldType::Enum, false, false);
        field.enum_options = Some(serde_json::json!(["mild", "hot"]));
        let req = shared(&[("spice", Value::from("nuclear"))]);
        assert_eq!(
            validate_entry(&[field], &req).unwrap_err().code(),
            codes::ERR_CUSTOM_ENTRY_VALIDATION
        );
    }

    #[test]
    fn rejects_localized_value_placed_in_shared() {
        let fields = vec![f("body", CustomFieldType::Text, true, false)];
        let req = shared(&[("body", Value::from("oops"))]);
        let err = validate_entry(&fields, &req).unwrap_err();
        assert_eq!(err.code(), codes::ERR_CUSTOM_ENTRY_VALIDATION);
    }

    #[test]
    fn rejects_shared_value_placed_in_locale() {
        let fields = vec![f("servings", CustomFieldType::Number, false, false)];
        let mut localized = HashMap::new();
        let mut en = HashMap::new();
        en.insert("servings".to_string(), Value::from(4));
        localized.insert("en".to_string(), en);
        let req = CustomEntryRequest {
            slug: None,
            shared: HashMap::new(),
            localized,
        };
        assert_eq!(
            validate_entry(&fields, &req).unwrap_err().code(),
            codes::ERR_CUSTOM_ENTRY_VALIDATION
        );
    }

    #[test]
    fn rejects_unknown_field_key() {
        let fields = vec![f("title", CustomFieldType::Text, false, true)];
        let req = shared(&[("title", Value::from("ok")), ("ghost", Value::from(1))]);
        assert_eq!(
            validate_entry(&fields, &req).unwrap_err().code(),
            codes::ERR_CUSTOM_ENTRY_VALIDATION
        );
    }

    #[test]
    fn enforces_number_range_and_text_length() {
        let mut num = f("n", CustomFieldType::Number, false, false);
        num.min = Some(1.0);
        num.max = Some(10.0);
        assert!(validate_entry(&[num.clone()], &shared(&[("n", Value::from(11))])).is_err());
        assert!(validate_entry(&[num], &shared(&[("n", Value::from(5))])).is_ok());

        let mut txt = f("t", CustomFieldType::Text, false, false);
        txt.max_length = Some(3);
        assert!(validate_entry(&[txt], &shared(&[("t", Value::from("toolong"))])).is_err());
    }

    #[test]
    fn null_optional_is_treated_as_absent() {
        let fields = vec![f("note", CustomFieldType::Text, false, false)];
        let req = shared(&[("note", Value::Null)]);
        assert!(validate_entry(&fields, &req).is_ok());
    }
}
