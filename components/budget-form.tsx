"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { saveBudget } from "@/app/dashboard/budgets/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, CategoryBudget } from "@/lib/types";
import { budgetSchema, type BudgetInput } from "@/lib/validations";

type Props = {
  categories: Category[];
  // Categories that already have a limit. They stay visible but unselectable, so
  // "why can't I pick Groceries" answers itself — the alternative, hiding them,
  // makes the list look arbitrarily short. The server upserts either way; this
  // is about not silently overwriting a limit the user forgot about.
  takenCategoryIds?: string[];
  budget?: CategoryBudget;
  trigger: React.ReactNode;
};

// PostgREST hands numeric(12,2) back as a number, so stringify it for the text
// input the schema expects.
function defaults(budget?: CategoryBudget): BudgetInput {
  return {
    category_id: budget?.category_id ?? "",
    amount: budget ? String(budget.amount) : "",
  };
}

export function BudgetFormDialog({
  categories,
  takenCategoryIds = [],
  budget,
  trigger,
}: Props) {
  const isEdit = Boolean(budget);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: defaults(budget),
  });

  const selectedCategory = useWatch({
    control: form.control,
    name: "category_id",
    defaultValue: "",
  });

  const taken = new Set(takenCategoryIds);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    form.reset(defaults(budget));
  }

  function onSubmit(values: BudgetInput) {
    const formData = new FormData();
    formData.set("category_id", values.category_id);
    formData.set("amount", values.amount);

    startTransition(async () => {
      const result = await saveBudget(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Budget updated" : "Budget added");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "Add budget"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change the limit for this category."
              : "Set a spending limit for a category."}{" "}
            The limit applies to every month.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget-category">Category</Label>
            <Select
              value={selectedCategory}
              // A budget's identity is the category it limits, so the category is
              // the one field that cannot move: a different one would be a
              // different limit, and the row to delete would be this one.
              disabled={isEdit}
              onValueChange={(value) =>
                form.setValue("category_id", value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="budget-category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => {
                  const alreadyLimited =
                    taken.has(category.id) && category.id !== budget?.category_id;

                  return (
                    <SelectItem
                      key={category.id}
                      value={category.id}
                      disabled={alreadyLimited}
                    >
                      {alreadyLimited
                        ? `${category.name} (has a limit)`
                        : category.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {form.formState.errors.category_id ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.category_id.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-amount">Limit (₱)</Label>
            <Input
              id="budget-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              placeholder="0.00"
              {...form.register("amount")}
            />
            {form.formState.errors.amount ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
