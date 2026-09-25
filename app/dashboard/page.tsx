import Link from "next/link";
import { redirect } from "next/navigation";

import { InsightsPanel } from "@/components/insights-panel";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionFormDialog } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { TransactionPagination } from "@/components/transaction-pagination";
import { Button } from "@/components/ui/button";
import { normalizeSummary } from "@/lib/insights";
import { pageCount, pageRange, parsePage } from "@/lib/pagination";
import {
  clearFiltersHref,
  currentMonth,
  dashboardHref,
  dashboardSearch,
  firstOfMonth,
  hasActiveFilters,
  parseMonth,
  parseTransactionFilters,
  type RawSearchParams,
} from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { buildTransactionsQuery } from "@/lib/transactions";
import type { Category, DashboardQuery, Transaction } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const requestedPage = parsePage(raw.page);
  const { from, to } = pageRange(requestedPage);
  const filters = parseTransactionFilters(raw);

  const thisMonth = currentMonth();
  const month = parseMonth(raw.month, thisMonth);
  const query: DashboardQuery = {
    ...filters,
    page: requestedPage,
    // null means "the month we are in", so the default period never has to be
    // spelled out in a URL and a shared link keeps following the calendar.
    month: month === thisMonth ? null : month,
  };

  const supabase = await createClient();

  const [categoriesResult, transactionsResult, summaryResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type, sort_order")
      .order("type")
      .order("sort_order")
      // Two categories can share a sort_order after a concurrent insert, so order
      // by id as well to keep the list stable between renders.
      .order("id"),
    buildTransactionsQuery(supabase, filters, { count: true }).range(from, to),
    // One call for the panel: the database does the summing, so nothing has to
    // be transferred and re-added here, and the month bounds stay in SQL.
    supabase.rpc("monthly_summary", { p_month: firstOfMonth(month) }),
  ]);

  const totalCount = transactionsResult.count ?? 0;
  const totalPages = pageCount(totalCount);

  if (requestedPage > totalPages) {
    // Built the same way the links are, so ?page=5 against a filter that only
    // fills 2 pages lands on that filter's page 2 instead of dropping it.
    redirect(dashboardHref({ ...query, page: totalPages }));
  }

  const categories: Category[] = categoriesResult.data ?? [];
  const transactions: Transaction[] = transactionsResult.data ?? [];
  // The RPC payload is untyped, so it goes through the normaliser before it can
  // reach a component — a malformed row becomes an absent row, never a ₱NaN.
  const summaryRows = normalizeSummary(summaryResult.data);
  const filtered = hasActiveFilters(filters);

  // Filters only: the month scopes the insights panel, not this list, so it has
  // no business in the file's URL — and no page param either, since the export
  // is the whole filtered set rather than the current page.
  const exportHref = `/dashboard/transactions/export${dashboardSearch({
    ...filters,
    page: null,
    month: null,
  })}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Your income and expenses at a glance.
        </p>
      </div>

      <InsightsPanel
        query={query}
        month={month}
        thisMonth={thisMonth}
        rows={summaryRows}
        error={summaryResult.error}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Transactions
            </h2>
            <p className="text-muted-foreground text-sm">
              Your income and expenses, most recent first.
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {/* A plain anchor rather than next/link, which would prefetch the whole
                file on hover. The download name comes from the response, not from
                here and never from the query string. */}
            <Button asChild variant="outline">
              <a href={exportHref}>
                Export {totalCount}{" "}
                {totalCount === 1 ? "transaction" : "transactions"}
              </a>
            </Button>

            <TransactionFormDialog
              categories={categories}
              trigger={<Button>Add transaction</Button>}
            />
          </div>
        </div>

        <TransactionFilters query={query} categories={categories} />

        {transactionsResult.error ? (
          <p className="text-destructive text-sm">
            Could not load transactions: {transactionsResult.error.message}
          </p>
        ) : (
          <>
            <TransactionList
              transactions={transactions}
              categories={categories}
              emptyMessage={
                filtered
                  ? "No transactions match these filters."
                  : undefined
              }
              emptyAction={
                filtered ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={clearFiltersHref(query)}>Clear filters</Link>
                  </Button>
                ) : null
              }
            />
            <TransactionPagination
              page={requestedPage}
              totalPages={totalPages}
              query={query}
            />
          </>
        )}
      </section>
    </div>
  );
}
