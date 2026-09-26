import { todayISO } from "@/lib/format";
import type {
  DashboardQuery,
  TransactionFilters,
  TransactionType,
} from "@/lib/types";
import { isRealISODate, UUID_PATTERN } from "@/lib/validations";

// The shape Next hands a page: a repeated key arrives as an array.
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const NO_FILTERS: TransactionFilters = {
  type: null,
  categoryId: null,
  from: null,
  to: null,
  q: null,
};

// A native GET form submits every field it renders, so a filter the user left
// alone arrives as "" rather than not arriving at all. Absent and empty have to
// mean the same thing, and a repeated key resolves to its first value.
export function firstParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ?? "";
}

// Every parser collapses an unusable value to null instead of failing: a
// hand-edited URL should show the unfiltered page, not an error. That mirrors
// parsePage's "invalid → page 1" (lib/pagination.ts).
function textOrNull(raw: string | string[] | undefined): string | null {
  const value = firstParam(raw).trim();
  return value.length > 0 ? value : null;
}

function typeOrNull(raw: string | string[] | undefined): TransactionType | null {
  const value = firstParam(raw).trim();
  return value === "income" || value === "expense" ? value : null;
}

function uuidOrNull(raw: string | string[] | undefined): string | null {
  const value = firstParam(raw).trim();
  return UUID_PATTERN.test(value) ? value : null;
}

// isRealISODate enforces the YYYY-MM-DD shape as well as the calendar round
// trip, so 2026-02-31 and 2026-2-1 are both rejected here.
function isoDateOrNull(raw: string | string[] | undefined): string | null {
  const value = firstParam(raw).trim();
  return isRealISODate(value) ? value : null;
}

export function parseTransactionFilters(
  params: RawSearchParams
): TransactionFilters {
  const from = isoDateOrNull(params.from);
  const to = isoDateOrNull(params.to);

  // A reversed range is a typo, not a request for zero rows: swap it so the
  // filter the user obviously meant is the one that runs. occurred_on is a plain
  // date, so string order is calendar order and no Date is involved.
  const reversed = from !== null && to !== null && from > to;

  return {
    type: typeOrNull(params.type),
    categoryId: uuidOrNull(params.category_id),
    from: reversed ? to : from,
    to: reversed ? from : to,
    q: textOrNull(params.q),
  };
}

export function hasActiveFilters(filters: TransactionFilters) {
  return (
    filters.type !== null ||
    filters.categoryId !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.q !== null
  );
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// The clock is an argument rather than a hidden new Date() so the parser is
// deterministic; currentMonth() below is the single place that reads it.
//
// MONTH_PATTERN bounds the month number and the year's width, not the year
// itself, and this value is sent on as firstOfMonth(month): a year the date type
// cannot hold would reach the RPC as '0000-01-01' and come back as a raw error
// rather than a fallback. Asking isRealISODate about the exact string the RPC
// will receive leaves "year 0 is not a date" in one place, next to the same
// rejection the from/to filters already get.
export function parseMonth(
  raw: string | string[] | undefined,
  currentMonth: string
): string {
  const value = firstParam(raw).trim();
  return MONTH_PATTERN.test(value) && isRealISODate(firstOfMonth(value))
    ? value
    : currentMonth;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

// Integer month arithmetic. new Date("2026-09-01") would be parsed as midnight
// UTC and then shift by the local offset — the hazard lib/format.ts exists to
// avoid — so the year*12 + month-1 form keeps this exact.
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = total - nextYear * 12;

  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth + 1).padStart(2, "0")}`;
}

export function firstOfMonth(month: string): string {
  return `${month}-01`;
}

// URLSearchParams.get() returns the first value for a repeated key, matching
// firstParam, so a route handler sees the same filters the page would.
export function rawFromSearchParams(params: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {};

  for (const key of new Set(params.keys())) {
    raw[key] = params.get(key) ?? undefined;
  }

  return raw;
}

// Everything that links back into /dashboard goes through here, so a filter or
// period a page adds cannot be dropped by a link somewhere else. An empty filter
// is omitted, as is page 1 — the plain /dashboard URL is the default state.
export function dashboardSearch(
  query: DashboardQuery,
  opts?: { includePage?: false }
): string {
  const params = new URLSearchParams();

  if (query.type) params.set("type", query.type);
  if (query.categoryId) params.set("category_id", query.categoryId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q) params.set("q", query.q);
  if (query.month) params.set("month", query.month);

  // Added last so the URL reads filter-first.
  if (opts?.includePage !== false && query.page !== null && query.page > 1) {
    params.set("page", String(query.page));
  }

  const search = params.toString();
  return search.length > 0 ? `?${search}` : "";
}

export function dashboardHref(
  query: DashboardQuery,
  opts?: { includePage?: false }
): string {
  return `/dashboard${dashboardSearch(query, opts)}`;
}

// Keeps the period, drops every filter and the page. Used by the filter bar's
// Clear button and by the empty state a filtered zero-result set renders.
export function clearFiltersHref(query: DashboardQuery): string {
  return dashboardHref({ ...query, ...NO_FILTERS, page: null });
}

// The budgets page has no filters and no paging, so the month is the only thing
// its URL carries. Built through the same serializer as /dashboard, so the month
// key and its "the current month means no parameter" rule cannot drift apart
// between the two pages.
export function budgetsHref(month: string | null): string {
  return `/dashboard/budgets${dashboardSearch({ ...NO_FILTERS, page: null, month })}`;
}

// The goals page has no filters either, so the page is the only thing its URL
// carries -- and page 1 is the bare path, the same rule the month follows.
export function goalsHref(page: number): string {
  return page > 1 ? `/dashboard/goals?page=${page}` : "/dashboard/goals";
}
