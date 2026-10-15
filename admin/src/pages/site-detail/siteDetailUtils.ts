export const GB = 1024 ** 3;

/** Quota input (GB, free text) → whole bytes, or null when not a positive number. */
export function parseQuotaGb(input: string): number | null {
  const gb = parseFloat(input);
  if (!Number.isFinite(gb) || gb <= 0) return null;
  return Math.round(gb * GB);
}

/** Stored quota in bytes → the GB string shown in the quota input. */
export function quotaBytesToGbInput(bytes: number): string {
  return (bytes / GB).toFixed(2);
}

interface MemberLike {
  role: string;
  name?: string | null;
  email?: string | null;
}

export interface OwnerSummary {
  /** Owner's name, else email, else `missingLabel`. */
  label: string;
  /** Secondary line: the owner's email when it isn't already the label. */
  email: string | undefined;
  hasOwner: boolean;
}

export function summarizeOwner(members: readonly MemberLike[], missingLabel: string): OwnerSummary {
  const owner = members.find((m) => m.role === 'owner');
  const label = owner?.name || owner?.email || missingLabel;
  return {
    label,
    email: owner?.email && owner.email !== label ? owner.email : undefined,
    hasOwner: !!owner,
  };
}
