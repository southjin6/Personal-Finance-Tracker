import { cn } from "cn";

import { MonthPicker } from "@/components/month-picker";
import { SpendingChart } from "@/components/spending-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMonthLabel, formatPHPFromCents } from "@/lib/format";
import { spendingSlices, totalsOf } from "@/lib/insights";
import type { DashboardQuery, MonthlySummaryRow } from "@/lib/types";

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

export function InsightsPanel({
  query,
  month,
  thisMonth,
  rows,
  error,
}: {
  query: DashboardQuery;
  month: string;
  thisMonth: string;
  rows: MonthlySummaryRow[];
  error?: { code?: string } | null;
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
        <MonthPicker query={query} month={month} thisMonth={thisMonth} />
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
    </section>
  );
}
