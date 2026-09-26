import type { Supabase } from "@/lib/actions";
import type { TransactionFilters } from "@/lib/types";

// One declaration for the projection both readers use. category_id is included
// because callers resolve names through their own category map; a file the user
// forwards never gets the identifiers themselves (see the export route).
export const TRANSACTION_COLUMNS =
  "id, type, amount, occurred_on, notes, payment_method, category_id";

// `ilike` is handed a SQL LIKE pattern: % and _ are wildcards and \ is the
// escape character, so a note that literally contains one of them has to be
// escaped — otherwise searching for "50%" matches every row. PostgREST also
// rewrites * to %, so it needs the same treatment. The backslash goes first in
// the class or it would escape the escapes added for the others.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_*]/g, (character) => `\\${character}`);
}

// The page and the CSV export both build their query here, which is what makes
// "the export is exactly the filtered set" true by construction rather than by
// two implementations happening to agree.
export function buildTransactionsQuery(
  supabase: Supabase,
  filters: TransactionFilters,
  // head returns the count and no rows, which is how the export asks how big the
  // set is before committing to serving it.
  options?: { count?: boolean; head?: boolean }
) {
  let query = supabase
    .from("transactions")
    .select(
      TRANSACTION_COLUMNS,
      options?.count
        ? { count: "exact", head: options.head ?? false }
        : undefined
    );

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.from) query = query.gte("occurred_on", filters.from);
  if (filters.to) query = query.lte("occurred_on", filters.to);
  if (filters.q) query = query.ilike("notes", `%${escapeLikePattern(filters.q)}%`);

  return (
    query
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      // Final tiebreak: rows sharing a timestamp would otherwise come back in an
      // undefined order, which can repeat or skip one across pages — and the
      // export walks .range() in a loop, where a total order is mandatory.
      .order("id")
  );
}
