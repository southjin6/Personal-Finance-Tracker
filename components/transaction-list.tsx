"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTransaction } from "@/app/dashboard/actions";
import { TransactionFormDialog } from "@/components/transaction-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatPHP } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";

function TransactionRow({
  transaction,
  categories,
  categoryNames,
}: {
  transaction: Transaction;
  categories: Category[];
  categoryNames: Map<string, string>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isIncome = transaction.type === "income";

  function onDelete() {
    startTransition(async () => {
      const result = await deleteTransaction(transaction.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction deleted");
      setConfirmOpen(false);
    });
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        {formatDate(transaction.occurred_on)}
      </TableCell>

      <TableCell>
        <Badge variant={isIncome ? "secondary" : "outline"}>
          {categoryNames.get(transaction.category_id) ?? "Uncategorized"}
        </Badge>
      </TableCell>

      <TableCell className="text-muted-foreground max-w-[16rem] truncate">
        {transaction.notes ?? "—"}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {transaction.payment_method ?? "—"}
      </TableCell>

      <TableCell
        className={`text-right font-medium tabular-nums ${
          isIncome ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"
        }`}
      >
        {isIncome ? "+" : "−"}
        {formatPHP(transaction.amount)}
      </TableCell>

      <TableCell>
        <div className="flex justify-end gap-1">
          <TransactionFormDialog
            categories={categories}
            transaction={transaction}
            trigger={
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            }
          />

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                <AlertDialogDescription>
                  {formatPHP(transaction.amount)} on{" "}
                  {formatDate(transaction.occurred_on)} will be permanently
                  removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    onDelete();
                  }}
                >
                  {pending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function TransactionList({
  transactions,
  categories,
  emptyMessage = "No transactions yet. Add your first income or expense to get started.",
  emptyAction,
}: {
  transactions: Transaction[];
  categories: Category[];
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
}) {
  if (transactions.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
        {emptyMessage}
        {emptyAction ? (
          <div className="mt-3 flex justify-center">{emptyAction}</div>
        ) : null}
      </div>
    );
  }

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name])
  );

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              categories={categories}
              categoryNames={categoryNames}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
