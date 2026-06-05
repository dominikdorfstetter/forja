//! Integration tests for the private-document TTL + lockout columns
//! introduced in #694 and consumed by #695/#696/#697.

mod common;

use chrono::{Duration, Utc};
use serial_test::serial;
use sqlx::Row;
use uuid::Uuid;

use forja::dto::document::CreateDocumentRequest;
use forja::repos::document_repo::DocumentRepo;

use common::{create_test_site, test_db_pool};

async fn make_uploaded_document(pool: &sqlx::PgPool) -> Uuid {
    let site_id = create_test_site(pool).await;
    let req = CreateDocumentRequest {
        url: None,
        file_data: Some(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            b"hello",
        )),
        file_name: Some(format!("doc-{}.txt", &Uuid::new_v4().to_string()[..8])),
        file_size: Some(5),
        mime_type: Some("text/plain".into()),
        document_type: "pdf".into(),
        folder_id: None,
        display_order: 0,
    };
    let file_data = Some(b"hello".to_vec());
    DocumentRepo::create(pool, site_id, &req, file_data)
        .await
        .expect("create document")
        .id
}

#[tokio::test]
#[serial]
async fn migration_694_columns_default_to_neutral_state() {
    let pool = test_db_pool().await;
    let id = make_uploaded_document(&pool).await;

    let row = sqlx::query(
        r#"
        SELECT private_access_expires_at,
               private_failed_attempt_count,
               private_locked_until
        FROM documents WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .expect("fetch lockout columns");

    let expires: Option<chrono::DateTime<Utc>> = row.get(0);
    let count: i32 = row.get(1);
    let locked_until: Option<chrono::DateTime<Utc>> = row.get(2);

    assert!(expires.is_none(), "TTL defaults to NULL");
    assert_eq!(count, 0, "failed-attempt counter defaults to 0");
    assert!(locked_until.is_none(), "locked_until defaults to NULL");
}

#[tokio::test]
#[serial]
async fn migration_694_columns_accept_writes() {
    let pool = test_db_pool().await;
    let id = make_uploaded_document(&pool).await;
    let exp = Utc::now() + Duration::hours(24);

    sqlx::query(
        r#"
        UPDATE documents
        SET private_access_expires_at = $2,
            private_failed_attempt_count = 2,
            private_locked_until = $3
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(exp)
    .bind(exp)
    .execute(&pool)
    .await
    .expect("update lockout columns");

    let row = sqlx::query(
        r#"
        SELECT private_access_expires_at,
               private_failed_attempt_count,
               private_locked_until
        FROM documents WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .expect("fetch lockout columns");

    let expires: Option<chrono::DateTime<Utc>> = row.get(0);
    let count: i32 = row.get(1);
    let locked_until: Option<chrono::DateTime<Utc>> = row.get(2);

    assert!(expires.is_some());
    assert_eq!(count, 2);
    assert!(locked_until.is_some());
}
