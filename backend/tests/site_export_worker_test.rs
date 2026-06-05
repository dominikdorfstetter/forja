//! Site export worker — ZIP builder + storage + signed link
//! (issue #717, epic #708).
//!
//! Vertical-slice TDD: the tracer drives enqueue → worker tick → `ready`
//! with a downloadable ZIP holding the JSON archive + media bytes; later
//! tests pin the archive shape, the storage-failure path, retention, and
//! the signed-download security boundary.

mod common;

use std::io::Read;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::models::api_key::ApiKeyPermission;
use forja::models::content::ContentStatus;
use forja::models::site_export::{SiteExportJob, SiteExportStatus};
use forja::services::content_service::ContentService;
use forja::services::site_export_worker;

use common::{create_test_api_key, create_test_site, test_context};

/// Drive the worker like the real spawn loop does — repeated ticks —
/// until `job_id` leaves `queued`. `forja_test` is shared, so older
/// queued jobs from sibling tests may share the batched dequeue; ticking
/// to drain is exactly what the 30s production loop does.
async fn drain_until_resolved(
    pool: &PgPool,
    storage: &dyn forja::services::storage::StorageBackend,
    site_id: Uuid,
    job_id: Uuid,
) -> SiteExportJob {
    for _ in 0..100 {
        site_export_worker::run_once(pool, storage)
            .await
            .expect("worker tick");
        let job = SiteExportJob::find_for_site(pool, site_id, job_id)
            .await
            .expect("job present");
        if job.status != SiteExportStatus::Queued {
            return job;
        }
    }
    panic!("worker did not resolve job within the tick budget");
}

/// Seed a site-owned media file whose bytes actually exist in `storage`.
async fn seed_owned_media_with_bytes(
    pool: &PgPool,
    storage: &dyn forja::services::storage::StorageBackend,
    site_id: Uuid,
    filename: &str,
    bytes: &[u8],
) -> Uuid {
    let storage_path = format!("test-media/{site_id}/{filename}");
    storage
        .store(&storage_path, bytes, "image/png")
        .await
        .expect("store media bytes");
    let media_id: Uuid = sqlx::query_scalar(
        "INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_path) \
         VALUES ($1, $1, 'image/png', $2, $3) RETURNING id",
    )
    .bind(filename)
    .bind(bytes.len() as i64)
    .bind(&storage_path)
    .fetch_one(pool)
    .await
    .expect("seed media_file");
    sqlx::query("INSERT INTO media_sites (media_file_id, site_id, is_owner) VALUES ($1, $2, TRUE)")
        .bind(media_id)
        .bind(site_id)
        .execute(pool)
        .await
        .expect("seed media_sites");
    media_id
}

#[tokio::test]
#[serial]
async fn tracer_worker_builds_ready_downloadable_zip() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    // Content + a real media file the archive must capture.
    ContentService::create_content(
        &mut ctx.pool.acquire().await.unwrap(),
        "blog",
        Some("tracer-export-post"),
        &ContentStatus::Draft,
        &[site_id],
        None,
        None,
        None,
    )
    .await
    .expect("seed blog");
    let png = b"\x89PNG\r\n\x1a\nTRACER-BYTES";
    seed_owned_media_with_bytes(&ctx.pool, ctx.storage.as_ref(), site_id, "logo.png", png).await;

    let job = SiteExportJob::enqueue(&ctx.pool, site_id, None)
        .await
        .expect("enqueue");

    let done = drain_until_resolved(&ctx.pool, ctx.storage.as_ref(), site_id, job.id).await;
    assert_eq!(done.status, SiteExportStatus::Ready, "job reaches ready");
    let storage_path = done.storage_path.expect("artifact path persisted");
    assert!(
        done.download_token.is_some(),
        "signed download token persisted"
    );
    assert!(done.expires_at.is_some(), "download link expiry persisted");

    // The artifact is a valid ZIP downloadable from storage, holding the
    // JSON archive and the media bytes.
    let (zip_bytes, _ct) = ctx
        .storage
        .fetch(&storage_path)
        .await
        .expect("artifact downloadable");
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(zip_bytes)).expect("valid zip archive");

    let mut archive_json = String::new();
    zip.by_name("archive.json")
        .expect("archive.json entry present")
        .read_to_string(&mut archive_json)
        .expect("archive.json readable");
    let archive: serde_json::Value =
        serde_json::from_str(&archive_json).expect("archive.json is valid JSON");
    assert_eq!(
        archive["site"]["id"],
        site_id.to_string(),
        "archive carries the site"
    );

    let mut media_bytes = Vec::new();
    zip.by_name("media/logo.png")
        .expect("media file bundled in zip")
        .read_to_end(&mut media_bytes)
        .expect("media readable");
    assert_eq!(media_bytes, png, "media bytes round-trip exactly");
}

#[tokio::test]
#[serial]
async fn archive_carries_every_219_domain_and_seeded_content() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let slug = format!("shape-post-{}", &Uuid::new_v4().to_string()[..8]);
    ContentService::create_content(
        &mut ctx.pool.acquire().await.unwrap(),
        "blog",
        Some(&slug),
        &ContentStatus::Draft,
        &[site_id],
        None,
        None,
        None,
    )
    .await
    .expect("seed blog");

    let job = SiteExportJob::enqueue(&ctx.pool, site_id, None)
        .await
        .expect("enqueue");
    let done = drain_until_resolved(&ctx.pool, ctx.storage.as_ref(), site_id, job.id).await;
    assert_eq!(done.status, SiteExportStatus::Ready);

    let (zip_bytes, _ct) = ctx
        .storage
        .fetch(&done.storage_path.unwrap())
        .await
        .expect("artifact");
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(zip_bytes)).expect("zip");
    let mut s = String::new();
    zip.by_name("archive.json")
        .unwrap()
        .read_to_string(&mut s)
        .unwrap();
    let a: serde_json::Value = serde_json::from_str(&s).expect("valid json");

    // #219 shape: every top-level domain present.
    assert!(a["forja_version"].is_string(), "forja_version present");
    assert!(a["exported_at"].is_string(), "exported_at present");
    assert!(a["site"].is_object(), "site present");
    assert!(a["settings"].is_array(), "settings present");
    assert!(a["locales"].is_array(), "locales present");
    assert!(a["content"]["blogs"].is_array(), "content.blogs present");
    assert!(a["content"]["pages"].is_array(), "content.pages present");
    assert!(
        a["content"]["localizations"].is_array(),
        "content.localizations present"
    );
    assert!(a["taxonomy"]["tags"].is_array(), "taxonomy.tags present");
    assert!(
        a["taxonomy"]["categories"].is_array(),
        "taxonomy.categories present"
    );
    assert!(
        a["navigation"]["menus"].is_array(),
        "navigation.menus present"
    );
    assert!(
        a["navigation"]["items"].is_array(),
        "navigation.items present"
    );
    assert!(a["social_links"].is_array(), "social_links present");
    assert!(a["media"].is_array(), "media manifest present");

    // Faithfulness: the archive is exactly what the canonical admin
    // finders return for the site — not a separately-derived view. This
    // is the real #219 contract and survives any internal refactor of
    // how blogs/social links are queried.
    let blogs_canonical =
        forja::repos::blog_repo::BlogRepo::find_all_for_site(&ctx.pool, site_id, 500, 0)
            .await
            .expect("canonical blogs");
    assert_eq!(
        a["content"]["blogs"],
        serde_json::to_value(&blogs_canonical).unwrap(),
        "archive blogs mirror the canonical finder"
    );

    let social_canonical =
        forja::models::social::SocialLink::find_all_for_site_admin(&ctx.pool, site_id)
            .await
            .expect("canonical social links");
    assert_eq!(
        a["social_links"],
        serde_json::to_value(&social_canonical).unwrap(),
        "archive social_links mirror the canonical finder"
    );

    let _ = slug; // seeded to exercise the content_sites linkage path
}

#[tokio::test]
#[serial]
async fn missing_media_bytes_fail_the_job_with_error_recorded() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    // Owned media row whose storage_path has NO bytes behind it → the
    // worker's storage.fetch fails mid-build.
    let media_id: Uuid = sqlx::query_scalar(
        "INSERT INTO media_files (filename, original_filename, mime_type, file_size, storage_path) \
         VALUES ('ghost.png', 'ghost.png', 'image/png', 10, 'missing/ghost.png') RETURNING id",
    )
    .fetch_one(&ctx.pool)
    .await
    .expect("seed media row");
    sqlx::query("INSERT INTO media_sites (media_file_id, site_id, is_owner) VALUES ($1, $2, TRUE)")
        .bind(media_id)
        .bind(site_id)
        .execute(&ctx.pool)
        .await
        .expect("seed media_sites");

    let job = SiteExportJob::enqueue(&ctx.pool, site_id, None)
        .await
        .expect("enqueue");
    let done = drain_until_resolved(&ctx.pool, ctx.storage.as_ref(), site_id, job.id).await;

    assert_eq!(done.status, SiteExportStatus::Failed, "job fails");
    let err = done.error.expect("error recorded");
    assert!(
        err.starts_with("SITE_EXPORT_FAILED"),
        "error is tagged with the export failure code, got: {err}"
    );
}

#[tokio::test]
#[serial]
async fn retention_purges_expired_artifacts() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;

    let job = SiteExportJob::enqueue(&ctx.pool, site_id, None)
        .await
        .expect("enqueue");
    let ready = drain_until_resolved(&ctx.pool, ctx.storage.as_ref(), site_id, job.id).await;
    assert_eq!(ready.status, SiteExportStatus::Ready);
    let path = ready.storage_path.clone().expect("artifact path");
    assert!(
        ctx.storage.fetch(&path).await.is_ok(),
        "artifact exists before expiry"
    );

    // Force the download window to have lapsed.
    sqlx::query("UPDATE site_export_jobs SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1")
        .bind(job.id)
        .execute(&ctx.pool)
        .await
        .expect("expire job");

    let purged = site_export_worker::purge_expired(&ctx.pool, ctx.storage.as_ref())
        .await
        .expect("purge sweep");
    assert!(purged >= 1, "at least the expired job was reclaimed");

    // Row gone and artifact deleted.
    assert!(
        SiteExportJob::find_for_site(&ctx.pool, site_id, job.id)
            .await
            .is_err(),
        "expired job row is removed"
    );
    assert!(
        ctx.storage.fetch(&path).await.is_err(),
        "stored artifact is deleted"
    );
}

// ── Signed-download HTTP boundary ───────────────────────────────────────

#[tokio::test]
#[serial]
async fn signed_download_serves_zip_and_rejects_bad_or_expired_token() {
    let ctx = test_context().await;
    let site_id = create_test_site(&ctx.pool).await;
    let owner = create_test_api_key(&ctx.pool, site_id, ApiKeyPermission::Master).await;

    // Enqueue via the API, then drive the worker to ready.
    let created = ctx
        .server
        .post(&format!("/api/v1/sites/{site_id}/export"))
        .add_header("x-api-key", owner.as_str())
        .await;
    assert_eq!(created.status_code().as_u16(), 202);
    let job_id: Uuid = created.json::<serde_json::Value>()["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    let ready = drain_until_resolved(&ctx.pool, ctx.storage.as_ref(), site_id, job_id).await;
    assert_eq!(ready.status, SiteExportStatus::Ready);
    let token = ready.download_token.clone().expect("token");

    // Status endpoint hands back a signed link carrying the token.
    let status = ctx
        .server
        .get(&format!("/api/v1/sites/{site_id}/export/{job_id}"))
        .add_header("x-api-key", owner.as_str())
        .await;
    let url = status.json::<serde_json::Value>()["download_url"]
        .as_str()
        .expect("download_url present when ready")
        .to_string();
    assert!(url.contains("/download?token="), "link points at download");

    // Correct token → the ZIP streams back.
    let ok = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/export/{job_id}/download?token={token}"
        ))
        .add_header("x-api-key", owner.as_str())
        .await;
    ok.assert_status_ok();
    assert_eq!(
        ok.header("content-type"),
        "application/zip",
        "served as a zip"
    );
    let bytes = ok.as_bytes();
    assert_eq!(&bytes[..2], b"PK", "body is a real zip archive");

    // Wrong token → indistinguishable 404.
    let bad = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/export/{job_id}/download?token=not-the-token"
        ))
        .add_header("x-api-key", owner.as_str())
        .await;
    assert_eq!(bad.status_code().as_u16(), 404);
    assert_eq!(
        bad.json::<serde_json::Value>()["code"],
        forja::errors::codes::SITE_EXPORT_JOB_NOT_FOUND
    );

    // Expired link → also 404 (the artifact is, for the caller, gone).
    sqlx::query("UPDATE site_export_jobs SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1")
        .bind(job_id)
        .execute(&ctx.pool)
        .await
        .expect("expire");
    let expired = ctx
        .server
        .get(&format!(
            "/api/v1/sites/{site_id}/export/{job_id}/download?token={token}"
        ))
        .add_header("x-api-key", owner.as_str())
        .await;
    assert_eq!(expired.status_code().as_u16(), 404);
}

/// AC #717.1: the worker is registered in `workers.rs::spawn_all`. The
/// registration is a single call; this compile-time guard pins the
/// `spawn(AppState)` signature `spawn_all` depends on so it can't drift
/// silently.
#[test]
fn worker_spawn_signature_is_stable() {
    let _f: fn(forja::AppState) = forja::services::site_export_worker::SiteExportWorker::spawn;
}
