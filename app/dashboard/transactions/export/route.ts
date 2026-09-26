import { NextResponse, type NextRequest } from "next/server";

import { toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/format";
import { parseTransactionFilters, rawFromSearchParams } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { buildTransactionsQuery } from "@/lib/transactions";
import type { Transaction } from "@/lib/types";

// PostgREST caps a response at the project's max-rows, so one big select would
// silently truncate. Batches of 1000 keep every request under any sane cap.
const BATCH_SIZE = 1000;

// The most rows one file will hold. Counted before any row is fetched rather
// than applied while paging: a ceiling that simply stopped the loop handed back
// a short file whose only notice was an X-Row-Limit header, and nothing on a
// download shows response headers. The button would read "Export 12500
// transactions" and the attachment would hold 10000.
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

// The body is always our own sentence, never the driver's: this text is served
// to the browser as-is, and a Postgres message names tables and constraints the
// reader can do nothing with.
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
    return failure(
      "Could not load your categories, so the export stopped. Please try again.",
      500
    );
  }

  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name])
  );

  // Counted before a single row is fetched, so an over-cap set is refused rather
  // than quietly truncated. The same builder and the same filters as the loop
  // below, so the count and the rows cannot disagree about what "this export"
  // covers. Refusing is the honest outcome: a partial file is indistinguishable
  // from a complete one once it is on disk, and the date filters already let the
  // user take the set in parts.
  const { count, error: countError } = await buildTransactionsQuery(
    supabase,
    filters,
    { count: true, head: true }
  );

  if (countError) {
    return failure("Could not export your transactions. Please try again.", 500);
  }

  const total = count ?? 0;

  if (total > MAX_ROWS) {
    return failure(
      `That is ${total} transactions, more than the ${MAX_ROWS} one file can ` +
        "hold. Narrow the date range and export in parts.",
      400
    );
  }

  const rows: string[][] = [HEADERS];

  // Stepped by the rows actually returned and stopped by the exact `total`
  // counted above. The old exit -- a batch shorter than BATCH_SIZE -- is only
  // right while the project's PostgREST max-rows is at least BATCH_SIZE. Lower
  // that cap (it is a per-project setting) and every batch comes back clamped,
  // so the first short batch ended the loop and the file was silently short.
  // Stepping by batch.length keeps the windows contiguous under any cap.
  let offset = 0;

  while (offset < total) {
    const { data, error } = await buildTransactionsQuery(supabase, filters).range(
      offset,
      offset + BATCH_SIZE - 1
    );

    if (error) {
      return failure("Could not export your transactions. Please try again.", 500);
    }

    const batch: Transaction[] = data ?? [];

    // No rows, yet `total` says there are some: the cap is swallowing whole
    // windows, so the loop cannot make progress. Stop and let the check below
    // report the short file instead of spinning.
    if (batch.length === 0) break;

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

    offset += batch.length;
  }

  // The count was taken with the same builder and filters as these rows, so a
  // mismatch means rows were truncated in transit and the file would be short.
  // Refusing beats handing back a partial file that looks complete.
  if (rows.length - 1 !== total) {
    return failure("Could not export every transaction. Please try again.", 500);
  }

  const headers = noStore({
    "Content-Type": "text/csv; charset=utf-8",
    // Never derived from the query string, or a crafted q could inject a header.
    "Content-Disposition": `attachment; filename="transactions-${todayISO()}.csv"`,
  });

  return new NextResponse(toCsv(rows), { status: 200, headers });
}
