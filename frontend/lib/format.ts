/**
 * Format a number as a currency value with grouping separators.
 *
 * Uses `Intl.NumberFormat` with `currency`/`currencyDisplay: code`. The
 * currency code is appended after the value (e.g. `1,234.56 GBP`) which
 * matches how the rest of the app currently presents currency.
 */
export function formatMoney(amount: number, currency: string | null | undefined): string {
  if (!Number.isFinite(amount)) return "—";
  const fractionDigits = 2;
  const value = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  return currency ? `${value} ${currency}` : value;
}

/**
 * Format a number with sensible precision based on magnitude — used for
 * unit prices like fuel reference prices.
 */
export function formatUnitPrice(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  if (Math.abs(amount) < 1) return amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (Math.abs(amount) < 10) return amount.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Format a number with grouping separators, no currency. */
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", opts).format(value);
}

/** Format a date (or ISO string) as `dd MMM yyyy`. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

/** Format a date as `dd MMM yyyy, HH:mm`. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
