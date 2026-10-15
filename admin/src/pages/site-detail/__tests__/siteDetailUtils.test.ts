import { describe, it, expect } from 'vitest';
import { GB, parseQuotaGb, quotaBytesToGbInput, summarizeOwner } from '../siteDetailUtils';

describe('parseQuotaGb', () => {
  it('converts a positive GB amount to whole bytes', () => {
    expect(parseQuotaGb('1.5')).toBe(Math.round(1.5 * GB));
  });

  it.each(['', 'abc', '0', '-2'])('rejects %j', (input) => {
    expect(parseQuotaGb(input)).toBeNull();
  });
});

describe('quotaBytesToGbInput', () => {
  it('renders the stored quota with two decimals', () => {
    expect(quotaBytesToGbInput(10 * GB)).toBe('10.00');
  });
});

describe('summarizeOwner', () => {
  it('labels the owner by name and shows the email underneath', () => {
    const members = [
      { role: 'admin', name: 'Admin', email: 'admin@example.com' },
      { role: 'owner', name: 'Olivia', email: 'olivia@example.com' },
    ];
    expect(summarizeOwner(members, 'No owner')).toEqual({
      label: 'Olivia',
      email: 'olivia@example.com',
      hasOwner: true,
    });
  });

  it('falls back to the email as label without repeating it', () => {
    expect(summarizeOwner([{ role: 'owner', name: null, email: 'o@example.com' }], 'No owner')).toEqual({
      label: 'o@example.com',
      email: undefined,
      hasOwner: true,
    });
  });

  it('uses the missing label when the site has no owner', () => {
    expect(summarizeOwner([{ role: 'editor', name: 'Ed' }], 'No owner')).toEqual({
      label: 'No owner',
      email: undefined,
      hasOwner: false,
    });
  });
});
