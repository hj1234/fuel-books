/**
 * Shared parsing + URL building for the fuel expenses table query state.
 *
 * The expenses page is a server component driven entirely by URL search params.
 * Client components (filter bar, sortable headers, pagination) update the URL
 * via these helpers so the back button, refresh, and bookmarking all behave.
 */

export type ExpensesSort =
  | "purchased_at"
  | "total_amount"
  | "volume"
  | "country_code"
  | "pilot_name";

export type ExpensesDir = "asc" | "desc";

export const EXPENSES_PAGE_SIZE = 25;

export const SORT_VALUES: readonly ExpensesSort[] = [
  "purchased_at",
  "total_amount",
  "volume",
  "country_code",
  "pilot_name",
] as const;

export const DIR_VALUES: readonly ExpensesDir[] = ["asc", "desc"] as const;

export type ExpensesQuery = {
  /** 1-based page number. */
  page: number;
  sort: ExpensesSort;
  dir: ExpensesDir;
  /** Pilot UUID (`public_id`), or null for no filter. */
  pilot: string | null;
  /** ISO `YYYY-MM-DD`, inclusive. */
  from: string | null;
  /** ISO `YYYY-MM-DD`, inclusive. */
  to: string | null;
};

export const DEFAULT_EXPENSES_QUERY: ExpensesQuery = {
  page: 1,
  sort: "purchased_at",
  dir: "desc",
  pilot: null,
  from: null,
  to: null,
};

export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

type RawSearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseExpensesQuery(input: RawSearchParams): ExpensesQuery {
  const get = (key: string): string | null => {
    if (input instanceof URLSearchParams) return input.get(key);
    const v = input[key];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };

  const pageRaw = Number(get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const sortRaw = get("sort");
  const sort: ExpensesSort = (SORT_VALUES as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as ExpensesSort)
    : DEFAULT_EXPENSES_QUERY.sort;

  const dirRaw = get("dir");
  const dir: ExpensesDir = (DIR_VALUES as readonly string[]).includes(dirRaw ?? "")
    ? (dirRaw as ExpensesDir)
    : DEFAULT_EXPENSES_QUERY.dir;

  const pilotRaw = get("pilot");
  // Pilot ids are opaque UUID strings; we accept any non-empty value but rely
  // on the server to validate that the UUID belongs to this aircraft.
  const pilot = pilotRaw && pilotRaw.trim() !== "" ? pilotRaw : null;

  const fromRaw = get("from");
  const from = fromRaw && isValidIsoDate(fromRaw) ? fromRaw : null;
  const toRaw = get("to");
  const to = toRaw && isValidIsoDate(toRaw) ? toRaw : null;

  return { page, sort, dir, pilot, from, to };
}

/**
 * Build the backend query string used by `fbFetch` against
 * `/v1/aircraft/{id}/fuel-expenses`. Only includes params with non-default values.
 */
export function buildBackendQueryString(
  q: ExpensesQuery,
  pageSize: number = EXPENSES_PAGE_SIZE,
): string {
  const sp = new URLSearchParams();
  sp.set("limit", String(pageSize));
  sp.set("offset", String(Math.max(0, (q.page - 1) * pageSize)));
  sp.set("sort", q.sort);
  sp.set("dir", q.dir);
  if (q.pilot != null) sp.set("pilot_id", q.pilot);
  if (q.from) sp.set("date_gte", q.from);
  if (q.to) sp.set("date_lte", q.to);
  return sp.toString();
}

/**
 * Build a new client-facing URL for the expenses page given the current URL
 * params and a sparse patch. Any non-page key in the patch automatically
 * resets `page` (since changing filters/sort should send the user back to
 * page 1). Default values are stripped to keep URLs short.
 */
export function buildExpensesUrl(
  pathname: string,
  current: URLSearchParams,
  patch: Partial<ExpensesQuery>,
): string {
  const next = new URLSearchParams(current);

  const setOrDelete = (key: string, value: string | null) => {
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
  };

  if ("page" in patch) {
    const n = patch.page;
    setOrDelete("page", n == null || n <= 1 ? null : String(n));
  }
  if ("sort" in patch) {
    setOrDelete(
      "sort",
      patch.sort && patch.sort !== DEFAULT_EXPENSES_QUERY.sort ? patch.sort : null,
    );
  }
  if ("dir" in patch) {
    setOrDelete(
      "dir",
      patch.dir && patch.dir !== DEFAULT_EXPENSES_QUERY.dir ? patch.dir : null,
    );
  }
  if ("pilot" in patch) {
    setOrDelete("pilot", patch.pilot ?? null);
  }
  if ("from" in patch) {
    setOrDelete("from", patch.from ?? null);
  }
  if ("to" in patch) {
    setOrDelete("to", patch.to ?? null);
  }

  const touchedNonPage = Object.keys(patch).some((k) => k !== "page");
  if (touchedNonPage && !("page" in patch)) {
    next.delete("page");
  }

  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * True when any filter/sort is non-default. Useful for showing a "Reset" link.
 */
export function hasActiveFilters(q: ExpensesQuery): boolean {
  return (
    q.pilot != null ||
    q.from != null ||
    q.to != null ||
    q.sort !== DEFAULT_EXPENSES_QUERY.sort ||
    q.dir !== DEFAULT_EXPENSES_QUERY.dir
  );
}
