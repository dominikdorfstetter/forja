//! Forja Multi-Site CMS API
//!
//! REST API built with Axum (post-Rocket cutover — see feat/migrate-to-axum
//! branch history for the migration commits). All HTTP request handling
//! lives in `axum_app`; this binary's job is configuration, state
//! assembly, background-worker spawn, and TLS-aware bind.

use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use forja::guards::auth_guard::ClerkJwksState;
use forja::services::storage;
use forja::{AppState, Settings};

/// Wait for SIGTERM (Railway / k8s rolling deploy) or SIGINT (Ctrl-C local).
/// Resolves as soon as either is received so `axum_server::Handle::graceful_shutdown`
/// can stop accepting new connections, drain in-flight ones, and FIN the rest —
/// which lets Railway's edge proxy discard the stale upstream connections instead
/// of holding them for a 5 s connect-timeout retry on the next request.
async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};
    let mut sigterm = signal(SignalKind::terminate()).expect("install SIGTERM handler");
    let mut sigint = signal(SignalKind::interrupt()).expect("install SIGINT handler");
    tokio::select! {
        _ = sigterm.recv() => tracing::info!("Received SIGTERM — beginning graceful HTTP shutdown"),
        _ = sigint.recv() => tracing::info!("Received SIGINT — beginning graceful HTTP shutdown"),
    }
}

/// Print the boot banner to stdout. Runs before `tracing_subscriber::init`
/// so it bypasses log-level filters and JSON formatting — operators see the
/// version + build identity even when prod logs are JSON-wrapped.
///
/// Stdout (not stderr) because Railway tags stderr lines as `[err]`, which
/// would surface the banner as error-level noise in dashboards and alerts.
fn print_banner() {
    println!();
    println!("   ███████╗ ██████╗ ██████╗      ██╗ █████╗ ");
    println!("   ██╔════╝██╔═══██╗██╔══██╗     ██║██╔══██╗");
    println!("   █████╗  ██║   ██║██████╔╝     ██║███████║");
    println!("   ██╔══╝  ██║   ██║██╔══██╗██   ██║██╔══██║");
    println!("   ██║     ╚██████╔╝██║  ██║╚█████╔╝██║  ██║");
    println!("   ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝");
    println!();
    println!(
        "       Multi-site CMS · Rust · Axum  v{}",
        env!("CARGO_PKG_VERSION")
    );
    println!();
}

#[tokio::main]
async fn main() {
    print_banner();

    // Log format selection:
    //   - LOG_FORMAT=json forces JSON, anywhere.
    //   - RAILWAY_ENVIRONMENT (set on Railway) defaults to JSON.
    //   - Otherwise (local dev) pretty ANSI output.
    let json = matches!(std::env::var("LOG_FORMAT").as_deref(), Ok("json"))
        || std::env::var("RAILWAY_ENVIRONMENT").is_ok();
    // `sqlx::postgres::notice=warn` silences the "relation already exists,
    // skipping" idempotent-migration spam on every boot. The notice target
    // emits at INFO, which the parent `sqlx=warn` directive *should* cover
    // but doesn't reliably — explicit override keeps the boot log clean.
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "forja=info,axum=warn,sqlx=warn,sqlx::postgres::notice=warn".into());
    // `tracing_error::ErrorLayer` captures span context into `SpanTrace` values
    // when constructed inside an error path — phase 1 just registers it so the
    // API is available; ApiError sites adopt `SpanTrace::capture()` in a
    // follow-up sweep.
    if json {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_error::ErrorLayer::default())
            .with(
                tracing_subscriber::fmt::layer()
                    .with_ansi(false)
                    .with_target(true)
                    .json()
                    .with_current_span(true)
                    .with_span_list(false),
            )
            .init();
    } else {
        // Pretty dev output: ANSI, target shown, spans inherited via the
        // default subscriber behaviour (no extra config needed).
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_error::ErrorLayer::default())
            .with(tracing_subscriber::fmt::layer().with_target(true))
            .init();
    }

    tracing::info!("Starting Forja API...");

    let settings = Settings::load().expect("Failed to load configuration");
    tracing::info!("Public URL: {}", settings.public_url);
    if settings.demo_mode {
        tracing::info!("Demo mode: ENABLED — demo site will be auto-seeded");
    }

    tracing::info!(
        "Request limits configured: body={}MB, json={}MB, file={}MB",
        settings.security.max_body_size / (1024 * 1024),
        settings.security.max_json_size / (1024 * 1024),
        settings.security.max_file_size / (1024 * 1024)
    );

    let db_pool = PgPoolOptions::new()
        .max_connections(settings.database.max_connections)
        // Wire the existing `idle_timeout_seconds` config (was unused before).
        // Idle connections are closed after this window so connections that
        // returned to the pool in a degraded state (e.g. with a poisoned
        // transaction after an aborted query) age out instead of lingering.
        .idle_timeout(std::time::Duration::from_secs(
            settings.database.idle_timeout_seconds,
        ))
        // Verify a connection is alive + clean before handing it out. Costs
        // a `SELECT 1` per acquire but defends against the
        // `current transaction is aborted, commands ignored until end of
        // transaction block` failure mode where a poisoned connection is
        // reused by the next acquirer.
        .test_before_acquire(true)
        .connect(&settings.database.url)
        .await
        .expect("Failed to connect to database");
    tracing::info!("Connected to database");

    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .expect("Failed to run database migrations");
    tracing::info!("Database migrations completed");

    let redis_conn = match redis::Client::open(settings.security.redis_url.as_str()) {
        Ok(client) => match redis::aio::ConnectionManager::new(client).await {
            Ok(conn) => {
                tracing::info!("Connected to Redis for rate limiting");
                Some(conn)
            }
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Failed to connect to Redis — rate limiting disabled. \
                     Public form submission, lookup, and self-service delete \
                     will accept unbounded traffic. Set RATE_LIMIT_FAIL_MODE=closed \
                     in production to refuse requests instead."
                );
                None
            }
        },
        Err(e) => {
            tracing::warn!(
                error = %e,
                "Invalid Redis URL — rate limiting disabled. \
                 Public form submission, lookup, and self-service delete \
                 will accept unbounded traffic. Set RATE_LIMIT_FAIL_MODE=closed \
                 in production to refuse requests instead."
            );
            None
        }
    };

    forja::config::require_redis_when_fail_closed(
        &settings.environment,
        redis_conn.is_some(),
        &settings.security.rate_limit_fail_mode,
    )
    .expect("boot guard: Redis absent with RATE_LIMIT_FAIL_MODE=closed in production");

    forja::config::require_document_encryption_key_in_production(
        &settings.environment,
        &settings.security.document_encryption_key,
    )
    .expect("boot guard: DOCUMENT_ENCRYPTION_KEY empty in production");

    let cors_origins: Vec<String> = settings
        .security
        .cors_allowed_origins
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    forja::config::require_non_wildcard_cors_in_production(&settings.environment, &cors_origins)
        .expect("boot guard: CORS_ALLOWED_ORIGINS='*' in production");

    if cors_origins.is_empty() {
        tracing::warn!(
            "CORS_ALLOWED_ORIGINS (or APP__SECURITY__CORS_ALLOWED_ORIGINS) is empty — \
             cross-origin browser calls will be blocked. Set it to a comma-separated \
             list of origins (e.g. https://admin.example.com) if you run a separate \
             admin frontend or consumer site."
        );
    }

    // Resolve Clerk FAPI domain for the dashboard CSP (env override > decode
    // from publishable key). Same logic as the pre-cutover Rocket boot.
    let clerk_fapi_domain: Option<String> = std::env::var("CLERK_FAPI_DOMAIN")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            let pk = &settings.security.clerk_publishable_key;
            let encoded = pk
                .strip_prefix("pk_live_")
                .or_else(|| pk.strip_prefix("pk_test_"));
            encoded.and_then(|b64| {
                use base64::Engine as _;
                base64::engine::general_purpose::STANDARD
                    .decode(b64)
                    .ok()
                    .and_then(|bytes| String::from_utf8(bytes).ok())
                    .map(|s| s.trim_end_matches('$').to_string())
            })
        });

    // Dashboard CSP template: `{{NONCE}}` is replaced per-request by
    // `axum_app::handlers::dashboard`. No 'unsafe-inline' — runtime
    // nonce authorizes Emotion (MUI) and Clerk inline styles.
    let dashboard_csp_template = {
        let mut clerk_domains = String::from("https://clerk.com https://*.clerk.accounts.dev");
        if let Some(ref fapi) = clerk_fapi_domain {
            clerk_domains.push_str(&format!(" https://{fapi}"));
        }
        format!(
            "default-src 'self'; \
             script-src 'self' {clerk}; \
             style-src 'self' 'nonce-{{{{NONCE}}}}' https://fonts.googleapis.com; \
             font-src 'self' https://fonts.gstatic.com; \
             img-src 'self' data: blob: https:; \
             connect-src 'self' {clerk}; \
             frame-src 'self' {clerk}; \
             worker-src 'self' blob:",
            clerk = clerk_domains,
        )
    };

    let clerk_service = if !settings.security.clerk_secret_key.is_empty() {
        match forja::services::clerk_service::ClerkService::new(
            settings.security.clerk_secret_key.clone(),
        ) {
            Ok(svc) => Some(std::sync::Arc::new(svc)),
            Err(e) => {
                tracing::error!(error = %e, "Failed to initialize Clerk service");
                std::process::exit(1);
            }
        }
    } else {
        None
    };

    let storage_backend = storage::create_storage(&settings.storage, &settings.public_url)
        .await
        .expect("Failed to initialize storage backend");
    tracing::info!(
        "Storage backend initialized (provider: {})",
        settings.storage.provider
    );

    if settings.storage.provider == "s3" {
        let proxy_prefix = format!("{}/files/", settings.public_url.trim_end_matches('/'));
        let updated = sqlx::query(
            "UPDATE media_files SET public_url = $1 || storage_path WHERE storage_provider = 's3' AND public_url IS NOT NULL AND public_url NOT LIKE $1 || '%'",
        )
        .bind(&proxy_prefix)
        .execute(&db_pool)
        .await;
        if let Ok(result) = updated {
            if result.rows_affected() > 0 {
                tracing::info!(
                    "Migrated {} media URLs to backend proxy",
                    result.rows_affected()
                );
            }
        }
    }

    let clerk_enabled = !settings.security.clerk_secret_key.is_empty();
    let clerk_jwks_url = std::env::var("CLERK_JWKS_URL")
        .ok()
        .filter(|s| !s.is_empty());
    let expected_issuer = settings.security.clerk_expected_issuer.clone();

    match forja::config::validate_clerk_jwt_pinning(
        &settings.environment,
        clerk_enabled,
        &settings.security.clerk_expected_audience,
        &expected_issuer,
    ) {
        Ok(warnings) => {
            for w in warnings {
                tracing::warn!("{w}");
            }
        }
        Err(msg) => panic!("boot guard: {msg}"),
    }

    let clerk_jwks_state: Option<std::sync::Arc<ClerkJwksState>> =
        if !settings.security.clerk_secret_key.is_empty() {
            let base = if let Some(url) = clerk_jwks_url {
                tracing::info!("Clerk JWT authentication enabled (JWKS URL configured)");
                ClerkJwksState::with_jwks_url(url)
            } else {
                tracing::info!(
                    "Clerk JWT authentication enabled (set CLERK_JWKS_URL for JWKS discovery)"
                );
                ClerkJwksState::new(&settings.security.clerk_secret_key)
            };
            Some(std::sync::Arc::new(
                base.with_expected_audience(settings.security.clerk_expected_audience.clone())
                    .with_expected_issuer(expected_issuer),
            ))
        } else {
            tracing::info!("Clerk JWT authentication disabled (no CLERK_SECRET_KEY)");
            None
        };

    let app_state = AppState {
        db: db_pool.clone(),
        settings: settings.clone(),
        redis: redis_conn,
        clerk_service,
        storage: storage_backend,
        clerk_jwks: clerk_jwks_state,
        dashboard_csp_template: std::sync::Arc::from(dashboard_csp_template.as_str()),
        demo_guest_key: std::sync::OnceLock::new(),
    };

    // Wire the response cache's invalidation handle (publish pipeline only has
    // a PgPool, so it reaches Redis through this process-global).
    forja::services::response_cache::init(app_state.redis.clone());

    // Generate a random demo guest key at boot when demo mode is enabled.
    // The key is hashed with Argon2id (not SHA-256) when stored in the DB.
    if settings.demo_mode {
        let (plaintext, _prefix, _hash, _version) = forja::models::api_key::ApiKey::generate_key();
        tracing::info!("Demo guest key generated (prefix: {}...)", &plaintext[..11]);
        app_state
            .demo_guest_key
            .set(plaintext)
            .expect("demo_guest_key OnceLock already set");
    }

    // Seed system admins from env (one-shot at boot).
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
                Ok(_) => tracing::info!("System admin seeded successfully"),
                Err(e) => tracing::warn!("Failed to seed system admin: {}", e),
            }
        }
    }

    // Spawn long-running background workers (publish scheduler, audit/trash
    // cleanup, usage aggregation, anomaly detection, demo seed, webhook
    // retry/flush). Each `spawn` returns immediately after registering its
    // own `tokio::spawn`.
    forja::axum_app::workers::spawn_all(app_state.clone());

    let mut router = forja::axum_app::build_router(app_state);

    // Mount static file server for local uploads (mirrors the Rocket-era
    // FileServer mount). LocalStorage::public_url returns
    // `<local_base_url>/<path>`, so media records reference URLs at this
    // mount point. S3 traffic doesn't need this — it goes through the
    // `/files/{path}` proxy in `axum_app::handlers::files`.
    if settings.storage.provider == "local" {
        let upload_dir = settings.storage.local_upload_dir.clone();
        let base_url = settings.storage.local_base_url.clone();
        tracing::info!(
            "Mounting local file server at {} -> {}",
            base_url,
            upload_dir
        );
        router = router.nest_service(&base_url, tower_http::services::ServeDir::new(upload_dir));
    }

    let addr: std::net::SocketAddr = (
        settings
            .host
            .parse::<std::net::IpAddr>()
            .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED)),
        settings.port,
    )
        .into();

    let cert_path = &settings.security.tls_cert_path;
    let key_path = &settings.security.tls_key_path;

    // Shared shutdown handle: lets both serve paths participate in the same
    // SIGTERM-triggered drain. 25 s is the drain budget — must stay below
    // Railway's `drainingSeconds` (30 s) so we finish before SIGKILL.
    let handle = axum_server::Handle::new();
    {
        let shutdown_handle = handle.clone();
        tokio::spawn(async move {
            shutdown_signal().await;
            shutdown_handle.graceful_shutdown(Some(Duration::from_secs(25)));
        });
    }

    if !cert_path.is_empty() && !key_path.is_empty() {
        tracing::info!("TLS enabled: binding https://{addr} (cert={cert_path}, key={key_path})");
        let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem_file(cert_path, key_path)
            .await
            .expect("Failed to load TLS cert/key");
        let mut server = axum_server::bind_rustls(addr, tls_config).handle(handle);
        configure_http2_keep_alive(&mut server);
        server
            .serve(router.into_make_service())
            .await
            .expect("Axum server crashed");
    } else {
        tracing::info!("TLS disabled — binding http://{addr}");
        let mut server = axum_server::bind(addr).handle(handle);
        configure_http2_keep_alive(&mut server);
        server
            .serve(router.into_make_service())
            .await
            .expect("Axum server crashed");
    }
}

/// Send HTTP/2 keep-alive PINGs every 30 s; close the connection if a PONG
/// doesn't arrive within 10 s. Lets either side notice a dead peer well
/// before the OS-level 2-hour TCP keep-alive default kicks in. Bounds how
/// long a stale upstream connection can survive in the edge proxy's pool.
fn configure_http2_keep_alive<A>(server: &mut axum_server::Server<std::net::SocketAddr, A>)
where
    A: axum_server::accept::Accept<tokio::net::TcpStream, axum::body::Body>
        + Clone
        + Send
        + Sync
        + 'static,
{
    server
        .http_builder()
        .http2()
        .keep_alive_interval(Some(Duration::from_secs(30)))
        .keep_alive_timeout(Duration::from_secs(10));
}
