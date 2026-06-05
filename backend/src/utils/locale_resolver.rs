//! Pure helper that picks one localization from many, per ADR 0002.
//!
//! The fallback chain is the contract:
//!   1. Exact match on `requested_id`.
//!   2. Site default (`site_default_id`).
//!   3. First element of `localizations` (caller pre-orders).
//!   4. `None` only if `localizations` is empty.
//!
//! Generic over the localization type via a `locale_id_of` accessor so every
//! entity family (projects, cv-entries, skills, pages, blog, legal) shares
//! one resolver without coupling to any specific DTO. No I/O, no async.

use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::models::site_locale::SiteLocale;

/// Pick the localization the client should see, given an optional requested
/// locale and the site's default. See ADR 0002 §1 for the chain.
///
/// Caller responsibilities:
/// - `requested_id`: resolved from `?locale=<code>` against the site's
///   locales. `None` if the param was absent OR the code did not match any
///   site locale (silent fallback per ADR §1).
/// - `site_default_id`: the locale_id with `site_locales.is_default = TRUE`,
///   or `None` for the (edge-case) site without a default.
/// - `localizations`: pre-ordered (existing repos already
///   `ORDER BY is_default DESC, code ASC`).
pub fn resolve_localization<L, F>(
    localizations: &[L],
    locale_id_of: F,
    requested_id: Option<Uuid>,
    site_default_id: Option<Uuid>,
) -> Option<&L>
where
    F: Fn(&L) -> Uuid,
{
    if let Some(req) = requested_id {
        if let Some(hit) = localizations.iter().find(|l| locale_id_of(l) == req) {
            return Some(hit);
        }
    }
    if let Some(def) = site_default_id {
        if let Some(hit) = localizations.iter().find(|l| locale_id_of(l) == def) {
            return Some(hit);
        }
    }
    localizations.first()
}

/// One requested-locale-id and one site-default-locale-id, derived from a
/// `?locale=<code>` value and the site's locale set. Both are `Option`
/// because either may be absent (unknown code → requested `None`; site
/// without a default → default `None`). Apply via [`pick_one`].
pub type LocaleResolution = (Option<Uuid>, Option<Uuid>);

/// Look up the (requested_id, default_id) tuple for one request.
///
/// Returns `Ok(None)` when `locale_code` is `None` — the caller must skip
/// per-item truncation in that case so the response shape stays unchanged
/// (ADR 0002: opt-in resolver). Returns `Ok(Some(_))` even if the code is
/// unknown to the site — the chain (see [`resolve_localization`]) then
/// falls through to default → first.
pub async fn resolve_ids_for_site(
    locale_code: Option<&str>,
    pool: &PgPool,
    site_id: Uuid,
) -> Result<Option<LocaleResolution>, ApiError> {
    let Some(code) = locale_code else {
        return Ok(None);
    };
    let site_locales = SiteLocale::find_all_for_site(pool, site_id).await?;
    let requested_id = site_locales
        .iter()
        .find(|sl| sl.code == code)
        .map(|sl| sl.locale_id);
    let default_id = site_locales
        .iter()
        .find(|sl| sl.is_default)
        .map(|sl| sl.locale_id);
    Ok(Some((requested_id, default_id)))
}

/// Truncate a `localizations` vec to the single resolved entry. When the
/// input is empty, returns it unchanged (matches ADR 0002 §1.4 — entity
/// with zero localizations + `?locale=` still returns the entity with an
/// empty array, not 404).
pub fn pick_one<L, F>(
    localizations: Vec<L>,
    locale_id_of: F,
    resolution: LocaleResolution,
) -> Vec<L>
where
    L: Clone,
    F: Fn(&L) -> Uuid,
{
    let (requested_id, default_id) = resolution;
    match resolve_localization(&localizations, locale_id_of, requested_id, default_id) {
        Some(picked) => vec![picked.clone()],
        None => localizations,
    }
}

/// Resolve `?locale=<code>` and collapse a single localization vec to the
/// one resolved entry — the 1:1 detail-handler shape (ADR 0002 §6).
///
/// One home for the `resolve_ids_for_site(..)?` + `pick_one(..)` invocation
/// that was copy-pasted across every localized **detail** handler. When
/// `locale_code` is `None` the vec is returned unchanged (opt-in resolver),
/// without the `pick_one` step.
///
/// Only for the 1:1 case. Sites that apply one resolution to **many** vecs —
/// list handlers (resolve once, pick per item) and heterogeneous double
/// collapses (legal detail) — must call [`resolve_ids_for_site`] once and
/// reuse [`pick_one`], or they would re-resolve per vec (an extra
/// `find_all_for_site` round-trip each, changing the query profile).
pub async fn collapse_localizations<L, F>(
    pool: &PgPool,
    site_id: Uuid,
    locale_code: Option<&str>,
    localizations: Vec<L>,
    locale_id_of: F,
) -> Result<Vec<L>, ApiError>
where
    L: Clone,
    F: Fn(&L) -> Uuid,
{
    match resolve_ids_for_site(locale_code, pool, site_id).await? {
        Some(resolution) => Ok(pick_one(localizations, locale_id_of, resolution)),
        None => Ok(localizations),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct Loc {
        locale_id: Uuid,
        label: &'static str,
    }

    fn loc(label: &'static str) -> Loc {
        Loc {
            locale_id: Uuid::new_v4(),
            label,
        }
    }

    #[test]
    fn exact_match_wins() {
        let de = loc("de");
        let en = loc("en");
        let es = loc("es");
        let locs = [de, en, es];

        let pick = resolve_localization(
            &locs,
            |l| l.locale_id,
            Some(locs[1].locale_id), // request "en"
            Some(locs[0].locale_id), // site default "de"
        );

        assert_eq!(pick.map(|l| l.label), Some("en"));
    }

    #[test]
    fn requested_missing_falls_back_to_site_default() {
        let de = loc("de");
        let en = loc("en");
        let locs = [de, en];
        let some_other_locale_id = Uuid::new_v4();

        let pick = resolve_localization(
            &locs,
            |l| l.locale_id,
            Some(some_other_locale_id), // "fr" — not present
            Some(locs[0].locale_id),    // site default "de"
        );

        assert_eq!(pick.map(|l| l.label), Some("de"));
    }

    #[test]
    fn no_request_falls_back_to_site_default() {
        let de = loc("de");
        let en = loc("en");
        let locs = [de, en];

        let pick = resolve_localization(
            &locs,
            |l| l.locale_id,
            None,
            Some(locs[1].locale_id), // default "en"
        );

        assert_eq!(pick.map(|l| l.label), Some("en"));
    }

    #[test]
    fn no_default_falls_back_to_first() {
        let de = loc("de");
        let en = loc("en");
        let locs = [de, en];

        let pick = resolve_localization(&locs, |l| l.locale_id, None, None);

        assert_eq!(pick.map(|l| l.label), Some("de"));
    }

    #[test]
    fn requested_and_default_both_missing_falls_back_to_first() {
        let de = loc("de");
        let en = loc("en");
        let locs = [de, en];
        let missing_a = Uuid::new_v4();
        let missing_b = Uuid::new_v4();

        let pick = resolve_localization(&locs, |l| l.locale_id, Some(missing_a), Some(missing_b));

        assert_eq!(pick.map(|l| l.label), Some("de"));
    }

    #[test]
    fn empty_input_returns_none() {
        let locs: [Loc; 0] = [];

        let pick = resolve_localization(
            &locs,
            |l| l.locale_id,
            Some(Uuid::new_v4()),
            Some(Uuid::new_v4()),
        );

        assert!(pick.is_none());
    }

    #[test]
    fn empty_input_with_no_filters_returns_none() {
        let locs: [Loc; 0] = [];

        let pick = resolve_localization(&locs, |l| l.locale_id, None, None);

        assert!(pick.is_none());
    }

    #[test]
    fn pick_one_truncates_to_resolved_entry() {
        let de = Loc {
            locale_id: Uuid::new_v4(),
            label: "de",
        };
        let en = Loc {
            locale_id: Uuid::new_v4(),
            label: "en",
        };
        let en_id = en.locale_id;
        let de_id = de.locale_id;
        let locs = vec![de, en];

        let one = pick_one(locs, |l| l.locale_id, (Some(en_id), Some(de_id)));

        assert_eq!(one.len(), 1);
        assert_eq!(one[0].label, "en");
    }

    #[test]
    fn pick_one_preserves_empty_input() {
        let locs: Vec<Loc> = Vec::new();
        let some_id = Uuid::new_v4();

        let one = pick_one(locs, |l| l.locale_id, (Some(some_id), Some(some_id)));

        assert!(one.is_empty());
    }
}
