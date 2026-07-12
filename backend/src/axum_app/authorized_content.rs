//! Authorized content-entity extractor seam — issue #662.
//!
//! Replaces the hand-rolled prelude that appears 100+ times across the
//! six Content entity handler files (blog, page, legal, project, cv,
//! document):
//!
//! ```ignore
//! let entity = EntityRepo::find_by_id(&state.db, id).await?;
//! let site_ids = Content::find_site_ids(&state.db, entity.content_id).await?;
//! if let Some(&site_id) = site_ids.first() {
//!     ModuleGuard::<EntityModule>::check(&state.db, site_id).await?;
//! }
//! for site_id in &site_ids {
//!     PermissionService::require(&state.db, &actor, *site_id, &Permission::new("entity", "read")).await?;
//! }
//! ```
//!
//! Becomes:
//!
//! ```ignore
//! async fn get_blog(
//!     State(state): State<AppState>,
//!     access: AuthorizedContent<BlogContent, Read>,
//! ) -> Result<Json<BlogResponse>, ApiError> {
//!     Ok(Json(BlogResponse::from(access.entity.into_blog())))
//! }
//! ```
//!
//! The extractor enforces, in order: actor resolution → entity load →
//! site resolution → module check (first site) → permission check
//! (all sites for `AllSites` mode, default; or any site for `AnySite`
//! mode used by skill/cv-style entities that explicitly share resources
//! across many sites without per-site auth).
//!
//! ## Why two extractors
//!
//! * [`AuthorizedContent<E, A>`] — entity-id is in the path; the extractor
//!   loads the entity and discovers its sites. Use for `get`, `update`,
//!   `delete` style operations.
//! * [`AuthorizedSite<K, A>`] — `site_id` is in the path directly. Use for
//!   `list`, `search`, and `create` operations where no existing entity
//!   identifies the authorisation target.
//!
//! ## What is _not_ covered
//!
//! * `PermissionService::require_resource_access` / `check_resource_access`
//!   — ownership-aware checks that need the entity's `created_by` + `status`.
//!   These stay inline (allow-listed in the lint gate) until issue #662
//!   follow-up.
//! * Bulk endpoints, which iterate over a list of entity IDs and apply
//!   per-entity authorisation. Keep their existing shape.

use std::marker::PhantomData;

use axum::extract::{FromRequest, FromRequestParts, RawPathParams, Request};
use axum::http::request::Parts;
use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::validated::{Validated, ValidatedDto, ValidatedJson};

use crate::AppState;
use crate::errors::{ApiError, codes};
use crate::guards::actor::Actor;
use crate::guards::module_guard::{ModuleGuard, ModuleMarker};
use crate::models::content::Content;
use crate::services::permission_service::{Permission, PermissionService};

// ── Action markers ───────────────────────────────────────────────────────

/// Marker for the permission action verb (`read`, `create`, `update`,
/// `delete`). Each marker maps to the action string passed to
/// [`Permission::new`].
pub trait ContentAction: Send + Sync + 'static {
    const ACTION: &'static str;
}

pub struct Read;
impl ContentAction for Read {
    const ACTION: &'static str = "read";
}

pub struct Create;
impl ContentAction for Create {
    const ACTION: &'static str = "create";
}

pub struct Update;
impl ContentAction for Update {
    const ACTION: &'static str = "update";
}

pub struct Delete;
impl ContentAction for Delete {
    const ACTION: &'static str = "delete";
}

// ── Auth modes ──────────────────────────────────────────────────────────

/// All listed sites must authorize the actor (strict). This is the
/// pattern used by blog/page/legal/project/document for content shared
/// across multiple sites — the actor must be authorised on every site
/// the content belongs to, not just one.
pub struct AllSites;

/// Any single site must authorize the actor (lenient). Used by
/// cv/skill-style resources that are intentionally shared widely and
/// where the actor only needs permission on one of the linked sites.
pub struct AnySite;

/// Internal seam selecting the permission-check semantics. Implemented
/// for [`AllSites`] (strict) and [`AnySite`] (lenient).
pub trait AuthMode: Send + Sync + 'static {
    /// Returns the "primary" site id chosen for downstream audit /
    /// publish-event emission. For `AllSites` this is the first listed
    /// site; for `AnySite` it is the first site that authorised.
    fn check(
        pool: &PgPool,
        actor: &Actor,
        site_ids: &[Uuid],
        permission: &Permission,
        entity_tag: &'static str,
    ) -> impl std::future::Future<Output = Result<Uuid, ApiError>> + Send;
}

impl AuthMode for AllSites {
    async fn check(
        pool: &PgPool,
        actor: &Actor,
        site_ids: &[Uuid],
        permission: &Permission,
        entity_tag: &'static str,
    ) -> Result<Uuid, ApiError> {
        if site_ids.is_empty() {
            return Err(empty_sites_error(entity_tag));
        }
        for site_id in site_ids {
            PermissionService::require(pool, actor, *site_id, permission).await?;
        }
        Ok(site_ids[0])
    }
}

impl AuthMode for AnySite {
    async fn check(
        pool: &PgPool,
        actor: &Actor,
        site_ids: &[Uuid],
        permission: &Permission,
        entity_tag: &'static str,
    ) -> Result<Uuid, ApiError> {
        if site_ids.is_empty() {
            return Err(empty_sites_error(entity_tag));
        }
        for site_id in site_ids {
            if PermissionService::has_permission(pool, actor, *site_id, permission).await? {
                return Ok(*site_id);
            }
        }
        Err(
            ApiError::forbidden("You don't have permission to perform this action")
                .with_code(codes::AUTH_INSUFFICIENT_ROLE),
        )
    }
}

fn empty_sites_error(entity_tag: &'static str) -> ApiError {
    ApiError::not_found(format!("{} not associated with any site", entity_tag))
        .with_code(codes::ENTITY_NOT_FOUND)
        .with_entity_type(entity_tag)
}

// ── Entity metadata trait ────────────────────────────────────────────────

/// Compile-time metadata bundle for a content entity: which module
/// guards it, which permission resource string it uses, how to load it,
/// and how to resolve its site memberships.
///
/// Most implementors delegate `load_and_sites` to a `EntityRepo::find_by_id`
/// call followed by `Content::find_site_ids`. Entities without a
/// `content_id` (skills, cv entries, document folders) override the
/// site-discovery side to read from their own junction table.
pub trait LoadableContent: Sized + Send + Sync + 'static {
    /// Module-guard marker enforced on the entity's primary site.
    type Module: ModuleMarker;

    /// Permission resource string (`"blog"`, `"page"`, `"legal"`,
    /// `"portfolio"`, `"cv"`, `"documents"`).
    const RESOURCE: &'static str;

    /// Tag for `entity_type` on the not-found ApiError when site
    /// resolution finds zero sites.
    const ENTITY_TAG: &'static str;

    /// Name of the path parameter carrying the entity UUID. Defaults to
    /// `"id"`, which matches the majority of routes (`/blogs/{id}`,
    /// `/pages/{id}`, etc.). Override when the route uses a named
    /// parameter (e.g. `"blog_id"`).
    const PATH_PARAM: &'static str = "id";

    fn load_and_sites(
        pool: &PgPool,
        id: Uuid,
    ) -> impl std::future::Future<Output = Result<(Self, Vec<Uuid>), ApiError>> + Send;
}

/// Resolve sites via the `contents` junction table for an entity that
/// carries a non-nullable `content_id`. Mirrors the dominant prelude
/// across blog / page / project handlers.
pub async fn sites_via_content(pool: &PgPool, content_id: Uuid) -> Result<Vec<Uuid>, ApiError> {
    Content::find_site_ids(pool, content_id).await
}

/// Same as [`sites_via_content`] but for entities whose `content_id` is
/// nullable (legal documents, document folders). Returns `Vec::new()`
/// when no content row is linked — the extractor treats an empty
/// site list as a 404 with `ENTITY_NOT_FOUND`.
pub async fn sites_via_optional_content(
    pool: &PgPool,
    content_id: Option<Uuid>,
) -> Result<Vec<Uuid>, ApiError> {
    match content_id {
        Some(cid) => Content::find_site_ids(pool, cid).await,
        None => Ok(Vec::new()),
    }
}

// ── Site-kind trait (for AuthorizedSite) ─────────────────────────────────

/// Lightweight metadata for site-rooted authorisation: a module marker
/// plus permission resource string. Used when the `site_id` is in the
/// URL path directly (list / search / create endpoints).
pub trait SiteKind: Send + Sync + 'static {
    type Module: ModuleMarker;
    const RESOURCE: &'static str;
}

// Every LoadableContent doubles as a SiteKind via blanket impl — same
// (Module, RESOURCE) pair, so a handler can use either extractor without
// declaring two markers per entity.
impl<E: LoadableContent> SiteKind for E {
    type Module = <E as LoadableContent>::Module;
    const RESOURCE: &'static str = <E as LoadableContent>::RESOURCE;
}

// ── Extractors ───────────────────────────────────────────────────────────

/// Authorized access to a content entity loaded from the URL path.
///
/// Resolution order:
///
/// 1. Extract entity id from path (`E::PATH_PARAM`).
/// 2. Resolve [`Actor`] from request (cached in extensions).
/// 3. Load the entity + its site memberships via `E::load_and_sites`.
/// 4. Enforce [`ModuleGuard::<E::Module>::check`] on the primary site.
/// 5. Enforce the per-site permission policy chosen by `M` (default
///    [`AllSites`]).
///
/// Fields are public so handlers can pattern-match into them directly.
pub struct AuthorizedContent<E, A, M = AllSites>
where
    E: LoadableContent,
    A: ContentAction,
    M: AuthMode,
{
    pub entity: E,
    pub site_ids: Vec<Uuid>,
    pub primary_site_id: Uuid,
    pub actor: Actor,
    _marker: PhantomData<(A, M)>,
}

impl<E, A, M> FromRequestParts<AppState> for AuthorizedContent<E, A, M>
where
    E: LoadableContent,
    A: ContentAction,
    M: AuthMode,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let entity_id = extract_path_uuid(parts, E::PATH_PARAM).await.map_err(|_| {
            ApiError::internal(format!(
                "AuthorizedContent<{}> requires path parameter `{}`",
                E::RESOURCE,
                E::PATH_PARAM
            ))
        })?;
        let actor = Actor::from_request_parts(parts, state).await?;
        let (entity, site_ids) = E::load_and_sites(&state.db, entity_id).await?;

        if let Some(&site_id) = site_ids.first() {
            ModuleGuard::<E::Module>::check(&state.db, site_id).await?;
        }

        let perm = Permission::new(E::RESOURCE, A::ACTION);
        let primary_site_id = M::check(&state.db, &actor, &site_ids, &perm, E::ENTITY_TAG).await?;

        Ok(Self {
            entity,
            site_ids,
            primary_site_id,
            actor,
            _marker: PhantomData,
        })
    }
}

/// Authorized access to a site identified by `site_id` in the URL
/// path. Loads no entity — used for list, search, and create endpoints.
///
/// Resolution order:
///
/// 1. Read `site_id` from the path (parameter name `"site_id"`).
/// 2. Resolve [`Actor`] from request.
/// 3. Enforce [`ModuleGuard::<K::Module>::check`].
/// 4. Enforce [`PermissionService::require`] with the resource + action.
pub struct AuthorizedSite<K, A>
where
    K: SiteKind,
    A: ContentAction,
{
    pub site_id: Uuid,
    pub actor: Actor,
    _marker: PhantomData<(K, A)>,
}

impl<K, A> FromRequestParts<AppState> for AuthorizedSite<K, A>
where
    K: SiteKind,
    A: ContentAction,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let site_id = extract_path_uuid(parts, "site_id").await.map_err(|_| {
            ApiError::internal(format!(
                "AuthorizedSite<{}> requires path parameter `site_id`",
                K::RESOURCE
            ))
        })?;
        let actor = Actor::from_request_parts(parts, state).await?;

        ModuleGuard::<K::Module>::check(&state.db, site_id).await?;
        PermissionService::require(
            &state.db,
            &actor,
            site_id,
            &Permission::new(K::RESOURCE, A::ACTION),
        )
        .await?;

        Ok(Self {
            site_id,
            actor,
            _marker: PhantomData,
        })
    }
}

// ── Ownership-aware extractor ────────────────────────────────────────────

/// Adapter trait for entities that expose a `content_id` joining to the
/// `contents` table. The ownership-aware extractor uses this to load the
/// `Content` row, which carries `created_by` + `status` — the fields
/// `PermissionService::require_resource_access` consults to evaluate
/// `own:` scope and protected-status escalation.
///
/// Returns `Option` because legal documents allow a null `content_id`;
/// the extractor 404s in that case (consistent with the empty-sites
/// behaviour on the base extractor).
pub trait HasContentId: LoadableContent {
    fn content_id(&self) -> Option<Uuid>;
}

/// Authorised access with ownership-aware policy evaluation.
///
/// Same resolution as [`AuthorizedContent`] up through site resolution
/// and module guard. Then it loads the `Content` row, builds a
/// [`ResourceContext`], and calls
/// [`PermissionService::require_resource_access`] — which evaluates
/// `own:` scope (creator match) and protected-status escalation
/// (`Published`/`Scheduled`/`Archived` requires Editor+).
///
/// Use for `update_*` / `delete_*` handlers that previously called
/// `check_resource_access` inline with manual error-message branching.
/// The error message comes from `require_resource_access` itself, which
/// emits `"Published content requires Editor or higher role to edit"`
/// for protected statuses and `"You can only edit your own content"`
/// otherwise.
pub struct AuthorizedContentWithOwnership<E, A>
where
    E: HasContentId,
    A: ContentAction,
{
    pub entity: E,
    pub site_ids: Vec<Uuid>,
    pub primary_site_id: Uuid,
    pub content: Content,
    pub actor: Actor,
    _marker: PhantomData<A>,
}

impl<E, A> FromRequestParts<AppState> for AuthorizedContentWithOwnership<E, A>
where
    E: HasContentId,
    A: ContentAction,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
        let entity_id = extract_path_uuid(parts, E::PATH_PARAM).await.map_err(|_| {
            ApiError::internal(format!(
                "AuthorizedContentWithOwnership<{}> requires path parameter `{}`",
                E::RESOURCE,
                E::PATH_PARAM
            ))
        })?;
        let actor = Actor::from_request_parts(parts, state).await?;
        let (entity, site_ids) = E::load_and_sites(&state.db, entity_id).await?;

        let Some(&primary_site_id) = site_ids.first() else {
            return Err(empty_sites_error(E::ENTITY_TAG));
        };
        ModuleGuard::<E::Module>::check(&state.db, primary_site_id).await?;

        let Some(content_id) = entity.content_id() else {
            return Err(empty_sites_error(E::ENTITY_TAG));
        };
        let content = Content::find_by_id(&state.db, content_id).await?;

        let ctx = crate::services::permission_service::ResourceContext::new(
            content.created_by.clone(),
            Some(content.status.clone()),
        );
        let perm = Permission::new(E::RESOURCE, A::ACTION);
        PermissionService::require_resource_access(&state.db, &actor, primary_site_id, &perm, &ctx)
            .await?;

        Ok(Self {
            entity,
            site_ids,
            primary_site_id,
            content,
            actor,
            _marker: PhantomData,
        })
    }
}

// ── Body-payload sites extractor ─────────────────────────────────────────

/// DTOs whose JSON body carries a `Vec<Uuid>` of target sites — typical
/// of `create_*` requests that target multiple sites.
///
/// Implementors are paired with [`AuthorizedJson<K, T, A>`], which
/// validates the body via `ValidatedJson<T>` and then enforces the
/// per-site permission policy ([`AllSites`] semantics by default) on
/// every id returned here.
pub trait HasPayloadSites {
    fn payload_site_ids(&self) -> &[Uuid];
}

/// Combined extractor for create-style handlers whose authorisation
/// target lives in the request body, not the URL path.
///
/// Equivalent to chaining `Actor` resolution → `ValidatedJson<T>` →
/// `ModuleGuard<K::Module>::check(first_site)` → per-site
/// `PermissionService::require`, in one step. Replaces the boilerplate
/// loop that previously appeared at the top of `create_blog`,
/// `create_page`, `create_legal_document`, etc.
pub struct AuthorizedJson<K, T, A>
where
    K: SiteKind,
    T: ValidatedDto + HasPayloadSites,
    A: ContentAction,
{
    pub validated: Validated<T>,
    pub actor: Actor,
    pub site_ids: Vec<Uuid>,
    _marker: PhantomData<(K, A)>,
}

impl<K, T, A> FromRequest<AppState> for AuthorizedJson<K, T, A>
where
    K: SiteKind,
    T: ValidatedDto + HasPayloadSites,
    A: ContentAction,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &AppState) -> Result<Self, ApiError> {
        let (mut parts, body) = req.into_parts();
        let actor = Actor::from_request_parts(&mut parts, state).await?;
        let req = Request::from_parts(parts, body);
        let ValidatedJson(validated) = ValidatedJson::<T>::from_request(req, state).await?;

        let site_ids: Vec<Uuid> = validated.payload_site_ids().to_vec();
        if site_ids.is_empty() {
            return Err(ApiError::bad_request(format!(
                "{} requires at least one site_id",
                K::RESOURCE
            )));
        }

        ModuleGuard::<K::Module>::check(&state.db, site_ids[0]).await?;
        let perm = Permission::new(K::RESOURCE, A::ACTION);
        for sid in &site_ids {
            PermissionService::require(&state.db, &actor, *sid, &perm).await?;
        }

        Ok(Self {
            validated,
            actor,
            site_ids,
            _marker: PhantomData,
        })
    }
}

// ── Path extraction helper ──────────────────────────────────────────────

/// Read a named path parameter and parse it as a UUID. Uses
/// `RawPathParams` (non-destructive) so it composes with any other
/// `Path<...>` extractor the handler also declares.
async fn extract_path_uuid(parts: &mut Parts, name: &str) -> Result<Uuid, ()> {
    let params = RawPathParams::from_request_parts(parts, &())
        .await
        .map_err(|_| ())?;
    params
        .iter()
        .find(|(n, _)| *n == name)
        .and_then(|(_, v)| Uuid::parse_str(v).ok())
        .ok_or(())
}

// ── Entity impls ─────────────────────────────────────────────────────────
//
// LoadableContent impls for the six Content entities. Each impl pairs a
// repo's `find_by_id` with `Content::find_site_ids` via the
// [`load_via_content_join`] helper — the dominant pattern across the
// existing handlers.

use crate::dto::blog::CreateBlogRequest;
use crate::dto::cv::CreateCvEntryRequest;
use crate::dto::legal::CreateLegalDocumentRequest;
use crate::dto::page::CreatePageRequest;
use crate::dto::project::CreateProjectRequest;
use crate::guards::module_guard::{
    BlogModule, CvModule, DocumentsModule, LegalModule, PagesModule, PortfolioModule,
};
use crate::models::blog::BlogWithContent;
use crate::models::document::Document;
use crate::models::legal::{LegalDocument, LegalGroup, LegalItem};
use crate::models::page::{PageSection, PageSectionLocalization, PageWithContent};
use crate::models::project::ProjectWithContent;
use crate::repos::blog_repo::BlogRepo;
use crate::repos::document_repo::DocumentRepo;
use crate::repos::legal_repo::{LegalDocumentRepo, LegalGroupRepo, LegalItemRepo};
use crate::repos::page_repo::{PageRepo, PageSectionLocalizationRepo, PageSectionRepo};
use crate::repos::project_repo::ProjectRepo;

impl LoadableContent for BlogWithContent {
    type Module = BlogModule;
    const RESOURCE: &'static str = "blog";
    const ENTITY_TAG: &'static str = "blog";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let entity = BlogRepo::find_by_id(pool, id).await?;
        let site_ids = sites_via_content(pool, entity.content_id).await?;
        Ok((entity, site_ids))
    }
}

impl HasContentId for BlogWithContent {
    fn content_id(&self) -> Option<Uuid> {
        Some(self.content_id)
    }
}

impl LoadableContent for PageWithContent {
    type Module = PagesModule;
    const RESOURCE: &'static str = "page";
    const ENTITY_TAG: &'static str = "page";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let entity = PageRepo::find_by_id(pool, id).await?;
        let site_ids = sites_via_content(pool, entity.content_id).await?;
        Ok((entity, site_ids))
    }
}

impl HasContentId for PageWithContent {
    fn content_id(&self) -> Option<Uuid> {
        Some(self.content_id)
    }
}

impl LoadableContent for ProjectWithContent {
    type Module = PortfolioModule;
    const RESOURCE: &'static str = "portfolio";
    const ENTITY_TAG: &'static str = "project";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let entity = ProjectRepo::find_by_id(pool, id).await?;
        let site_ids = sites_via_content(pool, entity.content_id).await?;
        Ok((entity, site_ids))
    }
}

impl HasContentId for ProjectWithContent {
    fn content_id(&self) -> Option<Uuid> {
        Some(self.content_id)
    }
}

impl LoadableContent for LegalDocument {
    type Module = LegalModule;
    const RESOURCE: &'static str = "legal";
    const ENTITY_TAG: &'static str = "legal_document";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let entity = LegalDocumentRepo::find_by_id(pool, id).await?;
        let site_ids = sites_via_optional_content(pool, entity.content_id).await?;
        Ok((entity, site_ids))
    }
}

impl HasContentId for LegalDocument {
    fn content_id(&self) -> Option<Uuid> {
        self.content_id
    }
}

// ── Stand-alone SiteKind markers (for entities without LoadableContent) ──
//
// `Skill` and `CvEntry` use the `"cv"` permission resource and the
// `CvModule` (alias for `PortfolioModule`). Until they grow their own
// `LoadableContent` impls (junction table is `skill_sites` / `cv_entry_sites`,
// not `content_sites`), we expose a SiteKind marker so `AuthorizedSite` /
// `AuthorizedJson` can still be used for site-rooted CV operations.

pub struct CvSite;
impl SiteKind for CvSite {
    type Module = CvModule;
    const RESOURCE: &'static str = "cv";
}

// ── HasPayloadSites impls for create-DTOs ────────────────────────────────

impl HasPayloadSites for CreateBlogRequest {
    fn payload_site_ids(&self) -> &[Uuid] {
        &self.site_ids
    }
}

impl HasPayloadSites for CreatePageRequest {
    fn payload_site_ids(&self) -> &[Uuid] {
        &self.site_ids
    }
}

impl HasPayloadSites for CreateProjectRequest {
    fn payload_site_ids(&self) -> &[Uuid] {
        &self.site_ids
    }
}

impl HasPayloadSites for CreateLegalDocumentRequest {
    fn payload_site_ids(&self) -> &[Uuid] {
        &self.site_ids
    }
}

impl HasPayloadSites for CreateCvEntryRequest {
    fn payload_site_ids(&self) -> &[Uuid] {
        &self.site_ids
    }
}

// ── Sub-entity LoadableContent impls ─────────────────────────────────────
//
// Sub-entities resolve their authorisation target by chaining through
// their parent: a page section's sites are its page's sites, a legal
// group's sites are its legal document's sites, etc.

impl LoadableContent for PageSection {
    type Module = PagesModule;
    const RESOURCE: &'static str = "page";
    const ENTITY_TAG: &'static str = "page_section";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let section = PageSectionRepo::find_by_id(pool, id).await?;
        let page = PageRepo::find_by_id(pool, section.page_id).await?;
        let site_ids = sites_via_content(pool, page.content_id).await?;
        Ok((section, site_ids))
    }
}

impl LoadableContent for PageSectionLocalization {
    type Module = PagesModule;
    const RESOURCE: &'static str = "page";
    const ENTITY_TAG: &'static str = "page_section_localization";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let loc = PageSectionLocalizationRepo::find_by_id(pool, id).await?;
        let section = PageSectionRepo::find_by_id(pool, loc.page_section_id).await?;
        let page = PageRepo::find_by_id(pool, section.page_id).await?;
        let site_ids = sites_via_content(pool, page.content_id).await?;
        Ok((loc, site_ids))
    }
}

impl LoadableContent for LegalGroup {
    type Module = LegalModule;
    const RESOURCE: &'static str = "legal";
    const ENTITY_TAG: &'static str = "legal_group";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let group = LegalGroupRepo::find_by_id(pool, id).await?;
        let doc = LegalDocumentRepo::find_by_id(pool, group.legal_document_id).await?;
        let site_ids = sites_via_optional_content(pool, doc.content_id).await?;
        Ok((group, site_ids))
    }
}

impl LoadableContent for LegalItem {
    type Module = LegalModule;
    const RESOURCE: &'static str = "legal";
    const ENTITY_TAG: &'static str = "legal_item";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let item = LegalItemRepo::find_by_id(pool, id).await?;
        let group = LegalGroupRepo::find_by_id(pool, item.legal_group_id).await?;
        let doc = LegalDocumentRepo::find_by_id(pool, group.legal_document_id).await?;
        let site_ids = sites_via_optional_content(pool, doc.content_id).await?;
        Ok((item, site_ids))
    }
}

// Documents carry `site_id` on the row directly — no `contents`
// junction needed, so site resolution is the row's own site_id.
impl LoadableContent for Document {
    type Module = DocumentsModule;
    const RESOURCE: &'static str = "document";
    const ENTITY_TAG: &'static str = "document";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let document = DocumentRepo::find_by_id(pool, id).await?;
        let site_ids = vec![document.site_id];
        Ok((document, site_ids))
    }
}

// DocumentFolder also carries `site_id` directly.
use crate::models::document::{DocumentFolder, DocumentLocalization};
use crate::repos::document_repo::{DocumentFolderRepo, DocumentLocalizationRepo};

impl LoadableContent for DocumentFolder {
    type Module = DocumentsModule;
    const RESOURCE: &'static str = "document";
    const ENTITY_TAG: &'static str = "document_folder";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let folder = DocumentFolderRepo::find_by_id(pool, id).await?;
        let site_ids = vec![folder.site_id];
        Ok((folder, site_ids))
    }
}

impl LoadableContent for DocumentLocalization {
    type Module = DocumentsModule;
    const RESOURCE: &'static str = "document";
    const ENTITY_TAG: &'static str = "document_localization";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let loc = DocumentLocalizationRepo::find_by_id(pool, id).await?;
        let doc = DocumentRepo::find_by_id(pool, loc.document_id).await?;
        let site_ids = vec![doc.site_id];
        Ok((loc, site_ids))
    }
}

// Skill / CvEntry — sites live in dedicated junction tables
// (`skill_sites`, `cv_entry_sites`), not the global `content_sites`.
// CvEntryRepo / SkillRepo expose `find_site_ids` for this.
use crate::models::cv::{CvEntry, Skill};
use crate::repos::cv_repo::{CvEntryRepo, SkillRepo};

impl LoadableContent for Skill {
    type Module = CvModule;
    const RESOURCE: &'static str = "cv";
    const ENTITY_TAG: &'static str = "skill";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let skill = SkillRepo::find_by_id(pool, id).await?;
        let site_ids = SkillRepo::find_site_ids(pool, id).await?;
        Ok((skill, site_ids))
    }
}

impl LoadableContent for CvEntry {
    type Module = CvModule;
    const RESOURCE: &'static str = "cv";
    const ENTITY_TAG: &'static str = "cv_entry";

    async fn load_and_sites(pool: &PgPool, id: Uuid) -> Result<(Self, Vec<Uuid>), ApiError> {
        let entry = CvEntryRepo::find_by_id(pool, id).await?;
        let site_ids = CvEntryRepo::find_site_ids(pool, id).await?;
        Ok((entry, site_ids))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_action_string_is_read() {
        assert_eq!(<Read as ContentAction>::ACTION, "read");
    }

    #[test]
    fn create_action_string_is_create() {
        assert_eq!(<Create as ContentAction>::ACTION, "create");
    }

    #[test]
    fn update_action_string_is_update() {
        assert_eq!(<Update as ContentAction>::ACTION, "update");
    }

    #[test]
    fn delete_action_string_is_delete() {
        assert_eq!(<Delete as ContentAction>::ACTION, "delete");
    }

    #[test]
    fn empty_sites_error_carries_entity_tag() {
        let err = empty_sites_error("blog");
        assert_eq!(err.status().as_u16(), 404);
        // The entity tag rides on the ProblemDetails extensions; we
        // assert it survives the round-trip via the Display impl, which
        // is the cheap surface here. The full shape is covered by
        // integration tests on real endpoints.
        let body = format!("{}", err);
        assert!(body.contains("blog"));
    }
}
