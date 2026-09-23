"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  createTransaction,
  updateTransaction,
} from "@/app/dashboard/actions";
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
import { PAYMENT_METHODS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import type { Category, Transaction, TransactionType } from "@/lib/types";
import { transactionSchema, type TransactionInput } from "@/lib/validations";

const UNSPECIFIED = "unspecified";

type Props = {
  categories: Category[];
  transaction?: Transaction;
  trigger: React.ReactNode;
};

export function TransactionFormDialog({ categories, transaction, trigger }: Props) {
  const isEdit = Boolean(transaction);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: transaction?.type ?? "expense",
      amount: transaction ? String(transaction.amount) : "",
      category_id: transaction?.category_id ?? "",
      occurred_on: transaction?.occurred_on ?? todayISO(),
      notes: transaction?.notes ?? "",
      payment_method: transaction?.payment_method ?? "",
    },
  });

  const selectedType = useWatch({
    control: form.control,
    name: "type",
    defaultValue: "expense",
  });
  const selectedCategory = useWatch({
    control: form.control,
    name: "category_id",
    defaultValue: "",
  });
  const selectedPaymentMethod = useWatch({
    control: form.control,
    name: "payment_method",
    defaultValue: "",
  });
  const options = categories.filter((category) => category.type === selectedType);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    form.reset(
      transaction
        ? {
            type: transaction.type,
            amount: String(transaction.amount),
            category_id: transaction.category_id,
            occurred_on: transaction.occurred_on,
            notes: transaction.notes ?? "",
            payment_method: transaction.payment_method ?? "",
          }
        : {
            type: "expense",
            amount: "",
            category_id: "",
            occurred_on: todayISO(),
            notes: "",
            payment_method: "",
          }
    );
  }

  function handleTypeChange(value: string) {
    const nextType = value as TransactionType;
    form.setValue("type", nextType, { shouldValidate: true });

    // Switching income/expense invalidates a category from the other type.
    const stillValid = categories.some(
      (category) =>
        category.id === form.getValues("category_id") &&
        category.type === nextType
    );
    if (!stillValid) form.setValue("category_id", "");
  }

  function onSubmit(values: TransactionInput) {
    const formData = new FormData();
    if (transaction) formData.set("id", transaction.id);
    formData.set("type", values.type);
    formData.set("amount", values.amount);
    formData.set("category_id", values.category_id);
    formData.set("occurred_on", values.occurred_on);
    formData.set("notes", values.notes ?? "");
    formData.set("payment_method", values.payment_method ?? "");

    startTransition(async () => {
      const result = await (isEdit ? updateTransaction : createTransaction)(
        formData
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Transaction updated" : "Transaction added");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this transaction."
              : "Record a new income or expense."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₱)</Label>
              <Input
                id="amount"
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <Select
              value={selectedCategory}
              onValueChange={(value) =>
                form.setValue("category_id", value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="category_id" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {options.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category_id ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.category_id.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurred_on">Date</Label>
            <Input id="occurred_on" type="date" {...form.register("occurred_on")} />
            {form.formState.errors.occurred_on ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.occurred_on.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment method</Label>
            <Select
              value={selectedPaymentMethod || UNSPECIFIED}
              onValueChange={(value) =>
                form.setValue(
                  "payment_method",
                  value === UNSPECIFIED ? "" : value,
                  { shouldValidate: true }
                )
              }
            >
              <SelectTrigger id="payment_method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSPECIFIED}>Not specified</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Optional"
              {...form.register("notes")}
            />
            {form.formState.errors.notes ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.notes.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
