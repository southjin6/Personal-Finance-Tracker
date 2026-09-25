import { cn } from "cn";

import { Progress } from "@/components/ui/progress";
import { formatPHPFromCents } from "@/lib/format";
import { toCents } from "@/lib/money";
import type { BudgetProgressRow } from "@/lib/types";

// One bar, two weights: the full cards on /dashboard/budgets and the compact
// rows in the overview both render through here, so a limit and the bar under it
// cannot disagree about how much has been spent against it. No "use client" —
// the only thing here that needs the client is Progress, which says so itself.
export function BudgetProgress({
  row,
  variant = "full",
}: {
  row: BudgetProgressRow;
  variant?: "full" | "compact";
}) {
  const compact = variant === "compact";
  const budgetCents = toCents(row.budgetAmount);
  const spentCents = toCents(row.spentAmount);
  const remainingCents = toCents(row.remainingAmount);

  // Overspending is not an error state -- unlike a goal, which cannot be funded
  // past its target (savings_goals_saved_amount_within_target), a budget can be
  // blown and that is worth seeing. So the bar is clamped while the label keeps
  // the true percentage, and the sign of what is left is carried in the text.
  const percent =
    budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0;
  const barValue = Math.min(percent, 100);
  const over = remainingCents < 0;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {formatPHPFromCents(spentCents)}{" "}
          <span className="text-muted-foreground font-normal">
            of {formatPHPFromCents(budgetCents)}
          </span>
        </p>
        <p
          className={cn(
            "tabular-nums",
            compact ? "text-xs" : "text-sm",
            over
              ? "font-medium text-red-600 dark:text-red-500"
              : "text-muted-foreground"
          )}
        >
          {percent}%
        </p>
      </div>

      <Progress
        value={barValue}
        className={cn(
          compact ? "h-1.5" : "h-2",
          over &&
            "[&>[data-slot=progress-indicator]]:bg-red-600 dark:[&>[data-slot=progress-indicator]]:bg-red-500"
        )}
      />

      {/* The compact rows are a glance at the month, so they only spend a line on
          the state that needs attention; a full card always states what is left. */}
      {over || !compact ? (
        <p
          className={cn(
            "text-xs",
            over ? "text-red-600 dark:text-red-500" : "text-muted-foreground"
          )}
        >
          {over
            ? `${formatPHPFromCents(Math.abs(remainingCents))} over budget`
            : `${formatPHPFromCents(remainingCents)} left`}
        </p>
      ) : null}
    </div>
  );
}
