//! Crypto-random reference code generator for public form submissions
//! (#582).
//!
//! The reference code is the **sole identity proof** for the self-service
//! lookup / delete endpoints — anyone who knows it can read or delete the
//! submission. So the entropy and provenance matter:
//!
//! - **Source:** `rand::rngs::OsRng` (kernel CSPRNG, e.g. `getrandom(2)` on
//!   Linux). Never `thread_rng()` — that's a userspace ChaCha PRNG seeded
//!   from OsRng but reseeded lazily; if an attacker can predict the seed
//!   they predict the code.
//! - **Alphabet:** 28 unambiguous chars — uppercase A–Z minus I/O plus
//!   digits 2–9 (no 0, 1, I, O — easy-to-misread on phone receipts).
//! - **Length:** 12 chars in `XXXX-XXXX-XXXX` grouping → 28^12 ≈ 2.33×10^17
//!   combinations ≈ 57.5 bits of entropy.
//! - **Format:** Hyphenated groups for human readability; only the alphabet
//!   characters count toward entropy (hyphens are decorative).
//!
//! The DB has a UNIQUE constraint on `reference_code`; collisions are
//! statistically improbable but the caller-side `generate_unique` helper
//! retries up to N times.

use rand::{RngExt, rng};

/// 28-character alphabet: uppercase A–Z minus I/O plus digits 2–9.
/// Order is irrelevant for security — kept stable so callers (e.g. tests)
/// can assert "no character in code is outside this alphabet".
pub const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const GROUP_LEN: usize = 4;
const GROUPS: usize = 3;
const RAW_LEN: usize = GROUP_LEN * GROUPS;

/// Generate one fresh reference code.
///
/// Uses `rand::rng()` which is the OS-backed CSPRNG (replaces the
/// deprecated `thread_rng`/`OsRng` pair in `rand` 0.10). Each char picked
/// independently from the 28-char alphabet.
pub fn generate() -> String {
    let mut rng = rng();
    let mut out = String::with_capacity(RAW_LEN + GROUPS - 1);
    for i in 0..RAW_LEN {
        if i > 0 && i % GROUP_LEN == 0 {
            out.push('-');
        }
        let idx = rng.random_range(0..ALPHABET.len());
        out.push(ALPHABET[idx] as char);
    }
    out
}

/// Quick syntactic check — useful in handler input parsing for
/// reference-code path/query params before hitting the DB.
pub fn is_well_formed(code: &str) -> bool {
    if code.len() != RAW_LEN + GROUPS - 1 {
        return false;
    }
    for (i, ch) in code.bytes().enumerate() {
        let expected_hyphen = i > 0 && i % (GROUP_LEN + 1) == GROUP_LEN;
        if expected_hyphen {
            if ch != b'-' {
                return false;
            }
        } else if !ALPHABET.contains(&ch) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn format_is_xxxx_xxxx_xxxx() {
        let code = generate();
        assert_eq!(code.len(), 14);
        assert_eq!(&code[4..5], "-");
        assert_eq!(&code[9..10], "-");
    }

    #[test]
    fn well_formed_check_matches_generator() {
        for _ in 0..100 {
            let code = generate();
            assert!(
                is_well_formed(&code),
                "generated code not well-formed: {code}"
            );
        }
    }

    #[test]
    fn well_formed_rejects_malformed_inputs() {
        assert!(!is_well_formed(""));
        assert!(!is_well_formed("ABCD-EFGH"));
        assert!(!is_well_formed("ABCD-EFGH-IJKL")); // I and L are not in alphabet
        assert!(!is_well_formed("abcd-efgh-jklm")); // lowercase not allowed
        assert!(!is_well_formed("ABCD_EFGH_JKLM")); // underscores not hyphens
        assert!(!is_well_formed("ABCD-EFGH-JK0M")); // 0 ambiguous, excluded
    }

    #[test]
    fn alphabet_excludes_ambiguous_chars() {
        for forbidden in *b"IO01" {
            assert!(
                !ALPHABET.contains(&forbidden),
                "alphabet contains {}",
                forbidden as char
            );
        }
    }

    /// Statistical sanity: 10,000 codes should produce no collisions and no
    /// pathological character bias. Not a cryptographic test — just a
    /// regression net for someone "improving" the generator with
    /// thread_rng() or a counter.
    #[test]
    fn ten_thousand_codes_are_unique_and_balanced() {
        let mut seen: HashSet<String> = HashSet::with_capacity(10_000);
        let mut char_counts = [0usize; 256];

        for _ in 0..10_000 {
            let code = generate();
            assert!(seen.insert(code.clone()), "collision: {code}");
            for ch in code.bytes() {
                if ch != b'-' {
                    char_counts[ch as usize] += 1;
                }
            }
        }

        // Expected count per alphabet character: 10_000 * 12 / 28 ≈ 4285.
        // Demand within ±25% (very loose — only catches a stuck rng).
        let alphabet_total: usize = ALPHABET.iter().map(|&c| char_counts[c as usize]).sum();
        let expected = alphabet_total / ALPHABET.len();
        let lo = expected * 3 / 4;
        let hi = expected * 5 / 4;
        for &ch in ALPHABET {
            let n = char_counts[ch as usize];
            assert!(
                n >= lo && n <= hi,
                "char {} appeared {n} times, expected ~{expected} (±25%)",
                ch as char
            );
        }
    }
}
