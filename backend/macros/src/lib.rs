//! Internal proc-macros for Forja.
//!
//! Currently hosts only `#[derive(ValidatedDto)]`, which emits the trivial
//! `ValidatedDto` impl for DTOs whose only validation is the field-level
//! gate from `derive(Validate)`. DTOs with cross-field or context-bound
//! rules hand-implement `ValidatedDto` instead — the derive is sugar, not
//! a hard contract.

use proc_macro::TokenStream;
use quote::quote;
use syn::{DeriveInput, parse_macro_input};

/// Derives a trivial `ValidatedDto` impl: `type Context = ()` and
/// `validate_all` that runs `validator::Validate::validate` then seals.
///
/// Expands to (logically):
///
/// ```ignore
/// impl crate::dto::validated::ValidatedDto for MyDto {
///     type Context = ();
///     async fn validate_all(self, _: &()) -> Result<Validated<Self>, ApiError> {
///         self.validate().map_err(ApiError::from)?;
///         Ok(Validated::seal(self))
///     }
/// }
/// ```
///
/// Requires the target type to implement `serde::de::DeserializeOwned`,
/// `Send + 'static`, and `validator::Validate`. Generic types are not
/// supported — Forja's DTOs are concrete.
#[proc_macro_derive(ValidatedDto)]
pub fn derive_validated_dto(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    if !input.generics.params.is_empty() {
        return syn::Error::new_spanned(
            &input.generics,
            "#[derive(ValidatedDto)] does not support generic types",
        )
        .to_compile_error()
        .into();
    }

    let expanded = quote! {
        impl crate::dto::validated::ValidatedDto for #name {
            type Context = ();

            async fn validate_all(
                self,
                _: &(),
            ) -> ::core::result::Result<
                crate::dto::validated::Validated<Self>,
                crate::errors::ApiError,
            > {
                <Self as ::validator::Validate>::validate(&self)
                    .map_err(crate::errors::ApiError::from)?;
                ::core::result::Result::Ok(crate::dto::validated::Validated::seal(self))
            }
        }
    };

    expanded.into()
}
