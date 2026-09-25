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
  budget,
  categories,
  takenCategoryIds,
}: {
  row: BudgetProgressRow;
  budget?: CategoryBudget;
  categories: Category[];
  takenCategoryIds: string[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!budget) return;

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

        {/* The progress rows and the budgets rows are two separate reads, so a
            category can in principle arrive without its budget's id. It still has
            amounts worth showing, but there is nothing to edit or delete — and a
            button that silently does nothing would be worse than no button. */}
        {budget ? (
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
        ) : null}
      </div>

      <div className="mt-4">
        <BudgetProgress row={row} />
      </div>
    </div>
  );
}

export function BudgetList({
  progress,
  budgets,
  categories,
}: {
  progress: BudgetProgressRow[];
  budgets: CategoryBudget[];
  categories: Category[];
}) {
  if (progress.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
        No budgets yet. Add one to set a spending limit for a category.
      </div>
    );
  }

  const budgetByCategory = new Map(
    budgets.map((budget) => [budget.category_id, budget])
  );
  const takenCategoryIds = budgets.map((budget) => budget.category_id);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {progress.map((row) => (
        <BudgetCard
          key={row.categoryId}
          row={row}
          budget={budgetByCategory.get(row.categoryId)}
          categories={categories}
          takenCategoryIds={takenCategoryIds}
        />
      ))}
    </div>
  );
}
