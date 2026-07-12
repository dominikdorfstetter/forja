//! Type-level proof that a request DTO has passed both its `derive(Validate)`
//! field-level gate and its cross-field / context-bound gate.
//!
//! Handlers take `ValidatedJson<T>`, which yields a `Validated<T>` — a newtype
//! constructible only via `ValidatedDto::validate_all`. The wall lives at the
//! request boundary; the type system makes "I forgot to call validate" non-
//! representable. See `CONTEXT.md` and the parent epic (issue #610) for the
//! full rationale and the migration plan.

use std::ops::Deref;

use axum::extract::{FromRequest, Request};
use axum::http::request::Parts;
use axum::response::Json;
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::AppState;
use crate::errors::ApiError;

/// Derives a trivial `ValidatedDto` impl for DTOs whose only validation is the
/// field-level gate from `derive(Validate)`. See `backend/macros/src/lib.rs`.
pub use forja_macros::ValidatedDto;

/// A `T` that has passed `ValidatedDto::validate_all`. The inner field is
/// private; `ValidatedDto` impls construct via `Validated::seal`. Outside this
/// crate, the only path to a `Validated<T>` is through `ValidatedJson<T>`.
#[derive(Debug)]
pub struct Validated<T>(T);

impl<T> Validated<T> {
    /// Internal constructor. Call only from within a `ValidatedDto::validate_all`
    /// impl after both field-level and cross-field gates have passed.
    pub(crate) fn seal(inner: T) -> Self {
        Self(inner)
    }

    /// Move out of the wrapper. The validation proof is discarded along with
    /// the wrapper, so prefer borrowing via `Deref` where possible.
    pub fn into_inner(self) -> T {
        self.0
    }
}

impl<T> Deref for Validated<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

/// Describes how to assemble a DTO's validation context from an in-flight
/// request. The trivial `()` impl below covers DTOs with no contextual needs.
///
/// # Reading the resolved [`Actor`] from request extensions
///
/// When a context needs the authenticated principal (e.g. owner-scoped
/// uniqueness checks, role-gated field requirements), prefer reading
/// [`Actor`] from `parts.extensions` over re-resolving the auth strategy:
///
/// ```ignore
/// use crate::guards::actor::Actor;
///
/// impl ValidationContext for MyCtx {
///     async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, ApiError> {
///         // Slice 2 of #619 caches the resolved Actor in extensions; reading
///         // it here keeps validation cost at one JWT-verify per request.
///         let actor = match parts.extensions.get::<Actor>() {
///             Some(a) => a.clone(),
///             None => Actor::from_request_parts(parts, state).await?,
///         };
///         // ...build Self from actor + path/query params...
///     }
/// }
/// ```
///
/// [`Actor`]: crate::guards::actor::Actor
pub trait ValidationContext: Sized + Send + Sync {
    fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> impl std::future::Future<Output = Result<Self, ApiError>> + Send;
}

impl ValidationContext for () {
    async fn from_request_parts(_: &mut Parts, _: &AppState) -> Result<Self, ApiError> {
        Ok(())
    }
}

/// Seam impl for JSON array request bodies: `ValidatedJson<Vec<T>>` runs every
/// element through its field-level `derive(Validate)` gate at the request
/// boundary, so handlers never hand-loop `input.validate()`. The element type
/// must implement `Validate`; element types with cross-field or context-bound
/// rules belong in a dedicated request DTO with its own `ValidatedDto`, not in
/// a bare array body. See issue #828.
impl<T> ValidatedDto for Vec<T>
where
    T: Validate + DeserializeOwned + Send + 'static,
{
    type Context = ();

    async fn validate_all(self, _: &()) -> Result<Validated<Self>, ApiError> {
        for item in &self {
            item.validate().map_err(ApiError::from)?;
        }
        Ok(Validated::seal(self))
    }
}

/// Describes how a DTO validates against its `Context`. Implementors run the
/// field-level gate (`derive(Validate)`) first, then any cross-field rules,
/// and seal a `Validated<Self>` on success.
pub trait ValidatedDto: Sized + DeserializeOwned + Send + 'static {
    type Context: ValidationContext;

    fn validate_all(
        self,
        ctx: &Self::Context,
    ) -> impl std::future::Future<Output = Result<Validated<Self>, ApiError>> + Send;
}

/// Axum extractor enforcing the validation seam at the request boundary.
///
/// Order of operations:
///   1. Split request into parts + body
///   2. Build context from parts (may read path / headers / auth / db)
///   3. Deserialize body as JSON
///   4. Run `validate_all`
///
/// Context is built *before* body deserialization so that authentication or
/// authorization failures short-circuit before we spend cycles parsing.
#[derive(Debug)]
pub struct ValidatedJson<T: ValidatedDto>(pub Validated<T>);

impl<T: ValidatedDto> FromRequest<AppState> for ValidatedJson<T> {
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &AppState) -> Result<Self, ApiError> {
        let (mut parts, body) = req.into_parts();
        let ctx = <T::Context as ValidationContext>::from_request_parts(&mut parts, state).await?;
        let req = Request::from_parts(parts, body);
        let Json(raw): Json<T> = Json::<T>::from_request(req, state)
            .await
            .map_err(|rej| ApiError::bad_request(rej.to_string()))?;
        let validated = raw.validate_all(&ctx).await?;
        Ok(ValidatedJson(validated))
    }
}
