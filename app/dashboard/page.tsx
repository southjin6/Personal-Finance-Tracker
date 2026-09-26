import Link from "next/link";
import { redirect } from "next/navigation";

import { InsightsPanel } from "@/components/insights-panel";
import { ListPagination } from "@/components/list-pagination";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionFormDialog } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { normalizeBudgetProgress, normalizeSummary } from "@/lib/insights";
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

  const [categoriesResult, transactionsResult, summaryResult, budgetsResult] =
    await Promise.all([
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
      // A second call for the budgets block, deliberately not folded into the one
      // above: the two fail independently, and a database that predates the
      // budgets schema should still render the cards and the chart.
      supabase.rpc("monthly_budget_progress", { p_month: firstOfMonth(month) }),
    ]);

  const totalCount = transactionsResult.count ?? 0;
  const totalPages = pageCount(totalCount);

  // A satisfiable range already implies requestedPage <= totalPages, so this used
  // to be the only way to land here: PostgREST answers PGRST103 (416) once the
  // requested window starts at or past the end of the set, and reports no count
  // with that answer -- leaving nothing to clamp against. Ask for the count on its
  // own instead, filter for filter, since a request with no range cannot be
  // unsatisfiable. Built the same way the links are, so ?page=5 against a filter
  // that only fills 2 pages lands on that filter's page 2 rather than dropping to
  // page 1. Any other failure falls through to the message below.
  if (transactionsResult.error?.code === "PGRST103") {
    const { count: total } = await buildTransactionsQuery(supabase, filters, {
      count: true,
      head: true,
    });

    if (total !== null) {
      redirect(dashboardHref({ ...query, page: pageCount(total) }));
    }
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
        budgetRows={normalizeBudgetProgress(budgetsResult.data)}
        budgetError={budgetsResult.error}
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
            {/* Withheld when the read failed, for the same reason as the dialog
                below: the label is the count, and a failed read leaves it at 0,
                so the button claimed "Export 0 transactions" above a message
                saying the transactions could not be loaded. The export route
                reads the same set and would refuse anyway. */}
            {transactionsResult.error ? null : (
              // A plain anchor rather than next/link, which would prefetch the
              // whole file on hover. The download name comes from the response,
              // not from here and never from the query string.
              <Button asChild variant="outline">
                <a href={exportHref}>
                  Export {totalCount}{" "}
                  {totalCount === 1 ? "transaction" : "transactions"}
                </a>
              </Button>
            )}

            {/* Withheld when the read failed: the dialog's picker is built from
                the category list, so an empty one is a dead end. */}
            {categoriesResult.error ? null : (
              <TransactionFormDialog
                categories={categories}
                trigger={<Button>Add transaction</Button>}
              />
            )}
          </div>
        </div>

        {/* Withheld for the same reason as the dialog: every option in the
            category menu comes from that list, and an active ?category_id=
            filter would otherwise render as "All categories" while the list
            stayed filtered. */}
        {categoriesResult.error ? null : (
          <TransactionFilters query={query} categories={categories} />
        )}

        {/* Two separate failure modes, so two branches. A failed transactions
            read is just a missing list, but a failed categories read used to be
            swallowed here and rendered every row as "Uncategorized" -- a claim
            the data denies, since category_id is not null -- above an empty
            filter menu and a dead-end Add dialog. That section now comes down
            instead, the way the budgets page does.
            Neither branch prints the driver's message: Postgres text names our
            tables and constraints, and tells the reader nothing they can do. */}
        {transactionsResult.error ? (
          <p className="text-destructive text-sm">
            Could not load your transactions. Please refresh the page.
          </p>
        ) : categoriesResult.error ? (
          <div className="rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="text-destructive text-sm font-medium">
              Could not load your categories.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Category names come from that list, so the transactions are hidden
              until it loads. Please refresh the page.
            </p>
          </div>
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
            <ListPagination
              page={requestedPage}
              totalPages={totalPages}
              label="Transaction pages"
              hrefFor={(target) => dashboardHref({ ...query, page: target })}
            />
          </>
        )}
      </section>
    </div>
  );
}
