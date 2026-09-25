import Link from "next/link";
import { cn } from "cn";

import { BudgetProgress } from "@/components/budget-progress";
import { MonthPicker } from "@/components/month-picker";
import { SpendingChart } from "@/components/spending-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMonthLabel, formatPHPFromCents } from "@/lib/format";
import { spendingSlices, totalsOf } from "@/lib/insights";
import { dashboardHref } from "@/lib/search-params";
import type {
  BudgetProgressRow,
  DashboardQuery,
  MonthlySummaryRow,
} from "@/lib/types";

function StatCard({
  label,
  value,
  valueClassName,
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-normal tracking-wide uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold tabular-nums", valueClassName)}>
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// A failing aggregate must never take the transaction list down with it: at the
// moment code ships ahead of schema.sql the function does not exist yet, and
// PGRST202 is the signature of exactly that window.
function SummaryError({ error }: { error: { code?: string } }) {
  const missingFunction = error.code === "PGRST202";

  return (
    <div className="rounded-lg border border-dashed px-6 py-8 text-center">
      <p className="text-destructive text-sm font-medium">
        Could not load the summary for this month.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        {missingFunction
          ? "The monthly_summary function is not in your database yet. Paste the latest supabase/schema.sql into the Supabase SQL Editor, then refresh."
          : "Something went wrong while loading this panel. Please refresh the page."}
      </p>
    </div>
  );
}

// The budgets block is a second, independent read, so it fails on its own terms:
// a database that predates this step must not lose the cards above it. Silence
// on an empty list is deliberate -- a dashboard should not advertise a feature
// that is switched off -- but a *failure* is loud, because silence there would
// look like "you have no budgets" when the truth is "we could not ask".
function BudgetsBlock({
  rows,
  error,
  month,
}: {
  rows: BudgetProgressRow[];
  error?: { code?: string } | null;
  month: string;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-6 text-center">
        <p className="text-destructive text-sm font-medium">
          Could not load your budgets.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {error.code === "PGRST202"
            ? "The monthly_budget_progress function is not in your database yet. Paste the latest supabase/schema.sql into the Supabase SQL Editor, then refresh."
            : "Something went wrong while loading this panel. Please refresh the page."}
        </p>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Budgets</h3>
        <Link
          href="/dashboard/budgets"
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Manage
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.categoryId}>
            <p className="mb-1 text-sm">{row.categoryName}</p>
            <BudgetProgress row={row} variant="compact" />
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        Limits apply to every month, including {formatMonthLabel(month)}.
      </p>
    </div>
  );
}

export function InsightsPanel({
  query,
  month,
  thisMonth,
  rows,
  error,
  budgetRows,
  budgetError,
}: {
  query: DashboardQuery;
  month: string;
  thisMonth: string;
  rows: MonthlySummaryRow[];
  error?: { code?: string } | null;
  budgetRows: BudgetProgressRow[];
  budgetError?: { code?: string } | null;
}) {
  const monthName = formatMonthLabel(month);
  const totals = totalsOf(rows);
  const slices = spendingSlices(rows);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          {/* When the aggregate fails, rows is empty for a reason that has nothing
              to do with the month having no transactions -- so the count line must
              not claim otherwise. */}
          <p className="text-muted-foreground text-sm">
            {error
              ? `Summary for ${monthName}.`
              : rows.length > 0
                ? `${totals.txnCount} transaction${totals.txnCount === 1 ? "" : "s"} recorded in ${monthName}.`
                : `Nothing recorded in ${monthName}.`}
          </p>
        </div>

        {/* Independent of the list's own from/to filters on purpose: this scopes
            the panel only, so the list's pagination stays unambiguous. */}
        <MonthPicker
          month={month}
          thisMonth={thisMonth}
          hrefFor={(target) => dashboardHref({ ...query, month: target })}
        />
      </div>

      {error ? (
        <SummaryError error={error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Income"
              value={formatPHPFromCents(totals.incomeCents)}
              valueClassName="text-emerald-600 dark:text-emerald-500"
            />
            <StatCard
              label="Expenses"
              value={formatPHPFromCents(totals.expenseCents)}
              valueClassName="text-red-600 dark:text-red-500"
            />
            <StatCard
              label="Net"
              value={`${totals.netCents < 0 ? "−" : "+"}${formatPHPFromCents(Math.abs(totals.netCents))}`}
              valueClassName={
                totals.netCents < 0
                  ? "text-red-600 dark:text-red-500"
                  : "text-emerald-600 dark:text-emerald-500"
              }
              hint="Income minus expenses"
            />
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium">Spending by category</h3>

            {slices.length === 0 ? (
              <p className="text-muted-foreground mt-4 rounded-lg border border-dashed px-6 py-10 text-center text-sm">
                No spending recorded in {monthName}.
              </p>
            ) : (
              <div className="mt-4">
                <SpendingChart slices={slices} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Outside the branch above: the summary and the budgets are separate
          reads, so one failing says nothing about the other. */}
      <BudgetsBlock rows={budgetRows} error={budgetError} month={month} />
    </section>
  );
}
