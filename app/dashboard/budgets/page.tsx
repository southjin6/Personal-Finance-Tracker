import { BudgetFormDialog } from "@/components/budget-form";
import { BudgetList } from "@/components/budget-list";
import { MonthPicker } from "@/components/month-picker";
import { Button } from "@/components/ui/button";
import { normalizeBudgetProgress } from "@/lib/insights";
import {
  budgetsHref,
  currentMonth,
  firstOfMonth,
  parseMonth,
  type RawSearchParams,
} from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

// The answer a database that predates this step gives: the function is not in
// the schema cache (PGRST202), or Postgres reports a relation the function's body
// reads as missing (42P01) when a paste was partial. Distinguished from a
// transient failure so the page can say what to actually do about it.
function isMissingSchema(code?: string) {
  return code === "PGRST202" || code === "42P01";
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const thisMonth = currentMonth();
  const month = parseMonth(raw.month, thisMonth);

  const supabase = await createClient();

  const [categoriesResult, progressResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type, sort_order")
      .order("name")
      .order("id"),
    // Spending comes from the same aggregate the dashboard's chart uses, so a
    // limit and the chart cannot disagree about what a category cost -- and the
    // budget's own id rides along in the same row, so there is no second read to
    // cap and no card that can arrive without its buttons.
    supabase.rpc("monthly_budget_progress", { p_month: firstOfMonth(month) }),
  ]);

  const loadError = progressResult.error ?? categoriesResult.error;

  const categories: Category[] = categoriesResult.data ?? [];
  // Budgets only apply to spending, so the form is not offered the income
  // categories at all -- the action refuses them too, since a hand-built request
  // need not come through this page.
  const expenseCategories = categories.filter(
    (category) => category.type === "expense"
  );
  const progress = normalizeBudgetProgress(progressResult.data);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground text-sm">
            Set a limit for a category and track what you spend against it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker
            month={month}
            thisMonth={thisMonth}
            hrefFor={budgetsHref}
          />

          {/* Withheld when the read failed: a limit cannot be saved into a table
              that is not there, so the button would only ever produce an error. */}
          {loadError ? null : (
            <BudgetFormDialog
              categories={expenseCategories}
              takenCategoryIds={progress.map((row) => row.categoryId)}
              trigger={<Button>Add budget</Button>}
            />
          )}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-destructive text-sm font-medium">
            Could not load your budgets.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {isMissingSchema(loadError.code)
              ? "The budgets table is not in your database yet. Paste the latest supabase/schema.sql into the Supabase SQL Editor, then refresh."
              : "Something went wrong while loading this page. This is usually temporary."}
          </p>
        </div>
      ) : (
        <BudgetList progress={progress} categories={expenseCategories} />
      )}
    </div>
  );
}
