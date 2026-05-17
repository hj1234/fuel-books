/** Prevent open redirects: only same-origin relative paths. */
export function safeInternalNext(raw: string | undefined, fallback = "/aircraft"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed.split(/[\?\#]/)[0] || fallback;
}
