"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { deleteGoal } from "@/app/dashboard/goals/actions";
import { GoalFormDialog } from "@/components/goal-form";
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
import { Progress } from "@/components/ui/progress";
import { formatDate, formatPHP, todayISO } from "@/lib/format";
import type { SavingsGoal } from "@/lib/types";

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Completion is derived from the amounts, never from the rounded percentage:
  // 9995 of 10000 rounds to 100%, and treating that as complete suppressed the
  // overdue line for a goal that was still short of its target.
  const complete =
    goal.target_amount > 0 && goal.saved_amount >= goal.target_amount;
  const rounded =
    goal.target_amount > 0
      ? Math.round((goal.saved_amount / goal.target_amount) * 100)
      : 0;
  // A short goal must not round up to 100 either, or the label would contradict
  // the card it sits on. Above the target it keeps reporting the true figure --
  // reachable only by a direct write, since the CHECK forbids saved > target.
  const percent = complete ? rounded : Math.min(rounded, 99);
  // The bar never overflows its track; the label is what reports an overshoot.
  const barValue = Math.min(percent, 100);
  const overdue =
    goal.deadline !== null && !complete && goal.deadline < todayISO();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteGoal(goal.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Goal deleted");
      setConfirmOpen(false);
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{goal.name}</p>
          {goal.deadline ? (
            <p
              className={cn(
                "text-sm",
                overdue ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              {overdue ? "Overdue — was due " : "Due "}
              {formatDate(goal.deadline)}
            </p>
          ) : null}
        </div>

        <div className="flex gap-1">
          <GoalFormDialog
            goal={goal}
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
                <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
                <AlertDialogDescription>
                  {goal.name} will be permanently removed, along with the
                  progress recorded against it. This cannot be undone.
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
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {formatPHP(goal.saved_amount)}{" "}
            <span className="text-muted-foreground font-normal">
              of {formatPHP(goal.target_amount)}
            </span>
          </p>
          <p
            className={cn(
              "text-sm tabular-nums",
              complete
                ? "font-medium text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground"
            )}
          >
            {percent}%
          </p>
        </div>

        <Progress
          value={barValue}
          // Radix renders role="progressbar" with no name, so the bar needs one of
          // its own for a reader to say what the percentage is progress toward.
          aria-label={`${goal.name} progress`}
          className={cn(
            "h-2",
            complete && "[&>[data-slot=progress-indicator]]:bg-emerald-600"
          )}
        />
      </div>
    </div>
  );
}

export function GoalList({ goals }: { goals: SavingsGoal[] }) {
  if (goals.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
        No savings goals yet. Add one to start tracking progress toward a
        target.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} />
      ))}
    </div>
  );
}
