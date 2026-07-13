//! Data Transfer Objects
//!
//! This module contains request/response DTOs for the API.
//!
//! # Naming convention
//!
//! All struct fields use **snake_case** — Serde serialises them as-is since Rust
//! identifiers are already snake_case. Explicit `#[serde(rename_all = "snake_case")]`
//! is not required on structs but **is** required on enums whose variants must
//! serialise as snake_case (e.g. `AiAction`, `ReviewAction`).
//!
//! The only field-level rename is `ProblemDetails::problem_type` → `"type"`
//! (required by RFC 7807).

pub mod ai;
pub mod ai_usage;
pub mod analytics;
pub mod api_key;
pub mod audit;
pub mod auth;
pub mod blog;
pub mod bulk;
pub mod clerk;
pub mod config;
pub mod content;
pub mod content_template;
pub mod custom_entry;
pub mod custom_type;
pub mod cv;
pub mod document;
pub mod environment;
pub mod error_codes;
pub mod favicon;
pub mod forms;
pub mod health;
pub mod help_state;
pub mod imprint;
pub mod legal;
pub mod locale;
pub mod media;
pub mod media_folder;
pub mod media_tag;
pub mod navigation;
pub mod navigation_menu;
pub mod notification;
pub mod onboarding;
pub mod onboarding_progress;
pub mod page;
pub mod pii_inventory;
pub mod project;
pub mod redirect;
pub mod review;
pub mod ropa;
pub mod site;
pub mod site_locale;
pub mod site_membership;
pub mod site_settings;
pub mod social;
pub mod taxonomy;
pub mod trash;
pub mod ui_strings;
pub mod user_preferences;
pub mod validated;
pub mod webhook;
