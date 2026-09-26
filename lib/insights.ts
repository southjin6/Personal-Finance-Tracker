import { sumCents, toCents } from "@/lib/money";
import type {
  BudgetProgressRow,
  MonthlySummaryRow,
  TransactionType,
} from "@/lib/types";

export type MonthlyTotals = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  txnCount: number;
};

export type SpendingSlice = {
  categoryId: string;
  categoryName: string;
  expenseCents: number;
};

// The label a bucket of small categories gets. Not a category name, so it can
// never collide with a real one the way "Other" (a seeded category) can.
export const OTHER_SLICE_NAME = "Everything else";

// A sentinel id, so consumers can recognise the bucket by id rather than by
// comparing the display label. Not a uuid, which is what makes it safe.
export const OTHER_SLICE_ID = "__other__";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  // numeric arrives as a JSON number. bigint normally does too, but one beyond
  // the safe integer range would arrive as a string, so accept both.
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function asType(value: unknown): TransactionType | null {
  return value === "income" || value === "expense" ? value : null;
}

// The RPC payload is untyped — the Supabase client here is created without a
// Database generic, so `data` is `any`. This is the one place a shape mismatch
// could surface as "₱NaN" on the page, so every field is coerced, an unreadable
// row is dropped rather than guessed at, and nothing here throws: a bad payload
// has to degrade to an empty panel, never to an error boundary that replaces the
// transactions list.
export function normalizeSummary(data: unknown): MonthlySummaryRow[] {
  if (!Array.isArray(data)) return [];

  const rows: MonthlySummaryRow[] = [];

  for (const raw of data) {
    if (typeof raw !== "object" || raw === null) continue;

    const row = raw as Record<string, unknown>;
    const categoryId = asString(row.category_id);
    const categoryName = asString(row.category_name);
    const categoryType = asType(row.category_type);
    const incomeTotal = asNumber(row.income_total);
    const expenseTotal = asNumber(row.expense_total);
    const txnCount = asNumber(row.txn_count);

    if (
      categoryId === null ||
      categoryName === null ||
      categoryType === null ||
      incomeTotal === null ||
      expenseTotal === null ||
      txnCount === null
    ) {
      continue;
    }

    rows.push({
      categoryId,
      categoryName,
      categoryType,
      incomeTotal,
      expenseTotal,
      txnCount,
    });
  }

  return rows;
}

// Same contract as normalizeSummary above, for the budgets aggregate: the RPC
// payload is untyped, every field is coerced, and an unreadable row is dropped
// rather than rendered as "₱NaN". No asType call — there is no type column in
// this result, because budgets only ever apply to expense categories.
export function normalizeBudgetProgress(data: unknown): BudgetProgressRow[] {
  if (!Array.isArray(data)) return [];

  const rows: BudgetProgressRow[] = [];

  for (const raw of data) {
    if (typeof raw !== "object" || raw === null) continue;

    const row = raw as Record<string, unknown>;
    const categoryId = asString(row.category_id);
    const budgetId = asString(row.budget_id);
    const categoryName = asString(row.category_name);
    const budgetAmount = asNumber(row.budget_amount);
    const spentAmount = asNumber(row.spent_amount);
    const remainingAmount = asNumber(row.remaining_amount);

    if (
      categoryId === null ||
      budgetId === null ||
      categoryName === null ||
      budgetAmount === null ||
      spentAmount === null ||
      remainingAmount === null
    ) {
      continue;
    }

    rows.push({
      categoryId,
      budgetId,
      categoryName,
      budgetAmount,
      spentAmount,
      remainingAmount,
    });
  }

  return rows;
}

// Every sum happens in cents (lib/money.ts), so the three cards cannot disagree
// with each other the way three independent float additions could.
export function totalsOf(rows: MonthlySummaryRow[]): MonthlyTotals {
  const incomeCents = sumCents(rows.map((row) => row.incomeTotal));
  const expenseCents = sumCents(rows.map((row) => row.expenseTotal));

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    txnCount: rows.reduce((total, row) => total + row.txnCount, 0),
  };
}

// Expenses only — the chart answers "where did the money go", and a month with
// no spending has nothing to show. Biggest first, because the chart is read top
// to bottom and the tail is the least interesting part.
export function spendingSlices(
  rows: MonthlySummaryRow[],
  limit = 8
): SpendingSlice[] {
  const spending = rows
    .filter((row) => row.expenseTotal > 0)
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      expenseCents: toCents(row.expenseTotal),
    }))
    .sort((a, b) => b.expenseCents - a.expenseCents);

  if (spending.length <= limit) return spending;

  // Past the limit the bars get too short to read, so the tail becomes one
  // bucket rather than shrinking into a comb.
  const head = spending.slice(0, limit);
  const tail = spending.slice(limit);

  head.push({
    categoryId: OTHER_SLICE_ID,
    categoryName: OTHER_SLICE_NAME,
    expenseCents: tail.reduce((total, slice) => total + slice.expenseCents, 0),
  });

  return head;
}
