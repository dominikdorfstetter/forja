//! Legal document versioning (#140): a new version must preserve the
//! document's identity (cookie_name), and the public by-slug resolver must
//! return the currently-published version of the chain — so publishing a new
//! version supersedes the old one at the same URL while the old version is
//! preserved.

mod common;

use serial_test::serial;
use uuid::Uuid;

use forja::dto::legal::CreateLegalDocumentRequest;
use forja::models::content::ContentStatus;
use forja::models::legal::LegalDocType;
use forja::repos::legal_repo::LegalDocumentRepo;

use common::{create_test_site, test_db_pool};

async fn set_status(pool: &sqlx::PgPool, content_id: Uuid, status: &str) {
    sqlx::query("UPDATE contents SET status = $1::content_status WHERE id = $2")
        .bind(status)
        .bind(content_id)
        .execute(pool)
        .await
        .expect("set content status");
}

async fn set_slug(pool: &sqlx::PgPool, content_id: Uuid, slug: &str) {
    sqlx::query("UPDATE contents SET slug = $1 WHERE id = $2")
        .bind(slug)
        .bind(content_id)
        .execute(pool)
        .await
        .expect("set content slug");
}

#[tokio::test]
#[serial]
async fn new_version_preserves_cookie_name_and_bumps_version() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let cookie = format!("privacy-{}", &Uuid::new_v4().to_string()[..8]);

    let v1 = LegalDocumentRepo::create(
        &mut pool.acquire().await.unwrap(),
        CreateLegalDocumentRequest {
            cookie_name: cookie.clone(),
            document_type: LegalDocType::PrivacyPolicy,
            status: ContentStatus::Published,
            site_ids: vec![site_id],
        },
        Some("test-user"),
    )
    .await
    .expect("create v1");

    let v2 = LegalDocumentRepo::create_new_version(&pool, v1.id, vec![site_id], Some("test-user"))
        .await
        .expect("create v2");

    // A version keeps the document's identity — no "_copy" mangling.
    assert_eq!(
        v2.cookie_name, cookie,
        "new version must keep the cookie_name"
    );
    assert_eq!(v2.version, 2);
    assert_eq!(v2.parent_version_id, Some(v1.id));
}

#[tokio::test]
#[serial]
async fn is_published_reflects_content_status() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    let draft = LegalDocumentRepo::create(
        &mut pool.acquire().await.unwrap(),
        CreateLegalDocumentRequest {
            cookie_name: format!("imm-{}", &Uuid::new_v4().to_string()[..8]),
            document_type: LegalDocType::Disclaimer,
            status: ContentStatus::Draft,
            site_ids: vec![site_id],
        },
        Some("test-user"),
    )
    .await
    .expect("create draft");

    assert!(
        !LegalDocumentRepo::is_published(&pool, draft.id)
            .await
            .unwrap(),
        "a draft legal doc is editable in place"
    );

    set_status(&pool, draft.content_id.unwrap(), "published").await;
    assert!(
        LegalDocumentRepo::is_published(&pool, draft.id)
            .await
            .unwrap(),
        "a published legal doc is immutable"
    );
}

#[tokio::test]
#[serial]
async fn by_slug_resolves_to_the_currently_published_version() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;
    let cookie = format!("terms-{}", &Uuid::new_v4().to_string()[..8]);
    let slug = format!("terms-{}", &Uuid::new_v4().to_string()[..8]);

    let v1 = LegalDocumentRepo::create(
        &mut pool.acquire().await.unwrap(),
        CreateLegalDocumentRequest {
            cookie_name: cookie.clone(),
            document_type: LegalDocType::TermsOfService,
            status: ContentStatus::Published,
            site_ids: vec![site_id],
        },
        Some("test-user"),
    )
    .await
    .expect("create v1");
    // v1 owns the canonical slug.
    set_slug(&pool, v1.content_id.unwrap(), &slug).await;

    let v2 = LegalDocumentRepo::create_new_version(&pool, v1.id, vec![site_id], Some("test-user"))
        .await
        .expect("create v2");

    // While v2 is a Draft, the slug still resolves to the published v1.
    let resolved = LegalDocumentRepo::find_by_slug_for_site(&pool, site_id, &slug)
        .await
        .expect("resolve while v2 draft");
    assert_eq!(
        resolved.id, v1.id,
        "draft v2 must not supersede published v1"
    );

    // Publish v2 → it supersedes v1 at the same slug.
    set_status(&pool, v2.content_id.unwrap(), "published").await;
    let resolved = LegalDocumentRepo::find_by_slug_for_site(&pool, site_id, &slug)
        .await
        .expect("resolve after v2 published");
    assert_eq!(
        resolved.id, v2.id,
        "published v2 must supersede v1 at the same slug"
    );

    // v1 still exists (preserved as history).
    let v1_still = LegalDocumentRepo::find_by_id(&pool, v1.id)
        .await
        .expect("v1 preserved");
    assert!(!v1_still.is_deleted);
}
