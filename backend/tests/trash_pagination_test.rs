//! Repo-level tests for #949 — `TrashRepo::list` must return one bounded page,
//! not the full UNION.
//!
//! `GET /sites/{id}/trash` was the only list endpoint without pagination: it
//! materialized an unbounded 13-way `UNION ALL` and derived `total` from
//! `Vec::len()`. With a site reset (#714) able to dump an entire site's content
//! into trash, that is a real memory edge. These tests pin the page bound and
//! the newest-first ordering against a real database.

mod common;

use serial_test::serial;
use sqlx::PgPool;
use uuid::Uuid;

use forja::models::content::ContentStatus;
use forja::repos::trash_repo::TrashRepo;
use forja::services::content_service::ContentService;

use common::{create_test_site, test_db_pool};

/// Seed `n` soft-deleted blog content rows scoped to `site_id`.
async fn seed_trashed_blogs(pool: &PgPool, site_id: Uuid, n: usize) {
    for _ in 0..n {
        let mut conn = pool.acquire().await.unwrap();
        let content_id = ContentService::create_content(
            &mut conn,
            "blog",
            Some(&format!("trash-{}", &Uuid::new_v4().to_string()[..8])),
            &ContentStatus::Draft,
            &[site_id],
            None,
            None,
            Some("test-user"),
        )
        .await
        .expect("create blog content");
        drop(conn);
        ContentService::soft_delete_content(pool, content_id)
            .await
            .expect("soft delete");
    }
}

// ---------------------------------------------------------------------------
// Tracer bullet: with N > page_size trashed items, page 1 returns exactly
// page_size rows while the count reflects the full total.
// ---------------------------------------------------------------------------
#[tokio::test]
#[serial]
async fn list_returns_one_bounded_page() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    seed_trashed_blogs(&pool, site_id, 7).await;

    let page = TrashRepo::list(&pool, site_id, 5, 0).await.expect("list");
    let total = TrashRepo::count(&pool, site_id).await.expect("count");

    assert_eq!(page.len(), 5, "page must be bounded by limit, not full set");
    assert_eq!(
        total, 7,
        "total must reflect every trashed row, not the page"
    );
    assert!(
        page.iter().all(|item| item.site_id == site_id),
        "every row must belong to the requested site"
    );
}

// ---------------------------------------------------------------------------
// Pagination is stable: offset walks to the remaining rows with no overlap.
// ---------------------------------------------------------------------------
#[tokio::test]
#[serial]
async fn list_offset_walks_remaining_rows() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    seed_trashed_blogs(&pool, site_id, 7).await;

    let page1 = TrashRepo::list(&pool, site_id, 5, 0).await.expect("page1");
    let page2 = TrashRepo::list(&pool, site_id, 5, 5).await.expect("page2");

    assert_eq!(page1.len(), 5);
    assert_eq!(page2.len(), 2, "second page holds the remainder");

    let ids1: std::collections::HashSet<Uuid> = page1.iter().map(|i| i.id).collect();
    assert!(
        page2.iter().all(|i| !ids1.contains(&i.id)),
        "pages must not overlap"
    );
}

// ---------------------------------------------------------------------------
// Newest-deleted first ordering is preserved across the UNION + LIMIT.
// ---------------------------------------------------------------------------
#[tokio::test]
#[serial]
async fn list_orders_newest_deleted_first() {
    let pool = test_db_pool().await;
    let site_id = create_test_site(&pool).await;

    seed_trashed_blogs(&pool, site_id, 4).await;

    let page = TrashRepo::list(&pool, site_id, 100, 0).await.expect("list");

    let deleted_ats: Vec<_> = page.iter().filter_map(|i| i.deleted_at).collect();
    let mut sorted = deleted_ats.clone();
    sorted.sort_by(|a, b| b.cmp(a));
    assert_eq!(deleted_ats, sorted, "rows must be newest-deleted first");
}
