import { TransactionFormDialog } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Category, Transaction } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [categoriesResult, transactionsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type, sort_order")
      .order("type")
      .order("sort_order"),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, occurred_on, notes, payment_method, category_id"
      )
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const categories: Category[] = categoriesResult.data ?? [];
  const transactions: Transaction[] = transactionsResult.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transactions
          </h1>
          <p className="text-muted-foreground text-sm">
            Your income and expenses, most recent first.
          </p>
        </div>

        <TransactionFormDialog
          categories={categories}
          trigger={<Button>Add transaction</Button>}
        />
      </div>

      {transactionsResult.error ? (
        <p className="text-destructive text-sm">
          Could not load transactions: {transactionsResult.error.message}
        </p>
      ) : (
        <TransactionList
          transactions={transactions}
          categories={categories}
        />
      )}
    </div>
  );
}
