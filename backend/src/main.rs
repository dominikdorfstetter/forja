//! OpenYapper Multi-Site CMS API
//!
//! A high-performance REST API built with Rust Rocket for managing
//! multiple websites with shared content and translations.

#[macro_use]
extern crate rocket;

use rocket::config::TlsConfig;
use rocket::data::{Limits, ToByteUnit};
use rocket::fairing::AdHoc;
use rocket::Config;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use rocket::fs::FileServer;

use openyapper::guards::auth_guard::ClerkJwksState;
use openyapper::middleware::rate_limit::RateLimitHeaderInfo;
use openyapper::services::storage;
use openyapper::{handlers, openapi::ApiDoc, AppState, Settings};

#[launch]
async fn rocket() -> _ {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "openyapper=debug,rocket=info,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting OpenYapper API...");

    // Load configuration
    let settings = Settings::load().expect("Failed to load configuration");

    // Configure request size limits from security settings
    // data-form limit must accommodate file uploads (use the larger of form vs file limit)
    let form_limit = std::cmp::max(
        settings.security.max_form_size,
        settings.security.max_file_size,
    );
    let limits = Limits::default()
        .limit("bytes", settings.security.max_body_size.bytes())
        .limit("data-form", form_limit.bytes())
        .limit("file", settings.security.max_file_size.bytes())
        .limit("json", settings.security.max_json_size.bytes())
        .limit("msgpack", settings.security.max_json_size.bytes())
        .limit("string", settings.security.max_body_size.bytes());

    tracing::info!(
        "Request limits configured: body={}MB, json={}MB, file={}MB",
        settings.security.max_body_size / (1024 * 1024),
        settings.security.max_json_size / (1024 * 1024),
        settings.security.max_file_size / (1024 * 1024)
    );

    // Create Rocket config with limits
    // Disable Rocket's cli_colors to avoid raw ANSI escape codes in tracing output
    let mut rocket_config = Config {
        address: settings
            .host
            .parse()
            .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED)),
        port: settings.port,
        limits,
        cli_colors: false,
        ..Config::default()
    };

    // Conditionally enable TLS if both cert and key paths are provided
    let cert_path = &settings.security.tls_cert_path;
    let key_path = &settings.security.tls_key_path;
    if !cert_path.is_empty() && !key_path.is_empty() {
        tracing::info!("TLS enabled: cert={}, key={}", cert_path, key_path);
        rocket_config.tls = Some(TlsConfig::from_paths(cert_path, key_path));
    } else {
        tracing::info!("TLS disabled (no TLS_CERT_PATH / TLS_KEY_PATH configured)");
    }

    // Create database pool
    let db_pool = PgPoolOptions::new()
        .max_connections(settings.database.max_connections)
        .connect(&settings.database.url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Connected to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .expect("Failed to run database migrations");

    tracing::info!("Database migrations completed");

    // Initialize Redis connection for rate limiting (graceful degradation)
    let redis_conn = match redis::Client::open(settings.security.redis_url.as_str()) {
        Ok(client) => match redis::aio::ConnectionManager::new(client).await {
            Ok(conn) => {
                tracing::info!("Connected to Redis for rate limiting");
                Some(conn)
            }
            Err(e) => {
                tracing::warn!(error = %e, "Failed to connect to Redis — rate limiting disabled");
                None
            }
        },
        Err(e) => {
            tracing::warn!(error = %e, "Invalid Redis URL — rate limiting disabled");
            None
        }
    };

    let cors_origins: Vec<String> = settings
        .security
        .cors_allowed_origins
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Initialize Clerk service if secret key is configured
    let clerk_service = if !settings.security.clerk_secret_key.is_empty() {
        Some(std::sync::Arc::new(
            openyapper::services::clerk_service::ClerkService::new(
                settings.security.clerk_secret_key.clone(),
            ),
        ))
    } else {
        None
    };

    // Initialize storage backend
    let storage_backend = storage::create_storage(&settings.storage)
        .await
        .expect("Failed to initialize storage backend");

    tracing::info!(
        "Storage backend initialized (provider: {})",
        settings.storage.provider
    );

    let app_state = AppState {
        db: db_pool.clone(),
        settings: settings.clone(),
        redis: redis_conn,
        clerk_service,
        storage: storage_backend,
    };

    // Initialize Clerk JWKS state if CLERK_SECRET_KEY is set
    let clerk_jwks_url = std::env::var("CLERK_JWKS_URL").ok();
    let clerk_jwks_state = if !settings.security.clerk_secret_key.is_empty() {
        if let Some(url) = clerk_jwks_url {
            tracing::info!("Clerk JWT authentication enabled (JWKS URL configured)");
            Some(ClerkJwksState::with_jwks_url(url))
        } else {
            tracing::info!(
                "Clerk JWT authentication enabled (set CLERK_JWKS_URL for JWKS discovery)"
            );
            Some(ClerkJwksState::new(&settings.security.clerk_secret_key))
        }
    } else {
        tracing::info!("Clerk JWT authentication disabled (no CLERK_SECRET_KEY)");
        None
    };

    // Seed system admins from environment
    let admin_ids: Vec<String> = settings
        .security
        .system_admin_clerk_ids
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if !admin_ids.is_empty() {
        tracing::info!("Seeding {} system admin(s)...", admin_ids.len());
        for clerk_id in &admin_ids {
            let result = sqlx::query(
                r#"
                INSERT INTO system_admins (clerk_user_id, granted_by)
                VALUES ($1, 'env_seed')
                ON CONFLICT (clerk_user_id) DO NOTHING
                "#,
            )
            .bind(clerk_id)
            .execute(&db_pool)
            .await;

            match result {
                Ok(_) => tracing::info!("System admin seeded: {}", clerk_id),
                Err(e) => tracing::warn!("Failed to seed system admin {}: {}", clerk_id, e),
            }
        }
    }

    let mut rocket_instance = rocket::custom(rocket_config).manage(app_state);

    if let Some(jwks_state) = clerk_jwks_state {
        rocket_instance = rocket_instance.manage(jwks_state);
    }

    // Mount static file server for local uploads
    if settings.storage.provider == "local" {
        let upload_dir = settings.storage.local_upload_dir.clone();
        let base_url = settings.storage.local_base_url.clone();
        tracing::info!(
            "Mounting local file server at {} -> {}",
            base_url,
            upload_dir
        );
        rocket_instance = rocket_instance.mount(&base_url, FileServer::from(&upload_dir));
    }

    rocket_instance
        .attach(AdHoc::on_response("Security Headers", move |req, res| {
            let cors_origins = cors_origins.clone();
            Box::pin(async move {
                // CORS headers — use configured origins instead of wildcard
                let allowed_origin = if cors_origins.len() == 1 && cors_origins[0] == "*" {
                    // Wildcard mode (development only)
                    Some("*".to_string())
                } else if let Some(origin) = req.headers().get_one("Origin") {
                    // Check if the request origin is in the allowed list
                    if cors_origins.iter().any(|o| o == origin) {
                        Some(origin.to_string())
                    } else {
                        None
                    }
                } else {
                    None
                };

                if let Some(origin) = allowed_origin {
                    res.set_header(rocket::http::Header::new(
                        "Access-Control-Allow-Origin",
                        origin,
                    ));
                    // Vary header required when origin is not wildcard
                    if cors_origins.len() != 1 || cors_origins[0] != "*" {
                        res.set_header(rocket::http::Header::new("Vary", "Origin"));
                    }
                }
                res.set_header(rocket::http::Header::new(
                    "Access-Control-Allow-Methods",
                    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                ));
                res.set_header(rocket::http::Header::new(
                    "Access-Control-Allow-Headers",
                    "Content-Type, Authorization, X-API-Key, X-Site-Domain, X-Request-ID",
                ));
                res.set_header(rocket::http::Header::new(
                    "Access-Control-Max-Age",
                    "86400",
                ));

                // Security headers
                let path = req.uri().path().as_str();
                res.set_header(rocket::http::Header::new(
                    "X-Content-Type-Options",
                    "nosniff",
                ));
                // Allow Swagger UI to be embedded in the admin panel iframe
                if !path.starts_with("/api-docs") {
                    res.set_header(rocket::http::Header::new(
                        "X-Frame-Options",
                        "DENY",
                    ));
                }
                res.set_header(rocket::http::Header::new(
                    "X-XSS-Protection",
                    "1; mode=block",
                ));
                res.set_header(rocket::http::Header::new(
                    "Referrer-Policy",
                    "strict-origin-when-cross-origin",
                ));
                // CSP - relaxed for dashboard and Swagger UI
                if path.starts_with("/api-docs") {
                    res.set_header(rocket::http::Header::new(
                        "Content-Security-Policy",
                        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
                    ));
                } else if path.starts_with("/dashboard") {
                    res.set_header(rocket::http::Header::new(
                        "Content-Security-Policy",
                        "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.com https://*.clerk.accounts.dev; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://clerk.com https://*.clerk.accounts.dev; frame-src 'self' https://clerk.com https://*.clerk.accounts.dev",
                    ));
                } else {
                    res.set_header(rocket::http::Header::new(
                        "Content-Security-Policy",
                        "default-src 'self'",
                    ));
                }

                // Request ID for tracing
                if let Some(request_id) = req.headers().get_one("X-Request-ID") {
                    res.set_header(rocket::http::Header::new("X-Request-ID", request_id.to_string()));
                }

                // Rate limit headers (populated by auth guard if Redis is available)
                let rl_info = req.local_cache(RateLimitHeaderInfo::default);
                let limit = rl_info.limit.load(std::sync::atomic::Ordering::Relaxed);
                if limit > 0 {
                    let remaining = rl_info.remaining.load(std::sync::atomic::Ordering::Relaxed);
                    let reset = rl_info.reset.load(std::sync::atomic::Ordering::Relaxed);
                    res.set_header(rocket::http::Header::new(
                        "X-RateLimit-Limit",
                        limit.to_string(),
                    ));
                    res.set_header(rocket::http::Header::new(
                        "X-RateLimit-Remaining",
                        remaining.to_string(),
                    ));
                    res.set_header(rocket::http::Header::new(
                        "X-RateLimit-Reset",
                        reset.to_string(),
                    ));
                }
            })
        }))
        .mount("/", handlers::system::routes())
        .mount("/api/v1", handlers::routes())
        .mount("/dashboard", handlers::dashboard::routes())
        .mount("/", SwaggerUi::new("/api-docs/<tail..>")
            .url("/api-docs/openapi.json", ApiDoc::openapi()))
}
