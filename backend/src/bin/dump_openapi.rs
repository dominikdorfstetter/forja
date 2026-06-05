//! Print the assembled OpenAPI document as JSON to stdout.
//!
//! Used by admin codegen (`npm run generate:openapi`) to materialise the
//! contract that `openapi-typescript` consumes. Keeps codegen offline —
//! no server, no DB, no env vars required.
//!
//! Issue: #623 (Slice 1 — tracer bullet).

fn main() {
    let spec = forja::axum_app::build_full_openapi();
    let json = serde_json::to_string_pretty(&spec).expect("OpenAPI spec serializes");
    println!("{json}");
}
