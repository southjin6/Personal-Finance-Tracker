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
import type { Category, CategoryBudget } from "@/lib/types";

// The answers a database that predates this step gives: the function is not in
// the schema cache (PGRST202), the table is not either (PGRST205), or Postgres
// itself reports the relation missing (42P01). Distinguished from a transient
// failure so the page can say what to actually do about it.
function isMissingSchema(code?: string) {
  return code === "PGRST202" || code === "PGRST205" || code === "42P01";
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

  const [categoriesResult, budgetsResult, progressResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type, sort_order")
      .order("name")
      .order("id"),
    supabase
      .from("category_budgets")
      .select("id, category_id, amount")
      // Ordered for stability only: the list's own order comes from the progress
      // RPC, which sorts by name. The explicit limit is still needed because
      // PostgREST caps a response at the project's max-rows and would truncate
      // silently otherwise.
      .order("category_id")
      .limit(200),
    // Spending comes from the same aggregate the dashboard's chart uses, so a
    // limit and the chart cannot disagree about what a category cost.
    supabase.rpc("monthly_budget_progress", { p_month: firstOfMonth(month) }),
  ]);

  const loadError =
    progressResult.error ?? budgetsResult.error ?? categoriesResult.error;

  const categories: Category[] = categoriesResult.data ?? [];
  // Budgets only apply to spending, so the form is not offered the income
  // categories at all -- the action refuses them too, since a hand-built request
  // need not come through this page.
  const expenseCategories = categories.filter(
    (category) => category.type === "expense"
  );
  const budgets: CategoryBudget[] = budgetsResult.data ?? [];
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
              takenCategoryIds={budgets.map((budget) => budget.category_id)}
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
        <BudgetList
          progress={progress}
          budgets={budgets}
          categories={expenseCategories}
        />
      )}
    </div>
  );
}
