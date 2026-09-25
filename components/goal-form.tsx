"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createGoal, updateGoal } from "@/app/dashboard/goals/actions";
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
import type { SavingsGoal } from "@/lib/types";
import { savingsGoalSchema, type SavingsGoalInput } from "@/lib/validations";

type Props = {
  goal?: SavingsGoal;
  trigger: React.ReactNode;
};

// PostgREST hands numeric(12,2) back as a number, so stringify it for the text
// inputs the schema expects. Blank is the right value for both optional boxes:
// no saved amount yet, and no deadline.
function defaults(goal?: SavingsGoal): SavingsGoalInput {
  return {
    name: goal?.name ?? "",
    target_amount: goal ? String(goal.target_amount) : "",
    saved_amount: goal ? String(goal.saved_amount) : "",
    deadline: goal?.deadline ?? "",
  };
}

export function GoalFormDialog({ goal, trigger }: Props) {
  const isEdit = Boolean(goal);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<SavingsGoalInput>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: defaults(goal),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    form.reset(defaults(goal));
  }

  function onSubmit(values: SavingsGoalInput) {
    const formData = new FormData();
    if (goal) formData.set("id", goal.id);
    formData.set("name", values.name);
    formData.set("target_amount", values.target_amount);
    formData.set("saved_amount", values.saved_amount);
    formData.set("deadline", values.deadline);

    startTransition(async () => {
      const result = await (isEdit ? updateGoal : createGoal)(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Goal updated" : "Goal added");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            Set a target amount and track how much of it you have saved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g. Emergency fund"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target (₱)</Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("target_amount")}
              />
              {form.formState.errors.target_amount ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.target_amount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-saved">Saved so far (₱)</Label>
              <Input
                id="goal-saved"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("saved_amount")}
              />
              {form.formState.errors.saved_amount ? (
                <p className="text-destructive text-sm">
                  {form.formState.errors.saved_amount.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-deadline">Deadline</Label>
            <Input
              id="goal-deadline"
              type="date"
              {...form.register("deadline")}
            />
            <p className="text-muted-foreground text-sm">Optional.</p>
            {form.formState.errors.deadline ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.deadline.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
