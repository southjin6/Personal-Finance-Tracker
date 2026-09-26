export type TransactionType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  sort_order: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  notes: string | null;
  payment_method: string | null;
  category_id: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string | null;
};

// A standing limit for one expense category, in force for every month. There is
// no month column, so the id is what an edit or delete addresses.
export type CategoryBudget = {
  id: string;
  category_id: string;
  amount: number;
};

// `null` means "not filtering on this", never "the empty string". lib/search-params.ts
// is the only module that builds these from URL input.
export type TransactionFilters = {
  type: TransactionType | null;
  categoryId: string | null;
  from: string | null;
  to: string | null;
  q: string | null;
};

// `month: null` means the current month, so the default period never has to be
// spelled out in a URL. `page: null` means page 1.
export type DashboardQuery = TransactionFilters & {
  page: number | null;
  month: string | null;
};

// One row of the monthly_summary() aggregate, exactly as PostgREST sends it:
// the totals stay in the numeric(12,2) domain until lib/money.ts converts them.
// lib/insights.ts is the only module that builds these — the RPC payload is
// untyped, so it is normalised there.
export type MonthlySummaryRow = {
  categoryId: string;
  categoryName: string;
  categoryType: TransactionType;
  incomeTotal: number;
  expenseTotal: number;
  txnCount: number;
};

// One row of the monthly_budget_progress() aggregate, same contract as
// MonthlySummaryRow: amounts stay in the numeric domain until lib/money.ts
// converts them, and lib/insights.ts is the only module that builds these.
// remainingAmount is signed on purpose — an overspent category shows a negative
// balance rather than being clamped at zero, so the page can say how far over
// the limit it went. budgetId is the budget's own id and is what an edit or a
// delete addresses; it arrives in the same row as the amounts so the list has
// one source for both.
export type BudgetProgressRow = {
  categoryId: string;
  budgetId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
};

