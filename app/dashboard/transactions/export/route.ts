import { NextResponse, type NextRequest } from "next/server";

import { toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/format";
import { parseTransactionFilters, rawFromSearchParams } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { buildTransactionsQuery } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";

// PostgREST caps a response at the project's max-rows, so one big select would
// silently truncate. Batches of 1000 keep every request under any sane cap; the
// ceiling stops a runaway export from paging forever.
const BATCH_SIZE = 1000;
const MAX_ROWS = 10_000;

const HEADERS = [
  "Date",
  "Type",
  "Category",
  "Amount",
  "Currency",
  "Payment method",
  "Notes",
];

function noStore(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Expires: "0",
    Pragma: "no-cache",
    ...extra,
  };
}

function failure(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: noStore({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

export async function GET(request: NextRequest) {
  // The proxy already redirects an anonymous caller, but it is a UX layer: by
  // its own comment a guard that quietly skips is worse than none, and editing
  // the matcher removes it without a trace. An explicit 401 keeps the failure
  // mode legible instead of handing back an empty file. RLS is the real backstop.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return failure("Sign in to export transactions.", 401);

  const filters = parseTransactionFilters(
    rawFromSearchParams(request.nextUrl.searchParams)
  );

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name");

  if (categoriesError) {
    return failure(`Could not load categories: ${categoriesError.message}`, 500);
  }

  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name])
  );

  const rows: string[][] = [HEADERS];
  let reachedLimit = false;

  for (let offset = 0; ; offset += BATCH_SIZE) {
    if (offset >= MAX_ROWS) {
      // Only reachable when the previous batch was full, so this genuinely means
      // "there may be more rows" rather than "we happened to land on the cap".
      reachedLimit = true;
      break;
    }

    const { data, error } = await buildTransactionsQuery(supabase, filters).range(
      offset,
      offset + BATCH_SIZE - 1
    );

    if (error) return failure(`Could not export transactions: ${error.message}`, 500);

    const batch: Transaction[] = data ?? [];

    for (const transaction of batch) {
      rows.push([
        transaction.occurred_on,
        transaction.type === "income" ? "Income" : "Expense",
        // Resolved through the same map the page's badges use, so a deleted
        // category reads as "Uncategorized" in both.
        categoryNames.get(transaction.category_id) ?? "Uncategorized",
        // Unsigned, with the direction in its own column: no cell ever starts
        // with "-", which is both the typographic minus and a formula lead.
        Number(transaction.amount).toFixed(2),
        "PHP",
        transaction.payment_method ?? "",
        transaction.notes ?? "",
      ]);
    }

    if (batch.length < BATCH_SIZE) break;
  }

  const headers = noStore({
    "Content-Type": "text/csv; charset=utf-8",
    // Never derived from the query string, or a crafted q could inject a header.
    "Content-Disposition": `attachment; filename="transactions-${todayISO()}.csv"`,
  });

  // Present only when the file is short of the full filtered set.
  if (reachedLimit) headers["X-Row-Limit"] = String(MAX_ROWS);

  return new NextResponse(toCsv(rows), { status: 200, headers });
}
