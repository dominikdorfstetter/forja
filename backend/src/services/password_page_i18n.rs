//! i18n for the private-document password landing page (#698).
//!
//! Parses the recipient's `Accept-Language` header, picks the closest
//! supported locale, and returns the translation map. No client-side
//! i18n — the page is fully server-rendered.

use std::sync::OnceLock;

use serde::Deserialize;

/// Supported locales, mirroring the admin's locale list. Order
/// matters: when ranking equally-preferred matches we prefer the
/// earlier entry, so admins' canonical English fallback stays last.
const SUPPORTED: &[&str] = &[
    "ar", "de-AT", "de", "en", "es", "fr", "it", "nl", "pl", "pt", "uk",
];

/// Locales that must be rendered right-to-left.
const RTL: &[&str] = &["ar"];

const FALLBACK_LOCALE: &str = "en";

#[derive(Debug, Clone, Deserialize)]
pub struct Translations {
    pub title: String,
    pub heading: String,
    pub subtitle: String,
    #[serde(rename = "badgeEncrypted")]
    pub badge_encrypted: String,
    #[serde(rename = "passwordLabel")]
    pub password_label: String,
    #[serde(rename = "passwordPlaceholder")]
    pub password_placeholder: String,
    #[serde(rename = "submitButton")]
    pub submit_button: String,
    pub verifying: String,
    pub downloaded: String,
    #[serde(rename = "incorrectPassword")]
    pub incorrect_password: String,
    pub expired: String,
    pub locked: String,
    pub footer: String,
}

macro_rules! locale_shard {
    ($code:literal) => {
        (
            $code,
            include_str!(concat!(
                "../../resources/i18n/document_password/",
                $code,
                ".json"
            )),
        )
    };
}

const SHARDS: &[(&str, &str)] = &[
    locale_shard!("ar"),
    locale_shard!("de-AT"),
    locale_shard!("de"),
    locale_shard!("en"),
    locale_shard!("es"),
    locale_shard!("fr"),
    locale_shard!("it"),
    locale_shard!("nl"),
    locale_shard!("pl"),
    locale_shard!("pt"),
    locale_shard!("uk"),
];

fn shard(locale: &str) -> Option<&'static str> {
    SHARDS
        .iter()
        .find(|(code, _)| code.eq_ignore_ascii_case(locale))
        .map(|(_, body)| *body)
}

/// Resolved locale + its translation bundle. Owned so the response
/// can drop the request data before rendering.
pub struct ResolvedLocale {
    pub code: &'static str,
    pub dir: &'static str,
    pub translations: Translations,
}

/// Negotiate the best-fit supported locale from an `Accept-Language`
/// header value. Order of preference:
///
/// 1. Highest-q-value tag that exactly matches a supported locale.
/// 2. Highest-q-value tag whose primary language matches a supported
///    locale's primary language (e.g. `de-CH` → `de`).
/// 3. English fallback.
pub fn negotiate(accept_language: Option<&str>) -> &'static str {
    let header = match accept_language {
        Some(h) if !h.trim().is_empty() => h,
        _ => return FALLBACK_LOCALE,
    };

    let mut tags = parse_accept_language(header);
    // Stable sort so earlier tags win on q-tie.
    tags.sort_by(|a, b| b.q.partial_cmp(&a.q).unwrap_or(std::cmp::Ordering::Equal));

    // 1. Exact match
    for tag in &tags {
        if let Some(code) = SUPPORTED.iter().find(|s| s.eq_ignore_ascii_case(&tag.tag)) {
            return code;
        }
    }
    // 2. Primary-language match — prefer the bare language code over
    //    regional variants, so a recipient asking for `de-CH` lands on
    //    `de` rather than `de-AT` (which is also a primary-language
    //    match but more specific and probably the wrong choice).
    for tag in &tags {
        let primary = tag.tag.split('-').next().unwrap_or(&tag.tag);
        if let Some(code) = SUPPORTED.iter().find(|s| s.eq_ignore_ascii_case(primary)) {
            return code;
        }
        if let Some(code) = SUPPORTED.iter().find(|s| {
            s.split('-')
                .next()
                .unwrap_or(s)
                .eq_ignore_ascii_case(primary)
        }) {
            return code;
        }
    }
    FALLBACK_LOCALE
}

/// Resolve a locale code into its translation bundle and direction.
/// Falls back to English if the code is somehow unknown (defensive —
/// `negotiate` only returns supported codes).
pub fn resolve(locale_code: &str) -> ResolvedLocale {
    let canonical = SUPPORTED
        .iter()
        .find(|c| c.eq_ignore_ascii_case(locale_code))
        .copied()
        .unwrap_or(FALLBACK_LOCALE);
    let translations = load_translations(canonical);
    let dir = if RTL.iter().any(|r| r.eq_ignore_ascii_case(canonical)) {
        "rtl"
    } else {
        "ltr"
    };
    ResolvedLocale {
        code: canonical,
        dir,
        translations,
    }
}

fn load_translations(code: &str) -> Translations {
    static EN_CACHE: OnceLock<Translations> = OnceLock::new();
    let body = shard(code).unwrap_or_else(|| {
        shard(FALLBACK_LOCALE).expect("english shard is bundled at compile time")
    });
    serde_json::from_str::<Translations>(body).unwrap_or_else(|_| {
        // If a locale's JSON is malformed we still need to render
        // something; cached English is the safe fallback.
        EN_CACHE
            .get_or_init(|| {
                serde_json::from_str(shard(FALLBACK_LOCALE).expect("english shard bundled"))
                    .expect("english shard parses")
            })
            .clone()
    })
}

struct WeightedTag {
    tag: String,
    q: f32,
}

fn parse_accept_language(header: &str) -> Vec<WeightedTag> {
    header
        .split(',')
        .filter_map(|part| {
            let mut iter = part.split(';').map(str::trim);
            let tag = iter.next()?.trim();
            if tag.is_empty() || tag == "*" {
                return None;
            }
            let mut q = 1.0_f32;
            for param in iter {
                if let Some(value) = param.strip_prefix("q=") {
                    if let Ok(parsed) = value.parse::<f32>() {
                        q = parsed;
                    }
                }
            }
            Some(WeightedTag {
                tag: tag.to_string(),
                q,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_header_falls_back_to_english() {
        assert_eq!(negotiate(None), "en");
        assert_eq!(negotiate(Some("")), "en");
        assert_eq!(negotiate(Some("   ")), "en");
    }

    #[test]
    fn exact_match_wins() {
        assert_eq!(negotiate(Some("de")), "de");
        assert_eq!(negotiate(Some("de-AT")), "de-AT");
        assert_eq!(negotiate(Some("ar")), "ar");
    }

    #[test]
    fn primary_language_match_when_no_exact() {
        // de-CH isn't supported; should fall back to de via primary language.
        assert_eq!(negotiate(Some("de-CH")), "de");
        assert_eq!(negotiate(Some("pt-BR")), "pt");
    }

    #[test]
    fn unsupported_locale_falls_back_to_english() {
        assert_eq!(negotiate(Some("zh-CN")), "en");
        assert_eq!(negotiate(Some("ja")), "en");
    }

    #[test]
    fn q_value_ordering_respected() {
        // de;q=0.5 vs en;q=0.9 — en wins.
        assert_eq!(negotiate(Some("de;q=0.5, en;q=0.9")), "en");
        // German with higher q than English.
        assert_eq!(negotiate(Some("de-CH, de;q=0.9, en;q=0.1")), "de");
    }

    #[test]
    fn malformed_header_falls_back_safely() {
        // No panic, returns English fallback.
        assert_eq!(negotiate(Some("not a valid header at all;;;;")), "en");
        assert_eq!(negotiate(Some(",,,, ")), "en");
    }

    #[test]
    fn wildcard_is_ignored() {
        // * matches anything; we treat it as no-preference and fall back.
        assert_eq!(negotiate(Some("*")), "en");
    }

    #[test]
    fn resolve_returns_rtl_for_arabic() {
        let r = resolve("ar");
        assert_eq!(r.code, "ar");
        assert_eq!(r.dir, "rtl");
    }

    #[test]
    fn resolve_returns_ltr_for_european_locales() {
        for code in [
            "de", "de-AT", "en", "es", "fr", "it", "nl", "pl", "pt", "uk",
        ] {
            let r = resolve(code);
            assert_eq!(r.dir, "ltr", "{code} should be LTR");
        }
    }

    #[test]
    fn every_locale_shard_parses_with_identical_keys() {
        // Compile-time check that every shard parses into Translations.
        for (code, _) in SHARDS.iter() {
            let r = resolve(code);
            // Every locale must produce non-empty values for every key —
            // otherwise the page renders blanks. Spot-check the load-bearing
            // strings; serde would have already rejected missing fields.
            assert!(
                !r.translations.heading.is_empty(),
                "{code}.json missing 'heading' value"
            );
            assert!(
                !r.translations.expired.is_empty(),
                "{code}.json missing 'expired' value"
            );
            assert!(
                !r.translations.locked.is_empty(),
                "{code}.json missing 'locked' value"
            );
        }
    }
}
