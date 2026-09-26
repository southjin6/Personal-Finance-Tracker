"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteBudget } from "@/app/dashboard/budgets/actions";
import { BudgetFormDialog } from "@/components/budget-form";
import { BudgetProgress } from "@/components/budget-progress";
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
import { Button } from "@/components/ui/button";
import type { BudgetProgressRow, Category, CategoryBudget } from "@/lib/types";

function BudgetCard({
  row,
  categories,
  takenCategoryIds,
}: {
  row: BudgetProgressRow;
  categories: Category[];
  takenCategoryIds: string[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Rebuilt from the aggregate row rather than read back from category_budgets:
  // the id an edit or a delete addresses comes down with the amounts, so it
  // cannot be missing for a card that is on screen.
  const budget: CategoryBudget = {
    id: row.budgetId,
    category_id: row.categoryId,
    amount: row.budgetAmount,
  };

  function onDelete() {
    startTransition(async () => {
      const result = await deleteBudget(budget.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Budget removed");
      setConfirmOpen(false);
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{row.categoryName}</p>

        <div className="flex gap-1">
          <BudgetFormDialog
            categories={categories}
            takenCategoryIds={takenCategoryIds}
            budget={budget}
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
                <AlertDialogTitle>Remove this budget?</AlertDialogTitle>
                <AlertDialogDescription>
                  The limit for {row.categoryName} will be deleted. Your
                  transactions are not affected — only the limit goes.
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
                  {pending ? "Removing…" : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mt-4">
        <BudgetProgress row={row} />
      </div>
    </div>
  );
}

export function BudgetList({
  progress,
  categories,
}: {
  progress: BudgetProgressRow[];
  categories: Category[];
}) {
  if (progress.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
        No budgets yet. Add one to set a spending limit for a category.
      </div>
    );
  }

  const takenCategoryIds = progress.map((row) => row.categoryId);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {progress.map((row) => (
        <BudgetCard
          key={row.categoryId}
          row={row}
          categories={categories}
          takenCategoryIds={takenCategoryIds}
        />
      ))}
    </div>
  );
}
