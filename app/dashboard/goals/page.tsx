import { GoalFormDialog } from "@/components/goal-form";
import { GoalList } from "@/components/goal-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { SavingsGoal } from "@/lib/types";

export default async function GoalsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("savings_goals")
    .select("id, name, target_amount, saved_amount, deadline")
    .order("created_at")
    // Two goals can share a created_at, so order by id as well to keep the list
    // stable between renders.
    .order("id")
    // Deliberately unpaginated — a person has a handful of goals. The explicit
    // limit is still needed: PostgREST caps a response at the project's
    // max-rows, so an unbounded select would truncate silently.
    .limit(200);

  const goals: SavingsGoal[] = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings goals</h1>
          <p className="text-muted-foreground text-sm">
            Track how much of each target you have put aside.
          </p>
        </div>

        <GoalFormDialog trigger={<Button>Add goal</Button>} />
      </div>

      {error ? (
        <p className="text-destructive text-sm">
          Could not load your savings goals. Please refresh the page.
        </p>
      ) : (
        <GoalList goals={goals} />
      )}
    </div>
  );
}
