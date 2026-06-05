export interface PasswordPolicy {
  minLength: number;
  regex: string;
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*';
const ALL_CHARS = LOWER + UPPER + DIGITS + SPECIAL;

function randomFrom(chars: string): string {
  const array = new Uint8Array(1);
  crypto.getRandomValues(array);
  return chars[array[0] % chars.length];
}

function shuffle(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const array = new Uint8Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a password that satisfies the given policy.
 *
 * Strategy: seed mandatory character classes (lower, upper, digit, special)
 * then fill remaining length with random chars. Shuffle to avoid predictable
 * positions. If a regex is set, verify and retry up to 20 times.
 */
export function generatePassword(policy?: PasswordPolicy): string {
  const length = Math.max(policy?.minLength ?? 16, 10);
  const regex = policy?.regex;
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Seed multiple from each class to satisfy strong regex patterns
    // e.g. ^(?=.*[A-Z].*[A-Z])(?=.*[!@#$&*])(?=.*[0-9].*[0-9])(?=.*[a-z].*[a-z].*[a-z])$
    const required = [
      randomFrom(LOWER), randomFrom(LOWER), randomFrom(LOWER),
      randomFrom(UPPER), randomFrom(UPPER),
      randomFrom(DIGITS), randomFrom(DIGITS),
      randomFrom(SPECIAL),
    ];

    // Fill the rest with random chars
    const remaining = length - required.length;
    const filler: string[] = [];
    if (remaining > 0) {
      const array = new Uint8Array(remaining);
      crypto.getRandomValues(array);
      for (const b of array) {
        filler.push(ALL_CHARS[b % ALL_CHARS.length]);
      }
    }

    const pw = shuffle([...required, ...filler]).join('');

    if (!regex) return pw;
    try {
      let pattern = regex;
      if (/^\^.*\$\s*$/.test(pattern) && !pattern.includes('.+$') && !pattern.includes('.*$')) {
        pattern = pattern.replace(/\$$/, '.+$');
      }
      if (new RegExp(pattern).test(pw)) return pw;
    } catch {
      return pw; // invalid regex — return as-is
    }
  }

  // Fallback after all attempts
  const required = [
    randomFrom(LOWER), randomFrom(LOWER), randomFrom(LOWER),
    randomFrom(UPPER), randomFrom(UPPER),
    randomFrom(DIGITS), randomFrom(DIGITS),
    randomFrom(SPECIAL),
  ];
  const remaining = length - required.length;
  const filler: string[] = [];
  if (remaining > 0) {
    const array = new Uint8Array(remaining);
    crypto.getRandomValues(array);
    for (const b of array) filler.push(ALL_CHARS[b % ALL_CHARS.length]);
  }
  return shuffle([...required, ...filler]).join('');
}

/**
 * Validate a password against the policy. Returns an error string or undefined.
 */
export function validatePassword(password: string, policy?: PasswordPolicy): string | undefined {
  if (password.length === 0) return undefined;

  const minLength = policy?.minLength ?? 8;
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }

  if (policy?.regex) {
    try {
      // Fix common pattern: ^(?=...lookaheads...)$ needs .+ before $ to match content
      let pattern = policy.regex;
      if (/^\^.*\$\s*$/.test(pattern) && !pattern.includes('.+$') && !pattern.includes('.*$')) {
        pattern = pattern.replace(/\$$/, '.+$');
      }
      if (!new RegExp(pattern).test(password)) {
        return 'Password does not match the required pattern';
      }
    } catch {
      return 'Site has an invalid password pattern configured';
    }
  }

  return undefined;
}
