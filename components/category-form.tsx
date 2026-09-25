"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  createCategory,
  renameCategory,
} from "@/app/dashboard/categories/actions";
import { Badge } from "@/components/ui/badge";
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
import type { Category, TransactionType } from "@/lib/types";
import { categorySchema, type CategoryInput } from "@/lib/validations";

type Props = {
  category?: Category;
  trigger: React.ReactNode;
};

export function CategoryFormDialog({ category, trigger }: Props) {
  const isEdit = Boolean(category);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      type: category?.type ?? "expense",
    },
  });

  const selectedType = useWatch({
    control: form.control,
    name: "type",
    defaultValue: "expense",
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    form.reset({
      name: category?.name ?? "",
      type: category?.type ?? "expense",
    });
  }

  function onSubmit(values: CategoryInput) {
    const formData = new FormData();
    if (category) formData.set("id", category.id);
    formData.set("name", values.name);
    // On rename the action ignores `type` entirely, so it isn't sent.
    if (!category) formData.set("type", values.type);

    startTransition(async () => {
      const result = await (isEdit ? renameCategory : createCategory)(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Category renamed" : "Category added");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Rename category" : "Add category"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Type cannot be changed after creation."
              : "Categories group your income and expenses."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Coffee" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {isEdit && category ? (
              <>
                <p className="text-sm font-medium">Type</p>
                <Badge
                  variant={category.type === "income" ? "secondary" : "outline"}
                >
                  {category.type === "income" ? "Income" : "Expense"}
                </Badge>
              </>
            ) : (
              <>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value) =>
                    form.setValue("type", value as TransactionType, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
