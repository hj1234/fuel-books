/** Canonical 8-4-4-4-12 hex form used in URLs and API `public_id` fields. */
const CANONICAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCanonicalUuidString(value: string): boolean {
  return CANONICAL_UUID_RE.test(value);
}
